import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { symbols } = body;

        if (!Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json({ quotes: [] });
        }

        const infra = await getInfrastructure();

        const quotePromises = symbols.map(async (sym: string) => {
            const formattedSymbol = sym.includes('.') || sym.startsWith('^') || sym.includes('=') ? sym : `${sym}.NS`;
            try {
                // Try live market price first
                const stock = await infra.market.getStockPrice(formattedSymbol);
                if (stock && typeof stock.price === 'number' && stock.price > 0) {
                    return {
                        symbol: sym,
                        name: stock.name || sym.replace('.NS', ''),
                        price: stock.price
                    };
                }
            } catch (e) {
                console.warn(`[QuotesAPI] Failed to fetch live price for ${formattedSymbol}:`, e);
            }

            // Fallback to stockRepo DB price if live fetch fails
            try {
                const dbStock = await infra.stock.findBySymbol(sym) || await infra.stock.findBySymbol(formattedSymbol);
                if (dbStock && typeof dbStock.price === 'number' && dbStock.price > 0) {
                    return {
                        symbol: sym,
                        name: dbStock.name || sym.replace('.NS', ''),
                        price: dbStock.price
                    };
                }
            } catch { }

            return {
                symbol: sym,
                name: sym.replace('.NS', ''),
                price: 0
            };
        });

        const quotes = await Promise.all(quotePromises);

        return NextResponse.json({ quotes });
    } catch (err: any) {
        console.error("Batch quotes API error:", err);
        return NextResponse.json({ error: err.message || "Failed to fetch quotes" }, { status: 500 });
    }
}
