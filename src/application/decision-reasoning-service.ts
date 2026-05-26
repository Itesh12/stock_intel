import { StrategyAssistant } from "../domain/strategy-assistant";
import { StrategyRecommendation } from "../domain/strategy";
import { Portfolio } from "../domain/portfolio";
import { LimitOrder } from "../domain/limit-order";
import { DecisionReasoning } from "../domain/assistant-signal";

// Retention period for terminal signals
const SIGNAL_RETENTION_DAYS = 30;

export function signalExpiresAt(): Date {
    const d = new Date();
    d.setDate(d.getDate() + SIGNAL_RETENTION_DAYS);
    return d;
}

/**
 * DecisionReasoningService
 *
 * Generates human-readable decision reasoning from scanner matchDetails and
 * portfolio/risk context. Calculates confidence using a layered formula:
 *
 *   Confidence = BaseScore + IndicatorWeights - RiskPenalties
 */
export class DecisionReasoningService {

    /**
     * Generate approval reasoning when a signal passes all checks.
     */
    public buildApprovalReasoning(
        assistant: StrategyAssistant,
        rec: StrategyRecommendation,
        portfolio: Portfolio,
        pendingOrders: LimitOrder[]
    ): DecisionReasoning {
        const reasons = this.extractStrategyReasons(assistant.strategySlug, rec);
        const portfolioReasons = this.extractPortfolioReasons(assistant, portfolio, pendingOrders);
        const allReasons = [...reasons, ...portfolioReasons];
        const confidence = this.calculateConfidence(rec.score, allReasons);

        return {
            decision: 'BUY',
            confidence,
            reasons: allReasons,
            generatedAt: new Date()
        };
    }

    /**
     * Generate rejection reasoning when a signal is blocked by risk/decision checks.
     */
    public buildRejectionReasoning(
        assistant: StrategyAssistant,
        rec: StrategyRecommendation,
        rejectionReason: string
    ): DecisionReasoning {
        const strategyReasons = this.extractStrategyReasons(assistant.strategySlug, rec);
        const rejectionReasons = this.parseRejectionReason(rejectionReason);
        const allReasons = [...strategyReasons, ...rejectionReasons];
        const confidence = this.calculateConfidence(rec.score, allReasons);

        return {
            decision: 'SKIP',
            confidence,
            reasons: allReasons,
            generatedAt: new Date()
        };
    }

    /**
     * Dynamic confidence calculation:
     *   BaseScore (from scanner score, max 100)
     *   + Volume breakout bonus (+10)
     *   + Sector strength bonus (+5)
     *   - High sector concentration penalty (-10)
     *   - High volatility / high risk penalty (-12)
     *   Clamped to [0, 100].
     */
    private calculateConfidence(baseScore: number, reasons: DecisionReasoning['reasons']): number {
        let confidence = baseScore;

        for (const reason of reasons) {
            if (reason.status === 'PASS') {
                if (reason.key === 'volume_breakout') confidence += 10;
                else if (reason.key === 'sector_strength') confidence += 5;
                else if (reason.key === 'price_near_52w_high') confidence += 5;
                else if (reason.key === 'earnings_growth') confidence += 5;
                else if (reason.key === 'roe_strong') confidence += 3;
            } else if (reason.status === 'WARN') {
                if (reason.key === 'sector_concentration') confidence -= 10;
                else if (reason.key === 'high_volatility') confidence -= 12;
                else if (reason.key === 'cooldown_active') confidence -= 15;
                else if (reason.key === 'max_positions_reached') confidence -= 20;
            } else if (reason.status === 'FAIL') {
                confidence -= 15;
            }
        }

        return Math.min(100, Math.max(0, Math.round(confidence)));
    }

    /**
     * Extract strategy-specific indicator reasons from scanner matchDetails.
     */
    private extractStrategyReasons(
        strategySlug: string,
        rec: StrategyRecommendation
    ): DecisionReasoning['reasons'] {
        const d = rec.matchDetails || {};

        switch (strategySlug) {
            case 'canslim':
                return this.canslimReasons(d, rec.score);

            case 'intermarket-analysis-india':
                return this.intermarketReasons(d, rec.score);

            case 'warren-buffet':
                return this.buffettReasons(d, rec.score);

            case 'intraday-strategy':
                return this.intradayReasons(d, rec.score);

            case 'swing-strategy':
                return this.swingReasons(d, rec.score);

            default:
                return [{
                    key: 'strategy_score',
                    label: 'Strategy Score',
                    status: rec.score >= 60 ? 'PASS' : 'WARN',
                    description: `Strategy score: ${rec.score}/100`
                }];
        }
    }

