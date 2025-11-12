import { Candle } from './types';

export class CandleMaker {
    private currentCandle: Candle | null = null;

    public update(symbol: string, price: number, volume: number = 0, timestamp: number) {
        const candleStartTime = Math.floor(timestamp / 60) * 60;

        if(!this.currentCandle || this.currentCandle.startTime !== candleStartTime) {
            const completedCandle = this.currentCandle;
            
            this.currentCandle = {
                symbol,
                startTime: candleStartTime,
                open: price,
                high: price,
                low: price,
                close: price,
                volume: volume,
            };

            return completedCandle;
        }

        if(this.currentCandle){
            this.currentCandle.high = Math.max(this.currentCandle.high, price);
            this.currentCandle.low = Math.min(this.currentCandle.low, price);
            this.currentCandle.close = price;
            this.currentCandle.volume += volume;
        }
        return null;
    }
    public getCurrentCandle(): Candle | null {
        return this.currentCandle;
    }
}