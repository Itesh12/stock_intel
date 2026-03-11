"use client";
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Search, X, TrendingUp, TrendingDown, Loader2, BarChart2, RefreshCcw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn, formatIndianNumber } from "@/lib/utils";

const METRICS = [
    { label: "Price", key: "price", format: (v: number) => `₹${v?.toFixed(2)}` },
    { label: "Market Cap", key: "marketCap", format: (v: number) => `₹${formatIndianNumber(v)}` },
    { label: "P/E Ratio", key: "peRatio", format: (v: number) => v?.toFixed(2) || "--" },
    { label: "EPS", key: "eps", format: (v: number) => v?.toFixed(2) || "--" },
    { label: "Beta", key: "beta", format: (v: number) => v?.toFixed(2) || "--" },
    { label: "52W High", key: "fiftyTwoWeekHigh", format: (v: number) => `₹${v?.toFixed(2)}` },
    { label: "52W Low", key: "fiftyTwoWeekLow", format: (v: number) => `₹${v?.toFixed(2)}` },
    { label: "Volume", key: "volume", format: (v: number) => formatIndianNumber(v) },
    { label: "Dividend Yield", key: "dividendYield", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--" },
    { label: "ROE", key: "roe", format: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "--" },
];

function StockSearchInput({ onSelect, placeholder, selected }: { onSelect: (symbol: string) => void; placeholder: string; selected?: string }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (q: string) => {
        setQuery(q);
        if (q.length < 2) { setResults([]); return; }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`);
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
                <button onClick={() => onSelect('')} className="ml-auto text-slate-600 hover:text-rose-400 transition-colors">
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus-within:border-blue-500 transition-all">
                {isSearching ? <Loader2 size={14} className="animate-spin text-slate-500" /> : <Search size={14} className="text-slate-500" />}
                <input
                    className="bg-transparent text-white text-sm font-medium w-full focus:outline-none placeholder:text-slate-600"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
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

    const fetchData = useCallback(async (symA: string, symB: string) => {
        if (!symA || !symB) return;
        setIsLoading(true);
        try {
            const [priceA, priceB, hA, hB] = await Promise.all([
                fetch(`/api/stock/price?symbol=${symA}`).then(r => r.json()),
                fetch(`/api/stock/price?symbol=${symB}`).then(r => r.json()),
                fetch(`/api/stock/history?symbol=${symA}&period=3mo`).then(r => r.json()),
                fetch(`/api/stock/history?symbol=${symB}&period=3mo`).then(r => r.json()),
            ]);
            setDataA(priceA);
            setDataB(priceB);
            setHistA(hA);
            setHistB(hB);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleCompare = () => {
        if (stockA && stockB) fetchData(stockA, stockB);
    };

    // Normalize price to 100 for overlay chart (percent change from start)
    const mergedChartData = histA.map((d: any, i: number) => {
        const baseA = histA[0]?.close || 1;
        const baseB = histB[0]?.close || 1;
        return {
            date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            [stockA?.replace(/\.(NS|BO)$/, '') || 'A']: parseFloat((( (histA[i]?.close || 0) / baseA - 1) * 100).toFixed(2)),
            [stockB?.replace(/\.(NS|BO)$/, '') || 'B']: parseFloat((( (histB[i]?.close || 0) / baseB - 1) * 100).toFixed(2)),
        };
    }).filter((_, i) => i % 3 === 0); // Sample every 3rd point for performance

    const nameA = stockA?.replace(/\.(NS|BO)$/, '') || 'Stock A';
    const nameB = stockB?.replace(/\.(NS|BO)$/, '') || 'Stock B';

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto py-8 px-6">
            <div className="text-center">
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
                    <Scale size={14} className="text-blue-400" />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Side-by-Side Intelligence</span>
                </div>
                <h1 className="text-5xl font-black text-white tracking-tighter mb-4">Stock <span className="text-blue-500">Duel</span></h1>
                <p className="text-slate-500 font-medium text-sm max-w-lg mx-auto">
                    Compare fundamentals, technicals, and historical performance between two stocks in a head-to-head showdown.
                </p>
            </div>

            {/* Search Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 max-w-xl mx-auto">
                <div className="flex-1 w-full">
                    <StockSearchInput placeholder="Search Stock A..." selected={stockA} onSelect={sym => { setStockA(sym); setDataA(null); }} />
                </div>
                <div className="text-slate-700 font-black text-lg">VS</div>
                <div className="flex-1 w-full">
                    <StockSearchInput placeholder="Search Stock B..." selected={stockB} onSelect={sym => { setStockB(sym); setDataB(null); }} />
                </div>
                <button
                    onClick={handleCompare}
                    disabled={!stockA || !stockB || isLoading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap shadow-xl shadow-blue-900/20"
                >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <BarChart2 size={14} />}
                    Compare
                </button>
            </div>

            <AnimatePresence>
                {dataA && dataB && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Price Headline */}
                        <div className="grid grid-cols-2 gap-6">
                            {[{ name: nameA, data: dataA, color: 'blue' }, { name: nameB, data: dataB, color: 'violet' }].map(({ name, data, color }) => (
                                <div key={name} className="bg-white/[0.03] border border-white/5 rounded-3xl p-8 text-center">
                                    <div className={cn(
                                        "text-[10px] font-black mb-3 px-3 py-1 rounded-full inline-block uppercase tracking-widest border",
                                        color === 'blue' ? "text-blue-400 bg-blue-400/10 border-blue-400/20" : "text-violet-400 bg-violet-400/10 border-violet-400/20"
                                    )}>
                                        {name}
                                    </div>
                                    <div className="text-4xl font-black text-white tracking-tighter mb-2">₹{data.price?.toFixed(2)}</div>
                                    <div className={cn("text-sm font-black", (data.changePercent ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {(data.changePercent ?? 0) >= 0 ? "+" : ""}{data.changePercent?.toFixed(2)}%
                                        {(data.changePercent ?? 0) >= 0 ? <TrendingUp size={14} className="inline ml-1.5 mb-0.5" /> : <TrendingDown size={14} className="inline ml-1.5 mb-0.5" />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Overlaid Chart */}
                        {mergedChartData.length > 0 && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-lg font-black text-white tracking-tight">3-Month Performance</h2>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Indexed to 100 — Equal Start Comparison</p>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={mergedChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} />
                                        <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#475569' }} />
                                        <Tooltip
                                            contentStyle={{ background: '#0a0a0b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                                            formatter={(v: any) => [`${v}%`]}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey={nameA} stroke="#3b82f6" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey={nameB} stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Metrics Grid */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden">
                            <div className="p-6 border-b border-white/5">
                                <h2 className="text-lg font-black text-white tracking-tight">Fundamental Comparison</h2>
                            </div>
                            <div className="divide-y divide-white/5">
                                <div className="grid grid-cols-3 gap-4 px-6 py-3 bg-white/[0.02]">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Metric</div>
                                    <div className={cn("text-[9px] font-black text-blue-400 uppercase tracking-widest text-center")}>{nameA}</div>
                                    <div className={cn("text-[9px] font-black text-violet-400 uppercase tracking-widest text-center")}>{nameB}</div>
                                </div>
                                {METRICS.map(m => {
                                    const vA = dataA?.[m.key];
                                    const vB = dataB?.[m.key];
                                    const aIsWinner = vA !== undefined && vB !== undefined && vA > vB;
                                    const bIsWinner = vA !== undefined && vB !== undefined && vB > vA;
                                    return (
                                        <div key={m.key} className="grid grid-cols-3 gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                                            <div className="text-xs font-bold text-slate-400">{m.label}</div>
                                            <div className={cn("text-xs font-black text-center", aIsWinner ? "text-blue-400" : "text-white")}>
                                                {m.format(vA)}
                                            </div>
                                            <div className={cn("text-xs font-black text-center", bIsWinner ? "text-violet-400" : "text-white")}>
                                                {m.format(vB)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!dataA && !dataB && !isLoading && (
                <div className="py-20 text-center opacity-30">
                    <Scale size={48} className="mx-auto mb-4 text-slate-700" />
                    <p className="text-sm font-bold text-slate-500">Select two stocks above to start the duel</p>
                </div>
            )}
        </div>
    );
}
