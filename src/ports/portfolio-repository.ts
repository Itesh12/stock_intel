import { Portfolio } from "../domain/portfolio";

export interface PortfolioRepository {
    findById(id: string): Promise<Portfolio | null>;
    findByUserId(userId: string): Promise<Portfolio[]>;
    save(portfolio: Portfolio): Promise<void>;
    list(): Promise<Portfolio[]>;
}
