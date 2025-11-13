import { Router, Request, Response, NextFunction } from 'express';
import type { Candle1m, CandleAgg } from '@prisma/client';
import { prisma } from '../db/prisma';
import { parseTimeframe } from '../models/timeframes';

const router = Router();

// GET /api/candles/:symbol/:timeframe
router.get(
  '/:symbol/:timeframe',
  async (
    req: Request<{ symbol: string; timeframe: string }, any, any, { limit?: string }>,
    res: Response,
    next: NextFunction,
  ) => {
  try {
    const { symbol, timeframe: tfStr } = req.params;
    const limit = Number.parseInt(req.query.limit ?? '10000', 10);
    const timeframeMinutes = parseTimeframe(tfStr);

    // Under strict type checking, avoid implicit any by typing the result set
    let data: Candle1m[] | CandleAgg[];
    if (timeframeMinutes === 1) {
      data = await prisma.candle1m.findMany({
        where: { symbol },
        orderBy: { time: 'desc' },
        take: limit,
      });
    } 
    else {
      data = await prisma.candleAgg.findMany({
        where: { symbol, timeframe: timeframeMinutes },
        orderBy: { startTime: 'desc' },
        take: limit,
      });
    }

    const formattedData = data.map((d: any) => ({
      time: (d.time || d.startTime).getTime() / 1000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    })).sort((a, b) => a.time - b.time);

    res.status(200).json({
      symbol,
      timeframe: tfStr,
      data: formattedData,
    });
  } 
  catch (err) {
    next(err);
  }
});

export default router;