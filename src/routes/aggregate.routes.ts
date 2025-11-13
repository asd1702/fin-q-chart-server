import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { parseTimeframe } from '../timeframes';
import { buildAggregations } from '../aggregation';

const router = Router();

type BuildBody = {
    symbol: string;
    timeframe: string; // e.g. '5m', '1h'
    from?: string | number; // ISO string or epoch seconds
    to?: string | number;   // ISO string or epoch seconds
};

router.post(
    '/build',
    async (
        req: Request<{}, any, BuildBody>,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const { symbol, timeframe: tfStr, from, to } = req.body;
            if (!symbol || !tfStr) {
                return res.status(400).json({ error: 'symbol과 timeframe이 필요합니다.' });
            }

            const timeframeMinutes = parseTimeframe(tfStr);

            const toEpochSec = (v: unknown): number | undefined => {
                if (v === undefined || v === null) return undefined;
                if (typeof v === 'number') return Math.floor(v);
                if (typeof v === 'string') {
                    if (/^\d+$/.test(v)) return Math.floor(Number(v));
                    const ms = Date.parse(v);
                    if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
                }
                return undefined;
            };

            let startEpochSec = toEpochSec(from);
            let endEpochSec = toEpochSec(to);

            if (!startEpochSec || !endEpochSec) {
                const boundary = await prisma.candle1m.aggregate({
                    where: { symbol },
                    _min: { time: true },
                    _max: { time: true },
                });
                if (!startEpochSec)
                    startEpochSec = (boundary._min.time?.getTime() || 0) / 1000;
                if (!endEpochSec)
                    endEpochSec = ((boundary._max.time?.getTime() || Date.now()) / 1000) + 60;
            }

            if (!startEpochSec || !endEpochSec) {
                return res.status(400).json({ error: '유효한 데이터 범위를 찾을 수 없습니다.' });
            }

            const created = await buildAggregations(symbol, timeframeMinutes, startEpochSec, endEpochSec);
            return res.status(200).json({ symbol, timeframe: tfStr, created, from: startEpochSec, to: endEpochSec });
        } catch (err) {
            next(err);
        }
    },
);

export default router;