import axios from 'axios';
import config from '../config/index';
import { prisma } from '../db/prisma';
import { buildAggregations } from '../processing/aggregation';
import { AGG_TIMEFRAMES } from '../models/timeframes';

const SYMBOLS = process.env.STREAM_SYMBOLS?.split(',') || ['BTC/USD'];

async function fillGaps() {
  console.log('🕵️ [GapFiller] 데이터 누락 구간 탐색 및 복구 시작...');

  for (const symbol of SYMBOLS) {
    console.log(`\n🔍 [${symbol}] 누락 구간 분석 중...`);

    // 1. 갭 찾기 (1분 5초 이상 차이 나는 구간)
    const gaps: any[] = await prisma.$queryRaw`
      SELECT 
        time as "gapStart", 
        next_time as "gapEnd",
        EXTRACT(EPOCH FROM (next_time - time)) / 60 as "missingMinutes"
      FROM (
        SELECT time, LEAD(time) OVER (ORDER BY time) AS next_time
        FROM "Candle1m"
        WHERE symbol = ${symbol}
      ) t
      WHERE next_time - time > interval '1 minute 5 seconds'
      ORDER BY time DESC
    `;

    if (gaps.length === 0) {
      console.log(`✅ [${symbol}] 누락된 구간이 없습니다. 완벽합니다!`);
      continue;
    }

    console.log(`⚠️ [${symbol}] 총 ${gaps.length}개의 누락 구간 발견.`);

    for (const gap of gaps) {
      const start = new Date(gap.gapStart); // 갭 직전 캔들 시간
      const end = new Date(gap.gapEnd);     // 갭 직후 캔들 시간
      const missingMins = Math.floor(gap.missingMinutes);

      console.log(`   🛠️ 복구 시도: ${start.toISOString()} ~ ${end.toISOString()} (${missingMins}분 누락)`);

      let filledCount = 0;

      // 2. API 데이터 요청 시도
      try {
        const response = await axios.get('https://api.twelvedata.com/time_series', {
          params: {
            symbol: symbol,
            interval: '1min',
            apikey: config.TWELVE_DATA_API_KEY,
            start_date: new Date(start.getTime() + 60000).toISOString(),
            end_date: new Date(end.getTime() - 1000).toISOString(),
            outputsize: 5000,
            order: 'ASC'
          },
        });

        // API 에러 처리
        if (response.data.status === 'error') {
          console.error(`      ❌ API Error: ${response.data.message}`);
          if (response.data.code === 429) {
             console.log('      ⏳ 1분 대기...');
             await new Promise(r => setTimeout(r, 60000));
          }
          // API 에러라도 아래 "가짜 채우기" 로직으로 넘어가기 위해 continue 하지 않음
        } else {
          const candles = response.data.values;
          if (candles && candles.length > 0) {
            // 정상 데이터 저장
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
            filledCount = candles.length;
            console.log(`      ✅ API 데이터 ${filledCount}개 저장 완료.`);
          }
        }
      } catch (err) {
        console.error('      ❌ 요청 중 에러:', err);
      }

      // -------------------------------------------------------
      // 🔥 [핵심] API가 데이터를 안 줬다면? -> "가짜 캔들"로 강제 메꾸기
      // -------------------------------------------------------
      if (filledCount === 0) {
        console.log('      ℹ️ API 데이터 없음. 이전 종가로 "강제 메꾸기" 실행...');

        // 직전 캔들의 '종가' 가져오기 (갭의 시작점인 start 시간이 곧 직전 캔들임)
        const lastCandle = await prisma.candle1m.findUnique({
            where: { time_symbol: { time: start, symbol } }
        });

        if (lastCandle) {
            const dummyCandles = [];
            // start + 1분부터 ~ end 직전까지 루프
            let curr = start.getTime() + 60000;
            const endTime = end.getTime();

            while(curr < endTime) {
                dummyCandles.push({
                    symbol,
                    time: new Date(curr),
                    open: lastCandle.close,
                    high: lastCandle.close,
                    low: lastCandle.close,
                    close: lastCandle.close, // 이전 종가 유지 (ㅡ자 캔들)
                    volume: 0                // 거래량 0
                });
                curr += 60000; // 1분 증가
            }

            if (dummyCandles.length > 0) {
                await prisma.candle1m.createMany({
                    data: dummyCandles,
                    skipDuplicates: true
                });
                console.log(`      ✨ 가짜 캔들(Volume 0) ${dummyCandles.length}개로 방어 성공!`);
                filledCount = dummyCandles.length;
            }
        }
      }

      // 3. 데이터가 채워졌다면(진짜든 가짜든) -> 상위 봉 재집계
      if (filledCount > 0) {
         const startEpoch = Math.floor(start.getTime() / 1000);
         const endEpoch = Math.floor(end.getTime() / 1000) + 60; 
         for (const tf of AGG_TIMEFRAMES) {
            await buildAggregations(symbol, tf, startEpoch, endEpoch);
         }
      }

      // API 속도 조절
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log('\n🎉 모든 복구 작업이 완료되었습니다.');
}

fillGaps()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });