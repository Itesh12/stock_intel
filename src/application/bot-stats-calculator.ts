import { AutoTradeBot } from "../domain/auto-trade-bot";
import { Trade } from "../domain/trade";

export function calculateBotStats(
    bot: AutoTradeBot,
    userTrades: Trade[],
    portfolioHoldings: any[]
) {
    const botTrades = userTrades.filter(t => t.botId === bot.id);
    
    // Group bot trades by symbol
    const tradesBySymbol: Record<string, Trade[]> = {};
    for (const trade of botTrades) {
        if (!tradesBySymbol[trade.symbol]) {
            tradesBySymbol[trade.symbol] = [];
        }
        tradesBySymbol[trade.symbol].push(trade);
    }
    
    let totalPnL = 0;
    let winCount = 0;
    let lossCount = 0;

    for (const [symbol, symbolTrades] of Object.entries(tradesBySymbol)) {
        // Sort chronologically
        const sortedTrades = [...symbolTrades].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        const buys = sortedTrades.filter(t => t.type === 'BUY');
        const sells = sortedTrades.filter(t => t.type === 'SELL');
        
        const N = buys.length;
        for (let i = 0; i < N; i++) {
            const buy = buys[i];
            const sell = sells[i]; // May be undefined if open
            
            if (sell) {
                // Realized trade
                const pnl = (sell.price - buy.price) * sell.quantity;
                totalPnL += pnl;
                if (pnl > 0) {
                    winCount++;
                } else if (pnl < 0) {
                    lossCount++;
                }
            } else {
                // Open position: check current price from portfolio holdings
                const holding = portfolioHoldings.find(h => h.symbol === symbol);
                if (holding && holding.quantity > 0) {
                    const currentPrice = holding.currentPrice || buy.price;
                    const unrealizedPnL = (currentPrice - buy.price) * buy.quantity;
                    totalPnL += unrealizedPnL;
                } else {
                    // Manual sell check
                    const manualSell = userTrades.find(t => 
                        t.symbol === symbol && 
                        t.type === 'SELL' && 
                        !t.botId && 
                        new Date(t.timestamp).getTime() > new Date(buy.timestamp).getTime()
                    );
                    if (manualSell) {
                        const pnl = (manualSell.price - buy.price) * buy.quantity;
                        totalPnL += pnl;
                        if (pnl > 0) winCount++;
                        else if (pnl < 0) lossCount++;
                    }
                }
            }
        }
    }
    
    return {
        totalPnL,
        winCount,
        lossCount,
        totalTradesExecuted: botTrades.length,
    };
}
