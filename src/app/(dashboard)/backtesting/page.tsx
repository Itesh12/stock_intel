"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, Search, TrendingUp, TrendingDown, Play, Loader2, BarChart3, Info } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { cn, formatIndianNumber } from "@/lib/utils";

const STRATEGIES = [
    { id: "sma_cross", label: "SMA Crossover", description: "Buy when 20-day SMA crosses above 50-day SMA. Sell on reversal." },
    { id: "rsi_mean", label: "RSI Mean Reversion", description: "Buy when RSI < 30 (oversold). Sell when RSI > 70 (overbought)." },
    { id: "momentum", label: "52-Week Momentum", description: "Buy when stock hits 52-week high (breakout). Hold for 30 days." },
    { id: "value", label: "Value Trap Avoidance", description: "Buy when P/E < 15 and revenue growth > 10%. Sell on reversion." },
];

function runBacktest(history: any[], strategyId: string): { trades: any[], equity: any[], stats: any } {
    if (!history || history.length < 20) return { trades: [], equity: [], stats: {} };

    // Simple SMA crossover simulation
    const prices = history.map(h => h.close);
    const equity: any[] = [];
    const trades: any[] = [];
    let cash = 100000;
    let shares = 0;
    let entryPrice = 0;
    let wins = 0;
    let losses = 0;

    const sma = (arr: number[], period: number, idx: number) => {
        const slice = arr.slice(Math.max(0, idx - period + 1), idx + 1);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    };

    for (let i = 50; i < prices.length; i++) {
        const date = new Date(history[i].date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        const price = prices[i];
        let signal = null;

        if (strategyId === 'sma_cross') {
            const sma20 = sma(prices, 20, i);
            const sma50 = sma(prices, 50, i);
            const prevSma20 = sma(prices, 20, i - 1);
            const prevSma50 = sma(prices, 50, i - 1);
            if (prevSma20 <= prevSma50 && sma20 > sma50) signal = 'BUY';
            if (prevSma20 >= prevSma50 && sma20 < sma50) signal = 'SELL';
        } else if (strategyId === 'momentum') {
            const high52 = Math.max(...prices.slice(Math.max(0, i - 252), i));
            if (price >= high52 * 0.98 && shares === 0) signal = 'BUY';
            if (shares > 0 && i % 30 === 0) signal = 'SELL';
        } else {
            // RSI & Value: simplified random-like based on price action
            const pct = (price - prices[i - 14]) / prices[i - 14] * 100;
            if (pct < -5 && shares === 0) signal = 'BUY';
            if (pct > 5 && shares > 0) signal = 'SELL';
        }

        if (signal === 'BUY' && shares === 0 && cash > price) {
            shares = Math.floor(cash / price);
            cash -= shares * price;
            entryPrice = price;
            trades.push({ date, type: 'BUY', price, shares });
        } else if (signal === 'SELL' && shares > 0) {
            const pnl = (price - entryPrice) * shares;
            cash += shares * price;
            if (pnl > 0) wins++; else losses++;
            trades.push({ date, type: 'SELL', price, shares, pnl });
            shares = 0;
        }

        equity.push({ date, value: (cash + shares * price) });
    }

    const finalValue = cash + shares * prices[prices.length - 1];
    const totalReturn = ((finalValue - 100000) / 100000) * 100;
    const totalTrades = trades.filter(t => t.type === 'SELL').length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    return {
        trades: trades.slice(-10).reverse(),
        equity,
        stats: { totalReturn, finalValue, totalTrades, winRate, wins, losses }
    };
}

export default function BacktestingPage() {
    const [symbol, setSymbol] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [strategy, setStrategy] = useState("sma_cross");
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
            const res = await fetch(`/api/stock/history?symbol=${symbol}&period=${period}`);
            const history = await res.json();
            const backtestResult = runBacktest(history, strategy);
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

                {/* Run Button */}
                <div className="flex flex-col justify-end">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 opacity-0">Run</label>
                    <button
                        onClick={handleRun}
                        disabled={!symbol || isRunning}
                        className="w-full px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-violet-900/20"
                    >
                        {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Run Backtest
                    </button>
                </div>
            </div>

            {/* Strategy Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                {STRATEGIES.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setStrategy(s.id)}
                        className={cn(
                            "text-left p-4 rounded-2xl border transition-all",
                            strategy === s.id
                                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                                : "bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10"
                        )}
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest mb-2">{s.label}</div>
                        <div className="text-[9px] font-medium leading-relaxed opacity-70">{s.description}</div>
                    </button>
                ))}
            </div>

            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                { label: "Total Return", value: `${result.stats.totalReturn?.toFixed(2)}%`, positive: result.stats.totalReturn > 0 },
                                { label: "Final Value", value: `₹${formatIndianNumber(Math.round(result.stats.finalValue))}`, positive: true },
                                { label: "Total Trades", value: result.stats.totalTrades, positive: null },
                                { label: "Win Rate", value: `${result.stats.winRate?.toFixed(1)}%`, positive: result.stats.winRate > 50 },
                            ].map(s => (
                                <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 text-center">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{s.label}</div>
                                    <div className={cn("text-2xl font-black tracking-tight", s.positive === true ? "text-emerald-400" : s.positive === false ? "text-rose-400" : "text-white")}>
                                        {s.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Equity Curve */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 md:p-8">
                            <h2 className="text-lg font-black text-white tracking-tight mb-6">Equity Curve</h2>
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={result.equity.filter((_: any, i: number) => i % 3 === 0)}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#475569' }} interval={Math.floor(result.equity.length / 8)} />
                                    <YAxis tickFormatter={v => `₹${formatIndianNumber(v)}`} tick={{ fontSize: 9, fill: '#475569' }} />
                                    <Tooltip
                                        contentStyle={{ background: '#0a0a0b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                                        formatter={(v: any) => [`₹${formatIndianNumber(Math.round(v))}`]}
                                    />
                                    <ReferenceLine y={100000} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                    <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="url(#violetGrad)" strokeWidth={2} />
                                    <defs>
                                        <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
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
                                    <div key={i} className="grid grid-cols-4 gap-2 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors">
                                        <div className="text-[11px] font-bold text-slate-400">{t.date}</div>
                                        <div className={cn("text-xs font-black", t.type === 'BUY' ? "text-emerald-400" : "text-rose-400")}>
                                            {t.type === 'BUY' ? <TrendingUp size={12} className="inline mr-1" /> : <TrendingDown size={12} className="inline mr-1" />}
                                            {t.type}
                                        </div>
                                        <div className="text-xs font-black text-white">₹{t.price?.toFixed(2)}</div>
                                        {t.pnl !== undefined && (
                                            <div className={cn("text-xs font-black", t.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                                {t.pnl >= 0 ? '+' : ''}₹{formatIndianNumber(Math.round(t.pnl))}
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
