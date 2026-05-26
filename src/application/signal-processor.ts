import { Infrastructure } from "../infrastructure/container";
import { SignalService } from "./signal-service";
import { Portfolio } from "../domain/portfolio";
import { LimitOrder } from "../domain/limit-order";

export class SignalProcessor {
    private signalService: SignalService;

    constructor(private infra: Infrastructure) {
        this.signalService = new SignalService(infra);
    }

    public async runAll(): Promise<void> {
        const assistants = await this.infra.strategyAssistant.findAllRunning();
        if (assistants.length === 0) return;

        let preloadedPortfolios: Portfolio[] | undefined = undefined;
        let preloadedPendingOrders: LimitOrder[] | undefined = undefined;

        if (process.env.ENABLE_SIGNAL_OPTIMIZATION === "true") {
            preloadedPortfolios = await this.infra.portfolio.list();
            preloadedPendingOrders = await this.infra.limitOrder.findPending();
        }

        for (const assistant of assistants) {
            try {
                await this.signalService.runAssistant(assistant, preloadedPortfolios, preloadedPendingOrders);
            } catch (err) {
                console.error(`[SignalProcessor] Assistant ${assistant.id} (${assistant.name}) failed:`, err);
                await this.signalService.logError(assistant.id, err);
            }
        }
    }
}
