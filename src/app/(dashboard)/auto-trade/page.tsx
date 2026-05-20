import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import AutoTradeClient from "@/app/(dashboard)/auto-trade/auto-trade-client";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function AutoTradePage() {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect('/login');
    }

    //
    const userId = (session.user as any).id;
    const infra = await getInfrastructure();

    // 1. Fetch user's bots
    const bots = await infra.autoTradeBot.findByUserId(userId);

    // 2. Fetch user's portfolio cash balance
    const portfolios = await infra.portfolio.findByUserId(userId);
    let portfolio = portfolios[0] || null;
    const cashBalance = portfolio ? portfolio.cashBalance : 0;

    let holdings: any[] = [];
    if (portfolio) {
        const analyzer = new (require("@/application/portfolio-analyzer").PortfolioAnalyzer)(
            infra.stock, 
            infra.notification, 
            infra.trade,
            infra.market
        );
        const analyzed = await analyzer.analyze(portfolio);
        holdings = analyzed.holdings;
    }

    const trades = await infra.trade.findByUserId(userId);
    const { calculateBotStats } = require("@/application/bot-stats-calculator");

    const enrichedBots = bots.map(bot => {
        const stats = calculateBotStats(bot, trades, holdings);
        // Async update DB cache
        infra.autoTradeBot.updateStats(bot.id, stats).catch(err => {
            console.error(`[AutoTradePage] Failed to update bot stats in DB:`, err);
        });
        return {
            ...bot,
            ...stats
        };
    });

    // 3. Fetch strategies list
    // Pre-market scan dynamic seeding is in search page, but we can query them from database safely.
    const dbStrategies = await infra.strategy.list();

    // Deep-serialize to plain JSON objects for client boundary compatibility
    const plainBots = JSON.parse(JSON.stringify(enrichedBots || []));
    const plainStrategies = JSON.parse(JSON.stringify(dbStrategies || []));

    return (
        <AutoTradeClient
            initialBots={plainBots}
            initialStrategies={plainStrategies}
            cashBalance={cashBalance}
        />
    );
}
