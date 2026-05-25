export type TradeType = 'BUY' | 'SELL';
export type TradeSource = 'manual' | 'bot' | 'limit_order' | 'stop_loss' | 'take_profit';

export interface Trade {
    id: string;
    userId: string;
    symbol: string;
    quantity: number;
    price: number;
    totalValue: number;
    type: TradeType;
    source: TradeSource;
    timestamp: Date;
    realizedPL?: number;
    averagePriceAtSale?: number;
    botId?: string;              // Links to StrategyAssistant if auto-executed
}
