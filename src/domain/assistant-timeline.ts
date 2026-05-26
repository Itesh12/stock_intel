export type TimelineEventType = 
    | 'SIGNAL_GENERATED' 
    | 'SIGNAL_APPROVED' 
    | 'SIGNAL_REJECTED' 
    | 'TRADE_EXECUTED' 
    | 'STOP_LOSS_UPDATED' 
    | 'POSITION_CLOSED' 
    | 'RISK_STOPPED' 
    | 'PAUSED' 
    | 'RESUMED';

export interface AssistantTimelineEvent {
    id: string;
    assistantId: string;
    eventType: TimelineEventType;
    title: string;
    description: string;
    metadata?: any;
    createdAt: Date;
    expiresAt: Date | null; // TTL support
}

export interface AssistantTimelineRepository {
    saveBatch(events: AssistantTimelineEvent[]): Promise<void>;
    findByAssistantId(assistantId: string, limit?: number): Promise<AssistantTimelineEvent[]>;
}
