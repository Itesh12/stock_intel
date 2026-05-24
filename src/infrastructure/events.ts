import { EventEmitter } from "events";

export class GlobalEventEmitter extends EventEmitter {
    private static instance: GlobalEventEmitter;

    private constructor() {
        super();
        this.setMaxListeners(100);
    }

    public static getInstance(): GlobalEventEmitter {
        if (!GlobalEventEmitter.instance) {
            GlobalEventEmitter.instance = new GlobalEventEmitter();
        }
        return GlobalEventEmitter.instance;
    }

    public emitLog(botId: string, level: 'INFO' | 'WARN' | 'ERROR', category: string, message: string, metadata?: any) {
        const payload = {
            botId,
            timestamp: new Date(),
            level,
            category,
            message,
            metadata
        };
        this.emit(`log:${botId}`, payload);
        this.emit('log:any', payload);
    }
}

export const globalEvents = GlobalEventEmitter.getInstance();
