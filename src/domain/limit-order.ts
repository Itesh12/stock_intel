export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';

export interface LimitOrder {
    id: string;
    userId: string;
    symbol: string;
    quantity: number;
    targetPrice: number;
    type: 'BUY' | 'SELL';
    status: OrderStatus;
    timestamp: Date;
    executedPrice?: number;
    executedAt?: Date;
}

export interface LimitOrderRepository {
    save(order: LimitOrder): Promise<void>;
    findById(id: string): Promise<LimitOrder | null>;
    findByUserId(userId: string): Promise<LimitOrder[]>;
    findPendingBySymbol(symbol: string): Promise<LimitOrder[]>;
    findPending(): Promise<LimitOrder[]>;
    updateStatus(id: string, status: OrderStatus, executedPrice?: number): Promise<void>;
}
