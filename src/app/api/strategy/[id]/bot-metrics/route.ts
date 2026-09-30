import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { getScannerForSlug } from "@/services/scanner-registry";

export const dynamic = "force-dynamic";

interface StrategyRuleSet {
    stopLossPercent: number;
    takeProfitPercent: number;
    stopLossDesc: string;
    takeProfitDesc: string;
    holdingHorizon: string;
    signalFrequency: string;
    riskPerTradePercent: number;
    executionProtocol: string;
}

const STRATEGY_METHODOLOGIES: Record<string, StrategyRuleSet> = {
    "john-carter-intraday": {
        stopLossPercent: 1.5,
        takeProfitPercent: 4.0,
        stopLossDesc: "Floor Pivot S1 / Swing Low (~1.5% Stop Market)",
        takeProfitDesc: "Carter 3-Target Scaling (1:1, 2:1, 60-min Runner)",
        holdingHorizon: "Intraday (Auto Square-off 3:15 PM)",
        signalFrequency: "~2 - 5 Setups / Day",
        riskPerTradePercent: 1.5,
        executionProtocol: "Carter 4-Step Playbook (Floor Pivots, TTM Squeeze, 3-Target Scaling)"
    },
    "canslim": {
        stopLossPercent: 7.0,
        takeProfitPercent: 20.0,
        stopLossDesc: "O'Neil Strict 7% - 8% Capital Cut-off",
        takeProfitDesc: "20% - 25% Leading Base Breakout Target",
        holdingHorizon: "Multi-Week Swing (3 - 8 Weeks)",
        signalFrequency: "~3 - 6 Setups / Month",
        riskPerTradePercent: 2.0,
        executionProtocol: "CANSLIM Institutional Accumulation & Growth Filter"
    },
    "warren-buffet": {
        stopLossPercent: 15.0,
        takeProfitPercent: 35.0,
        stopLossDesc: "15% Structural Moat / Governance Degradation Stop",
        takeProfitDesc: "30%+ Multi-Year Compounding Exit",
        holdingHorizon: "Long-Term (1 - 3 Years)",
        signalFrequency: "~1 - 3 Setups / Quarter",
        riskPerTradePercent: 3.0,
        executionProtocol: "Indian Buffett Compounder (ROCE > 20%, Moat & Margin of Safety)"
    },
    "intermarket-analysis-india": {
        stopLossPercent: 5.0,
        takeProfitPercent: 15.0,
        stopLossDesc: "5% Macro Regime Reversal Stop",
        takeProfitDesc: "15% Sector Leadership Expansion Target",
        holdingHorizon: "Swing Trend (2 - 6 Weeks)",
        signalFrequency: "~1 - 2 Setups / Week",
        riskPerTradePercent: 2.0,
        executionProtocol: "John Murphy Intermarket Regime & Sector Rotation"
    }
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: slug } = await params;
        const infra = await getInfrastructure();
        const url = new URL(req.url);
        const shouldRescan = url.searchParams.get("rescan") === "true";

        // 1. Find Strategy
        const strategy = await infra.strategy.findBySlug(slug);
        if (!strategy) {
            return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
        }

        // 2. Query Assistants for this strategy to calculate Real Bot Trade Performance
        let totalCompletedTrades = 0;
        let winningTrades = 0;
        let losingTrades = 0;
        let totalRealizedPnL = 0;
        let realMaxDrawdown = 0;
        let realWinRate: number | null = null;
        let hasLiveHistory = false;

        if (infra.mongoClient) {
            const db = infra.mongoClient.db(process.env.MONGO_DB || "market");
            const assistants = await db.collection("strategy_assistants")
                .find({ strategySlug: slug })
                .toArray();

            const assistantIds = assistants.map((a: any) => a.id);

            if (assistantIds.length > 0) {
                const closedTrades = await db.collection("trades")
                    .find({
                        botId: { $in: assistantIds },
                        type: "SELL"
                    })
                    .sort({ timestamp: 1 })
                    .toArray();

                if (closedTrades.length > 0) {
                    hasLiveHistory = true;
                    totalCompletedTrades = closedTrades.length;
                    winningTrades = closedTrades.filter((t: any) => (t.realizedPL || 0) > 0).length;
                    losingTrades = closedTrades.filter((t: any) => (t.realizedPL || 0) < 0).length;
                    totalRealizedPnL = closedTrades.reduce((acc: number, t: any) => acc + (t.realizedPL || 0), 0);
                    realWinRate = Number(((winningTrades / totalCompletedTrades) * 100).toFixed(1));

                    // Calculate peak-to-trough drawdown from real trade ledger
                    let peak = 0;
                    let maxDrop = 0;
                    let runningPnL = 0;
                    for (const t of closedTrades) {
                        runningPnL += (t.realizedPL || 0);
                        if (runningPnL > peak) peak = runningPnL;
                        const drop = runningPnL - peak;
                        if (drop < maxDrop) maxDrop = drop;
                    }
                    realMaxDrawdown = Number(maxDrop.toFixed(2));
                }
            }
        }

        // 3. Dynamic Strategy Candidates (Trigger scan if requested or empty)
        let recommendations = await infra.strategy.getRecommendations(strategy.id);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        if (shouldRescan || recommendations.length === 0 || (recommendations[0]?.timestamp && recommendations[0].timestamp < oneHourAgo)) {
            try {
                const scanner = getScannerForSlug(slug, infra);
                await scanner.scan();
                recommendations = await infra.strategy.getRecommendations(strategy.id);
            } catch (scanErr) {
                console.warn(`[BotMetrics] Scanner scan error for ${slug}:`, scanErr);
            }
        }

        // Map live candidates with real prices and scores
        const candidates = recommendations.slice(0, 10).map(r => {
            const cleanSym = r.symbol.replace(/\.NS$/, "").replace(/\.BO$/, "");
            const details = r.matchDetails || {};
            return {
                symbol: cleanSym,
                fullSymbol: r.symbol,
                score: Math.round(r.score),
                price: details.price || 0,
                changePercent: details.changePercent || 0,
                gapPercent: details.gapPercent || 0,
                rvol: details.rvol || 1,
                setup: details.setup || (details.rvol > 1.5 ? "High Relative Volume" : "Pivot Alignment"),
                timestamp: r.timestamp
            };
        });

        const methodology = STRATEGY_METHODOLOGIES[slug] || {
            stopLossPercent: 2.0,
            takeProfitPercent: 6.0,
            stopLossDesc: "2.0% Risk Guard Stop",
            takeProfitDesc: "6.0% Profit Target",
            holdingHorizon: "Standard Swing",
            signalFrequency: "~2 - 4 Setups / Week",
            riskPerTradePercent: 2.0,
            executionProtocol: "Algorithmic Confluence"
        };

        return NextResponse.json({
            strategyId: strategy.id,
            strategySlug: slug,
            strategyName: strategy.name,
            riskLevel: strategy.riskLevel,
            benchmarkWinRate: strategy.winRate,
            methodology,
            metrics: {
                hasLiveHistory,
                totalCompletedTrades,
                winningTrades,
                losingTrades,
                totalRealizedPnL,
                realWinRate, // e.g. 68.5 or null
                realMaxDrawdown, // e.g. -1420.50
            },
            candidates,
            scannedAt: recommendations[0]?.timestamp || new Date().toISOString()
        });

    } catch (error: any) {
        console.error("[BotMetrics] Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch bot metrics" }, { status: 500 });
    }
}
