import { Pool } from "pg";
import { Portfolio, Holding } from "../../domain/portfolio";
import { PortfolioRepository } from "../../ports/portfolio-repository";

export class PostgresPortfolioRepository implements PortfolioRepository {
    constructor(private pool: Pool) { }

    async findById(id: string): Promise<Portfolio | null> {
        const result = await this.pool.query("SELECT * FROM portfolios WHERE id = $1", [id]);
        if (result.rows.length === 0) return null;
        return this.mapToDomain(result.rows[0]);
    }

    async findByUserId(userId: string): Promise<Portfolio[]> {
        const result = await this.pool.query("SELECT * FROM portfolios WHERE user_id = $1", [userId]);
        return result.rows.map(row => this.mapToDomain(row));
    }

    async save(portfolio: Portfolio): Promise<void> {
        const {
            id, userId, name, holdings, totalValue, totalPL, totalPLPercent, cashBalance, riskScore, sectorExposure, updatedAt, createdAt
        } = portfolio;

        await this.pool.query(
            `INSERT INTO portfolios (id, user_id, name, holdings, total_value, total_pl, total_pl_percent, cash_balance, risk_score, sector_exposure, updated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
       user_id = $2, name = $3, holdings = $4, total_value = $5, total_pl = $6, total_pl_percent = $7, cash_balance = $8, risk_score = $9, sector_exposure = $10, updated_at = $11`,
            [id, userId, name, JSON.stringify(holdings), totalValue, totalPL, totalPLPercent, cashBalance, riskScore, JSON.stringify(sectorExposure), updatedAt, createdAt]
        );
    }

    async delete(id: string): Promise<void> {
        await this.pool.query("DELETE FROM portfolios WHERE id = $1", [id]);
    }

    async list(): Promise<Portfolio[]> {
        const result = await this.pool.query("SELECT * FROM portfolios");
        return result.rows.map(row => this.mapToDomain(row));
    }

    private mapToDomain(row: any): Portfolio {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            holdings: row.holdings as Holding[],
            totalValue: Number(row.total_value),
            totalPL: Number(row.total_pl),
            totalPLPercent: Number(row.total_pl_percent),
            cashBalance: Number(row.cash_balance),
            riskScore: Number(row.risk_score),
            sectorExposure: row.sector_exposure,
            updatedAt: new Date(row.updated_at),
            createdAt: new Date(row.created_at),
        };
    }
}