    // CANSLIM: C (Earnings Growth), A (ROE), N (52W High Proximity),
    //          S (Market Cap), L (Momentum), I (Institutional Holding)
    private canslimReasons(d: any, score: number): DecisionReasoning['reasons'] {
        return [
            {
                key: 'earnings_growth',
                label: 'Earnings Growth (C)',
                status: (d.earningsGrowth || 0) >= 15 ? 'PASS' : 'FAIL',
                description: `EPS Growth: ${d.earningsGrowth ? d.earningsGrowth.toFixed(1) : 'N/A'}% (threshold ≥15%)`
            },
            {
                key: 'roe_strong',
                label: 'Return on Equity (A)',
                status: (d.roe || 0) >= 10 ? 'PASS' : 'FAIL',
                description: `ROE: ${d.roe ? d.roe.toFixed(1) : 'N/A'}% (threshold ≥10%)`
            },
            {
                key: 'price_near_52w_high',
                label: 'Near 52-Week High (N)',
                status: (d.distanceToHigh || 0) >= 0.75 ? 'PASS' : 'WARN',
                description: `Price at ${d.distanceToHigh ? (d.distanceToHigh * 100).toFixed(1) : 'N/A'}% of 52W high (threshold ≥75%)`
            },
            {
                key: 'market_cap',
                label: 'Market Cap (S)',
                status: 'PASS',
                description: `Large-cap stock passed market cap pre-screen`
            },
            {
                key: 'institutional_ownership',
                label: 'Institutional Ownership (I)',
                status: (d.institutionOwnership || 0) > 0.05 ? 'PASS' : 'WARN',
                description: `Institutional ownership: ${d.institutionOwnership ? (d.institutionOwnership * 100).toFixed(1) : 'N/A'}%`
            },
            {
                key: 'canslim_score',
                label: 'CANSLIM Composite Score',
                status: score >= 60 ? 'PASS' : 'WARN',
                description: `Overall CANSLIM score: ${score}/100`
            }
        ];
    }

    private intermarketReasons(d: any, score: number): DecisionReasoning['reasons'] {
        return [
            {
                key: 'volume_breakout',
                label: 'Price Breakout (52W High)',
                status: (d.distanceToHigh || 0) >= 0.70 ? 'PASS' : 'FAIL',
                description: `Trading at ${d.distanceToHigh ? (d.distanceToHigh * 100).toFixed(1) : 'N/A'}% of 52W high (threshold ≥70%)`
            },
            {
                key: 'trend_above_ma200',
                label: 'Above 200-Day MA',
                status: d.approxMa200 && d.price > d.approxMa200 ? 'PASS' : 'FAIL',
                description: `Price ₹${d.price?.toFixed(2)} vs approx MA200 ₹${d.approxMa200?.toFixed(2)}`
            },
            {
                key: 'debt_ratio',
                label: 'Debt-to-Equity',
                status: (d.debtToEquity || 0) < 100 ? 'PASS' : 'WARN',
                description: `D/E Ratio: ${d.debtToEquity?.toFixed(1) || 'N/A'} (threshold <100)`
            },
            {
                key: 'intermarket_score',
                label: 'Intermarket Score',
                status: score >= 60 ? 'PASS' : 'WARN',
                description: `Intermarket confluence score: ${score}/100`
            }
        ];
    }

    private buffettReasons(d: any, score: number): DecisionReasoning['reasons'] {
        return [
            {
                key: 'roe_strong',
                label: 'Return on Equity',
                status: (d.roe || 0) > 15 ? 'PASS' : 'FAIL',
                description: `ROE: ${d.roe?.toFixed(1) || 'N/A'}% (threshold >15%)`
            },
            {
                key: 'debt_ratio',
                label: 'Debt-to-Equity',
                status: (d.de || 0) < 50 ? 'PASS' : 'WARN',
                description: `D/E Ratio: ${d.de?.toFixed(1) || 'N/A'} (threshold <50)`
            },
            {
                key: 'pe_valuation',
                label: 'P/E Valuation',
                status: (d.pe || 99) < 25 ? 'PASS' : 'WARN',
                description: `P/E Ratio: ${d.pe?.toFixed(1) || 'N/A'} (threshold <25)`
            },
            {
                key: 'quality_score',
                label: 'Quality Score (Q)',
                status: (d.q_score || 0) >= 60 ? 'PASS' : 'WARN',
                description: `IVCF Quality score: ${d.q_score?.toFixed(0) || 'N/A'}/100`
            },
            {
                key: 'buffett_ivcf_score',
                label: 'IVCF Composite Score',
                status: score >= 65 ? 'PASS' : 'WARN',
                description: `Total IVCF score: ${score}/100`
            }
        ];
    }

