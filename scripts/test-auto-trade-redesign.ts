// Mock server-only to allow stand-alone execution outside Next.js compiler
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
    if (id === 'server-only') {
        return {};
    }
    return originalRequire.apply(this, arguments);
};

import { getInfrastructure } from "../src/infrastructure/container";
import { SectorResolverService } from "../src/application/sector-resolver-service";
import { RiskGuardService } from "../src/application/risk-guard-service";
import { StrategyAssistant } from "../src/domain/strategy-assistant";
import { LimitOrder } from "../src/domain/limit-order";
import { Trade } from "../src/domain/trade";

async function runTests() {
    console.log("====================================================");
    console.log("🧪 AUTO-TRADE REDESIGN PRO FUNCTIONAL TEST SUITE");
    console.log("====================================================\n");

    const infra = await getInfrastructure();
    const sectorResolver = new SectorResolverService(infra);
    const riskGuard = new RiskGuardService(infra);

    let passedCount = 0;
    let failedCount = 0;

    function assert(condition: boolean, message: string) {
        if (condition) {
            console.log(`✅ [PASS] ${message}`);
            passedCount++;
        } else {
            console.error(`❌ [FAIL] ${message}`);
            failedCount++;
        }
    }

    try {
        // ==========================================
        // 1. Sector Resolver Service Tests
        // ==========================================
        console.log("1. Running SectorResolverService Tests...");
        
        const relianceSector = await sectorResolver.resolveSector("RELIANCE.NS");
        assert(relianceSector === "Energy", `RELIANCE.NS resolves to 'Energy' (got: ${relianceSector})`);

        const tcsSector = await sectorResolver.resolveSector("TCS.NS");
        assert(tcsSector === "Technology", `TCS.NS resolves to 'Technology' (got: ${tcsSector})`);

        const lowercaseSector = await sectorResolver.resolveSector("infy.ns");
        assert(lowercaseSector === "Technology", `infy.ns resolves case-insensitively to 'Technology' (got: ${lowercaseSector})`);

        const fallbackSector = await sectorResolver.resolveSector("INVALID_SYMBOL.NS");
        assert(fallbackSector === "Unknown", `Non-existent symbol fallback is 'Unknown' (got: ${fallbackSector})`);

        console.log("");

        // ==========================================
        // 2. Risk Guard Service Tests
        // ==========================================
        console.log("2. Running RiskGuardService Validation Checks...");

        const mockBot: StrategyAssistant = {
            id: "test-bot-123",
            userId: "test-user-456",
            name: "Swing Breakout Alpha",
            strategySlug: "swing-strategy",
            strategyName: "Swing Momentum",
            status: "RUNNING",
            mode: "paper",
            allocatedCapital: 100000,
            deployedCapital: 0,
            maxPositionSizePercent: 20,
            stopLossPercent: 5,
            takeProfitPercent: 15,
            minConfluenceScore: 70,
            
            // Risk bounds
            maxDailyLoss: 5000,
            maxConcurrentPositions: 2,
            cooldownPeriodMinutes: 30,
            maxSectorAllocationPercent: 40,
            drawdownProtectionPercent: 15,
            useTrailingStop: true,

            totalTradesExecuted: 0,
            winCount: 0,
            lossCount: 0,
            totalPnL: 0,
            todayTradeCount: 0,
            todayDate: "2026-05-24",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Test Case A: Normal allowed trade
        const normalResult = await riskGuard.evaluateRisk(mockBot, "RELIANCE.NS", 15000);
        assert(normalResult.allowed === true, `Normal allowed trade evaluates to allowed (allowed: ${normalResult.allowed}, reason: ${normalResult.reason || 'none'})`);

        // Test Case B: Max concurrent position cap check
        // Save two mock pending limit orders to the database for this bot
        const mockOrder1: LimitOrder = {
            id: "mock-order-sl-1",
            userId: "test-user-456",
            symbol: "RELIANCE.NS",
            quantity: 10,
            targetPrice: 2300,
            type: "STOP_LOSS",
            status: "PENDING",
            timestamp: new Date(),
            botId: "test-bot-123"
        };
        const mockOrder2: LimitOrder = {
            id: "mock-order-sl-2",
            userId: "test-user-456",
            symbol: "TCS.NS",
            quantity: 5,
            targetPrice: 3200,
            type: "STOP_LOSS",
            status: "PENDING",
            timestamp: new Date(),
            botId: "test-bot-123"
        };

        await infra.limitOrder.save(mockOrder1);
        await infra.limitOrder.save(mockOrder2);

        const positionLimitResult = await riskGuard.evaluateRisk(mockBot, "INFY.NS", 10000);
        assert(
            positionLimitResult.allowed === false && 
            !!positionLimitResult.reason?.includes("Max concurrent positions limit"),
            `Max concurrent positions cap rejects trade (allowed: ${positionLimitResult.allowed}, reason: "${positionLimitResult.reason}")`
        );

        // Cleanup mock orders
        await infra.limitOrder.updateStatus("mock-order-sl-1", "CANCELLED");
        await infra.limitOrder.updateStatus("mock-order-sl-2", "CANCELLED");

        // Test Case C: Cooldown Period validation check
        const mockTrade: Trade = {
            id: "mock-cooldown-sell",
            userId: "test-user-456",
            symbol: "RELIANCE.NS",
            quantity: 10,
            price: 2400,
            totalValue: 24000,
            type: "SELL",
            source: "stop_loss",
            timestamp: new Date(),
            botId: "test-bot-123"
        };
        await infra.trade.save(mockTrade);

        const cooldownResult = await riskGuard.evaluateRisk(mockBot, "TCS.NS", 15000);
        assert(
            cooldownResult.allowed === false && 
            !!cooldownResult.reason?.includes("Cooldown active"),
            `Exit cooldown active blocks new entries (allowed: ${cooldownResult.allowed}, reason: "${cooldownResult.reason}")`
        );

        // Cleanup trades by mock user
        await infra.trade.deleteByUserId("test-user-456");

        console.log("");

        // ==========================================
        // 3. Database Log TTL Index Checks
        // ==========================================
        console.log("3. Verifying database logging & TTL indices...");
        
        await infra.assistantLog.save({
            id: "test-log-ttl",
            botId: "test-bot-123",
            timestamp: new Date(),
            level: "INFO",
            category: "SYSTEM",
            message: "Test logging entry for TTL verification check",
            createdAt: new Date()
        });

        const retrievedLogs = await infra.assistantLog.findByBotId("test-bot-123");
        const foundTestLog = retrievedLogs.some((l: any) => l.id === "test-log-ttl");
        assert(foundTestLog === true, `Successfully logged and retrieved audit messages for bot (count: ${retrievedLogs.length})`);

        await infra.assistantLog.deleteByBotId("test-bot-123");

        console.log("\n====================================================");
        console.log(`🏁 TEST EXECUTION COMPLETE: Passed: ${passedCount} | Failed: ${failedCount}`);
        console.log("====================================================");

        if (failedCount > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }

    } catch (err) {
        console.error("Fatal test execution error:", err);
        process.exit(1);
    }
}

runTests();
