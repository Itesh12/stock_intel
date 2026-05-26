import { Infrastructure } from "./container";
import { Logger } from "./logger";
import { MetricsRegistry } from "./metrics";
import { TradeMonitorService } from "../application/trade-monitor-service";
import { SignalProcessor } from "../application/signal-processor";

export class WorkerManager {
    private isShuttingDown = false;
    private runningLoops = new Map<string, { interval: number; globalFlag: string; timer?: NodeJS.Timeout }>();

    constructor(private infra: Infrastructure) {
        // Handle process termination events if not running inside build phase
        const isBuildPhase =
            process.env.NEXT_PHASE === "phase-production-build" ||
            process.env.IS_BUILD === "true" ||
            (process.env.NODE_ENV === "production" && !process.env.NEXT_RUNTIME);

        if (!isBuildPhase) {
            const shutdown = () => {
                if (this.isShuttingDown) return;
                this.isShuttingDown = true;
                console.log("[WorkerManager] Gracefully stopping all background loops...");
                this.stopAll();
            };
            process.on("SIGINT", shutdown);
            process.on("SIGTERM", shutdown);
        }
    }

    public startAll(): void {
        // TradeMonitor loop (runs every 15 seconds)
        this.startLoop(
            "TradeMonitor",
            async () => {
                const monitor = new TradeMonitorService(this.infra);
                await monitor.monitorAll();
            },
            15000,
            "tradeMonitorStarted"
        );

        // StrategyAssistant loop (runs every 30 seconds)
        if (process.env.ENABLE_STRATEGY_ASSISTANTS === "true") {
            this.startLoop(
                "StrategyAssistant",
                async () => {
                    const processor = new SignalProcessor(this.infra);
                    await processor.runAll();
                },
                30000,
                "strategyAssistantStarted"
            );
        }
    }

    public stopAll(): void {
        this.isShuttingDown = true;
        this.runningLoops.forEach((loop, name) => {
            if (loop.timer) {
                clearTimeout(loop.timer);
            }
            console.log(`[WorkerManager] Stopped loop: ${name}`);
        });
        this.runningLoops.clear();
    }

    private startLoop(
        name: string,
        task: () => Promise<void>,
        intervalMs: number,
        globalFlag: string
    ) {
        if ((global as any)[globalFlag]) {
            return;
        }
        (global as any)[globalFlag] = true;

        console.log(`[WorkerManager] ${name} loop initialized.`);

        let isExecuting = false;

        const run = async () => {
            if (this.isShuttingDown) return;
            if (isExecuting) {
                Logger.skipped('Worker', name, 'previous execution still running');
                return;
            }

            isExecuting = true;
            const workerStart = Date.now();
            Logger.started('Worker', name);
            try {
                await task();
                const durationMs = Date.now() - workerStart;
                MetricsRegistry.recordWorkerEnd(name, true, durationMs);
                Logger.info('Worker', name, undefined, durationMs);
            } catch (err) {
                const durationMs = Date.now() - workerStart;
                MetricsRegistry.recordWorkerEnd(name, false, durationMs);
                Logger.error('Worker', name, err, undefined, durationMs);
            } finally {
                isExecuting = false;
                if (!this.isShuttingDown) {
                    const timer = setTimeout(run, intervalMs);
                    this.runningLoops.set(name, { interval: intervalMs, globalFlag, timer });
                }
            }
        };

        // 5-second initial boot delay to prioritize HTTP server startup
        const timer = setTimeout(run, 5000);
        this.runningLoops.set(name, { interval: intervalMs, globalFlag, timer });
    }
}
