"use client";
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Search, X, TrendingUp, TrendingDown, Loader2, BarChart2, RefreshCcw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn, formatIndianNumber } from "@/lib/utils";
import TimeframeSelector from "../timeframe-selector";
import { GlobalLoader } from "@/components/ui/global-loader";

interface Metric {
    label: string;
    key: string;
    format: (v: any) => string;
    higherIsBetter?: boolean;
    lowerIsBetter?: boolean;
    noCompare?: boolean;
}

interface MetricCategory {
    name: string;
    metrics: Metric[];
}

const METRIC_CATEGORIES: MetricCategory[] = [
    {
        name: "Market Valuation",
        metrics: [
            { label: "Market Cap", key: "marketCap", format: (v: number) => `₹${formatIndianNumber(v)}` },
            { label: "Enterprise Value", key: "enterpriseValue", format: (v: number) => `₹${formatIndianNumber(v || 0)}` },
            { label: "EV / Revenue", key: "enterpriseToRevenue", format: (v: number) => v?.toFixed(2) || "--", lowerIsBetter: true },
            { label: "EV / EBITDA", key: "enterpriseToEbitda", format: (v: number) => v?.toFixed(2) || "--", lowerIsBetter: true },
            { label: "Price / Sales", key: "priceToSales", format: (v: number) => v?.toFixed(2) || "--", lowerIsBetter: true },
            { label: "Shares Outstanding", key: "sharesOutstanding", format: (v: number) => formatIndianNumber(v || 0) },
            { label: "Float Shares", key: "floatShares", format: (v: number) => formatIndianNumber(v || 0) },
            { label: "Symbol", key: "symbol", format: (v: string) => v, noCompare: true },
        ]
    },
    {
        name: "Valuation Ratios",
        metrics: [
            { label: "P/E Ratio (TTM)", key: "peRatio", format: (v: number) => v?.toFixed(2) || "--", lowerIsBetter: true },
            { label: "Forward P/E", key: "forwardPe", format: (v: number) => v?.toFixed(2) || "--", lowerIsBetter: true },
            { label: "P/B Ratio", key: "pbRatio", format: (v: number) => v?.toFixed(2) || "--", lowerIsBetter: true },
            { label: "Dividend Yield", key: "dividendYield", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "0.00%", higherIsBetter: true },
            { label: "Beta (Risk)", key: "beta", format: (v: number) => v?.toFixed(2) || "--", lowerIsBetter: true },
            { label: "52W High", key: "fiftyTwoWeekHigh", format: (v: number) => `₹${formatIndianNumber(v || 0)}` },
            { label: "52W Low", key: "fiftyTwoWeekLow", format: (v: number) => `₹${formatIndianNumber(v || 0)}` },
        ]
    },
    {
        name: "Profitability Hub",
        metrics: [
            { label: "Return on Equity (ROE)", key: "roe", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--", higherIsBetter: true },
            { label: "Return on Assets (ROA)", key: "roa", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--", higherIsBetter: true },
            { label: "Gross Margins", key: "grossMargins", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--", higherIsBetter: true },
            { label: "Operating Margins", key: "operatingMargins", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--", higherIsBetter: true },
            { label: "Profit Margins", key: "profitMargins", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--", higherIsBetter: true },
            { label: "EBITDA Margins", key: "ebitdaMargins", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--", higherIsBetter: true },
            { label: "Revenue Growth (YoY)", key: "revenueGrowth", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--", higherIsBetter: true },
            { label: "Earnings Growth (YoY)", key: "earningsGrowth", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--", higherIsBetter: true },
        ]
    },
    {
        name: "Financial Health",
        metrics: [
            { label: "Debt to Equity", key: "debtToEquity", format: (v: number) => v?.toFixed(2) || "--", lowerIsBetter: true },
            { label: "Current Ratio", key: "currentRatio", format: (v: number) => v?.toFixed(2) || "--", higherIsBetter: true },
            { label: "Quick Ratio", key: "quickRatio", format: (v: number) => v?.toFixed(2) || "--", higherIsBetter: true },
            { label: "Total Cash", key: "totalCash", format: (v: number) => `₹${formatIndianNumber(v || 0)}`, higherIsBetter: true },
            { label: "Total Debt", key: "totalDebt", format: (v: number) => `₹${formatIndianNumber(v || 0)}`, lowerIsBetter: true },
            { label: "Free Cash Flow", key: "freeCashflow", format: (v: number) => `₹${formatIndianNumber(v || 0)}`, higherIsBetter: true },
            { label: "Operating Cash Flow", key: "operatingCashflow", format: (v: number) => `₹${formatIndianNumber(v || 0)}`, higherIsBetter: true },
            { label: "Book Value", key: "bookValue", format: (v: number) => `₹${v?.toFixed(2) || "--"}`, higherIsBetter: true },
        ]
    },
    {
        name: "Battle Performance",
        metrics: [
            { label: "Period Return", key: "changePercent", format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, higherIsBetter: true },
            { label: "Range High", key: "high", format: (v: number) => `₹${formatIndianNumber(v || 0)}`, higherIsBetter: true },
            { label: "Range Low", key: "low", format: (v: number) => `₹${formatIndianNumber(v || 0)}`, lowerIsBetter: true },
        ]
    },
    {
        name: "Ownership & Trend",
        metrics: [
            { label: "Insider Ownership", key: "insiderOwnership", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--" },
            { label: "Inst. Ownership", key: "institutionOwnership", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--" },
            { label: "52W Price Change", key: "fiftyTwoWeekChange", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--", higherIsBetter: true },
            { label: "EPS (TTM)", key: "eps", format: (v: number) => `₹${v?.toFixed(2) || "--"}`, higherIsBetter: true },
            { label: "EPS Forward", key: "epsForward", format: (v: number) => `₹${v?.toFixed(2) || "--"}`, higherIsBetter: true },
        ]
    }
];

function ComparisonResult({ dataA, dataB, nameA, nameB, period }: { dataA: any; dataB: any; nameA: string; nameB: string; period: string }) {
    const scores = { a: 0, b: 0 };
    let totalCompared = 0;
    
    METRIC_CATEGORIES.forEach(cat => {
        cat.metrics.forEach(m => {
            if (m.noCompare) return;
            const vA = dataA[m.key];
            const vB = dataB[m.key];
            if (vA === undefined || vB === undefined || vA === null || vB === null) return;
            
            totalCompared++;
            if (m.higherIsBetter) {
                if (vA > vB) scores.a++; else if (vB > vA) scores.b++;
            } else if (m.lowerIsBetter) {
                if (vA < vB) scores.a++; else if (vB < vA) scores.b++;
            } else {
                // If no preference, just count as comparison but no score? 
                // Usually we want to score everything. For things like Market Cap, higher is often better (size).
                // Let's assume higher is better for unspecified metrics except neutral ones.
                if (vA > vB) scores.a++; else if (vB > vA) scores.b++;
            }
        });
    });

    const categoryWins = METRIC_CATEGORIES.map(cat => {
        let aTotalWins = 0, bTotalWins = 0;
        cat.metrics.forEach(m => {
            if (m.noCompare) return;
            const vA = dataA[m.key];
            const vB = dataB[m.key];
            if (vA === undefined || vB === undefined || vA === null || vB === null) return;
            if (m.higherIsBetter || (!m.lowerIsBetter && vA > vB)) {
                if (vA > vB) aTotalWins++; else if (vB > vA) bTotalWins++;
            } else if (m.lowerIsBetter) {
                if (vA < vB) aTotalWins++; else if (vB < vA) bTotalWins++;
            }
        });
        return { name: cat.name, winner: aTotalWins > bTotalWins ? 'a' : bTotalWins > aTotalWins ? 'b' : 'draw' };
    });

    const overallWinner = scores.a > scores.b ? 'a' : scores.b > scores.a ? 'b' : 'draw';
    const winnerName = overallWinner === 'a' ? nameA : nameB;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-indigo-600/5 border border-indigo-500/10 rounded-[32px] p-6 md:p-10 relative overflow-hidden group"
        >
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <Scale size={18} className="text-indigo-400" />
                        </div>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Comparison Result • {period} period</span>
                    </div>
                    
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                        {overallWinner === 'draw' ? "Both stocks are performing well" : `${winnerName} is performing better`}
                    </h2>
                    
                    <p className="text-slate-500 font-medium leading-relaxed max-w-md text-sm">
                        Comparing {totalCompared} individual data points across {METRIC_CATEGORIES.length} main categories, 
                        {overallWinner === 'draw' 
                            ? " both stocks have similar strengths in different areas." 
                            : ` ${winnerName} is winning in more metrics, especially in ${categoryWins.find(c => c.winner === overallWinner)?.name}.`}
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {categoryWins.map(cat => (
                            <div key={cat.name} className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{cat.name}:</span>
                                <span className={cn(
                                    "text-[8px] font-black uppercase",
                                    cat.winner === 'a' ? "text-blue-400" : cat.winner === 'b' ? "text-violet-400" : "text-amber-400"
                                )}>
                                    {cat.winner === 'a' ? nameA : cat.winner === 'b' ? nameB : 'Equal'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-center lg:justify-end gap-10">
                    <div className="text-center space-y-1">
                        <div className={cn(
                            "text-5xl font-black tracking-tighter",
                            overallWinner === 'a' ? "text-blue-500" : "text-slate-800"
                        )}>{scores.a}</div>
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{nameA}</div>
                    </div>
                    <div className="text-xl font-black text-slate-800 italic">VS</div>
                    <div className="text-center space-y-1">
                        <div className={cn(
                            "text-5xl font-black tracking-tighter",
                            overallWinner === 'b' ? "text-violet-500" : "text-slate-800"
                        )}>{scores.b}</div>
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{nameB}</div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function StockSearchInput({ onSelect, placeholder, selected }: { onSelect: (symbol: string) => void; placeholder: string; selected?: string }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (q: string) => {
        const caps = q.toUpperCase();
        setQuery(caps);
        if (caps.length < 2) { setResults([]); return; }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/stock/search?q=${encodeURIComponent(caps)}`);
            const data = await res.json();
            setResults(data.slice(0, 5));
        } finally {
            setIsSearching(false);
        }
    };

    if (selected) {
        return (
            <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl">
                <span className="font-black text-white text-sm">{selected.replace(/\.(NS|BO)$/, '')}</span>
                <button onClick={() => { onSelect(''); setQuery(''); }} className="ml-auto text-slate-600 hover:text-rose-400 transition-colors">
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus-within:border-blue-500 transition-all">
                {isSearching ? (
                   <div className="w-3.5 h-3.5"><GlobalLoader minimal={true} /></div>
                ) : <Search size={14} className="text-slate-500" />}
                <input
                    className="bg-transparent text-white text-sm font-medium w-full focus:outline-none placeholder:text-slate-600 uppercase"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => handleSearch(e.target.value.toUpperCase())}
                />
            </div>
            <AnimatePresence>
                {results.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute top-full mt-2 left-0 right-0 bg-[#111] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl"
                    >
                        {results.map((r: any) => (
                            <button
                                key={r.symbol}
                                onClick={() => { onSelect(r.symbol); setResults([]); setQuery(''); }}
                                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3"
                            >
                                <span className="text-xs font-black text-white">{r.symbol?.replace(/\.(NS|BO)$/, '')}</span>
                                <span className="text-[10px] text-slate-500 truncate">{r.name}</span>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function ComparisonPage() {
    const [stockA, setStockA] = useState<string>("");
    const [stockB, setStockB] = useState<string>("");
    const [dataA, setDataA] = useState<any>(null);
    const [dataB, setDataB] = useState<any>(null);
    const [histA, setHistA] = useState<any[]>([]);
    const [histB, setHistB] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [period, setPeriod] = useState("3mo");

    const fetchHistory = useCallback(async (symA: string, symB: string, p: string) => {
        setIsHistoryLoading(true);
        try {
            const [hA, hB] = await Promise.all([
                fetch(`/api/stock/history?symbol=${symA}&period=${p}`).then(r => r.json()),
                fetch(`/api/stock/history?symbol=${symB}&period=${p}`).then(r => r.json()),
            ]);
            setHistA(hA || []);
            setHistB(hB || []);
        } catch (err) {
            console.error("History fetch failed", err);
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);

    const fetchData = useCallback(async (symA: string, symB: string) => {
        if (!symA || !symB) return;
        setIsLoading(true);
        const t = Date.now();
        try {
            const [perfA, perfB, hA, hB] = await Promise.all([
                fetch(`/api/stock/performance?symbol=${symA}&period=${period}&_t=${t}`).then(r => r.json()),
                fetch(`/api/stock/performance?symbol=${symB}&period=${period}&_t=${t}`).then(r => r.json()),
                fetch(`/api/stock/history?symbol=${symA}&period=${period}&_t=${t}`).then(r => r.json()),
                fetch(`/api/stock/history?symbol=${symB}&period=${period}&_t=${t}`).then(r => r.json()),
            ]);
            
            setDataA({ ...perfA, price: perfA.currentPrice });
            setDataB({ ...perfB, price: perfB.currentPrice });
            setHistA(hA || []);
            setHistB(hB || []);
        } catch (err) {
            console.error("Comparison fetch failed", err);
        } finally {
            setIsLoading(false);
        }
    }, [period]);

    const handleCompare = () => {
        if (stockA && stockB) fetchData(stockA, stockB);
    };

    // Re-fetch all data when period changes to apply to all metrics
    React.useEffect(() => {
        if (stockA && stockB && dataA && dataB) {
            fetchData(stockA, stockB);
        }
    }, [period]);

    // Normalize price to 100 for overlay chart (percent change from start)
    const mergedChartData = React.useMemo(() => {
        if (!histA.length || !histB.length) return [];
        
        const nameKeyA = stockA?.replace(/\.(NS|BO)$/, '') || 'A';
        const nameKeyB = stockB?.replace(/\.(NS|BO)$/, '') || 'B';
        const baseA = histA[0]?.close || 1;
        const baseB = histB[0]?.close || 1;

        // Map B's data by date for alignment
        const bMap = new Map(histB.map((d: any) => [new Date(d.date).setHours(0,0,0,0), d.close]));
        
        return histA.map((d: any) => {
            const dateObj = new Date(d.date);
            const ts = dateObj.setHours(0,0,0,0);
            const closeB = bMap.get(ts);
            
            if (closeB === undefined) return null;

            return {
                date: dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
                [nameKeyA]: parseFloat((( d.close / baseA - 1) * 100).toFixed(2)),
                [nameKeyB]: parseFloat((( closeB / baseB - 1) * 100).toFixed(2)),
            };
        }).filter(Boolean).filter((_, i, arr) => {
            if (period === '1y') return i % 10 === 0 || i === arr.length - 1;
            if (period === '5y') return i % 30 === 0 || i === arr.length - 1;
            if (period === '3mo') return i % 3 === 0 || i === arr.length - 1;
            return true;
        });
    }, [histA, histB, stockA, stockB, period]);

    const nameA = stockA?.replace(/\.(NS|BO)$/, '') || 'Stock A';
    const nameB = stockB?.replace(/\.(NS|BO)$/, '') || 'Stock B';

    return (
        <div className="space-y-8 md:space-y-12 pb-24 py-4 md:py-8 container max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center">
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-6">
                    <Scale size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Stock Comparison</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-white tracking-tighter mb-4 leading-none uppercase">Stock <span className="text-indigo-500">Battle</span></h1>
                <p className="text-slate-500 font-medium text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
                    Compare two stocks to see which one is stronger in price, profits, and financial health.
                </p>
            </div>

            {/* Search Bar */}
            <div className="flex flex-col lg:flex-row items-center gap-4 w-full bg-white/[0.02] border border-white/5 p-4 rounded-[32px] sm:rounded-[40px] shadow-2xl">
                <div className="flex-1 w-full">
                    <StockSearchInput placeholder="Search first stock..." selected={stockA} onSelect={sym => { setStockA(sym); setDataA(null); }} />
                </div>
                <div className="text-slate-700 font-black text-lg italic px-2">VS</div>
                <div className="flex-1 w-full">
                    <StockSearchInput placeholder="Search second stock..." selected={stockB} onSelect={sym => { setStockB(sym); setDataB(null); }} />
                </div>
                <button
                    onClick={handleCompare}
                    disabled={!stockA || !stockB || isLoading}
                    className="w-full lg:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl"
                >
                    {isLoading ? (
                        <div className="w-4 h-4"><GlobalLoader minimal={true} /></div>
                    ) : <BarChart2 size={16} />}
                    Compare
                </button>
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <GlobalLoader title="Comparing Data" />
                    </motion.div>
                ) : dataA && dataB ? (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-12"
                    >
                        {/* Global Period Filter Selection */}
                        <div className="flex justify-end pr-4">
                            <TimeframeSelector current={period} onSelect={setPeriod} />
                        </div>

                        {/* Comparison Result */}
                        <ComparisonResult dataA={dataA} dataB={dataB} nameA={nameA} nameB={nameB} period={period} />

                        {/* Price Headline */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[{ name: nameA, data: dataA, color: 'blue' }, { name: nameB, data: dataB, color: 'violet' }].map(({ name, data, color }) => (
                                <div key={name} className="bg-white/[0.03] border border-white/5 rounded-[40px] p-8 sm:p-10 text-center relative overflow-hidden group">
                                    <div className={cn(
                                        "text-[9px] font-black mb-4 px-4 py-1.5 rounded-full inline-block uppercase tracking-widest border",
                                        color === 'blue' ? "text-blue-400 bg-blue-400/10 border-blue-400/20" : "text-violet-400 bg-violet-400/10 border-violet-400/20"
                                    )}>
                                        {name}
                                    </div>
                                    <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tighter mb-3 leading-none italic">
                                        ₹{(data.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className={cn(
                                        "text-base font-black flex items-center justify-center gap-2", 
                                        (data.changePercent ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {(data.changePercent ?? 0) >= 0 ? "+" : ""}{(data.changePercent || 0).toFixed(2)}%
                                        {(data.changePercent ?? 0) >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Chart Area */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-[48px] p-6 sm:p-12 shadow-2xl relative overflow-hidden">
                            <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight italic">Returns Comparison</h2>
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1.5">How much $100 would have grown</p>
                                </div>
                            </div>
                            
                            <div className="h-[400px] w-full mt-4 relative">
                                {isHistoryLoading && (
                                    <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-3xl">
                                        <div className="w-8 h-8"><GlobalLoader minimal={true} /></div>
                                    </div>
                                )}
                                {mergedChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={mergedChartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                            <XAxis 
                                                dataKey="date" 
                                                tick={{ fontSize: 9, fill: '#475569', fontWeight: 800 }} 
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis 
                                                tickFormatter={v => `${v}%`} 
                                                tick={{ fontSize: 9, fill: '#475569', fontWeight: 800 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                contentStyle={{ 
                                                    background: '#0a0a0b', 
                                                    border: '1px solid rgba(255,255,255,0.1)', 
                                                    borderRadius: '16px', 
                                                    padding: '12px',
                                                    fontSize: '10px',
                                                    fontWeight: 'bold',
                                                }}
                                                itemStyle={{ fontWeight: 800 }}
                                            />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            <Line type="monotone" dataKey={nameA} stroke="#3b82f6" strokeWidth={3} dot={false} animationDuration={1000} />
                                            <Line type="monotone" dataKey={nameB} stroke="#8b5cf6" strokeWidth={3} dot={false} animationDuration={1000} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-700 italic font-black uppercase tracking-widest text-[10px]">
                                        Loading chart data...
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Metrics Category Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {METRIC_CATEGORIES.map((category) => (
                                <div key={category.name} className="bg-white/[0.03] border border-white/5 rounded-[40px] overflow-hidden shadow-xl">
                                    <div className="p-6 sm:p-8 border-b border-white/5 bg-white/[0.01]">
                                        <h2 className="text-lg font-black text-white tracking-tighter uppercase">{category.name}</h2>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        <div className="grid grid-cols-3 gap-4 px-8 py-3 bg-black/20">
                                            <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Metric</div>
                                            <div className="text-[8px] font-black text-blue-400/60 uppercase tracking-widest text-center">{nameA}</div>
                                            <div className="text-[8px] font-black text-violet-400/60 uppercase tracking-widest text-center">{nameB}</div>
                                        </div>
                                        {category.metrics.map(m => {
                                            const vA = dataA?.[m.key];
                                            const vB = dataB?.[m.key];
                                            let aIsWinner = false;
                                            let bIsWinner = false;

                                            if (vA !== undefined && vB !== undefined && vA !== null && vB !== null && !m.noCompare) {
                                                if (m.higherIsBetter) {
                                                    aIsWinner = vA > vB; bIsWinner = vB > vA;
                                                } else if (m.lowerIsBetter) {
                                                    aIsWinner = vA < vB; bIsWinner = vB < vA;
                                                }
                                            }

                                            return (
                                                <div key={m.key} className="grid grid-cols-3 gap-4 px-8 py-4 items-center group">
                                                    <div className="text-[11px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors">{m.label}</div>
                                                    <div className={cn(
                                                        "text-[11px] font-black text-center whitespace-nowrap px-2 py-1 rounded-xl",
                                                        aIsWinner ? "text-blue-400 bg-blue-400/10 border border-blue-400/10" : "text-white"
                                                    )}>
                                                        {m.format(vA) || "--"}
                                                    </div>
                                                    <div className={cn(
                                                        "text-[11px] font-black text-center whitespace-nowrap px-2 py-1 rounded-xl",
                                                        bIsWinner ? "text-violet-400 bg-violet-400/10 border border-violet-400/10" : "text-white"
                                                    )}>
                                                        {m.format(vB) || "--"}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    <div className="py-20 text-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 group hover:border-indigo-500/30 transition-colors">
                            <Scale size={32} className="text-slate-700 group-hover:text-indigo-500/50 transition-colors" />
                        </div>
                        <p className="text-sm font-black text-slate-600 uppercase tracking-[0.2em]">Select stocks to compare</p>
                        <p className="text-[10px] text-slate-700 font-bold mt-2 italic px-10">Choose two companies above to see who wins the battle</p>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
