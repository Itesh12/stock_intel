import { IInfrastructure } from "./contracts/infrastructure";
import { StrategyAssistant } from "../domain/strategy-assistant";
import { ProposedTrade } from "./decision-service";
import { LimitOrder } from "../domain/limit-order";
import { v4 as uuidv4 } from "uuid";
import { AuditLogService } from "./audit-log-service";
import { CapitalReservationService } from "./capital-reservation-service";

export class ExecutionService {
    private auditLogService: AuditLogService;

    constructor(private infra: IInfrastructure) {
        this.auditLogService = new AuditLogService(infra);
    }

    /**
     * Executes the proposed buy trade in a transaction session and places SL/TP exits.
     */
    public async executeBuyTrade(
        assistant: StrategyAssistant,
        trade: ProposedTrade,
        strategyId: string
    ): Promise<boolean> {
        const today = new Date().toISOString().slice(0, 10);
        const idempotencyKey = `ast-exec-${assistant.id}-${trade.symbol}-${today}-${assistant.todayTradeCount}`;

        // 1. Write Idempotency check
        if (this.infra.mongoClient) {
            const db = this.infra.mongoClient.db(process.env.MONGO_DB || "market");
            const idempotencyCol = db.collection("idempotency_keys");
            try {
                await idempotencyCol.insertOne({
                    key: idempotencyKey,
                    status: "PROCESSING",
                    createdAt: new Date(),
                });
            } catch {
                // Key collision, trade step already processed
                return false;
            }
        }

        const session = this.infra.mongoClient ? this.infra.mongoClient.startSession() : null;
        let success = false;

        const executeTransaction = async (sess?: any) => {
            // Reload latest portfolio inside transaction
            const portfolios = await this.infra.portfolio.findByUserId(assistant.userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            // Re-validate funds
            if (portfolio.cashBalance < trade.cost) {
                throw new Error("Portfolio cash balance is insufficient for execution");
            }

            // Execute virtual buy
            await this.infra.portfolio.executeTrade(
                portfolio.id,
                trade.symbol,
                trade.quantity,
                trade.price,
                'BUY',
                sess,
                assistant.id
            );

            // Record trade in ledger
            await this.infra.trade.save({
                id: uuidv4(),
                userId: assistant.userId,
                symbol: trade.symbol,
                quantity: trade.quantity,
                price: trade.price,
                totalValue: trade.cost,
                type: 'BUY',
                source: 'bot',
                timestamp: new Date(),
                botId: assistant.id
            }, sess);

            // Save Stop Loss Order
            const slOrder: LimitOrder = {
                id: uuidv4(),
                userId: assistant.userId,
                symbol: trade.symbol,
                quantity: trade.quantity,
                targetPrice: trade.slPrice,
                type: 'STOP_LOSS',
                status: 'PENDING',
                timestamp: new Date(),
                strategyId,
                botId: assistant.id
            };
            await this.infra.limitOrder.save(slOrder, sess);

            // Save Take Profit Order (linked to companion SL order)
            const tpOrder: LimitOrder = {
                id: uuidv4(),
                userId: assistant.userId,
                symbol: trade.symbol,
                quantity: trade.quantity,
                targetPrice: trade.tpPrice,
                type: 'TAKE_PROFIT',
                status: 'PENDING',
                timestamp: new Date(),
                strategyId,
                parentOrderId: slOrder.id,
                botId: assistant.id
            };
            await this.infra.limitOrder.save(tpOrder, sess);

            // Update assistant stats
            const newDeployed = assistant.deployedCapital + trade.cost;
            const newTodayCount = assistant.todayTradeCount + 1;
            const newTotal = assistant.totalTradesExecuted + 1;

            await this.infra.strategyAssistant.updateStats(assistant.id, {
                deployedCapital: newDeployed,
                todayTradeCount: newTodayCount,
                totalTradesExecuted: newTotal,
                todayDate: today
            }, sess);

            // Update in-memory reference
            assistant.deployedCapital = newDeployed;
            assistant.todayTradeCount = newTodayCount;
            assistant.totalTradesExecuted = newTotal;
            assistant.todayDate = today;

            // Recalculate reservedCash dynamically to avoid arithmetic drift
            const reservationService = new CapitalReservationService(this.infra);
            await reservationService.syncReservedCash(assistant.userId, sess);
        };

        try {
            if (session) {
                await session.withTransaction(async () => {
                    await executeTransaction(session);
                });
            } else {
                await executeTransaction();
            }
            success = true;
        } catch (err: any) {
            console.error(`[ExecutionService] Transaction failed for ${trade.symbol}:`, err.message || err);
            await this.auditLogService.log(
                assistant.id,
                'WARN',
                'TRADE_ENTRY',
                `Execution rejected for ${trade.symbol.replace('.NS', '')}: ${err.message || err}`
            );
        } finally {
            if (session) {
                await session.endSession();
            }
        }

        // Update Idempotency status
        if (this.infra.mongoClient) {
            const db = this.infra.mongoClient.db(process.env.MONGO_DB || "market");
            await db.collection("idempotency_keys").updateOne(
                { key: idempotencyKey },
                { $set: { status: success ? "COMPLETED" : "FAILED", updatedAt: new Date() } }
            ).catch(() => {});
        }

        if (success) {
            const successMsg = `🤖 Execution Success: Bought ${trade.quantity} shares of ${trade.symbol.replace('.NS', '')} @ ₹${trade.price.toFixed(2)} (Total: ₹${trade.cost.toFixed(2)}). Attached SL: ₹${trade.slPrice} | TP: ₹${trade.tpPrice}.`;
            await this.auditLogService.log(assistant.id, 'INFO', 'TRADE_ENTRY', successMsg, {
                symbol: trade.symbol,
                qty: trade.quantity,
                price: trade.price,
                total: trade.cost,
                sl: trade.slPrice,
                tp: trade.tpPrice
            });
        }

        return success;
    }
}
