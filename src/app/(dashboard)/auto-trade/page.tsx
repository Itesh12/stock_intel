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

    // 1. Fetch user's strategy assistants
    const assistants = await infra.strategyAssistant.findByUserId(userId);

    // 2. Fetch user's portfolio cash balance
    const portfolios = await infra.portfolio.findByUserId(userId);
    let portfolio = portfolios[0] || null;
    const cashBalance = portfolio ? portfolio.cashBalance : 0;

    const enrichedAssistants = await new (require("@/application/assistant-metrics-service").AssistantMetricsService)(infra).getEnrichedAssistants(assistants);

    // 3. Fetch strategies list
    const dbStrategies = await infra.strategy.list();

    // Deep-serialize to plain JSON objects for client boundary compatibility
    const plainBots: any[] = [];
    const plainAssistants = JSON.parse(JSON.stringify(enrichedAssistants || []));
    const plainStrategies = JSON.parse(JSON.stringify(dbStrategies || []));

    return (
        <AutoTradeClient
            initialBots={plainBots}
            initialAssistants={plainAssistants}
            initialStrategies={plainStrategies}
            cashBalance={cashBalance}
        />
    );
}
