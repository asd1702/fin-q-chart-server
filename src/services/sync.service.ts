import axios from 'axios';
import config from '../config/index';
import { prisma } from '../db/prisma';
import { buildAggregations } from '../processing/aggregation'; // 집계 함수 임포트
import { AGG_TIMEFRAMES } from '../models/timeframes'; // 타임프레임 목록 임포트

const SYMBOLS = process.env.STREAM_SYMBOLS?.split(',') || ['SPY', 'QQQ', 'DIA', 'BTC/USD'];

export async function syncMissingData() {
  console.log('[Sync] 데이터 정합성 검사 및 백필 시작...');

  for (const symbol of SYMBOLS) {
    try {
      // 1. DB에서 해당 심볼의 가장 마지막 1분봉 시간을 조회
      const lastCandle = await prisma.candle1m.findFirst({
        where: { symbol },
        orderBy: { time: 'desc' },
      });

      if (!lastCandle) {
        console.log(`[Sync] ${symbol} 데이터가 없음. 초기 시딩 필요.`);
        continue; 
      }

      const lastTime = lastCandle.time.getTime();
      const currentTime = Date.now();
      // 마지막 데이터와 현재 시간의 차이 (분)
      const diffMinutes = (currentTime - lastTime) / (1000 * 60);

      // 2. 2분 이상 차이가 나면 비어있는 것으로 간주하고 REST API 요청
      if (diffMinutes > 2) {
        console.log(`[Sync] ${symbol}: ${Math.floor(diffMinutes)}분 데이터 누락됨. 복구 시도...`);
        
        const startDate = new Date(lastTime + 60000); // 마지막 시간 + 1분
        const endDate = new Date(); // 현재

        const response = await axios.get('https://api.twelvedata.com/time_series', {
          params: {
            symbol: symbol,
            interval: '1min',
            apikey: config.TWELVE_DATA_API_KEY,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            outputsize: 5000,
            order: 'ASC' // 과거 -> 현재 순
          },
        });

        if (response.data.status === 'error') {
            console.error(`[Sync] API Error (${symbol}):`, response.data.message);
            continue;
        }

        const candles = response.data.values;
        if (candles && candles.length > 0) {
            // 3. 1분 봉 저장
            await prisma.candle1m.createMany({
                data: candles.map((c: any) => ({
                    symbol: symbol,
                    time: new Date(c.datetime),
                    open: parseFloat(c.open),
                    high: parseFloat(c.high),
                    low: parseFloat(c.low),
                    close: parseFloat(c.close),
                    volume: parseInt(c.volume) || 0,
                })),
                skipDuplicates: true,
            });
            console.log(`[Sync] ${symbol}: ${candles.length}개 1분 캔들 복구 완료.`);
            
            const startEpoch = Math.floor(startDate.getTime() / 1000);
            const endEpoch = Math.floor(endDate.getTime() / 1000) + 60; // 여유 있게 +1분

            console.log(`[Sync] ${symbol}: 상위 봉 집계 시작...`);
            for (const tf of AGG_TIMEFRAMES) {
                const count = await buildAggregations(symbol, tf, startEpoch, endEpoch);
                console.log(`   -> ${tf}분 봉 ${count}개 생성 완료`);
            }

        } else {
            console.log(`ℹ[Sync] ${symbol}: 가져올 데이터가 없습니다.`);
        }
      } else {
        console.log(`[Sync] ${symbol}: 최신 상태입니다.`);
      }

    } catch (error) {
      console.error(`[Sync] ${symbol} 동기화 실패:`, error);
    }
  }
  console.log('[Sync] 모든 데이터 동기화 작업 완료.');
}