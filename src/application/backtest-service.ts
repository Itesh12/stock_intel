import { IInfrastructure } from "./contracts/infrastructure";
import { BacktestResult, BacktestSnapshot, BacktestTrade } from "../domain/backtest";
import { v4 as uuidv4 } from "uuid";

export class BacktestService {
    constructor(private infra: IInfrastructure) {}

    async runSimpleBacktest(
        userId: string,
        symbol: string,
        initialCapital: number,
        days: number = 365
    ): Promise<BacktestResult> {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        
        const history = await this.infra.market.getHistoricalData(symbol, 'all', fromDate);
        
        if (history.length === 0) {
            throw new Error(`No historical data found for ${symbol}`);
        }

        let cash = initialCapital;
        let holdings = 0;
        let avgCost = 0;
        let grossWins = 0;
        let grossLosses = 0;
        let winsCount = 0;
        let lossesCount = 0;
        const trades: BacktestTrade[] = [];
        const equityCurve: BacktestSnapshot[] = [];

        // Simple Mean Reversion Strategy Logic (Example)
        // Buy if price is 5% below moving average (20-day)
        // Sell if price is 5% above moving average
        
        const window = 20;
        for (let i = 0; i < history.length; i++) {
            const current = history[i];
            const price = current.close;
            const date = new Date(current.date);

            // Calculate SMA
            if (i >= window) {
                const slice = history.slice(i - window, i);
                const sma = slice.reduce((sum, h) => sum + h.close, 0) / window;
                
                // Strategy Signals
                if (price < sma * 0.95 && cash > price) {
                    // BUY SIGNAL
                    const qty = Math.floor((cash * 0.95) / price);
                    if (qty > 0) {
                        const total = qty * price;
                        cash -= total;
                        avgCost = (holdings * avgCost + total) / (holdings + qty);
                        holdings += qty;
                        
                        trades.push({
                            id: uuidv4(),
                            symbol,
                            type: 'BUY',
                            quantity: qty,
                            price,
                            timestamp: date,
                            totalValue: total,
                            reason: 'Oversold Mean Reversion'
                        });
                    }
                } else if (price > sma * 1.05 && holdings > 0) {
                    // SELL SIGNAL
                    const total = holdings * price;
                    const pnl = (price - avgCost) * holdings;
                    if (pnl >= 0) {
                        grossWins += pnl;
                        winsCount++;
                    } else {
                        grossLosses += Math.abs(pnl);
                        lossesCount++;
                    }

                    cash += total;
                    
                    trades.push({
                        id: uuidv4(),
                        symbol,
                        type: 'SELL',
                        quantity: holdings,
                        price,
                        timestamp: date,
                        totalValue: total,
                        reason: 'Overbought Mean Reversion'
                    });
                    
                    holdings = 0;
                    avgCost = 0;
                }
            }

            const holdingsValue = holdings * price;
            const nav = cash + holdingsValue;
            
            equityCurve.push({
                timestamp: date,
                nav,
                cash,
                holdingsValue,
                unrealizedPL: holdings > 0 ? (price - avgCost) * holdings : 0
            });
        }

        const finalNav = equityCurve[equityCurve.length - 1]?.nav || initialCapital;
        const totalReturn = finalNav - initialCapital;
        const totalReturnPercent = (totalReturn / initialCapital) * 100;

        // Calculate Win Rate and Max Drawdown
        let maxNav = initialCapital;
        let maxDd = 0;
        for (const snap of equityCurve) {
            if (snap.nav > maxNav) maxNav = snap.nav;
            const dd = (maxNav - snap.nav) / maxNav;
            if (dd > maxDd) maxDd = dd;
        }

        const totalCompletedTrades = winsCount + lossesCount;
        const winRate = totalCompletedTrades > 0 ? (winsCount / totalCompletedTrades) * 100 : 0;
        const profitFactor = grossLosses > 0 ? parseFloat((grossWins / grossLosses).toFixed(2)) : (grossWins > 0 ? 99.99 : 0);

        return {
            id: uuidv4(),
            userId,
            symbol,
            strategyName: 'Mean Reversion (20-Day SMA)',
            startDate: fromDate,
            endDate: new Date(),
            initialCapital,
            finalNav,
            totalReturn,
            totalReturnPercent,
            maxDrawdown: maxDd * 100,
            winRate,
            profitFactor,
            trades,
            equityCurve
        };
    }
}
