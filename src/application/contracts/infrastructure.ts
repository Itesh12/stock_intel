import { StockRepository } from "../../ports/stock-repository";
import { PortfolioRepository } from "../../ports/portfolio-repository";
import { UserRepository } from "../../ports/user-repository";
import { TradeRepository } from "../../ports/trade-repository";
import { WatchlistRepository } from "../../ports/watchlist-repository";
import { AnalyticsRepository } from "../../domain/analytics";
import { LimitOrderRepository } from "../../domain/limit-order";
import { StrategyRepository } from "../../ports/strategy-repository";
import { NotificationRepository } from "../../ports/notification-repository";
import { MarketDataPort } from "../../ports/market-data-port";
import { AssistantLogRepository } from "../../domain/assistant-log";
import { StrategyAssistantRepository } from "../../domain/strategy-assistant";
import { WorkerHealthRepository } from "../../domain/worker-health";

export interface IInfrastructure {
    stock: StockRepository;
    portfolio: PortfolioRepository;
    user: UserRepository;
    trade: TradeRepository;
    watchlist: WatchlistRepository;
    analytics: AnalyticsRepository;
    limitOrder: LimitOrderRepository;
    strategy: StrategyRepository;
    notification: NotificationRepository;
    market: MarketDataPort;
    assistantLog: AssistantLogRepository;
    strategyAssistant: StrategyAssistantRepository;
    mongoClient: any;
    workerHealth: WorkerHealthRepository;
}
