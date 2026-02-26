export type TradeType = 'BUY' | 'SELL';

export interface Trade {
    id: string;
    userId: string;
    symbol: string;
    quantity: number;
    price: number;
    totalValue: number;
    type: TradeType;
    timestamp: Date;
}
