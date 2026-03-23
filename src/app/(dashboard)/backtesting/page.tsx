"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, Search, TrendingUp, TrendingDown, Play, Loader2, BarChart3, Info } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { cn, formatIndianNumber } from "@/lib/utils";

const STRATEGIES = [
    { id: "sma_cross", label: "SMA Crossover", description: "Classic trend-following using Short vs Long Moving Average crossover.", params: [
        { label: "Short Period", key: "smaShort", default: 20 },
        { label: "Long Period", key: "smaLong", default: 50 },
    ]},
    { id: "rsi_mean", label: "RSI Reversal", description: "Buy oversold dips and sell overbought peaks using Relative Strength Index.", params: [
        { label: "RSI Period", key: "rsiPeriod", default: 14 },
        { label: "Oversold", key: "rsiLow", default: 30 },
        { label: "Overbought", key: "rsiHigh", default: 70 },
    ]},
    { id: "macd", label: "MACD Trend", description: "Momentum analysis using Moving Average Convergence Divergence signals.", params: [
        { label: "Fast EMA", key: "macdFast", default: 12 },
        { label: "Slow EMA", key: "macdSlow", default: 26 },
    ]},
    { id: "momentum", label: "Breakout", description: "Ride the trend when stock breaks 52-week highs with fixed hold time.", params: [
        { label: "Lookback (Days)", key: "momLookback", default: 252 },
        { label: "Hold Days", key: "holdDays", default: 30 },
    ]},
];

