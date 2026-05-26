import { Infrastructure } from "../infrastructure/container";
import { SignalService } from "./signal-service";

export class SignalProcessor {
    private signalService: SignalService;

    constructor(private infra: Infrastructure) {
        this.signalService = new SignalService(infra);
    }

    public async runAll(): Promise<void> {
        const assistants = await this.infra.strategyAssistant.findAllRunning();
        if (assistants.length === 0) return;

        for (const assistant of assistants) {
            try {
                await this.signalService.runAssistant(assistant);
            } catch (err) {
                console.error(`[SignalProcessor] Assistant ${assistant.id} (${assistant.name}) failed:`, err);
                await this.signalService.logError(assistant.id, err);
            }
        }
    }
}
