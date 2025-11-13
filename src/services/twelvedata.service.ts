import config from '../config/index';
import WebSocket from 'ws';
import { CandleMaker } from '../candleMaker';
import { prisma } from '../prisma';
import { updateAggregationsFrom1m } from '../aggregation';
import { timeframeToString } from '../timeframes';
import { broadcast } from './websocket.service';

const symbols = process.env.STREAM_SYMBOLS?.split(',') || ['SPY', 'QQQ', 'DIA', 'BTC/USD'];
const candleMakers = new Map<string, CandleMaker>();
symbols.forEach(s => candleMakers.set(s, new CandleMaker()));

export function connectToTwelveData() {
  console.log('📡 [Twelve Data] WebSocket 연결 시도...');
  const tdWs = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${config.TWELVE_DATA_API_KEY}`);

  tdWs.on('open', () => {
    console.log('✅ [Twelve Data] WebSocket 연결 성공.');
    tdWs.send(JSON.stringify({
      action: 'subscribe',
      params: { symbols: symbols.join(',') },
    }));
  });

  tdWs.on('message', async (data: WebSocket.RawData) => {
    try {
      const text = typeof data === 'string' ? data : data.toString();
      const message = JSON.parse(text);

      if (message.event === 'price' && message.symbol && message.price && message.timestamp) {
        const { symbol, price, timestamp } = message;

        // 1. 프론트엔드로 'tick' 브로드캐스트
        broadcast({ type: 'tick', symbol, price, timestamp });

        // 2. 1분봉 조립
        const maker = candleMakers.get(symbol);
        if (!maker) return;

        const completedCandle = maker.update(symbol, price, 0, timestamp);
        
        if (completedCandle) {
          // 3. 1분봉 DB 저장
          await prisma.candle1m.create({
            data: {
              symbol: completedCandle.symbol,
              time: new Date(completedCandle.startTime * 1000),
              open: completedCandle.open,
              high: completedCandle.high,
              low: completedCandle.low,
              close: completedCandle.close,
              volume: completedCandle.volume,
            },
          });

          // 4. 프론트엔드로 '1m' 캔들 브로드캐스트
          broadcast({ type: 'candle', timeframe: '1m', candle: completedCandle });
          console.log(`[${symbol}] 1분봉 완성: ${new Date(completedCandle.startTime * 1000).toISOString()}`);

          // 5. 상위 타임프레임 집계 및 브로드캐스트
          const aggregatedCandles = await updateAggregationsFrom1m(completedCandle);
          for (const aggCandle of aggregatedCandles) {
            const tfStr = timeframeToString(aggCandle.timeframe);
            broadcast({ type: 'candle', timeframe: tfStr, candle: aggCandle });
            console.log(`[${symbol}] ${tfStr} 집계봉 완성: ${new Date(aggCandle.startTime * 1000).toISOString()}`);
          }
        }
      }
    } catch (err) {
      console.error('[Twelve Data] 메시지 처리 중 오류:', err);
    }
  });

  tdWs.on('error', (err) => {
    console.error('❌ [Twelve Data] WebSocket 오류:', err.message);
  });

  tdWs.on('close', (code) => {
    console.warn(`[Twelve Data] WebSocket 연결 종료 (Code: ${code}). 5초 후 재연결...`);
    setTimeout(connectToTwelveData, 5000); // 재연결
  });
}