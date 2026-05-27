import { IInfrastructure } from "./contracts/infrastructure";

export class CapitalReservationService {
    constructor(private infra: IInfrastructure) {}

    /**
     * Recalculates and synchronizes the portfolio's reservedCash based on the
     * active RUNNING strategy assistants' undeployed capital (allocatedCapital - deployedCapital).
     */
    public async syncReservedCash(userId: string, session?: any): Promise<void> {
        let assistants: any[] = [];
        if (this.infra.mongoClient) {
            const db = this.infra.mongoClient.db(process.env.MONGO_DB || "market");
            assistants = await db.collection("strategy_assistants")
                .find({ userId }, { session })
                .toArray();
        } else {
            assistants = await this.infra.strategyAssistant.findByUserId(userId);
        }

        const runningAssistants = assistants.filter(a => a.status === 'RUNNING');
        
        const newReserved = runningAssistants.reduce((sum, a) => {
            return sum + Math.max(0, a.allocatedCapital - a.deployedCapital);
        }, 0);

        const portfolios = await this.infra.portfolio.findByUserId(userId, session);
        if (portfolios.length > 0) {
            const portfolio = portfolios[0];
            portfolio.reservedCash = newReserved;
            await this.infra.portfolio.save(portfolio, session);
        }
    }
}
