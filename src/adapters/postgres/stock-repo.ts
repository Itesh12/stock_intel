import { Pool } from "pg";
import { Stock } from "../../domain/stock";
import { StockRepository } from "../../ports/stock-repository";

export class PostgresStockRepository implements StockRepository {
    constructor(private pool: Pool) { }

    async findById(id: string): Promise<Stock | null> {
        const result = await this.pool.query(
            "SELECT * FROM stocks WHERE id = $1",
            [id]
        );
        if (result.rows.length === 0) return null;
        return this.mapToDomain(result.rows[0]);
    }

    async findBySymbol(symbol: string): Promise<Stock | null> {
        const result = await this.pool.query(
            "SELECT * FROM stocks WHERE symbol = $1",
            [symbol]
        );
        if (result.rows.length === 0) return null;
        return this.mapToDomain(result.rows[0]);
    }

    async save(stock: Stock): Promise<void> {
        const {
            id, symbol, name, sector, marketCap, price, change, changePercent, lastUpdated, createdAt
        } = stock;

        await this.pool.query(
            `INSERT INTO stocks (id, symbol, name, sector, market_cap, price, change, change_percent, last_updated, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
       symbol = $2, name = $3, sector = $4, market_cap = $5, price = $6, change = $7, change_percent = $8, last_updated = $9`,
            [id, symbol, name, sector, marketCap, price, change, changePercent, lastUpdated, createdAt]
        );
    }

    async list(): Promise<Stock[]> {
        const result = await this.pool.query("SELECT * FROM stocks");
        return result.rows.map(row => this.mapToDomain(row));
    }

    async delete(id: string): Promise<void> {
        await this.pool.query("DELETE FROM stocks WHERE id = $1", [id]);
    }

    private mapToDomain(row: any): Stock {
        return {
            id: row.id,
            symbol: row.symbol,
            name: row.name,
            sector: row.sector,
            marketCap: Number(row.market_cap),
            price: Number(row.price),
            change: Number(row.change),
            changePercent: Number(row.change_percent),
            lastUpdated: new Date(row.last_updated),
            createdAt: new Date(row.created_at),
        };
    }
}
