import { Router } from 'express';
import candleRouter from './candle.routes';
import aggregateRouter from './aggregate.routes';

const router = Router();

router.use('/candles', candleRouter);
router.use('/aggregate', aggregateRouter);

export default router;