function runBacktest(history: any[], strategyId: string, params: any): { trades: any[], equity: any[], stats: any, benchmark: any[] } {
    if (!history || history.length < 50) return { trades: [], equity: [], stats: {}, benchmark: [] };

    const prices = history.map(h => h.close);
    const equity: any[] = [];
    const benchmark: any[] = [];
    const trades: any[] = [];
    let cash = 100000;
    let shares = 0;
    let entryPrice = 0;
    let wins = 0;
    let losses = 0;
    let maxDrawdown = 0;
    let peak = 100000;

    // INDICATOR CALCULATORS
    const sma = (arr: number[], period: number, idx: number) => {
        const slice = arr.slice(Math.max(0, idx - period + 1), idx + 1);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    };

    const calculateRSI = (arr: number[], idx: number, period: number = 14) => {
        if (idx < period) return 50;
        let gains = 0, losses = 0;
        for (let j = idx - period + 1; j <= idx; j++) {
            const diff = arr[j] - arr[j - 1];
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    };

    const calculateEMA = (arr: number[], idx: number, period: number, prevEma: number | null) => {
        const k = 2 / (period + 1);
        const price = arr[idx];
        if (prevEma === null) return sma(arr, period, idx);
        return price * k + prevEma * (1 - k);
    };

    let prevEma12 = null, prevEma26 = null, prevSignal = null;
    const macdBuffer: number[] = [];
    let grossWins = 0;
    let grossLosses = 0;

    for (let i = 50; i < prices.length; i++) {
        const date = new Date(history[i].date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        const price = prices[i];
        let signal = null;

        // STRATEGY LOGIC
        if (strategyId === 'sma_cross') {
            const sShort = params.smaShort || 20;
            const sLong = params.smaLong || 50;
            const short = sma(prices, sShort, i);
            const long = sma(prices, sLong, i);
            const prevShort = sma(prices, sShort, i - 1);
            const prevLong = sma(prices, sLong, i - 1);
            if (prevShort <= prevLong && short > long) signal = 'BUY';
            if (prevShort >= prevLong && short < long) signal = 'SELL';
        } else if (strategyId === 'rsi_mean') {
            const rsi = calculateRSI(prices, i, params.rsiPeriod || 14);
            const thresholdLow = params.rsiLow || 30;
            const thresholdHigh = params.rsiHigh || 70;
            if (rsi < thresholdLow && shares === 0) signal = 'BUY';
            if (rsi > thresholdHigh && shares > 0) signal = 'SELL';
        } else if (strategyId === 'macd') {
            const ema12: number = calculateEMA(prices, i, params.macdFast || 12, prevEma12);
            const ema26: number = calculateEMA(prices, i, params.macdSlow || 26, prevEma26);
            const macdLine = ema12 - ema26;
            macdBuffer.push(macdLine);
            const signalLine: number = calculateEMA(macdBuffer, macdBuffer.length - 1, 9, prevSignal);
            if (macdLine > signalLine && (prevSignal === null || (macdBuffer[macdBuffer.length - 2] || 0) <= (prevSignal || 0)) && shares === 0) signal = 'BUY';
            if (macdLine < signalLine && (prevSignal === null || (macdBuffer[macdBuffer.length - 2] || 0) >= (prevSignal || 0)) && shares > 0) signal = 'SELL';
            prevEma12 = ema12; prevEma26 = ema26; prevSignal = signalLine;
        } else if (strategyId === 'momentum') {
            const lookback = params.momLookback || 252;
            const high52 = Math.max(...prices.slice(Math.max(0, i - lookback), i));
            if (price >= high52 * 0.99 && shares === 0) signal = 'BUY';
            if (shares > 0 && i % (params.holdDays || 30) === 0) signal = 'SELL';
        }

        // SIMULATION EXECUTION
        if (signal === 'BUY' && shares === 0 && cash > price) {
            shares = Math.floor(cash / price);
            cash -= shares * price;
            entryPrice = price;
            trades.push({ date, type: 'BUY', price, shares });
        } else if (signal === 'SELL' && shares > 0) {
            const pnl = (price - entryPrice) * shares;
            cash += shares * price;
            if (pnl > 0) { wins++; grossWins += pnl; } else { losses++; grossLosses += Math.abs(pnl); }
            trades.push({ date, type: 'SELL', price, shares, pnl, roi: (pnl / (entryPrice * shares)) * 100 });
            shares = 0;
        }

        const currentEquity = cash + shares * price;
        equity.push({ date, value: Math.round(currentEquity) });
        benchmark.push({ date, value: Math.round(100000 * (price / prices[50])) });

        // RISK METRICS
        if (currentEquity > peak) peak = currentEquity;
        const dd = ((peak - currentEquity) / peak) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const finalValue = cash + shares * prices[prices.length - 1];
    const strategyReturn = ((finalValue - 100000) / 100000) * 100;
    const benchmarkReturn = ((prices[prices.length - 1] - prices[50]) / prices[50]) * 100;
    const totalTrades = trades.filter(t => t.type === 'SELL').length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 100 : 0;

    return {
        trades: trades.slice(-10).reverse(),
        equity,
        benchmark,
        stats: { 
            totalReturn: strategyReturn, 
            finalValue, 
            totalTrades, 
            winRate, 
            maxDrawdown,
            alpha: strategyReturn - benchmarkReturn,
            benchmarkReturn,
            profitFactor
        }
    };
}

export default function BacktestingPage() {
    const [symbol, setSymbol] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [strategy, setStrategy] = useState("sma_cross");
    const [params, setParams] = useState<Record<string, number>>({ smaShort: 20, smaLong: 50 });
    const [period, setPeriod] = useState("1y");
    const [result, setResult] = useState<any>(null);
    const [isRunning, setIsRunning] = useState(false);

    const handleSearch = async (q: string) => {
        setSearchQuery(q);
        if (q.length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            setSearchResults(data.slice(0, 5));
        } finally {
            setIsSearching(false);
        }
    };

    const handleRun = async () => {
        if (!symbol) return;
        setIsRunning(true);
        setResult(null);
        try {
            const res = await fetch(`/api/stock/history?symbol=${symbol}&period=${period}&_t=${Date.now()}`);
            const history = await res.json();
            const backtestResult = runBacktest(history, strategy, params);
            setResult(backtestResult);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="space-y-8 md:space-y-12 pb-20 py-4 md:py-8">
            <div className="text-center">
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-full mb-6">
                    <FlaskConical size={14} className="text-violet-400" />
                    <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Strategy Lab</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter mb-4">Back<span className="text-violet-500">testing</span></h1>
                <p className="text-slate-500 font-medium text-sm max-w-lg mx-auto">
                    Test trading strategies on historical data. Simulate performance before risking real capital.
                </p>
            </div>

            {/* Config Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {/* Stock Selector */}
                <div className="relative">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Stock Symbol</label>
                    {symbol ? (
                        <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl">
                            <span className="font-black text-white text-sm">{symbol.replace(/\.(NS|BO)$/, '')}</span>
                            <button onClick={() => { setSymbol(''); setResult(null); }} className="ml-auto text-slate-600 hover:text-rose-400">
                                <Search size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus-within:border-violet-500 transition-all">
                                {isSearching ? <Loader2 size={14} className="animate-spin text-slate-500" /> : <Search size={14} className="text-slate-500" />}
                                <input
                                    className="bg-transparent text-white text-sm font-medium w-full focus:outline-none placeholder:text-slate-600"
                                    placeholder="Search stock..."
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="absolute top-full mt-2 left-0 right-0 bg-[#111] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl">
                                    {searchResults.map((r: any) => (
                                        <button key={r.symbol} onClick={() => { setSymbol(r.symbol); setSearchResults([]); setSearchQuery(''); }}
                                            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3">
                                            <span className="text-xs font-black text-white">{r.symbol?.replace(/\.(NS|BO)$/, '')}</span>
                                            <span className="text-[10px] text-slate-500 truncate">{r.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Period Selector */}
                <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Data Period</label>
                    <select
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-bold focus:outline-none focus:border-violet-500 transition-all"
                    >
                        {[{ label: '6 Months', v: '6mo' }, { label: '1 Year', v: '1y' }, { label: '2 Years', v: '2y' }, { label: '5 Years', v: '5y' }].map(p => (
                            <option key={p.v} value={p.v} className="bg-[#111]">{p.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Run Button */}
            <div className="flex flex-col items-center gap-4">
                <button
                    onClick={handleRun}
                    disabled={!symbol || isRunning}
                    className="w-full max-w-md px-10 py-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl shadow-violet-900/30 group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
                    {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                    {isRunning ? "Simulating Intelligence..." : "Execute Backtest"}
                </button>
            </div>

            {/* Strategy Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                {STRATEGIES.map(s => (
                    <button
                        key={s.id}
                        onClick={() => {
                            setStrategy(s.id);
                            const newParams: Record<string, number> = {};
                            s.params?.forEach(p => newParams[p.key] = p.default);
                            setParams(newParams);
                        }}
                        className={cn(
                            "text-left p-4 rounded-2xl border transition-all relative overflow-hidden group",
                            strategy === s.id
                                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                                : "bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10"
                        )}
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center justify-between">
                            {s.label}
                            {strategy === s.id && <div className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />}
                        </div>
                        <div className="text-[9px] font-medium leading-relaxed opacity-70 italic lowercase first-letter:uppercase">{s.description}</div>
                    </button>
                ))}
            </div>

            {/* Parameters Panel */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={strategy}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                >
                    <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Info size={12} className="text-violet-400" />
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Strategy Parameters</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {STRATEGIES.find(s => s.id === strategy)?.params?.map(p => (
                                <div key={p.key} className="space-y-2">
                                    <label className="text-[9px] font-bold text-slate-500 ml-1">{p.label}</label>
                                    <input
                                        type="number"
                                        value={params[p.key] || p.default}
                                        onChange={e => setParams(prev => ({ ...prev, [p.key]: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-violet-500 transition-all"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                            {[
                                { label: "Total Return", value: `${result.stats.totalReturn?.toFixed(2)}%`, positive: result.stats.totalReturn > 0 },
                                { label: "Benchmark", value: `${result.stats.benchmarkReturn?.toFixed(2)}%`, positive: result.stats.benchmarkReturn > 0 },
                                { label: "Alpha", value: `${result.stats.alpha >= 0 ? '+' : ''}${result.stats.alpha?.toFixed(2)}%`, positive: result.stats.alpha > 0 },
                                { label: "Max Drawdown", value: `${result.stats.maxDrawdown?.toFixed(1)}%`, positive: false },
                                { label: "Profit Factor", value: result.stats.profitFactor?.toFixed(2), positive: result.stats.profitFactor > 1.5 },
                                { label: "Win Rate", value: `${result.stats.winRate?.toFixed(1)}%`, positive: result.stats.winRate > 50 },
                                { label: "Trades", value: result.stats.totalTrades, positive: null },
                            ].map(s => (
                                <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-center group hover:bg-white/[0.05] transition-all">
                                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</div>
                                    <div className={cn("text-lg font-black tracking-tight", s.positive === true ? "text-emerald-400" : s.positive === false ? "text-rose-400" : "text-white")}>
                                        {s.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Equity Curve */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 md:p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h1 className="text-lg font-black text-white tracking-tight uppercase">Equity Curve <span className="text-[10px] text-slate-500 font-bold ml-2">vs Benchmark</span></h1>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-violet-500"></div><span className="text-[9px] font-bold text-slate-400">Strategy</span></div>
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-600"></div><span className="text-[9px] font-bold text-slate-400">Buy & Hold</span></div>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={320}>
                                <AreaChart data={result.equity.map((e: any, i: number) => ({ ...e, benchmark: result.benchmark[i]?.value }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#475569' }} interval={Math.floor(result.equity.length / 8)} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: '#0a0a0b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                                        formatter={(v: any, name: string | undefined) => [`₹${formatIndianNumber(Math.round(v))}`, name === 'value' ? 'Strategy' : 'Benchmark']}
                                    />
                                    <Area type="monotone" dataKey="benchmark" stroke="rgba(255,255,255,0.1)" fill="transparent" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                                    <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="url(#violetGrad)" strokeWidth={2.5} dot={false} />
                                    <defs>
                                        <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Recent Trades */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden">
                            <div className="p-6 border-b border-white/5">
                                <h2 className="text-lg font-black text-white tracking-tight">Recent Simulated Trades</h2>
                            </div>
                            <div className="divide-y divide-white/5">
                                {result.trades.map((t: any, i: number) => (
                                    <div key={i} className="grid grid-cols-4 items-center gap-2 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors group">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{t.date}</div>
                                        <div className={cn("text-[10px] font-black uppercase flex items-center gap-1", t.type === 'BUY' ? "text-emerald-400" : "text-rose-400")}>
                                            {t.type === 'BUY' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {t.type}
                                        </div>
                                        <div className="text-[11px] font-black text-white">₹{t.price?.toLocaleString()}</div>
                                        {t.pnl !== undefined && (
                                            <div className="text-right">
                                                <div className={cn("text-[11px] font-black", t.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                                    {t.pnl >= 0 ? '+' : ''}{t.roi?.toFixed(1)}%
                                                </div>
                                                <div className="text-[8px] text-slate-600 font-bold">₹{formatIndianNumber(Math.round(t.pnl))}</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                            <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-[10px] font-medium text-amber-500/70 leading-relaxed">
                                Backtested results are simulated and may not reflect real market conditions. Slippage, taxes, and market impact are not accounted for. Past performance does not guarantee future results.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!result && !isRunning && (
                <div className="py-20 text-center opacity-30">
                    <FlaskConical size={48} className="mx-auto mb-4 text-slate-700" />
                    <p className="text-sm font-bold text-slate-500">Select a stock and strategy, then run the simulation</p>
                </div>
            )}
        </div>
    );
}
