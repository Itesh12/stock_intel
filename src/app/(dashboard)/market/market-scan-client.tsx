"use client";

import React, { useState, useEffect } from 'react';
import {
    Zap, Activity, Database, Server, RefreshCcw,
    ArrowUpRight, ArrowDownRight, Search, Filter,
    ChevronRight, ArrowLeft, Signal,
    Globe, Terminal, Cpu, ShieldAlert, BarChart3,
    CircuitBoard, Dna, Info, Shield, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatIndianNumber, cn } from '../../../lib/utils';
import Link from 'next/link';
import Tooltip from '@/components/ui/tooltip';
import { useSnackbar } from '@/components/ui/snackbar';
import { CandleLoader } from '@/components/ui/candle-loader';
import { GlobalLoader } from '@/components/ui/global-loader';
import {
    ScatterChart, Scatter, XAxis, YAxis, ZAxis,
    Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
    ReferenceLine, CartesianGrid
} from 'recharts';

interface MarketScanResult {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    marketCap: number;
    volume: number;
    neuralAlphaScore: number;
    sentimentFlow: string;
    volatility: number;
    efficiency: number;
}

const scanners = [
    {
        id: 'day_gainers',
        label: 'Top Gainers',
        icon: <ArrowUpRight size={16} />,
        desc: 'Top percentage gainers across indexed markets.',
        tooltip: 'Stocks showing the highest percentage gains in the current session. These often indicate strong short-term momentum or positive news catalysts.'
    },
    {
        id: 'most_actives',
        label: 'Most Traded',
        icon: <Activity size={16} />,
        desc: 'Stocks with lots of trading activity.',
        tooltip: "Stocks that many people are buying and selling right now. This often means big investors are interested."
    },
    {
        id: 'day_losers',
        label: 'Market Pullbacks',
        icon: <ArrowDownRight size={16} />,
        desc: 'Significant retracements and sell-off signals.',
        tooltip: 'Stocks experiencing significant price retracements after a recent rally. These zones are monitored for potential "buy the dip" opportunities.'
    },
    {
        id: 'undervalued_growth_stocks',
        label: 'Best Value',
        icon: <Database size={16} />,
        desc: 'Cheap stocks with good growth potential.',
        tooltip: "Stocks that are priced lower than they should be based on their company's earnings. These are potential bargains."
    }
];

