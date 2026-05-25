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

    const plainStrategies = JSON.parse(JSON.stringify(dbStrategies || []));

    return (
        <SetupClient
            strategies={plainStrategies}
            cashBalance={cashBalance}
            reservedCash={reservedCash}
            availableCash={availableCash}
        />
    );
}
