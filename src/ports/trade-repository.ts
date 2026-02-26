import { Trade } from "../domain/trade";

export interface TradeRepository {
    save(trade: Trade): Promise<void>;
    findByUserId(userId: string): Promise<Trade[]>;
    deleteByUserId(userId: string): Promise<void>;
}
