import { prisma } from '../db/prisma';
import { AggregatedCandle, Candle } from '../models/types';
import { AGG_TIMEFRAMES } from '../models/timeframes';

// Build aggregated candle incrementally when a 1m candle completes.
export async function updateAggregationsFrom1m(candle: Candle): Promise<AggregatedCandle[]> {
  const results: AggregatedCandle[] = [];
  const baseStart = candle.startTime; // epoch seconds (aligned to minute)
  for (const tf of AGG_TIMEFRAMES) {
    if (isCandleStartOfTimeframe(baseStart, tf)) {
      // compute timeframe window start
      const windowStart = baseStart - (tf - 1) * 60; // inclusive start of first minute in window
      const windowEnd = baseStart + 60; // exclusive end (next minute)
      const startDate = new Date(windowStart * 1000);
      const endDate = new Date(windowEnd * 1000);
      const rows = await prisma.candle1m.findMany({
        where: { symbol: candle.symbol, time: { gte: startDate, lt: endDate } },
        orderBy: { time: 'asc' },
      });
      if (!rows.length) continue;
      const first = rows[0]!;
      const last = rows[rows.length - 1]!;
      const agg: AggregatedCandle = {
        symbol: candle.symbol,
        timeframe: tf,
        startTime: windowStart,
        open: first.open,
        high: Math.max(...rows.map(r => r.high)),
        low: Math.min(...rows.map(r => r.low)),
        close: last.close,
        volume: rows.reduce((sum, r) => sum + r.volume, 0),
      };
      const db: any = prisma as any;
      await db.candleAgg.upsert({
        where: { startTime_symbol_timeframe: { startTime: new Date(windowStart * 1000), symbol: candle.symbol, timeframe: tf } },
        update: { open: agg.open, high: agg.high, low: agg.low, close: agg.close, volume: agg.volume },
        create: { startTime: new Date(windowStart * 1000), symbol: candle.symbol, timeframe: tf, open: agg.open, high: agg.high, low: agg.low, close: agg.close, volume: agg.volume },
      });
      results.push(agg);
    }
  }
  return results;
}

// Historical build for a symbol/timeframe between start and end epoch seconds (exclusive end)
export async function buildAggregations(symbol: string, timeframe: number, startEpochSec: number, endEpochSec: number): Promise<number> {
  // Align start to timeframe boundary
  startEpochSec = alignToTimeframe(startEpochSec, timeframe);
  let created = 0;
  for (let bucketStart = startEpochSec; bucketStart < endEpochSec; bucketStart += timeframe * 60) {
    const bucketEnd = bucketStart + timeframe * 60;
    const rows = await prisma.candle1m.findMany({
      where: { symbol, time: { gte: new Date(bucketStart * 1000), lt: new Date(bucketEnd * 1000) } },
      orderBy: { time: 'asc' },
    });
    if (!rows.length) continue;
    const first = rows[0]!;
    const last = rows[rows.length - 1]!;
    const agg = {
      startTime: new Date(bucketStart * 1000),
      symbol,
      timeframe,
      open: first.open,
      high: Math.max(...rows.map(r => r.high)),
      low: Math.min(...rows.map(r => r.low)),
      close: last.close,
      volume: rows.reduce((sum, r) => sum + r.volume, 0),
    };
    const db: any = prisma as any;
    await db.candleAgg.upsert({
      where: { startTime_symbol_timeframe: { startTime: agg.startTime, symbol: symbol, timeframe } },
      update: { open: agg.open, high: agg.high, low: agg.low, close: agg.close, volume: agg.volume },
      create: agg,
    });
    created++;
  }
  return created;
}

function isCandleStartOfTimeframe(minuteStartEpoch: number, timeframeMinutes: number): boolean {
  // minuteStartEpoch always aligned to minute; check if end of timeframe window
  // We treat "completion" at the last minute of the bucket, so bucket start is minuteStartEpoch - (timeframeMinutes-1)*60
  const endMinuteIndex = minuteStartEpoch / 60; // minute count since epoch
  return (endMinuteIndex + 1) % timeframeMinutes === 0; // after adding this minute, timeframe completes
}

function alignToTimeframe(epochSec: number, timeframeMinutes: number): number {
  const minuteIndex = Math.floor(epochSec / 60);
  const alignedEndMinuteIndex = Math.ceil(minuteIndex / timeframeMinutes) * timeframeMinutes; // first bucket end >= epoch
  return (alignedEndMinuteIndex - timeframeMinutes) * 60; // bucket start
}