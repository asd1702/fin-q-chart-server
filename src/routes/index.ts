import { Router } from 'express';
import candleRouter from './candle.routes.js';
import aggregateRouter from './aggregate.routes.js';

const router = Router();

router.use('/candles', candleRouter);
router.use('/aggregate', aggregateRouter);

export default router;