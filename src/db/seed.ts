import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_KEY = process.env.TWELVE_DATA_API_KEY;
const SYMBOLS = ['QQQ', 'SPY', 'DIA', 'BTC/USD'];
const TARGET_DATE = new Date('2025-01-01').getTime();

async function fetchAndSaveHistory(symbol: string) {
  let endDate: string | undefined = undefined;
  let totalSaved = 0;

  console.log(`🚀 [${symbol}] 2025년 이후 데이터 대량 수집 시작...`);

  while (true) {
    try {
      const response: any = await axios.get('https://api.twelvedata.com/time_series', {
        params: {
          symbol: symbol,
          interval: '1min',
          outputsize: 5000,
          apikey: API_KEY,
          end_date: endDate,
          order: 'DESC',
        },
      });

      if (response.data.status === 'error') {
        console.error(`[${symbol}] API Error: ${response.data.message}`);
        break;
      }

      const candles: any[] = response.data.values;
      if (!candles || candles.length === 0) {
        console.log(`🏁 [${symbol}] 더 이상 데이터가 없습니다.`);
        break;
      }

      const validCandles: any[] = candles.filter((c: any) =>
        c.datetime && c.open && c.high && c.low && c.close
      );

      if (validCandles.length === 0) break;

      await prisma.candle1m.createMany({
        data: validCandles.map((c: any) => ({
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

      totalSaved += validCandles.length;
      const oldestCandleTime = new Date(validCandles[validCandles.length - 1].datetime);
      endDate = validCandles[validCandles.length - 1].datetime;

      console.log(`[${symbol}] ${validCandles.length}개 저장 완료 (누적: ${totalSaved}개, 현재 도달 시점: ${endDate})`);

      if (oldestCandleTime.getTime() < TARGET_DATE) {
        console.log(`[${symbol}] 목표 날짜(2020-01-01) 도달! 수집 종료.`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`[${symbol}] 요청 중 에러 발생:`, error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function main() {
  for (const symbol of SYMBOLS) {
    await fetchAndSaveHistory(symbol);
  }
  console.log('모든 종목 데이터 시딩 완료!');
  await prisma.$disconnect();
}

main();
