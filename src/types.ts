export interface Candle {
    symbol: string;
    startTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface AggregatedCandle {
    symbol: string;
    timeframe: number; // minutes
    startTime: number; // epoch seconds at start of bucket
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface CandleSubscriptionMessage {
    type: 'candle';
    timeframe: string; // e.g. '1m','5m'
    candle: Candle | AggregatedCandle;
}

export interface PriceTickMessage {
    type: 'tick';
    symbol: string;
    price: number;
    timestamp: number; // epoch seconds
}

export type OutboundSocketMessage = CandleSubscriptionMessage | PriceTickMessage;