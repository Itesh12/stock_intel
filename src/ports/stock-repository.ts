import { Stock } from "../domain/stock";

export interface StockRepository {
    findById(id: string): Promise<Stock | null>;
    findBySymbol(symbol: string): Promise<Stock | null>;
    save(stock: Stock): Promise<void>;
    list(): Promise<Stock[]>;
    delete(id: string): Promise<void>;
}