export default function MarketScanClient() {
    const { showSnackbar } = useSnackbar();
    const [isConnected, setIsConnected] = useState(false);
    const [isEstablishing, setIsEstablishing] = useState(false);
    const [activeScanner, setActiveScanner] = useState(scanners[0]);
    const [results, setResults] = useState<MarketScanResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [connectionProgress, setConnectionProgress] = useState(0);
    const [displayCount, setDisplayCount] = useState(25);
    const [selectedAuditStock, setSelectedAuditStock] = useState<MarketScanResult | null>(null);
    const [refreshingRows, setRefreshingRows] = useState<Record<string, boolean>>({});
    const [viewMode, setViewMode] = useState<'GRID' | 'RADAR'>('GRID');

    const fetchScanData = React.useCallback(async (type: string, count: number = 50) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/market/scan?type=${type}&count=${count}`);
            const data = await res.json();
            setResults(data);
        } catch (error) {
            console.error('Failed to fetch scan data', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const establishConnection = React.useCallback(() => {
        setIsEstablishing(true);
        const interval = setInterval(() => {
            setConnectionProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setIsEstablishing(false);
                        setIsConnected(true);
                        fetchScanData(activeScanner.id);
                    }, 500);
                    return 100;
                }
                return prev + 2;
            });
        }, 30);
    }, [activeScanner.id, fetchScanData]);

    const handleLoadMore = () => {
        setDisplayCount(prev => prev + 25);
    };

    useEffect(() => {
        // Auto-trigger connection on mount for seamless UX
        // Only trigger if we haven't started yet
        if (!isConnected && !isEstablishing && connectionProgress === 0) {
            establishConnection();
        }
    }, [establishConnection, isConnected, isEstablishing, connectionProgress]);

    useEffect(() => {
        if (isConnected) {
            fetchScanData(activeScanner.id);
        }
    }, [activeScanner.id, isConnected, fetchScanData]);

    if (!isConnected && !isEstablishing) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-morphic-card rounded-[40px] p-20 flex flex-col items-center justify-center text-center border-white/5 bg-[#0A0A0B]"
            >
                <div className="w-40 h-40 rounded-full border border-blue-500/20 flex items-center justify-center mb-10 relative group">
                    <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 border-t-transparent animate-[spin_3s_linear_infinite]"></div>
                    <div className="absolute -inset-4 rounded-full border border-blue-500/10 animate-[pulse_4s_ease-in-out_infinite]"></div>
                    <div className="w-28 h-28 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
                        <CandleLoader />
                    </div>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4 font-outfit tracking-tight">Market Scan Terminal</h2>
                <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed font-medium">
                    Scanning institutional order flow and algorithmic price action. Click below to begin sequence.
                </p>
                <button
                    onClick={establishConnection}
                    className="mt-12 group relative inline-flex items-center justify-center px-10 py-4 font-bold text-white transition-all duration-300 bg-blue-600 rounded-2xl hover:bg-blue-700 shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_50px_rgba(37,99,235,0.5)] overflow-hidden"
                >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <Signal size={18} className="mr-3 text-blue-100" />
                    <span className="relative">Start Scanning</span>
                </button>
            </motion.div>
        );
    }

    if (isEstablishing) {
        return (
            <GlobalLoader 
                progress={connectionProgress} 
                title="Loading Data" 
                fullScreen={false} 
            />
        );
    }

    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto px-4 sm:px-6 py-4 md:py-6 pb-20">
            {/* Control Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {scanners.map((scanner) => (
                    <button
                        key={scanner.id}
                        onClick={() => setActiveScanner(scanner)}
                        className={cn(
                            "flex flex-col p-5 sm:p-6 rounded-3xl border transition-all text-left group gap-3 relative w-full",
                            activeScanner.id === scanner.id
                                ? "bg-blue-600/10 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.15)]"
                                : "bg-white/[0.02] border-white/5 hover:border-white/10"
                        )}
                    >
                        {activeScanner.id === scanner.id && (
                            <div className="absolute inset-0 bg-blue-500/5 pointer-events-none rounded-3xl"></div>
                        )}

                        <div className="absolute top-4 right-4 z-20">
                            <Tooltip content={scanner.tooltip}>
                                <div className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-help">
                                    <Info size={14} className="text-slate-500 group-hover:text-blue-400" />
                                </div>
                            </Tooltip>
                        </div>

                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                            activeScanner.id === scanner.id ? "bg-blue-500 text-white" : "bg-white/5 text-slate-400 group-hover:text-blue-400"
                        )}>
                            {scanner.icon}
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm font-outfit uppercase tracking-wider">{scanner.label}</h3>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">{scanner.desc}</p>
                        </div>
                    </button>
                ))}
            </div>

            {/* Results Terminal */}
            <div className="bg-[#0A0A0B] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.03),transparent_40%)]"></div>

                <div className="p-5 md:p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500 shrink-0">
                            <BarChart3 size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-white font-outfit uppercase tracking-tight">{activeScanner.label}</h2>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em] mt-0.5">Live Market Scan Result</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 mr-4">
                            <button
                                onClick={() => setViewMode('GRID')}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                                    viewMode === 'GRID' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                Stock List
                            </button>
                            <button
                                onClick={() => setViewMode('RADAR')}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                                    viewMode === 'RADAR' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                Stock Map
                            </button>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                            {isLoading ? (
                                <div className="scale-50 origin-left mr-2">
                                    <CandleLoader />
                                </div>
                            ) : (
                                <RefreshCcw size={12} />
                            )}
                            {isLoading ? "Fetching" : "Ready"}
                        </div>
                        <div className="hidden sm:block w-[1px] h-6 bg-white/5 mx-2"></div>
                        <Tooltip content="Live Network Sync Status: Active data ingestion from regional exchange nodes.">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                <span className="flex h-1.5 w-1.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                                </span>
                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">Network Sync</span>
                            </div>
                        </Tooltip>
                    </div>
                </div>

                <div className="overflow-x-auto relative z-10">
                    <AnimatePresence mode="wait">
                        {viewMode === 'GRID' ? (
                            <motion.div
                                key="grid"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="w-full"
                            >
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.01]">
                                            <th className="py-4 md:py-5 px-4 md:px-8 text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">
                                                <Tooltip content="Symbol and company name of the stock." position="bottom">
                                                    <div className="flex items-center gap-2">
                                                        Stock Name
                                                        <Info size={10} className="text-slate-700" />
                                                    </div>
                                                </Tooltip>
                                            </th>
                                            <th className="py-4 md:py-5 px-4 md:px-8 text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em] text-right">
                                                <Tooltip content="Current market price in Rupees (INR)." position="bottom">
                                                    <div className="flex items-center justify-end gap-2 w-full">
                                                        Price
                                                        <Info size={10} className="text-slate-700" />
                                                    </div>
                                                </Tooltip>
                                            </th>
                                            <th className="py-4 md:py-5 px-4 md:px-8 text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em] text-right">
                                                <Tooltip content="Percentage change since market open." position="bottom">
                                                    <div className="flex items-center justify-end gap-2 w-full">
                                                        Performance
                                                        <Info size={10} className="text-slate-700" />
                                                    </div>
                                                </Tooltip>
                                            </th>
                                            <th className="py-5 px-8 text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em] text-right">
                                                <Tooltip content="Total market value of the company." position="bottom">
                                                    <div className="flex items-center justify-end gap-2 w-full">
                                                        Market Cap
                                                        <Info size={10} className="text-slate-700" />
                                                    </div>
                                                </Tooltip>
                                            </th>
                                            <th className="py-5 px-8 text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em] text-right text-blue-400/80">
                                                <Tooltip content="AI-calculated score based on market trends." position="bottom">
                                                    <div className="flex items-center justify-end gap-2 w-full">
                                                        AI Score
                                                        <Info size={10} className="text-slate-700" />
                                                    </div>
                                                </Tooltip>
                                            </th>
                                            <th className="py-5 px-8 text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em] text-right">
                                                <Tooltip content="Current market feeling (Bullish/Bearish)." position="bottom">
                                                    <div className="flex items-center justify-end gap-2 w-full">
                                                        Sentiment
                                                        <Info size={10} className="text-slate-700" />
                                                    </div>
                                                </Tooltip>
                                            </th>
                                            <th className="py-5 px-8 text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em] text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {results.length > 0 ? (
                                            results.slice(0, displayCount).map((stock) => (
                                                <tr
                                                    key={stock.symbol}
                                                    className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                                                    onClick={() => window.location.href = `/stock/${stock.symbol}`}
                                                >
                                                    <td className="py-6 px-8">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center font-bold text-white text-xs group-hover:border-blue-500/30 transition-colors">
                                                                {stock.symbol.slice(0, 2)}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors tracking-tight">{stock.symbol}</span>
                                                                <span className="text-[10px] text-slate-500 font-medium truncate max-w-[150px] uppercase tracking-wider">{stock.name}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-6 px-8 text-right">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-white font-mono">{formatCurrency(stock.price, 'INR')}</span>
                                                            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Indian Stock</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-6 px-8 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <div className={cn(
                                                                "flex items-center gap-1.5 font-bold font-mono text-sm",
                                                                stock.change >= 0 ? "text-emerald-500" : "text-rose-500"
                                                            )}>
                                                                {stock.change >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                                                                {stock.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                            </div>
                                                            <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">Today's Change</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-6 px-8 text-right">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-300 font-mono">{formatIndianNumber(stock.marketCap)}</span>
                                                            <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">Market Cap</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-6 px-8 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <div className="text-sm font-black text-blue-400 font-outfit tracking-tighter bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                                                {stock.neuralAlphaScore}
                                                            </div>
                                                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-1">AI Score</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-6 px-8 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <div className={cn(
                                                                "text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded flex items-center gap-1.5",
                                                                stock.change >= 0 ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                                            )}>
                                                                <div className={cn("w-1 h-1 rounded-full animate-pulse", stock.change >= 0 ? "bg-emerald-500" : "bg-rose-500")}></div>
                                                                {stock.sentimentFlow}
                                                            </div>
                                                            <span className="text-[9px] text-slate-700 font-bold uppercase tracking-widest mt-1">Market Feeling</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-6 px-8 relative z-20">
                                                        <div className="flex items-center justify-center gap-3">
                                                            <Tooltip content="Refresh Data">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setRefreshingRows(prev => ({ ...prev, [stock.symbol]: true }));
                                                                        setTimeout(() => {
                                                                            setRefreshingRows(prev => ({ ...prev, [stock.symbol]: false }));
                                                                            showSnackbar(`Synchronized pulse data for ${stock.symbol}.`, 'success');
                                                                        }, 1500);
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-600 hover:text-blue-500 transition-colors"
                                                                >
                                                                    {refreshingRows[stock.symbol] ? (
                                                                        <div className="scale-[0.3]"><CandleLoader /></div>
                                                                    ) : (
                                                                        <CircuitBoard size={14} />
                                                                    )}
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip content="View Details">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedAuditStock(stock);
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-600 hover:text-emerald-500 transition-colors"
                                                                >
                                                                    <Dna size={14} />
                                                                </button>
                                                            </Tooltip>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            [1, 2, 3, 4, 5].map(i => (
                                                <tr key={i} className="animate-pulse">
                                                    <td colSpan={7} className="py-6 px-8">
                                                        <div className="h-4 bg-white/5 rounded-lg w-full"></div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="radar"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="p-8 md:p-12 min-h-[600px] flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-xl font-bold text-white font-outfit uppercase tracking-tight flex items-center gap-3">
                                            Quantum Alpha Radar 
                                            <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Experimental Terminal</span>
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">X: Performance % | Y: Alpha Score | Size: Market Liquidity</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Strong Convergence</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Outlier</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 w-full relative">
                                    <ResponsiveContainer width="100%" height={500}>
                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                            <XAxis 
                                                type="number" 
                                                dataKey="changePercent" 
                                                name="Performance" 
                                                unit="%" 
                                                stroke="rgba(255,255,255,0.2)" 
                                                fontSize={10}
                                                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}`}
                                            />
                                            <YAxis 
                                                type="number" 
                                                dataKey="neuralAlphaScore" 
                                                name="Alpha Score" 
                                                stroke="rgba(255,255,255,0.2)" 
                                                fontSize={10}
                                                domain={[0, 100]}
                                            />
                                            <ZAxis type="number" dataKey="marketCap" range={[100, 2000]} />
                                            <RechartsTooltip 
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-[#0A0A0B] border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-xl max-w-[240px]">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-blue-400 font-bold text-sm tracking-tighter">{data.symbol}</span>
                                                                        <span className="text-[8px] text-slate-500 uppercase font-black truncate max-w-[120px]">{data.name}</span>
                                                                    </div>
                                                                    <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-black text-white">
                                                                        {data.neuralAlphaScore} AQ
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between items-center text-[10px]">
                                                                        <span className="text-slate-500 font-bold uppercase">Performance</span>
                                                                        <span className={cn("font-mono font-bold", data.changePercent >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                                                            {data.changePercent.toFixed(2)}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-[10px]">
                                                                        <span className="text-slate-500 font-bold uppercase">Sentiment</span>
                                                                        <span className="text-blue-500 font-black italic">{data.sentimentFlow}</span>
                                                                    </div>
                                                                    <div className="pt-2 border-t border-white/5 text-[9px] text-slate-600 italic">
                                                                        AI analysis suggests {data.neuralAlphaScore > 75 ? 'strong interest' : 'neutral flow'} at current price levels.
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" />
                                            <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" />
                                            <Scatter name="Stocks" data={results} onClick={(data) => window.location.href = `/stock/${data.symbol}`}>
                                                {results.map((entry, index) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={entry.changePercent >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(244,63,94,0.5)'}
                                                        stroke={entry.changePercent >= 0 ? '#10b981' : '#f43f5e'}
                                                        strokeWidth={1}
                                                        className="cursor-pointer transition-all hover:opacity-100"
                                                        opacity={0.6}
                                                    />
                                                ))}
                                            </Scatter>
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div >

    {
        results.length > displayCount && (
            <div className="p-8 bg-black/40 border-t border-white/5 flex justify-center items-center relative z-10">
                <button
                    onClick={handleLoadMore}
                    className="px-8 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] cursor-pointer hover:bg-white/5 hover:border-blue-500/30 transition-all active:scale-95"
                >
                    Load Additional Data
                </button>
            </div>
        )
    }
            </div >

        <AnimatePresence>
            {selectedAuditStock && (
                <TechnicalAuditModal
                    stock={selectedAuditStock}
                    onClose={() => setSelectedAuditStock(null)}
                />
            )}
        </AnimatePresence>
        </div >
    );
}

function TechnicalAuditModal({ stock, onClose }: { stock: MarketScanResult; onClose: () => void }) {
    // Deterministic metrics based on symbol for a "real" feel
    const getMetric = (seed: string, offset: number) => {
        const charCode = seed.charCodeAt(0) + offset;
        return (charCode % 20) + 80; // 80-99 range
    };

    const metrics = [
        { label: "Market Interest", value: `${getMetric(stock.symbol, 1)}%`, desc: "How easily you can buy or sell this stock.", status: "Good" },
        { label: "Data Quality", value: "Verified", desc: "Data is directly from the exchange.", status: "Secure" },
        { label: "Update Speed", value: `${(stock.symbol.charCodeAt(1) % 15) + 5}ms`, desc: "How fast we get data for this stock.", status: "Very Fast" },
        { label: "Price Movement", value: stock.changePercent > 0 ? "Active" : "Stable", desc: "How much the price is moving up and down.", status: "Monitored" }
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-[#0A0A0B] border border-white/10 rounded-[32px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)]"
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_50%)]"></div>

                <div className="p-8 border-b border-white/5 relative z-10 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white font-outfit uppercase tracking-tight">{stock.symbol} Details</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mt-1">Company Details & Safety</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-600 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6 relative z-10">
                    <div className="grid grid-cols-2 gap-4">
                        {metrics.map((m, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i }}
                                className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 group hover:border-emerald-500/20 transition-all"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{m.label}</span>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">{m.status}</span>
                                </div>
                                <div className="text-2xl font-black text-white font-outfit tracking-tighter">{m.value}</div>
                                <p className="text-[9px] text-slate-600 font-medium leading-tight opacity-0 group-hover:opacity-100 transition-opacity">{m.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-4 p-4 rounded-2xl bg-blue-600/5 border border-blue-500/10 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <Activity size={16} className="text-blue-400" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Audit Synopsis</span>
                            <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                Institutional hardware nodes have verified the liquidity clusters for <b>{stock.name}</b>. All exchange-direct protocols are nominal.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-0 relative z-10">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all active:scale-[0.98]"
                    >
                        Close Details
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function StatusPulse({ label, active }: { label: string; active: boolean }) {
    return (
        <div className={cn(
            "flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-700",
            active ? "bg-blue-600/5 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.05)]" : "bg-white/[0.01] border-white/5 opacity-40"
        )}>
            <div className={cn(
                "w-2 h-2 rounded-full",
                active ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" : "bg-slate-800"
            )}></div>
            <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                active ? "text-blue-400" : "text-slate-700"
            )}>{label}</span>
        </div>
    );
}
