import { Trade } from "../domain/trade";

export interface TradeRepository {
    save(trade: Trade, session?: any): Promise<void>;
    findByUserId(userId: string): Promise<Trade[]>;
    deleteByUserId(userId: string): Promise<void>;
}
