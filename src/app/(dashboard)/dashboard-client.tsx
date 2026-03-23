"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    TrendingUp, Activity, Zap, Shield,
    ArrowUpRight, ArrowDownRight, AlertCircle,
    Globe, Gauge, Hexagon, Coins, Landmark, Repeat,
    Banknote, Timer, Loader2, Star, Plus, Info
} from "lucide-react";
import Link from "next/link";
import { formatIndianNumber } from "@/lib/utils";
import TimeframeSelector from "./timeframe-selector";
import { CandleLoader } from "@/components/ui/candle-loader";
import { motion, AnimatePresence } from "framer-motion";

interface MarketDataPoint {
    symbol: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    volume?: number;
    label?: string;
    low?: number;
    high?: number;
}

export default function DashboardClient({ initialData }: { initialData: MarketDataPoint[] }) {
    const [timeframe, setTimeframe] = useState("1d");
    const [marketData, setMarketData] = useState<MarketDataPoint[]>(initialData);
    const [watchlistData, setWatchlistData] = useState<MarketDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);
    const [newSymbol, setNewSymbol] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        const isInitial = timeframe === "1d" && marketData === initialData;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/market/all-data?timeframe=${timeframe}&_t=${Date.now()}`, {
                    cache: 'no-store'
                });
                if (!res.ok) throw new Error("Failed to fetch");
                const newData = await res.json();
                setMarketData(newData);
            } catch (err) {
                console.error("Dashboard refresh failed", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (!isInitial) fetchData();
        fetchWatchlist();
    }, [timeframe]);

    const fetchWatchlist = async () => {
        setIsWatchlistLoading(true);
        try {
            const res = await fetch('/api/watchlist/data');
            const data = await res.json();
            if (Array.isArray(data)) {
                setWatchlistData(data);
            }
        } catch (err) {
            console.error("Watchlist fetch failed", err);
        } finally {
            setIsWatchlistLoading(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setSearchResults([]);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (newSymbol.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/stock/search?q=${encodeURIComponent(newSymbol)}`);
                const data = await res.json();
                setSearchResults(data);
            } catch (err) {
                console.error("Watchlist search failed", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [newSymbol]);

    const submitSymbol = async (symbolToAdd: string) => {
        if (!symbolToAdd.trim()) return;

        if (watchlistData.length >= 20) {
            alert("Watchlist limit reached. You can only track up to 20 stocks.");
            return;
        }

        setIsAdding(true);
        try {
            const res = await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: symbolToAdd.toUpperCase(), action: 'ADD' })
            });
            if (res.ok) {
                setNewSymbol("");
                setSearchResults([]);
                await fetchWatchlist();
            }
        } catch (err) {
            console.error("Failed to add to watchlist", err);
        } finally {
            setIsAdding(false);
        }
    };

    const handleAddWatchlist = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitSymbol(newSymbol);
    };

    const getPerf = (sym: string) => marketData.find(m => m.symbol === sym) || { currentPrice: 0, changePercent: 0, volume: 0 };

    // Derived Logic (Same as before but reactive to state)
    const nifty = getPerf('^NSEI');
    const vix = getPerf('^INDIAVIX');

    const sectorSymbols = [
        { label: "Financials", sym: "^NSEBANK" },
        { label: "IT", sym: "^CNXIT" },
        { label: "Energy", sym: "^CNXENERGY" },
        { label: "FMCG", sym: "^CNXFMCG" },
        { label: "Pharma", sym: "^CNXPHARMA" },
        { label: "Metals", sym: "^CNXMETAL" }
    ];

    const sectors = sectorSymbols.map(s => {
        const data = getPerf(s.sym);
        return {
            ...s,
            ...data,
            price: data.currentPrice,
            momentum: (data.changePercent || 0) * (Math.log10(data.volume || 1) / 10)
        };
    });

    // Granular Market Breadth (using all 50+ stocks from data)
    const stockData = marketData.filter(m => m.symbol.endsWith('.NS'));
    const advances = stockData.filter(s => (s.changePercent || 0) > 0).length;
    const declines = stockData.filter(s => (s.changePercent || 0) < 0).length;
    
    // Breadth as percentage of advancing stocks (Real market-wide view)
    const activeSample = advances + declines;
    const breadthPercent = activeSample > 0 ? (advances / activeSample) * 100 : 50;
    const breadthLabel = breadthPercent > 60 ? "STRONG BREADTH" : breadthPercent < 40 ? "WEAK BREADTH" : "NEUTRAL BREADTH";
    
    const avgSectorChange = sectors.reduce((acc, s) => acc + (s.changePercent || 0), 0) / (sectors.length || 1);
    const sentimentScore = Math.min(Math.max(Math.round(50 + (avgSectorChange * 15)), 15), 95);
    
    const vixValue = vix.currentPrice || 12.5;
    // Normalized VIX impact: 16 is calm, 22+ is panic.
    const vixEffect = (16 - vixValue) * 1.2; 
    const healthIndex = Math.min(Math.max(Math.round(((100 - sentimentScore) * 0.1) + (sentimentScore * 0.9) + vixEffect), 15), 99);
    
    let regime: 'EXPANSION' | 'DISTRIBUTION' | 'CAPITULATION' | 'COMPRESSION' = 'COMPRESSION';
    if (breadthPercent > 60 && vixValue < 18) regime = 'EXPANSION';
    else if ((nifty.changePercent || 0) > 0 && breadthPercent < 45) regime = 'DISTRIBUTION';
    else if (vixValue > 25 && breadthPercent < 35) regime = 'CAPITULATION';
    else if (vixValue < 14 && Math.abs(avgSectorChange) < 0.4) regime = 'COMPRESSION';

    const isDivergent = ((nifty.changePercent || 0) > 0.1 && breadthPercent < 45) || ((nifty.changePercent || 0) < -0.1 && breadthPercent > 55);
    const moneyFlows = [...sectors].sort((a, b) => b.momentum - a.momentum).slice(0, 3);

    return (
        <div className="relative space-y-10 md:space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-10 md:pb-20">
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-x-0 -top-8 flex justify-center z-50 pointer-events-none">
                    <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-blue-600 shadow-2xl shadow-blue-600/50 border border-blue-400/20 animate-in slide-in-from-top-4">
                        <CandleLoader />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Getting Data</span>
                    </div>
                </div>
            )}

            {/* Intel Hero & Regime Header */}
            <div className="flex flex-col gap-8 pb-4 border-b border-white/5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                            <Hexagon size={12} className="text-blue-400 fill-blue-400/20" />
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none">Market Insights</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-outfit tracking-tighter leading-[0.9]">
                            Market <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Overview</span>
                        </h1>
                    </div>

                    <div className="flex flex-col md:flex-row items-start gap-4">
                        <TimeframeSelector current={timeframe} onSelect={setTimeframe} />
                        <div className={`px-4 py-1.5 rounded-xl glass-card border transition-all duration-700 ${regime === 'EXPANSION' ? 'border-emerald-500/30 bg-emerald-500/5' :
                            regime === 'DISTRIBUTION' ? 'border-yellow-500/30 bg-yellow-500/5' :
                                regime === 'CAPITULATION' ? 'border-rose-500/30 bg-rose-500/5' :
                                    'border-blue-500/30 bg-blue-500/5'
                            }`}>
                            <div className="flex items-center gap-3">
                                <Activity size={16} className={`${regime === 'EXPANSION' ? 'text-emerald-400' :
                                    regime === 'DISTRIBUTION' ? 'text-yellow-400' :
                                        regime === 'CAPITULATION' ? 'text-rose-400' :
                                            'text-blue-400'
                                    } animate-pulse`} />
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-none mb-0.5">Market Trend</span>
                                    <h3 className="text-lg font-black text-white tracking-tighter leading-none">{regime}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {isDivergent && (
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 animate-pulse">
                        <AlertCircle className="text-amber-500" />
                        <div>
                            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Divergence Alert: Low Conviction Trend</span>
                            <p className="text-[10px] text-amber-500/80">Market indices and sector breadth are decoupled.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* SECTION 1: GLOBAL EQUITY DECK */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white font-outfit flex items-center gap-2">
                        <Globe className="text-blue-400" size={20} />
                        Global Markets
                    </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    {[
                        { label: "S&P 500", sym: "^GSPC" },
                        { label: "Nasdaq 100", sym: "^IXIC" },
                        { label: "Dow Jones", sym: "^DJI" },
                        { label: "DAX Performance", sym: "^GDAXI" },
                        { label: "FTSE 100", sym: "^FTSE" },
                        { label: "Nikkei 225", sym: "^N225" }
                    ].map((item) => (
                        <SymbolCard key={item.sym} label={item.label} data={getPerf(item.sym)} />
                    ))}
                </div>
            </section>

            {/* SECTION 1.5: WATCHLIST MONITOR */}
            <section className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-white font-outfit flex items-center gap-2">
                            <Star className="text-amber-400" size={20} fill="currentColor" />
                            My Watchlist
                            {isWatchlistLoading && <Loader2 size={14} className="animate-spin text-slate-500" />}
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 border border-white/5 px-2 py-1 rounded-md">
                            {watchlistData.length} Targets
                        </span>
                    </div>

                    <form onSubmit={handleAddWatchlist} className="flex items-center gap-2 relative" ref={searchRef}>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search Symbol (e.g. TCS)"
                                value={newSymbol}
                                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all w-full sm:w-64"
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 scale-[0.4] origin-right pointer-events-none">
                                    <CandleLoader />
                                </div>
                            )}

                            {/* Search Results Dropdown */}
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl shadow-black p-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {searchResults.map((result, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                submitSymbol(result.symbol);
                                            }}
                                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-all text-left group"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-xs font-black text-white group-hover:text-amber-400 transition-colors uppercase tracking-tight truncate">
                                                        {(result.symbol || '').replace(/\.(NS|BO)$/, '')}
                                                    </div>
                                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-slate-500 font-black uppercase tracking-widest">
                                                        {result.symbol?.endsWith('.NS') ? 'NSE' :
                                                            (result.symbol?.includes('.') ? result.symbol.split('.').pop() : 'EQ')}
                                                    </span>
                                                </div>
                                                <div className="text-[9px] text-slate-500 font-bold truncate opacity-80 group-hover:opacity-100 transition-opacity">
                                                    {result.name}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </form>
                </div>
                {watchlistData.length > 0 ? (
                    <div className="max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
                            {watchlistData.map((item) => (
                                <Link key={item.symbol} href={`/stock/${item.symbol}`}>
                                    <div className="glass-card p-6 border-amber-500/10 hover:border-amber-500/30 transition-all bg-amber-500/[0.02] flex items-center justify-between group cursor-pointer active:scale-[0.98]">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-white group-hover:text-amber-400 transition-colors uppercase tracking-tight">
                                                    {item.symbol.replace(/\.(NS|BO)$/, '')}
                                                </span>
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-slate-500 font-bold uppercase tracking-widest">
                                                    {item.symbol.endsWith('.NS') ? 'NSE' : 'EQUITY'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-60 truncate max-w-[120px]">
                                                {item.label || "Equity Node"}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-base font-black text-white font-mono tracking-tighter">
                                                ₹{formatIndianNumber(item.currentPrice)}
                                            </span>
                                            <div className={`flex items-center gap-1 text-[10px] font-bold ${item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {item.changePercent >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                                {Math.abs(item.changePercent).toFixed(2)}%
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 rounded-[32px] border border-dashed border-white/5 bg-white/[0.01]">
                        <Star size={32} className="text-white/5 mb-4" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">No target nodes identified</span>
                        <p className="text-[10px] text-slate-700 mt-2">Add symbols to your watchlist from the Stock Detail page to monitor them here.</p>
                    </div>
                )}
            </section>

            {/* SECTION 2: MACRO MONITOR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <section className="space-y-6">
                    <h2 className="text-xl font-black text-white font-outfit flex items-center gap-2">
                        <Coins className="text-amber-400" size={20} />
                        Gold & Commodities
                    </h2>
                    <div className="grid grid-cols-1 gap-4">
                        {[
                            { label: "Gold Futures", sym: "GC=F" },
                            { label: "Silver Futures", sym: "SI=F" },
                            { label: "Crude Oil", sym: "CL=F" }
                        ].map((item) => (
                            <SymbolCard key={item.sym} label={item.label} data={getPerf(item.sym)} icon={<Coins size={14} className="text-amber-500/50" />} />
                        ))}
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-xl font-black text-white font-outfit flex items-center gap-2">
                        <Banknote className="text-emerald-400" size={20} />
                        Currency Rates
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { label: "USD / INR", sym: "USDINR=X" },
                            { label: "EUR / INR", sym: "EURINR=X" },
                            { label: "GBP / INR", sym: "GBPINR=X" },
                            { label: "JPY / INR", sym: "JPYINR=X" },
                            { label: "AUD / INR", sym: "AUDINR=X" },
                            { label: "CHF / INR", sym: "CHFINR=X" }
                        ].map((item) => (
                            <SymbolCard key={item.sym} label={item.label} data={getPerf(item.sym)} />
                        ))}
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-xl font-black text-white font-outfit flex items-center gap-2">
                        <Timer className="text-purple-400" size={20} />
                        US Yield Curve
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { label: "US 13W Yield", sym: "^IRX" },
                            { label: "US 5Y Yield", sym: "^FVX" },
                            { label: "US 10Y Yield", sym: "^TNX" },
                            { label: "US 30Y Yield", sym: "^TYX" }
                        ].map((item) => (
                            <SymbolCard key={item.sym} label={item.label} data={getPerf(item.sym)} />
                        ))}
                    </div>
                </section>
            </div>

            {/* SECTION 3: INDIAN SECTOR ALPHA (Definitive Grid Alignment) */}
            <div className="pt-8 md:pt-16 border-t border-white/5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 items-stretch">
                    {/* Headers Row */}
                    <div className="lg:col-span-2 flex items-center justify-between h-10">
                        <h2 className="text-2xl font-black text-white font-outfit flex items-center gap-3">
                            <Landmark className="text-blue-400" size={24} />
                            Industry Trends
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Indian Industries</span>
                    </div>
                    <div className="flex items-center justify-between h-10">
                        <h2 className="text-2xl font-black text-white font-outfit flex items-center gap-3">
                            <Zap className="text-indigo-400" size={24} />
                            Top Gaining Industries
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">MARKET ACTIVITY</span>
                    </div>

                    {/* Content Row - Compact Grid */}
                    <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 content-start auto-rows-max">
                        {sectors.map((sector, i) => (
                            <SectorItem
                                key={i}
                                label={sector.label}
                                value={`${(sector.changePercent ?? 0) >= 0 ? '+' : ''}${sector.changePercent?.toFixed(2)}%`}
                                status={(sector.changePercent ?? 0) >= 0 ? "up" : "down"}
                            />
                        ))}
                    </div>

                    <div className="lg:col-span-1 glass-card p-4 md:p-5 flex flex-col relative overflow-hidden group border-indigo-500/10">
                        <p className="text-[9px] text-slate-500 mb-3 uppercase tracking-widest font-bold">Relative Strength Concentration</p>
                        <div className="space-y-3">
                            {moneyFlows.map((flow, i) => (
                                <div key={i} className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[11px] font-bold text-white uppercase tracking-wider">{flow.label}</span>
                                        <span className={`text-[9px] font-black ${flow.changePercent > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            FLUX: {flow.momentum.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${flow.changePercent > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                            style={{ width: `${Math.min(Math.abs(flow.momentum * 50), 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-auto pt-4">
                            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Zap size={12} className="text-indigo-400" />
                                    <span className="text-[9px] font-black text-indigo-400 uppercase">Quick Summary</span>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                                    Focus concentrated in <b>{moneyFlows[0]?.label}</b>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Core Health Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <DataPointCard
                    label="Market Participation"
                    mainValue={`${breadthPercent.toFixed(0)}%`}
                    subValue={breadthLabel}
                    description={`Percentage of Nifty 50 constituents currently advancing (${advances}/${activeSample} stocks).`}
                    status={breadthPercent > 60 ? "positive" : breadthPercent < 40 ? "negative" : "neutral"}
                    icon={<Activity className="text-blue-400" size={24} />}
                />
                <DataPointCard
                    label="Market Volatility"
                    mainValue={vixValue.toFixed(2)}
                    subValue={vixValue > 22 ? "HIGH PANIC" : vixValue > 18 ? "VOLATILE" : "CALM"}
                    description="India VIX index. Levels above 20 indicate high market uncertainty and potential panic."
                    status={vixValue > 22 ? "negative" : vixValue > 18 ? "neutral" : "positive"}
                    icon={<Gauge className="text-purple-400" size={24} />}
                />
                <DataPointCard
                    label="Market Confidence"
                    mainValue={`${sentimentScore}%`}
                    subValue={sentimentScore > 70 ? "OPTIMISTIC" : sentimentScore < 30 ? "PESSIMISTIC" : "NEUTRAL"}
                    description="Aggregated sentiment across all major sectors. High scores indicate broad buying interest."
                    status={sentimentScore > 70 ? "positive" : sentimentScore < 30 ? "negative" : "neutral"}
                    icon={<TrendingUp className="text-emerald-400" size={24} />}
                />
                <DataPointCard
                    label="System Status"
                    mainValue={`${healthIndex}%`}
                    subValue={healthIndex > 60 ? "STABLE" : healthIndex < 30 ? "CRITICAL" : "CAUTION"}
                    description="Overall system health combining participation, sentiment, and volatility metrics."
                    status={healthIndex > 60 ? "positive" : healthIndex < 30 ? "negative" : "neutral"}
                    icon={<Shield size={24} className="text-indigo-400" />}
                />
            </div>

            {/* Data Insights Breakdown */}
            <div className="rounded-3xl border border-white/5 bg-white/5 p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Info size={16} className="text-blue-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">How these scores are calculated</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] leading-relaxed text-zinc-400">
                    <div className="space-y-2">
                        <p className="font-bold text-zinc-200">Participation (Breadth)</p>
                        <p>Calculated by tracking the price action of the **Nifty 50** constituents. Ideally, high participation (&gt;60%) indicates a healthy, sustainable trend.</p>
                    </div>
                    <div className="space-y-2">
                        <p className="font-bold text-zinc-200">Confidence (Sentiment)</p>
                        <p>A weighted average of the 6 major sector indices. It measures how broad the buying interest is across different industries.</p>
                    </div>
                    <div className="space-y-2">
                        <p className="font-bold text-zinc-200">System Health (Overall)</p>
                        <p>Our proprietary index that balances Participation and Confidence against Volatility (VIX). High VIX (&gt;22) significantly reduces health.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SymbolCard({ label, data, icon, prefix = "" }: { label: string; data: any; icon?: React.ReactNode; prefix?: string }) {
    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            className="glass-card p-5 md:p-6 flex flex-col gap-2 border-white/5 hover:border-blue-500/30 transition-all group cursor-pointer"
        >
            <div className="flex items-center gap-1.5 opacity-50 mb-1">
                {icon || <Globe size={12} className="text-slate-500" />}
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate leading-none">{label}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-white">{prefix}{data.currentPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <div className={`flex flex-col items-end ${data.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <span className="text-[10px] font-bold leading-none">
                        {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)}
                    </span>
                    <span className="text-[8px] font-bold opacity-80 leading-none mt-0.5">
                        ({data.changePercent >= 0 ? '+' : ''}{data.changePercent?.toFixed(2)}%)
                    </span>
                </div>
            </div>
            {data.low !== undefined && data.high !== undefined && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
                    <div className="flex flex-col">
                        <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Today's Low</span>
                        <span className="text-[10px] font-black text-slate-400 leading-none">{data.low?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Today's High</span>
                        <span className="text-[10px] font-black text-slate-400 leading-none">{data.high?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

const DataPointCard: React.FC<{ 
    label: string, 
    mainValue: string, 
    subValue: string, 
    status: 'positive' | 'negative' | 'neutral', 
    icon: React.ReactNode, 
    description?: string 
}> = ({ label, mainValue, subValue, status, icon, description }) => {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card p-4 md:p-5 flex flex-col justify-between h-36 relative overflow-hidden group cursor-default"
        >
            <div className="absolute top-0 right-0 p-6 -mr-8 -mt-8 opacity-[0.03] group-hover:opacity-[0.15] transition-all duration-500 group-hover:scale-110">
                {icon}
            </div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <div className="flex flex-col">
                <span className="text-3xl font-black text-white font-outfit mb-1 group-hover:text-blue-400 transition-colors">{mainValue}</span>
                <div className={`text-[9px] font-bold uppercase tracking-tight ${status === 'positive' ? 'text-emerald-400' : status === 'negative' ? 'text-rose-400' : 'text-slate-400'}`}>
                    {subValue}
                </div>
            </div>
            
            {description && (
                <div className="absolute inset-0 bg-slate-900/95 p-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 text-center border border-white/10 rounded-3xl">
                    <p className="text-[10px] leading-relaxed text-slate-300 font-medium">{description}</p>
                </div>
            )}
        </motion.div>
    );
};

function SectorItem({ label, value, status }: { label: string; value: string; status: 'up' | 'down' }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate mr-2">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white font-outfit">{value}</span>
                {status === 'up' ?
                    <ArrowUpRight size={14} className="text-emerald-400" /> :
                    <ArrowDownRight size={14} className="text-rose-400" />
                }
            </div>
        </div>
    );
}
