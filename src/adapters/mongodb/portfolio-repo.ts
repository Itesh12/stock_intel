import { Db, Collection, ClientSession } from "mongodb";
import { Portfolio } from "../../domain/portfolio";
import { PortfolioRepository } from "../../ports/portfolio-repository";

export class MongoPortfolioRepository implements PortfolioRepository {
    private collection: Collection<Portfolio>;

    constructor(db: Db) {
        this.collection = db.collection<Portfolio>("portfolios");
        // Ensure index for performance and unique constraint to prevent duplicate portfolio creations
        this.collection.createIndex({ userId: 1 }, { unique: true }).catch(err => {
            console.error("[MongoPortfolioRepository] Failed to create unique index on userId:", err);
        });
    }

    async findById(id: string, session?: ClientSession): Promise<Portfolio | null> {
        const doc = await this.collection.findOne({ id } as any, { session });
        return doc ? this.map(doc) : null;
    }

    async findByUserId(userId: string, session?: ClientSession): Promise<Portfolio[]> {
        const docs = await this.collection.find({ userId } as any, { session }).toArray();
        return docs.map(d => this.map(d));
    }

    private map(doc: any): Portfolio {
        return {
            id: doc.id,
            userId: doc.userId,
            name: doc.name,
            holdings: doc.holdings || [],
            totalValue: doc.totalValue || 0,
            totalPL: doc.totalPL || 0,
            totalPLPercent: doc.totalPLPercent || 0,
            dayPnL: doc.dayPnL || 0,
            dayPnLPercent: doc.dayPnLPercent || 0,
            cashBalance: doc.cashBalance || 0,
            reservedCash: doc.reservedCash !== undefined ? doc.reservedCash : 0,
            riskScore: doc.riskScore || 0,
            sectorExposure: doc.sectorExposure || {},
            profitFactor: doc.profitFactor,
            winRate: doc.winRate,
            avgWin: doc.avgWin,
            avgLoss: doc.avgLoss,
            maxDrawdown: doc.maxDrawdown,
            performanceHistory: doc.performanceHistory || [],
            version: doc.version,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }

    async save(portfolio: Portfolio, session?: ClientSession): Promise<void> {
        const currentVersion = portfolio.version || 0;
        const nextVersion = currentVersion + 1;

        const filter: any = { id: portfolio.id };
        if (currentVersion > 0) {
            filter.version = currentVersion;
        }

        const result = await this.collection.updateOne(
            filter,
            { 
                $set: { 
                    ...portfolio, 
                    version: nextVersion 
                } 
            },
            { upsert: currentVersion === 0, session }
        );

        if (result.matchedCount === 0 && currentVersion > 0) {
            throw new Error("VersionConflictError: Portfolio document was modified concurrently.");
        }

        portfolio.version = nextVersion;
    }

    async delete(id: string, session?: ClientSession): Promise<void> {
        await this.collection.deleteOne({ id } as any, { session });
    }

    async list(): Promise<Portfolio[]> {
        const docs = await this.collection.find().toArray();
        return docs.map(d => this.map(d));
    }

    async executeTrade(
        portfolioId: string, 
        symbol: string, 
        quantity: number, 
        price: number, 
        type: 'BUY' | 'SELL',
        session?: ClientSession,
        botId?: string
    ): Promise<void> {
        const portfolio = await this.findById(portfolioId, session);
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
                    unrealizedPLPercent: ((price - newAvg) / newAvg) * 100,
                    botId: botId || existing.botId
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
                    weight: 0,
                    botId
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

        await this.save(portfolio, session);
    }
}
