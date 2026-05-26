import { Infrastructure } from "../infrastructure/container";
import { StrategyAssistant } from "../domain/strategy-assistant";
import { SectorResolverService } from "./sector-resolver-service";
import { Logger } from "../infrastructure/logger";
import { AuditLogService } from "./audit-log-service";

export class RiskGuardService {
    private sectorResolver: SectorResolverService;
    private auditLogService: AuditLogService;

    constructor(private infra: Infrastructure) {
        this.sectorResolver = new SectorResolverService(infra);
        this.auditLogService = new AuditLogService(infra);
    }

    /**
     * Evaluates all risk constraints before executing a trade entry.
     * Writes database logs and streams real-time messages via SSE.
     */
    public async evaluateRisk(
        bot: StrategyAssistant,
        symbol: string,
        proposedCost: number
    ): Promise<{ allowed: boolean; reason?: string }> {
        const botId = bot.id;
        const cleanSymbol = symbol.toUpperCase().trim();

        // 1. Max Concurrent Positions Check
        const pendingOrders = await this.infra.limitOrder.findPending();
        const botPendingSL = pendingOrders.filter(
            (o) => o.botId === botId && o.type === "STOP_LOSS" && o.status === "PENDING"
        );
        const openPositionsCount = botPendingSL.length;

        if (openPositionsCount >= bot.maxConcurrentPositions) {
            const msg = `Risk check failed: Max concurrent positions limit (${bot.maxConcurrentPositions}) reached. Active: ${openPositionsCount}.`;
            await this.auditLog(botId, "WARN", "RISK_GUARD", msg, { openPositionsCount, limit: bot.maxConcurrentPositions });
            return { allowed: false, reason: msg };
        }

        // 2. Cooldown Period Check
        const userTrades = await this.infra.trade.findByUserId(bot.userId);
        const botTrades = userTrades.filter((t) => t.botId === botId);
        if (botTrades.length > 0) {
            const lastTrade = botTrades[0]; // sorted by timestamp desc
            if (lastTrade.type === "SELL") {
                const diffMs = Date.now() - new Date(lastTrade.timestamp).getTime();
                const diffMins = diffMs / 60000;
                if (diffMins < bot.cooldownPeriodMinutes) {
                    const remainingMin = Math.ceil(bot.cooldownPeriodMinutes - diffMins);
                    const msg = `Risk check failed: Cooldown active. Last trade executed ${diffMins.toFixed(1)} mins ago. Re-entry allowed in ${remainingMin} mins.`;
                    await this.auditLog(botId, "WARN", "RISK_GUARD", msg, { diffMins, limit: bot.cooldownPeriodMinutes });
                    return { allowed: false, reason: msg };
                }
            }
        }

        // 3. Sector Concentration Check
        const sector = await this.sectorResolver.resolveSector(cleanSymbol);
        if (sector !== "Unknown") {
            const portfolios = await this.infra.portfolio.findByUserId(bot.userId);
            if (portfolios.length > 0) {
                const portfolio = portfolios[0];
                let currentSectorCost = 0;

                // Sum up cost of existing holdings belonging to this bot in the same sector
                for (const slOrder of botPendingSL) {
                    const holding = portfolio.holdings.find((h) => h.symbol === slOrder.symbol);
                    if (holding) {
                        const holdingSector = await this.sectorResolver.resolveSector(slOrder.symbol);
                        if (holdingSector === sector) {
                            currentSectorCost += holding.quantity * holding.averagePrice;
                        }
                    }
                }

                const totalSectorCost = currentSectorCost + proposedCost;
                const allocatedCapital = bot.allocatedCapital;
                const allocationPercent = (totalSectorCost / allocatedCapital) * 100;

                if (allocationPercent > bot.maxSectorAllocationPercent) {
                    const msg = `Risk check failed: Sector concentration limit exceeded for ${sector}. Limit: ${bot.maxSectorAllocationPercent}%, Proposed: ${allocationPercent.toFixed(1)}% (₹${totalSectorCost.toFixed(2)} / ₹${allocatedCapital}).`;
                    await this.auditLog(botId, "WARN", "RISK_GUARD", msg, {
                        sector,
                        totalSectorCost,
                        limitPercent: bot.maxSectorAllocationPercent,
                        proposedPercent: allocationPercent
                    });
                    return { allowed: false, reason: msg };
                }
            }
        } else {
            // Sector is "Unknown", bypass concentration checks as specified
            const msg = `Sector resolver returned 'Unknown' for ${cleanSymbol}. Concentration checks bypassed.`;
            await this.auditLog(botId, "INFO", "RISK_GUARD", msg, { symbol: cleanSymbol });
        }

        // 4. Drawdown Protection Check
        if (bot.drawdownProtectionPercent > 0 && bot.totalPnL < 0) {
            const allocatedCapital = bot.allocatedCapital;
            const drawdownPercent = (Math.abs(bot.totalPnL) / allocatedCapital) * 100;
            if (drawdownPercent >= bot.drawdownProtectionPercent) {
                const msg = `Risk check failed: Drawdown protection triggered. Current drawdown: ${drawdownPercent.toFixed(1)}% exceeds limit of ${bot.drawdownProtectionPercent}%.`;
                await this.auditLog(botId, "ERROR", "RISK_GUARD", msg, { drawdownPercent, limit: bot.drawdownProtectionPercent });
                return { allowed: false, reason: msg };
            }
        }

        // All checks passed!
        return { allowed: true };
    }

    /**
     * Persists log in MongoDB and streams live log payload via Event Source SSE
     */
    private async auditLog(
        botId: string,
        level: "INFO" | "WARN" | "ERROR",
        category: "SCAN" | "TRADE_ENTRY" | "TRADE_EXIT" | "RISK_GUARD" | "SYSTEM",
        message: string,
        metadata?: any
    ): Promise<void> {
        try {
            await this.auditLogService.log(botId, level, category, message, metadata);
            Logger.info("RiskGuard", `AuditLog: [${level}] [${category}] ${message}`, metadata);
        } catch (err) {
            console.error("[RiskGuardService] Failed to write audit log:", err);
        }
    }
}
