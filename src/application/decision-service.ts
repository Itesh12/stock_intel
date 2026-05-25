import { StrategyAssistant } from "../domain/strategy-assistant";
import { Portfolio } from "../domain/portfolio";

export interface ProposedTrade {
    symbol: string;
    quantity: number;
    price: number;
    cost: number;
    slPrice: number;
    tpPrice: number;
}

export class DecisionService {
    /**
     * Evaluates a signal score and calculates optimal sizing.
     */
    public evaluateSignal(
        assistant: StrategyAssistant,
        portfolio: Portfolio,
        symbol: string,
        price: number,
        score: number
    ): ProposedTrade | null {
        // 1. Confluence check
        if (score < assistant.minConfluenceScore) {
            return null;
        }

        // 2. Capital Reservation Sizing Calculations
        const maxPositionSize = assistant.allocatedCapital * (assistant.maxPositionSizePercent / 100);
        const availableBotCash = assistant.allocatedCapital - assistant.deployedCapital;
        const availablePortfolioCash = portfolio.cashBalance - (portfolio.reservedCash || 0);

        const availableCash = Math.min(availablePortfolioCash, availableBotCash, maxPositionSize);
        if (availableCash < price) {
            return null; // Insufficient funds for even 1 share
        }

        const quantity = Math.floor(availableCash / price);
        if (quantity <= 0) {
            return null;
        }

        const cost = quantity * price;
        const slPrice = parseFloat((price * (1 - assistant.stopLossPercent / 100)).toFixed(2));
        const tpPrice = parseFloat((price * (1 + assistant.takeProfitPercent / 100)).toFixed(2));

        return {
            symbol,
            quantity,
            price,
            cost,
            slPrice,
            tpPrice
        };
    }
}
