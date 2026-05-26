export type SignalStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED';

export interface DecisionReasoning {
    decision: 'BUY' | 'SELL' | 'SKIP';
    confidence: number;
    reasons: {
        key: string;
        label: string;
        status: 'PASS' | 'FAIL' | 'WARN';
        description: string;
    }[];
    generatedAt: Date;
}

export interface AssistantSignal {
    id: string;
    assistantId: string;
    symbol: string;
    signalType: 'BUY' | 'SELL';
    strategy: string;
    score: number;
    confidence: number;
    status: SignalStatus;
    reasoning: DecisionReasoning;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date | null; // For safe TTL auto-deletion
}

export interface AssistantSignalRepository {
    save(signal: AssistantSignal, session?: any): Promise<void>;
    findById(id: string, session?: any): Promise<AssistantSignal | null>;
    findByAssistantId(assistantId: string, limit?: number): Promise<AssistantSignal[]>;
    updateStatus(
        id: string, 
        status: SignalStatus, 
        reasoning?: DecisionReasoning, 
        expiresAt?: Date | null,
        session?: any
    ): Promise<void>;
    pruneExpired(expirationTime: Date): Promise<number>;
    deleteByAssistantId(assistantId: string, session?: any): Promise<void>;
}
