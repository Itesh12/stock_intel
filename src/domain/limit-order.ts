export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED' | 'TRIGGERED';
export type OrderType = 'BUY' | 'SELL' | 'STOP_LOSS' | 'TAKE_PROFIT';

export interface LimitOrder {
    id: string;
    userId: string;
    symbol: string;
    quantity: number;
    targetPrice: number; // For SL/TP, this is the trigger price
    type: OrderType;
    status: OrderStatus;
    timestamp: Date;
    executedPrice?: number;
    executedAt?: Date;
    strategyId?: string; // Link to a scanner signal
    parentOrderId?: string; // For attached SL/TP
}

export interface LimitOrderRepository {
    save(order: LimitOrder): Promise<void>;
    findById(id: string): Promise<LimitOrder | null>;
    findByUserId(userId: string): Promise<LimitOrder[]>;
    findPendingBySymbol(symbol: string): Promise<LimitOrder[]>;
    findPending(): Promise<LimitOrder[]>;
    updateStatus(id: string, status: OrderStatus, executedPrice?: number): Promise<void>;
}
