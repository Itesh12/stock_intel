import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import PortfolioClient from "./portfolio-client";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect('/login');
    }

    const userId = (session.user as any).id;
    const infra = await getInfrastructure();

    // 1. Portfolio
    const portfolios = await infra.portfolio.findByUserId(userId);
    let portfolio = portfolios[0] || null;
    if (portfolio) {
        const analyzer = new (require("@/application/portfolio-analyzer").PortfolioAnalyzer)(
            infra.stock, 
            infra.notification, 
            infra.trade,
            infra.market
        );
        portfolio = await analyzer.analyze(portfolio);
    }

    // 2. Trades
    const trades = await infra.trade.findByUserId(userId);

    // 3. Analytics
    const analytics = await new (require("@/application/portfolio-analyzer").PortfolioAnalyzer)(
        infra.stock, 
        infra.notification, 
        infra.trade,
        infra.market
    ).generateAnalytics(portfolio);

    // 4. Limit Orders
    const limitOrders = await infra.limitOrder.findByUserId(userId);

    // Deep-serialize to plain JSON objects for Client Component transfer to avoid Next.js serialization issues
    const plainPortfolio = portfolio ? JSON.parse(JSON.stringify(portfolio)) : null;
    const plainTrades = JSON.parse(JSON.stringify(trades || []));
    const plainAnalytics = JSON.parse(JSON.stringify(analytics || {}));
    const plainLimitOrders = JSON.parse(JSON.stringify(limitOrders || []));

    return (
        <PortfolioClient 
            initialPortfolio={plainPortfolio}
            initialTrades={plainTrades}
            initialAnalytics={plainAnalytics}
            initialLimitOrders={plainLimitOrders}
        />
    );
}
