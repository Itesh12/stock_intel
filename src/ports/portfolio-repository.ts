import { Portfolio } from "../domain/portfolio";

export interface PortfolioRepository {
    findById(id: string, session?: any): Promise<Portfolio | null>;
    findByUserId(userId: string, session?: any): Promise<Portfolio[]>;
    save(portfolio: Portfolio, session?: any): Promise<void>;
    delete(id: string, session?: any): Promise<void>;
    list(): Promise<Portfolio[]>;
    executeTrade(portfolioId: string, symbol: string, quantity: number, price: number, type: 'BUY' | 'SELL', session?: any): Promise<void>;
}
