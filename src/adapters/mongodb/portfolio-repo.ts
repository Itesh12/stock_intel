import { Db, Collection } from "mongodb";
import { Portfolio } from "../../domain/portfolio";
import { PortfolioRepository } from "../../ports/portfolio-repository";

export class MongoPortfolioRepository implements PortfolioRepository {
    private collection: Collection<Portfolio>;

    constructor(db: Db) {
        this.collection = db.collection<Portfolio>("portfolios");
    }

    async findById(id: string): Promise<Portfolio | null> {
        const doc = await this.collection.findOne({ id } as any);
        return doc ? (doc as unknown as Portfolio) : null;
    }

    async findByUserId(userId: string): Promise<Portfolio[]> {
        const docs = await this.collection.find({ userId } as any).toArray();
        return docs as unknown as Portfolio[];
    }

    async save(portfolio: Portfolio): Promise<void> {
        await this.collection.updateOne(
            { id: portfolio.id } as any,
            { $set: portfolio },
            { upsert: true }
        );
    }

    async delete(id: string): Promise<void> {
        await this.collection.deleteOne({ id } as any);
    }

    async list(): Promise<Portfolio[]> {
        const docs = await this.collection.find().toArray();
        return docs as unknown as Portfolio[];
    }

    async executeTrade(portfolioId: string, symbol: string, quantity: number, price: number, type: 'BUY' | 'SELL'): Promise<void> {
        const portfolio = await this.findById(portfolioId);
        if (!portfolio) throw new Error("Portfolio not found");

        const totalValue = price * quantity;

        if (type === 'BUY') {
            if (portfolio.cashBalance < totalValue) throw new Error("Insufficient funds");

            const holdingIndex = portfolio.holdings.findIndex(h => h.symbol === symbol);
            if (holdingIndex >= 0) {
                const existing = portfolio.holdings[holdingIndex];
                const newQty = existing.quantity + quantity;
                const newAvg = (existing.averagePrice * existing.quantity + totalValue) / newQty;

                portfolio.holdings[holdingIndex] = {
                    ...existing,
                    quantity: newQty,
                    averagePrice: newAvg,
                    currentPrice: price,
                    marketValue: newQty * price,
                    unrealizedPL: (price - newAvg) * newQty,
                    unrealizedPLPercent: ((price - newAvg) / newAvg) * 100
                };
            } else {
                portfolio.holdings.push({
                    id: Math.random().toString(36).substring(7),
                    symbol,
                    quantity,
                    averagePrice: price,
                    currentPrice: price,
                    marketValue: totalValue,
                    unrealizedPL: 0,
                    unrealizedPLPercent: 0,
                    sector: "Auto-Assigned",
                    weight: 0
                });
            }
            portfolio.cashBalance -= totalValue;
        } else {
            const holdingIndex = portfolio.holdings.findIndex(h => h.symbol === symbol);
            if (holdingIndex < 0 || portfolio.holdings[holdingIndex].quantity < quantity) {
                throw new Error("Insufficient holdings");
            }

            const existing = portfolio.holdings[holdingIndex];
            if (existing.quantity === quantity) {
                portfolio.holdings.splice(holdingIndex, 1);
            } else {
                existing.quantity -= quantity;
                existing.currentPrice = price;
                existing.marketValue = existing.quantity * price;
                existing.unrealizedPL = (price - existing.averagePrice) * existing.quantity;
                existing.unrealizedPLPercent = ((price - existing.averagePrice) / existing.averagePrice) * 100;
            }
            portfolio.cashBalance += totalValue;
        }

        portfolio.totalValue = portfolio.cashBalance + portfolio.holdings.reduce((sum, h) => sum + h.marketValue, 0);
        portfolio.updatedAt = new Date();

        await this.save(portfolio);
    }
}
