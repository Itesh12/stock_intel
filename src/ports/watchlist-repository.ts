import { Watchlist } from "../domain/watchlist";

export interface WatchlistRepository {
    findByUserId(userId: string): Promise<Watchlist | null>;
    save(watchlist: Watchlist): Promise<void>;
    addSymbol(userId: string, symbol: string): Promise<void>;
    removeSymbol(userId: string, symbol: string): Promise<void>;
}
