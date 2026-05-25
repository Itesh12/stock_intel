import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { redirect } from "next/navigation";
import AssistantClient from "./assistant-client";

export const dynamic = "force-dynamic";

export default async function AssistantPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }

    if (process.env.ENABLE_STRATEGY_ASSISTANTS !== "true") {
        redirect("/auto-trade");
    }

    const { id } = await params;
    const userId = (session!.user as any).id;
    const infra = await getInfrastructure();

    const assistant = await infra.strategyAssistant.findById(id);
    if (!assistant || assistant.userId !== userId) {
        redirect("/auto-trade");
    }

    // Fetch strategy details
    const strategy = await infra.strategy.findBySlug(assistant!.strategySlug);

    // Fetch user portfolio cash & holdings
    const portfolios = await infra.portfolio.findByUserId(userId);
    const portfolio = portfolios[0] || null;
    const cashBalance = portfolio ? portfolio.cashBalance : 0;
    const reservedCash = portfolio ? (portfolio.reservedCash || 0) : 0;
    const availableCash = Math.max(0, cashBalance - reservedCash);

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
    const { calculateAssistantStats } = require("@/application/assistant-stats-calculator");
    const stats = calculateAssistantStats(assistant!, trades, holdings);

    // Filter holdings managed by this specific assistant
    const assistantHoldings = holdings.filter(h => h.botId === assistant!.id);

    // Sync stats in background DB cache
    infra.strategyAssistant.updateStats(assistant!.id, {
        totalPnL: stats.totalPnL,
        winCount: stats.winCount,
        lossCount: stats.lossCount,
        totalTradesExecuted: stats.totalTradesExecuted,
    }).catch(err => {
        console.error(`[AssistantPage] Failed to update stats:`, err);
    });

    const plainAssistant = JSON.parse(JSON.stringify({ ...assistant!, ...stats }));
    const plainStrategy = JSON.parse(JSON.stringify(strategy || null));
    const plainHoldings = JSON.parse(JSON.stringify(assistantHoldings || []));

    return (
        <AssistantClient
            initialAssistant={plainAssistant}
            strategy={plainStrategy}
            cashBalance={cashBalance}
            reservedCash={reservedCash}
            availableCash={availableCash}
            initialHoldings={plainHoldings}
        />
    );
}
