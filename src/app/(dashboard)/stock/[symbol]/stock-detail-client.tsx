"use client";
import React, { useState, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, Activity, ArrowLeft, Globe, Zap,
    Target, Timer, AlertCircle, Coins, Info, ShieldCheck,
    BarChart3, Shield, Loader2, Landmark, Wallet, PieChart,
    ArrowUpRight, ArrowDownRight, Layers, Briefcase, GraduationCap,
    Clock, RefreshCcw, Search, ExternalLink, ChevronRight, Scale,
    HelpCircle, Database, Server, Terminal, Gauge, ShoppingCart, Ban, Star
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import Tooltip from '@/components/ui/tooltip';
import InteractiveChart from '@/components/charts/InteractiveChart';
import { formatCurrency, formatIndianNumber, formatPercent, cn } from '../../../../lib/utils';
import TerminalFooter from '@/components/ui/terminal-footer';
import { CandleLoader } from '@/components/ui/candle-loader';

interface StockDetailClientProps {
    symbol: string;
    initialPriceData: any;
    initialHistoryData: any[];
}

export default function StockDetailClient({ symbol, initialPriceData, initialHistoryData }: StockDetailClientProps) {
    const [period, setPeriod] = useState('1mo');
    const [priceData, setPriceData] = useState(initialPriceData || {});
    const [historyData, setHistoryData] = useState(initialHistoryData);
    const [isLoading, setIsLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [portfolio, setPortfolio] = useState<any>(null);
    const [isTrading, setIsTrading] = useState(false);
    const [isWatched, setIsWatched] = useState(false);
    const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);
    const [trades, setTrades] = useState<any[]>([]);
    const [earliestTradeDate, setEarliestTradeDate] = useState<Date | null>(null);

    useEffect(() => {
        setIsMounted(true);
        fetchPortfolio();
        fetchWatchlistStatus();
        fetchTradeHistory();
    }, []);

    const fetchPortfolio = async () => {
        try {
            const res = await fetch('/api/portfolio/me');
            const data = await res.json();
            setPortfolio(data);
        } catch (err) {
            console.error("Failed to fetch portfolio", err);
        }
    };

    const fetchTradeHistory = async () => {
        try {
            const res = await fetch('/api/trade/history');
            const allTrades = await res.json();
            const symbolTrades = allTrades.filter((t: any) => t.symbol === symbol);
            setTrades(symbolTrades);

            if (symbolTrades.length > 0) {
                const dates = symbolTrades.map((t: any) => new Date(t.timestamp).getTime());
                setEarliestTradeDate(new Date(Math.min(...dates)));
            }
        } catch (err) {
            console.error("Failed to fetch trade history", err);
        }
    };

    const fetchWatchlistStatus = async () => {
        try {
            const res = await fetch('/api/watchlist');
            const data = await res.json();
            if (Array.isArray(data)) {
                setIsWatched(data.includes(symbol));
            }
        } catch (err) {
            console.error("Failed to fetch watchlist status", err);
        }
    };

    const toggleWatchlist = async () => {
        setIsWatchlistLoading(true);
        try {
            const res = await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    action: isWatched ? 'REMOVE' : 'ADD'
                })
            });
            if (res.ok) {
                setIsWatched(!isWatched);
            }
        } catch (err) {
            console.error("Watchlist toggle failed", err);
        } finally {
            setIsWatchlistLoading(false);
        }
    };

    const timeframes = [
        { label: '1D', value: '1d' },
        { label: '1M', value: '1mo' },
        { label: '3M', value: '3mo' },
        { label: '6M', value: '6mo' },
        { label: '1Y', value: '1y' },
        { label: '5Y', value: '5y' },
        { label: 'YTD', value: 'ytd' },
        ...(earliestTradeDate ? [{ label: 'POS', value: 'pos' }] : [])
    ];

    useEffect(() => {
        if (period === '1mo' && priceData === initialPriceData && historyData === initialHistoryData) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                let historyUrl = `/api/stock/history?symbol=${encodeURIComponent(symbol)}&period=${period}&_t=${Date.now()}`;
                if (period === 'pos' && earliestTradeDate) {
                    historyUrl += `&from=${earliestTradeDate.toISOString()}`;
                }

                const [histRes, perfRes] = await Promise.all([
                    fetch(historyUrl, { cache: 'no-store' }),
                    fetch(`/api/stock/performance?symbol=${encodeURIComponent(symbol)}&period=${period}&_t=${Date.now()}`, { cache: 'no-store' })
                ]);

                const hist = await histRes.json();
                const stockPerf = await perfRes.json();

                setHistoryData(hist);
                setPriceData((prev: any) => ({ ...prev, ...stockPerf }));
            } catch (err) {
                console.error("Failed to sync timeframe data", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [period, symbol]);

    const isPositive = (priceData.changePercent ?? 0) >= 0;
    const low = priceData.fiftyTwoWeekLow || priceData.low || 0;
    const high = priceData.fiftyTwoWeekHigh || priceData.high || 1;
    const current = priceData.currentPrice || priceData.price || 0;

    const rangeDivisor = high - low === 0 ? 1 : high - low;
    const rangePercent = Math.min(Math.max(((current - low) / rangeDivisor) * 100, 0), 100);

    const displaySymbol = symbol.replace(/\.(NS|BO)$/, '');

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
                duration: 0.4
            }
        }
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 10 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
        }
    };

    if (!isMounted) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <CandleLoader />
                <span className="text-xs font-bold text-slate-500 tracking-[0.4em] uppercase">Initializing Adaptive Interface</span>
            </div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 pb-12 max-w-[1600px] mx-auto px-6 py-6"
        >
            {/* 1. HEADER SECTION (BENTO HEADER) */}
            <motion.div variants={itemVariants} className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <Link href="/" className="group flex items-center gap-2 text-slate-400 hover:text-white transition-all text-xs font-semibold uppercase tracking-wider">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Dashboard
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-tight">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Market Live
                        </span>
                        <div className="h-4 w-px bg-white/10"></div>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{priceData.sector || "General Sector"}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                    <div className="lg:col-span-8 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-4">
                            <h1 className="text-4xl lg:text-5xl font-bold text-white font-outfit tracking-tight leading-none">
                                {priceData.name || symbol}
                            </h1>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-md bg-blue-600/20 border border-blue-500/30 text-xs font-bold text-blue-400">
                                    {displaySymbol}
                                </span>
                                <span className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-bold text-slate-400">
                                    {symbol.endsWith('.NS') ? 'NSE' : 'BSE'}
                                </span>
                                <button
                                    onClick={toggleWatchlist}
                                    disabled={isWatchlistLoading}
                                    className={cn(
                                        "p-2 rounded-xl border transition-all active:scale-95 flex items-center justify-center",
                                        isWatched
                                            ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                                            : "bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/20"
                                    )}
                                    title={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
                                >
                                    {isWatchlistLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Star size={18} fill={isWatched ? "currentColor" : "none"} />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-slate-500 text-xs font-medium uppercase tracking-wider">
                            <span className="flex items-center gap-1.5"><Globe size={14} className="text-blue-500/70" /> India</span>
                            <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                            <span className="flex items-center gap-1.5"><Activity size={14} className="text-blue-500/70" /> Alpha Priority: <span className="text-blue-400">94.2</span></span>
                        </div>
                    </div>

                    <div className="lg:col-span-4 flex flex-col lg:items-end gap-1">
                        <div className="text-5xl font-bold text-white font-outfit tracking-tighter leading-none">
                            {formatCurrency(current)}
                        </div>
                        <div className={`flex items-center gap-2 font-bold text-lg ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                            <span>
                                {isPositive ? '+' : ''}{priceData.change?.toFixed(2)} ({priceData.changePercent?.toFixed(2)}%)
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 2. CORE ANALYSIS GRID (BENTO BOX ARCHITECTURE) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Trajectory Card */}
                <motion.div variants={itemVariants} className="lg:col-span-8 xl:col-span-9 bg-[#0A0A0B] border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-6 md:p-8 flex flex-col flex-1">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <BarChart3 size={18} className="text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Trajectory Analysis</h2>
                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-0.5">Price & Volume Matrix</p>
                                </div>
                            </div>
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                                {timeframes.map((tf) => (
                                    <button
                                        key={tf.value}
                                        onClick={() => setPeriod(tf.value)}
                                        disabled={isLoading}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${period === tf.value
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'text-slate-500 hover:text-white'
                                            }`}
                                    >
                                        {tf.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative flex-1 min-h-[400px] h-full bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                            <AnimatePresence>
                                {isLoading && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 flex items-center justify-center bg-[#0A0A0B]/80 backdrop-blur-sm z-40"
                                    >
                                        <div className="flex flex-col items-center gap-4">
                                            <CandleLoader />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">Refreshing Telemetry</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {historyData && historyData.length > 0 ? (
                                <div className="w-full h-full p-4">
                                    <InteractiveChart data={historyData} isPositive={isPositive} trades={trades} />
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center opacity-20">
                                    <Activity size={48} className="text-slate-500 mb-4 animate-pulse" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Telemetry Initializing</span>
                                </div>
                            )}
                        </div>

                        {/* RANGE DRILLDOWN */}
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-16 pt-8 border-t border-white/5">
                            {/* Day Range */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Day Range</span>
                                        <span className="text-xl font-bold text-white font-outfit tracking-tight">{formatCurrency(current, 0)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-blue-500/80 uppercase tracking-widest bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">Intraday Pulse</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="relative h-1.5 w-full bg-white/5 rounded-full">
                                        <div
                                            style={{
                                                left: `${Math.min(Math.max(((current - (priceData.low || priceData.dayLow || current)) / (rangeDivisor)) * 100, 0), 100)}%`
                                            }}
                                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full z-10 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                        ></div>
                                        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 via-blue-500/20 to-emerald-500/20 rounded-full"></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                        <div className="flex flex-col items-start">
                                            <span className="text-slate-600 mb-0.5">Low</span>
                                            <span className="text-slate-400 font-mono">{formatCurrency(priceData.low || priceData.dayLow || 0, 0)}</span>
                                        </div>
                                        <div className="flex flex-col items-end text-right">
                                            <span className="text-slate-600 mb-0.5">High</span>
                                            <span className="text-slate-400 font-mono">{formatCurrency(priceData.high || priceData.dayHigh || 0, 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 52W Range */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">52W Spectrum</span>
                                        <span className="text-xl font-bold text-white font-outfit tracking-tight">{rangePercent.toFixed(1)}% <span className="text-xs text-slate-500">Range</span></span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">Annual Cycle</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="relative h-1.5 w-full bg-white/5 rounded-full">
                                        <div
                                            style={{ left: `${rangePercent}%` }}
                                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full z-10 shadow-[0_0_10px_rgba(255,255,255,0.5)] border-2 border-blue-600"
                                        ></div>
                                        <div className="absolute inset-0 bg-blue-500/10 rounded-full"></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                        <div className="flex flex-col items-start">
                                            <span className="text-slate-600 mb-0.5">Min</span>
                                            <span className="text-slate-400 font-mono">{formatCurrency(low, 0)}</span>
                                        </div>
                                        <div className="flex flex-col items-end text-right">
                                            <span className="text-slate-600 mb-0.5">Max</span>
                                            <span className="text-slate-400 font-mono">{formatCurrency(high, 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Right Analytics Deck */}
                <motion.div variants={itemVariants} className="lg:col-span-4 xl:col-span-3 space-y-6 flex flex-col">
                    {/* Primary Metrics Bento */}
                    <div className="bg-[#0A0A0B] border border-white/5 rounded-3xl p-6 flex-1 shadow-2xl">
                        <div className="flex items-center gap-1.5 mb-6 text-slate-300 font-bold uppercase tracking-widest text-[11px]">
                            <Gauge size={14} className="text-blue-500" />
                            Core Asset Metrics
                        </div>
                        <div className="space-y-1">
                            <BentoRow icon={<Landmark size={14} />} label="Market Cap" value={`₹${formatIndianNumber(priceData.marketCap || 0)}`} tooltip="Aggregate market value of a company's outstanding shares of stock." />
                            <BentoRow icon={<Zap size={14} />} label="Volume" value={formatIndianNumber(priceData.volume || 0)} />
                            <BentoRow icon={<Target size={14} />} label="P/E Ratio" value={priceData.peRatio?.toFixed(2) || "--"} tooltip="Price-to-Earnings ratio, indicating the market value of a stock compared to its earnings." />
                            <BentoRow icon={<Scale size={14} />} label="Beta" value={priceData.beta?.toFixed(2) || "--"} tooltip="Measure of a stock's volatility in relation to the overall market." />
                        </div>
                    </div>

                    {/* Capital Flow Bento */}
                    <div className="bg-[#0A0A0B] border border-white/5 rounded-3xl p-6 shadow-2xl">
                        <div className="flex items-center gap-1.5 mb-6 text-slate-300 font-bold uppercase tracking-widest text-[11px]">
                            <Layers size={14} className="text-blue-500" />
                            Capital Structure
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Institution</span>
                                <span className="text-xl font-bold text-white font-outfit">{formatPercent(priceData.institutionOwnership)}</span>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Insider</span>
                                <span className="text-xl font-bold text-white font-outfit">{formatPercent(priceData.insiderOwnership)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Hub Bento - REPLACED WITH TRADING TERMINAL */}
                    <div className="bg-[#0A0A0B] border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-widest text-[11px]">
                                <Terminal size={14} className="text-blue-500" />
                                Order Execution
                            </div>
                            {portfolio && (
                                <div className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg border border-emerald-400/20">
                                    Bal: ₹{formatIndianNumber(portfolio.cashBalance)}
                                </div>
                            )}
                        </div>

                        <OrderTerminal
                            symbol={symbol}
                            currentPrice={current}
                            portfolio={portfolio}
                            onTradeSuccess={fetchPortfolio}
                            isTrading={isTrading}
                            setIsTrading={setIsTrading}
                        />
                    </div>

                    <div className="bg-blue-600 rounded-3xl p-6 shadow-2xl flex flex-col justify-between group cursor-pointer hover:bg-blue-500 transition-colors">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <ShieldCheck size={18} className="text-white" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest leading-none">Alpha Guardian</h3>
                            </div>
                            <p className="text-[12px] text-blue-100 font-medium leading-relaxed mb-6 opacity-80 group-hover:opacity-100 transition-opacity">
                                Active neural tracking configured for priority whale movements & liquid flux.
                            </p>
                        </div>
                        <button className="w-full py-3.5 bg-white text-blue-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest ring-0 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all">
                            Configure Stream
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* 3. BENTO DATA MATRIX (NO GAPS, PERFECT ALIGNMENT) */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 px-2">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">Integrated Analytics Matrix</h2>
                    <div className="h-px w-full bg-white/5"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {/* Valuation Hub */}
                    <BentoBox title="Valuation Intel" icon={<Layers className="text-amber-500" />} color="amber">
                        <MetricRow label="Forward P/E" value={priceData.forwardPe?.toFixed(2) || "--"} tooltip="Price-to-Earnings ratio based on forecasted earnings." />
                        <MetricRow label="P/S Ratio" value={priceData.priceToSales?.toFixed(2) || "--"} tooltip="Price-to-Sales ratio compares stock price to company revenue." />
                        <MetricRow label="EV / Revenue" value={priceData.enterpriseToRevenue?.toFixed(2) || "--"} />
                        <MetricRow label="EV / EBITDA" value={priceData.enterpriseToEbitda?.toFixed(2) || "--"} />
                        <MetricRow label="Book Value" value={`₹${priceData.bookValue?.toFixed(2) || "--"}`} />
                    </BentoBox>

                    {/* Health Hub */}
                    <BentoBox title="Financial Health" icon={<Shield className="text-blue-500" />} color="blue">
                        <MetricRow label="Debt / Equity" value={priceData.debtToEquity?.toFixed(2) || "--"} />
                        <MetricRow label="Current Ratio" value={priceData.currentRatio?.toFixed(2) || "--"} tooltip="Liquidity ratio measuring company's ability to pay short-term obligations." />
                        <MetricRow label="Quick Ratio" value={priceData.quickRatio?.toFixed(2) || "--"} />
                        <MetricRow label="Total Cash" value={`₹${formatIndianNumber(priceData.totalCash)}`} />
                        <MetricRow label="Total Debt" value={`₹${formatIndianNumber(priceData.totalDebt)}`} />
                    </BentoBox>

                    {/* Profitability Hub */}
                    <BentoBox title="Profitability Matrix" icon={<TrendingUp className="text-emerald-500" />} color="emerald">
                        <MetricRow label="Return on Equity" value={formatPercent(priceData.roe)} />
                        <MetricRow label="Return on Assets" value={formatPercent(priceData.roa)} />
                        <MetricRow label="Gross Margin" value={formatPercent(priceData.grossMargins)} />
                        <MetricRow label="Operating Margin" value={formatPercent(priceData.operatingMargins)} />
                        <MetricRow label="Free Cash Flow" value={`₹${formatIndianNumber(priceData.freeCashflow)}`} />
                    </BentoBox>

                    {/* Growth & Structure */}
                    <BentoBox title="Growth Vector" icon={<Zap className="text-rose-500" />} color="rose">
                        <MetricRow label="Revenue Growth" value={formatPercent(priceData.revenueGrowth)} isPositive={(priceData.revenueGrowth || 0) > 0} />
                        <MetricRow label="Earnings Growth" value={formatPercent(priceData.earningsGrowth)} isPositive={(priceData.earningsGrowth || 0) > 0} />
                        <MetricRow label="Dividend Yield" value={formatPercent(priceData.dividendYield)} />
                        <MetricRow label="Total Revenue" value={`₹${formatIndianNumber(priceData.revenue)}`} />
                        <MetricRow label="Floating Shares" value={formatIndianNumber(priceData.floatShares)} />
                    </BentoBox>
                </div>
            </div>

            {/* 4. TOTAL REVENUE SUMMARY BENTO (REFINED LAYOUT) */}
            <motion.div variants={itemVariants} className="bg-[#0A0A0B] border border-white/5 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden group border-b-blue-600/20 border-b-2">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.05),transparent_40%)]"></div>
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-7 space-y-4">
                        <div className="flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                            <Landmark size={20} className="text-blue-500" />
                            <span className="text-[12px] font-bold text-slate-500 uppercase tracking-[0.4em]">Enterprise Valuation</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-3xl md:text-5xl lg:text-6xl font-bold text-white font-outfit tracking-tighter leading-none">
                                ₹{formatIndianNumber(priceData.enterpriseValue || 0)}
                            </div>
                            <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed max-w-xl opacity-80">
                                Comprehensive valuation assessment incorporating total equity, gross debt, and liquid cash reserves.
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-5 grid grid-cols-2 gap-8 lg:border-l lg:border-white/10 lg:pl-12">
                        <div className="flex flex-col gap-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-blue-500"></div> Nominal Sales
                            </span>
                            <div className="text-xl md:text-2xl font-bold text-white font-outfit tracking-tight whitespace-nowrap">₹{formatIndianNumber(priceData.revenue || 0)}</div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-emerald-500"></div> Liquid Surplus
                            </span>
                            <div className="text-xl md:text-2xl font-bold text-white font-outfit tracking-tight whitespace-nowrap">₹{formatIndianNumber(priceData.freeCashflow || 0)}</div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 5. FUNCTIONAL METADATA FOOTER (FINAL POLISH) */}
            <motion.div variants={itemVariants} className="pt-12 mt-12 border-t border-white/5">
                <div className="flex flex-col lg:flex-row justify-between gap-12 items-start">
                    {/* Brand Meta */}
                    <div className="flex flex-col gap-5 max-w-xs">
                        <div className="flex items-center gap-3.5 text-white font-bold text-xl font-outfit">
                            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-sm shadow-[0_0_20px_rgba(37,99,235,0.4)]">SI</div>
                            <div className="flex flex-col">
                                <span className="leading-tight tracking-tight">StockIntel Alpha</span>
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-[0.2em]">Terminal Architecture</span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase tracking-[0.2em] opacity-80">
                            Professional Analytics Environment<br />
                            <span className="text-slate-800 font-mono">Build 2.4.0-STABLE / RT-SYNC</span>
                        </p>
                    </div>

                    {/* Telemetry Columns */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 w-full max-w-4xl lg:ml-12">
                        <div className="flex flex-col gap-4">
                            <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.4em] pb-2.5 border-b border-white/5">Network Stream</h4>
                            <div className="space-y-3.5">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"><RefreshCcw size={10} className="text-slate-600" /> Sync Time</span>
                                    <span className="text-[10px] font-bold text-white font-mono tracking-wider whitespace-nowrap">{priceData.lastUpdated ? new Date(priceData.lastUpdated).toLocaleTimeString() : "--"}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"><Database size={10} className="text-slate-600" /> Data Tier</span>
                                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest whitespace-nowrap">Enterprise Pulse</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.4em] pb-2.5 border-b border-white/5">Protocol Stack</h4>
                            <div className="space-y-3.5">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"><Shield size={10} className="text-slate-600" /> Layer</span>
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest tracking-wider whitespace-nowrap">Quantum-TSX</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"><Server size={10} className="text-slate-600" /> Node</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tracking-wider whitespace-nowrap">HTTP/2 TLS 1.3</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.4em] pb-2.5 border-b border-white/5">Interface Health</h4>
                            <div className="space-y-3.5">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"><Activity size={10} className="text-slate-600" /> Latency</span>
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest whitespace-nowrap">12ms Nominal</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"><Target size={10} className="text-slate-600" /> Accuracy</span>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest whitespace-nowrap">99.98% Cryptic</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Hub */}
                    <div className="flex lg:flex-col items-center gap-3.5 lg:justify-start lg:h-full lg:pt-1">
                        <div className="w-11 h-11 rounded-xl border border-white/5 flex items-center justify-center text-slate-600 hover:text-white hover:border-white transition-all cursor-pointer bg-white/[0.03]">
                            <ExternalLink size={18} />
                        </div>
                        <div className="w-11 h-11 rounded-xl border border-white/5 flex items-center justify-center text-slate-600 hover:text-white hover:border-white transition-all cursor-pointer bg-white/[0.03]">
                            <Shield size={18} />
                        </div>
                    </div>
                </div>

                <TerminalFooter />
            </motion.div>
        </motion.div>
    );
}

function OrderTerminal({ symbol, currentPrice, portfolio, onTradeSuccess, isTrading, setIsTrading }: any) {
    const [quantity, setQuantity] = useState(1);
    const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
    const [limitPrice, setLimitPrice] = useState(currentPrice);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    const holding = portfolio?.holdings?.find((h: any) => h.symbol === symbol);
    const executionPrice = orderType === 'MARKET' ? currentPrice : limitPrice;
    const totalValue = executionPrice * quantity;

    useEffect(() => {
        if (orderType === 'MARKET') setLimitPrice(currentPrice);
    }, [currentPrice, orderType]);

    const handleTrade = async (type: 'BUY' | 'SELL') => {
        setIsTrading(true);
        setStatus({ type: null, message: '' });
        try {
            const url = orderType === 'MARKET' ? '/api/trade' : '/api/trade/limit';
            const body = orderType === 'MARKET'
                ? { symbol, quantity, type }
                : { symbol, quantity, targetPrice: limitPrice, type };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({
                    type: 'success',
                    message: orderType === 'MARKET'
                        ? `${type} successful: ${quantity} shares`
                        : `${type} Limit Order placed at ₹${limitPrice}`
                });
                onTradeSuccess();
                setTimeout(() => setStatus({ type: null, message: '' }), 3000);
            } else {
                setStatus({ type: 'error', message: data.error || 'Execution failed' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Network error' });
        } finally {
            setIsTrading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                {['MARKET', 'LIMIT'].map((t) => (
                    <button
                        key={t}
                        onClick={() => setOrderType(t as any)}
                        className={cn(
                            "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                            orderType === t ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Quantity</label>
                    <div className="relative group">
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-blue-500 transition-all text-sm group-hover:border-white/20"
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                        {orderType === 'MARKET' ? 'Market Price' : 'Target Price'}
                    </label>
                    <div className="relative group">
                        <input
                            type="number"
                            step="0.05"
                            disabled={orderType === 'MARKET'}
                            value={limitPrice}
                            onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-blue-500 transition-all text-sm group-hover:border-white/20 disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-slate-500">Total {orderType === 'MARKET' ? 'Value' : 'Requirement'}</span>
                    <span className="text-white">₹{formatIndianNumber(totalValue)}</span>
                </div>
                {holding && (
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-slate-500">Security Nodes</span>
                        <span className="text-blue-400">{holding.quantity} Owned</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => handleTrade('BUY')}
                    disabled={isTrading || !currentPrice || (portfolio && portfolio.cashBalance < totalValue)}
                    className="flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                >
                    {isTrading ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                    {orderType === 'MARKET' ? 'Buy Asset' : 'Place Limit'}
                </button>
                <button
                    onClick={() => handleTrade('SELL')}
                    disabled={isTrading || !holding || holding.quantity < quantity}
                    className="flex items-center justify-center gap-2 py-3.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-rose-900/20 active:scale-95"
                >
                    {isTrading ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                    {orderType === 'MARKET' ? 'Sell Asset' : 'Place Limit'}
                </button>
            </div>

            <AnimatePresence>
                {status.type && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`p-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${status.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}
                    >
                        {status.type === 'success' ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
                        {status.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function BentoRow({ icon, label, value, tooltip }: { icon: React.ReactNode; label: string; value: string; tooltip?: string }) {
    return (
        <div className="group/row flex items-center justify-between py-3.5 border-b border-white/5 last:border-0 hover:px-2 transition-all cursor-default">
            <div className="flex items-center gap-2.5">
                <div className="text-slate-500 group-hover/row:text-blue-400 transition-colors">{icon}</div>
                <span className="text-[11px] font-semibold text-slate-500 group-hover/row:text-slate-200 transition-colors uppercase tracking-wider">{label}</span>
                {tooltip && (
                    <Tooltip content={tooltip}>
                        <HelpCircle size={12} className="text-slate-700 hover:text-blue-400 cursor-help transition-colors" />
                    </Tooltip>
                )}
            </div>
            <span className="text-sm font-bold text-white font-mono">{value}</span>
        </div>
    );
}

function BentoBox({ title, icon, children, color }: { title: string; icon: React.ReactNode; children: React.ReactNode; color: string }) {
    return (
        <div className="bg-[#0A0A0B] border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col gap-6 relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white/5 border border-white/10 group-hover:scale-110 transition-transform`}>
                        {icon}
                    </div>
                    <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">{title}</h3>
                </div>
                <ChevronRight size={14} className="text-slate-700 group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="space-y-4 relative z-10">
                {children}
            </div>
        </div>
    );
}

function MetricRow({ label, value, tooltip, isPositive }: { label: string; value: string; tooltip?: string; isPositive?: boolean }) {
    return (
        <div className="flex items-center justify-between group/metric py-1">
            <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide truncate">{label}</span>
                {tooltip && (
                    <Tooltip content={tooltip}>
                        <Info size={10} className="text-slate-700 hover:text-blue-400 cursor-help transition-colors flex-shrink-0" />
                    </Tooltip>
                )}
            </div>
            <div className={`text-sm font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-slate-300'} flex-shrink-0`}>
                {value}
            </div>
        </div>
    );
}
