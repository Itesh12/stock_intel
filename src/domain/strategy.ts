export interface StrategyStep {
    id: string;
    title: string;
    description: string;
    formula?: string;
    requirements: string[];
}

export interface Strategy {
    id: string; // Database ID
    slug: string; // URL slug (e.g. 'canslim')
    name: string;
    trader: string;
    description: string;
    longDescription: string;
    objective: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    winRate: string;
    steps: StrategyStep[];
    riskManagement: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface StrategyRecommendation {
    id: string;
    strategyId: string;
    symbol: string;
    score: number;
    matchDetails: any; // Breakdown of which criteria passed
    timestamp: Date;
}
