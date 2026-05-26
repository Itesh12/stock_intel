import { IInfrastructure } from "./contracts/infrastructure";

export class SectorResolverService {
    // Local pre-cached sector mapping for top NSE symbols to ensure ultra-fast lookup
    private localSectorDb: Record<string, string> = {
        "RELIANCE.NS": "Energy",
        "TCS.NS": "Technology",
        "INFY.NS": "Technology",
        "HDFCBANK.NS": "Financials",
        "ICICIBANK.NS": "Financials",
        "WIT.NS": "Technology",
        "SBIN.NS": "Financials",
        "BHARTIARTL.NS": "Telecommunications",
        "ITC.NS": "Consumer Goods",
        "LT.NS": "Industrials",
        "HINDUNILVR.NS": "Consumer Goods"
    };

    constructor(private infra: IInfrastructure) {}

    /**
     * Resolves the industry sector of a symbol via Local DB -> Yahoo API -> Fallback.
     */
    public async resolveSector(symbol: string): Promise<string> {
        const cleanSymbol = symbol.toUpperCase().trim();

        // 1. Local Cache Lookup (O(1) complexity)
        if (this.localSectorDb[cleanSymbol]) {
            return this.localSectorDb[cleanSymbol];
        }

        // Try standard fallback without NS suffix
        const baseSymbol = cleanSymbol.replace(".NS", "");
        if (this.localSectorDb[baseSymbol]) {
            return this.localSectorDb[baseSymbol];
        }

        try {
            // 2. Yahoo Finance dynamic API lookup
            const info = await this.infra.market.getStockPrice(cleanSymbol);
            // Yahoo Finance adapter may expose sector under info, let's check or call getStockPrice
            // If getStockPrice doesn't return sector directly, let's fetch profile or fallback to "Unknown"
            if (info && (info as any).sector) {
                return (info as any).sector;
            }
        } catch (err) {
            // Suppress errors and continue to fallback to protect bot thread from blocking
            console.warn(`[SectorResolver] Failed to resolve sector for ${symbol} via API:`, err);
        }

        // 3. Graceful Fallback
        return "Unknown";
    }
}