    private intradayReasons(d: any, score: number): DecisionReasoning['reasons'] {
        return [
            {
                key: 'volume_breakout',
                label: 'Relative Volume (RVOL)',
                status: (d.rvol || 0) >= 1.5 ? 'PASS' : 'WARN',
                description: `RVOL: ${d.rvol?.toFixed(2) || 'N/A'}x average (threshold ≥1.5x)`
            },
            {
                key: 'gap_momentum',
                label: 'Intraday Gap',
                status: (d.gapPercent || 0) >= 1.0 ? 'PASS' : 'WARN',
                description: `Gap: ${d.gapPercent?.toFixed(2) || 'N/A'}% (threshold ≥1%)`
            },
            {
                key: 'sector_strength',
                label: 'Positive Momentum',
                status: (d.changePercent || 0) > 0.5 ? 'PASS' : 'WARN',
                description: `Today's change: ${d.changePercent?.toFixed(2) || 'N/A'}%`
            },
            {
                key: 'intraday_score',
                label: 'Intraday Confluence Score',
                status: score >= 70 ? 'PASS' : 'WARN',
                description: `Intraday score: ${score}/100`
            }
        ];
    }

    private swingReasons(d: any, score: number): DecisionReasoning['reasons'] {
        return [
            {
                key: 'price_near_52w_high',
                label: 'Near 52-Week High',
                status: (d.distanceToHighPercent || 100) <= 5 ? 'PASS' : 'WARN',
                description: `${d.distanceToHighPercent?.toFixed(1) || 'N/A'}% below 52W high (threshold ≤5%)`
            },
            {
                key: 'volume_breakout',
                label: 'Volume Surge',
                status: (d.volSurge || 0) >= 1.5 ? 'PASS' : 'WARN',
                description: `Volume: ${d.volSurge?.toFixed(2) || 'N/A'}x average (threshold ≥1.5x)`
            },
            {
                key: 'sector_strength',
                label: 'Positive Trend',
                status: (d.changePercent || 0) > 1.0 ? 'PASS' : 'WARN',
                description: `Momentum: ${d.changePercent?.toFixed(2) || 'N/A'}%`
            },
            {
                key: 'swing_score',
                label: 'Swing Confluence Score',
                status: score >= 65 ? 'PASS' : 'WARN',
                description: `Swing score: ${score}/100`
            }
        ];
    }

    /**
     * Extract portfolio-level context reasons (position limits, sector concentration).
     */
    private extractPortfolioReasons(
        assistant: StrategyAssistant,
        portfolio: Portfolio,
        pendingOrders: LimitOrder[]
    ): DecisionReasoning['reasons'] {
        const reasons: DecisionReasoning['reasons'] = [];
        const openPositions = pendingOrders.filter(o => o.botId === assistant.id && o.type === 'STOP_LOSS').length;
        const remainingSlots = assistant.maxConcurrentPositions - openPositions;

        reasons.push({
            key: 'position_capacity',
            label: 'Position Capacity',
            status: remainingSlots > 0 ? 'PASS' : 'WARN',
            description: `${openPositions}/${assistant.maxConcurrentPositions} positions active (${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} free)`
        });

        const availableCash = portfolio.cashBalance - (portfolio.reservedCash || 0);
        const availableBotCash = assistant.allocatedCapital - assistant.deployedCapital;
        const deployableCapital = Math.min(availableCash, availableBotCash);

        reasons.push({
            key: 'capital_available',
            label: 'Available Capital',
            status: deployableCapital > 0 ? 'PASS' : 'FAIL',
            description: `₹${deployableCapital.toLocaleString('en-IN')} deployable (portfolio: ₹${availableCash.toLocaleString('en-IN')}, assistant: ₹${availableBotCash.toLocaleString('en-IN')})`
        });

        return reasons;
    }

    /**
     * Parse a risk rejection string into structured reason items.
     */
    private parseRejectionReason(reason: string): DecisionReasoning['reasons'] {
        const lower = reason.toLowerCase();
        const reasons: DecisionReasoning['reasons'] = [];

        if (lower.includes('max concurrent')) {
            reasons.push({
                key: 'max_positions_reached',
                label: 'Max Positions Reached',
                status: 'WARN',
                description: reason
            });
        } else if (lower.includes('cooldown')) {
            reasons.push({
                key: 'cooldown_active',
                label: 'Cooldown Period Active',
                status: 'WARN',
                description: reason
            });
        } else if (lower.includes('sector')) {
            reasons.push({
                key: 'sector_concentration',
                label: 'Sector Concentration Limit',
                status: 'WARN',
                description: reason
            });
        } else if (lower.includes('capital') || lower.includes('funds') || lower.includes('insufficient')) {
            reasons.push({
                key: 'insufficient_capital',
                label: 'Insufficient Capital',
                status: 'FAIL',
                description: reason
            });
        } else {
            reasons.push({
                key: 'risk_blocked',
                label: 'Risk Check Failed',
                status: 'FAIL',
                description: reason
            });
        }

        return reasons;
    }
}
