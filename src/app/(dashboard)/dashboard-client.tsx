"use client";

import React, { useState, useEffect } from "react";
import {
    TrendingUp, Activity, Zap, Shield,
    ArrowUpRight, ArrowDownRight, AlertCircle,
    Globe, Gauge, Hexagon, Coins, Landmark, Repeat,
    Banknote, Timer, Loader2, Star
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

    const advances = sectors.filter(s => s.changePercent > 0).length;
    const declines = sectors.filter(s => s.changePercent <= 0).length;
    const breadth = declines > 0 ? (advances / declines).toFixed(2) : advances.toString();
    const avgSectorChange = sectors.reduce((acc, s) => acc + (s.changePercent || 0), 0) / sectors.length;
    const sentimentScore = Math.min(Math.max(Math.round(50 + (avgSectorChange * 15)), 10), 98);
    const vixValue = vix.currentPrice || 12.5;
    const healthIndex = Math.min(Math.max(Math.round(((100 - sentimentScore) * 0.2) + (sentimentScore * 0.8) + (20 - vixValue)), 20), 99);

    let regime: 'EXPANSION' | 'DISTRIBUTION' | 'CAPITULATION' | 'COMPRESSION' = 'COMPRESSION';
    if (parseFloat(breadth) > 1.2 && vixValue < 15) regime = 'EXPANSION';
    else if (nifty.changePercent > 0 && parseFloat(breadth) < 0.8) regime = 'DISTRIBUTION';
    else if (vixValue > 22 && parseFloat(breadth) < 0.5) regime = 'CAPITULATION';
    else if (vixValue < 13 && Math.abs(avgSectorChange) < 0.3) regime = 'COMPRESSION';

    const isDivergent = (nifty.changePercent > 0.1 && parseFloat(breadth) < 0.7) || (nifty.changePercent < -0.1 && parseFloat(breadth) > 1.3);
    const moneyFlows = [...sectors].sort((a, b) => b.momentum - a.momentum).slice(0, 3);

    return (
        <div className="relative space-y-20 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-x-0 -top-8 flex justify-center z-50 pointer-events-none">
                    <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-blue-600 shadow-2xl shadow-blue-600/50 border border-blue-400/20 animate-in slide-in-from-top-4">
                        <CandleLoader />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Intel Syncing</span>
                    </div>
                </div>
            )}

            {/* Intel Hero & Regime Header */}
            <div className="flex flex-col gap-8 pb-4 border-b border-white/5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                            <Hexagon size={12} className="text-blue-400 fill-blue-400/20" />
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none">Global Intel v5.0 SPA</span>
                        </div>
                        <h1 className="text-5xl font-black text-white font-outfit tracking-tighter leading-[0.9]">
                            Strategic <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Market Vision</span>
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
                                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-none mb-0.5">Market Regime</span>
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
                        Global Equity Monitor
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
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white font-outfit flex items-center gap-2">
                        <Star className="text-amber-400" size={20} fill="currentColor" />
                        Watchlist Monitor
                        {isWatchlistLoading && <Loader2 size={14} className="animate-spin text-slate-500" />}
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{watchlistData.length} Targets</span>
                </div>
                {watchlistData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {watchlistData.map((item) => (
                            <Link key={item.symbol} href={`/stock/${item.symbol}`}>
                                <div className="glass-card p-5 border-amber-500/10 hover:border-amber-500/30 transition-all bg-amber-500/[0.02] flex items-center justify-between group cursor-pointer active:scale-[0.98]">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-white group-hover:text-amber-400 transition-colors uppercase tracking-tight">
                                                {item.symbol.replace(/\.(NS|BO)$/, '')}
                                            </span>
                                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-slate-500 font-bold uppercase tracking-widest">
                                                {item.symbol.endsWith('.NS') ? 'NSE' : 'BSE'}
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
                        Hard Assets
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
                        Currency Monitor
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
            <div className="pt-16 border-t border-white/5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
                    {/* Headers Row */}
                    <div className="lg:col-span-2 flex items-center justify-between h-10">
                        <h2 className="text-2xl font-black text-white font-outfit flex items-center gap-3">
                            <Landmark className="text-blue-400" size={24} />
                            Sector Drift Tracking
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">NSE SECTORAL INDICES</span>
                    </div>
                    <div className="flex items-center justify-between h-10">
                        <h2 className="text-2xl font-black text-white font-outfit flex items-center gap-3">
                            <Zap className="text-indigo-400" size={24} />
                            Money Flow Hub
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">FLUX RANKING</span>
                    </div>

                    {/* Content Row - Guaranteed Horizontal Alignment */}
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sectors.map((sector, i) => (
                            <SectorItem
                                key={i}
                                label={sector.label}
                                value={`${(sector.changePercent ?? 0) >= 0 ? '+' : ''}${sector.changePercent?.toFixed(2)}%`}
                                status={(sector.changePercent ?? 0) >= 0 ? "up" : "down"}
                            />
                        ))}
                    </div>

                    <div className="glass-card px-10 pt-[31px] pb-10 flex flex-col relative overflow-hidden group border-indigo-500/10 h-full min-h-[460px]">
                        <p className="text-[10px] text-slate-500 mb-8 uppercase tracking-widest font-bold">Relative Strength Concentration</p>
                        <div className="space-y-8">
                            {moneyFlows.map((flow, i) => (
                                <div key={i} className="flex flex-col gap-3">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-bold text-white uppercase tracking-wider">{flow.label}</span>
                                        <span className={`text-[10px] font-black ${flow.changePercent > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            FLUX: {flow.momentum.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${flow.changePercent > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                            style={{ width: `${Math.min(Math.abs(flow.momentum * 50), 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-auto pt-10">
                            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={14} className="text-indigo-400" />
                                    <span className="text-[10px] font-black text-indigo-400 uppercase">Intelligence Summary</span>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed italic">
                                    Focus concentrated in <b>{moneyFlows[0]?.label}</b> over the {timeframe} window.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Core Health Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DataPointCard
                    label="Market Breadth"
                    mainValue={breadth}
                    subValue={`${advances} Adv / ${declines} Dec`}
                    status={parseFloat(breadth) >= 1 ? "positive" : "negative"}
                    icon={<Activity className="text-blue-400" size={24} />}
                />
                <DataPointCard
                    label="INDIA VIX"
                    mainValue={vixValue.toFixed(2)}
                    subValue="Volatility Pulse"
                    status={vixValue < 15 ? "positive" : vixValue > 20 ? "negative" : "neutral"}
                    icon={<Gauge className="text-purple-400" size={24} />}
                />
                <DataPointCard
                    label="Bullish Sentiment"
                    mainValue={`${sentimentScore}%`}
                    subValue="System Confidence"
                    status={sentimentScore > 60 ? "positive" : sentimentScore < 40 ? "negative" : "neutral"}
                    icon={<TrendingUp className="text-emerald-400" size={24} />}
                />
                <DataPointCard
                    label="Intelligence Health"
                    mainValue={`${healthIndex}%`}
                    subValue="Data Integrity"
                    status={healthIndex > 70 ? "positive" : healthIndex > 40 ? "neutral" : "negative"}
                    icon={<Shield className="text-indigo-400" size={24} />}
                />
            </div>
        </div>
    );
}

function SymbolCard({ label, data, icon, prefix = "" }: { label: string; data: any; icon?: React.ReactNode; prefix?: string }) {
    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            className="glass-card p-4 flex flex-col gap-2 border-white/5 hover:border-blue-500/30 transition-all group cursor-pointer"
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
                        <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Session Low</span>
                        <span className="text-[10px] font-black text-slate-400 leading-none">{data.low?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Session High</span>
                        <span className="text-[10px] font-black text-slate-400 leading-none">{data.high?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

function DataPointCard({ label, mainValue, subValue, status, icon }: { label: string; mainValue: string; subValue: string; status: 'positive' | 'negative' | 'neutral'; icon: React.ReactNode }) {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card p-7 flex flex-col justify-between h-44 relative overflow-hidden group cursor-default"
        >
            <div className="absolute top-0 right-0 p-8 -mr-10 -mt-10 opacity-[0.03] group-hover:opacity-[0.2] transition-all duration-500 group-hover:scale-110">
                {icon}
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <div className="flex flex-col">
                <span className="text-4xl font-black text-white font-outfit mb-1 group-hover:text-blue-400 transition-colors">{mainValue}</span>
                <div className={`text-[10px] font-bold uppercase tracking-tight ${status === 'positive' ? 'text-emerald-400' : status === 'negative' ? 'text-rose-400' : 'text-slate-400'}`}>
                    {subValue}
                </div>
            </div>
        </motion.div>
    );
}

function SectorItem({ label, value, status }: { label: string; value: string; status: 'up' | 'down' }) {
    return (
        <div className="flex items-center justify-between p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
            <div className="flex items-center gap-4">
                <span className="text-xl font-black text-white font-outfit">{value}</span>
                {status === 'up' ?
                    <ArrowUpRight size={20} className="text-emerald-400" /> :
                    <ArrowDownRight size={20} className="text-rose-400" />
                }
            </div>
        </div>
    );
}
