import { Strategy, StrategyRecommendation } from "../domain/strategy";

export interface StrategyRepository {
    findBySlug(slug: string): Promise<Strategy | null>;
    list(): Promise<Strategy[]>;
    save(strategy: Strategy): Promise<void>;

    // Recommendations
    getRecommendations(strategyId: string): Promise<StrategyRecommendation[]>;
    saveRecommendations(strategyId: string, recommendations: StrategyRecommendation[]): Promise<void>;
    clearRecommendations(strategyId: string): Promise<void>;
}
