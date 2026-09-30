import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { redirect } from "next/navigation";
import SetupClient from "./setup-client";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }

    if (process.env.ENABLE_STRATEGY_ASSISTANTS !== "true") {
        redirect("/auto-trade");
    }

    const userId = (session.user as any).id;
    const infra = await getInfrastructure();

    // Fetch strategies list
    const dbStrategies = await infra.strategy.list();

    // Fetch user's portfolio cash details
    const portfolios = await infra.portfolio.findByUserId(userId);
    const portfolio = portfolios[0] || null;
    const cashBalance = portfolio ? portfolio.cashBalance : 0;
    const reservedCash = portfolio ? (portfolio.reservedCash || 0) : 0;
    const availableCash = Math.max(0, cashBalance - reservedCash);

    // Calculate real live bot win rate and completed trades for each strategy
    let enrichedStrategies = dbStrategies;
    if (infra.mongoClient) {
        const db = infra.mongoClient.db(process.env.MONGO_DB || "market");
        const allAssistants = await db.collection("strategy_assistants").find({}).toArray();
        const allTrades = await db.collection("trades").find({ type: "SELL" }).toArray();

        enrichedStrategies = dbStrategies.map((strat: any) => {
            const slug = strat.slug || strat.id;
            const assistantIds = new Set(
                allAssistants.filter((a: any) => a.strategySlug === slug).map((a: any) => a.id)
            );
            const strategyTrades = allTrades.filter((t: any) => t.botId && assistantIds.has(t.botId));
            const totalTrades = strategyTrades.length;
            const winningTrades = strategyTrades.filter((t: any) => (t.realizedPL || 0) > 0).length;
            const liveWinRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : null;

            return {
                ...strat,
                liveWinRate,
                totalTrades,
                benchmarkWinRate: strat.winRate || "65%"
            };
        });
    }

    const plainStrategies = JSON.parse(JSON.stringify(enrichedStrategies || []));

    return (
        <SetupClient
            strategies={plainStrategies}
            cashBalance={cashBalance}
            reservedCash={reservedCash}
            availableCash={availableCash}
        />
    );
}
