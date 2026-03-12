import { Portfolio } from "../domain/portfolio";

export interface PortfolioRepository {
    findById(id: string): Promise<Portfolio | null>;
    findByUserId(userId: string): Promise<Portfolio[]>;
    save(portfolio: Portfolio): Promise<void>;
    list(): Promise<Portfolio[]>;
    executeTrade(portfolioId: string, symbol: string, quantity: number, price: number, type: 'BUY' | 'SELL'): Promise<void>;
}
