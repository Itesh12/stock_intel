"use client";
import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Play, RotateCcw, TrendingUp, TrendingDown, History, Cpu, Target, ArrowRight, ShieldAlert } from "lucide-react";
import { formatCurrency, formatIndianNumber, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function BacktestSimulator() {
    const [symbol, setSymbol] = useState("RELIANCE.NS");
    const [initialCapital, setInitialCapital] = useState(1000000);
    const [days, setDays] = useState(365);
    const [result, setResult] = useState<any>(null);
    const [isSimulating, setIsSimulating] = useState(false);

    const runSim = async () => {
        setIsSimulating(true);
        try {
            const res = await fetch('/api/sim/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, initialCapital, days })
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            console.error("Backtest failed", err);
        } finally {
            setIsSimulating(false);
        }
    };

    return (
        <div className="space-y-8 h-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-6">
                    <div className="glass-morphic-card rounded-3xl p-6 border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-3 mb-6 font-outfit uppercase tracking-widest text-[10px] font-black text-blue-500">
                            <Target size={14} />
                            Simulation Parameters
                        </div>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Symbol Node</label>
                                <input
                                    type="text"
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-blue-500 focus:outline-none transition-all"
                                    placeholder="e.g. RELIANCE.NS"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Starting Capital (Virtual)</label>
                                <input
                                    type="number"
                                    value={initialCapital}
                                    onChange={(e) => setInitialCapital(parseInt(e.target.value) || 0)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-blue-500 focus:outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Range Horizon (Days)</label>
                                <select 
                                    value={days}
                                    onChange={(e) => setDays(parseInt(e.target.value))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition-all appearance-none"
                                >
                                    <option value={30}>30 Days (Tactical)</option>
                                    <option value={90}>90 Days (Momentum)</option>
                                    <option value={180}>180 Days (Strategic)</option>
                                    <option value={365}>1 Year (Structural)</option>
                                    <option value={730}>2 Years (Generational)</option>
                                </select>
                            </div>

                            <button
                                onClick={runSim}
                                disabled={isSimulating}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-4 shadow-xl shadow-blue-900/40"
                            >
                                {isSimulating ? <RotateCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                                Initialize Backtest
                            </button>
                        </div>
                    </div>

                    {result && (
                        <div className="glass-morphic-card rounded-3xl p-6 border-emerald-500/10 bg-emerald-500/[0.01]">
                            <div className="flex items-center gap-3 mb-6 font-outfit uppercase tracking-widest text-[10px] font-black text-emerald-500">
                                <TrendingUp size={14} />
                                Simulation Outcome
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Total Return</div>
                                    <div className={cn("text-xl font-black font-outfit", result.totalReturnPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {result.totalReturnPercent >= 0 ? '+' : ''}{result.totalReturnPercent.toFixed(2)}%
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Win Rate</div>
                                    <div className="text-xl font-black font-outfit text-white">
                                        {result.winRate.toFixed(1)}%
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Max Drawdown</div>
                                    <div className="text-sm font-bold font-mono text-rose-500/70">
                                        -{result.maxDrawdown.toFixed(2)}%
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Profit Factor</div>
                                    <div className="text-sm font-bold font-mono text-blue-400">
                                        {result.profitFactor.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="md:col-span-2 space-y-6">
                    <section className="glass-morphic-card rounded-[32px] p-8 border-white/5 min-h-[400px] flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Equity Trajectory</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Virtual Capital Growth Over Range</p>
                            </div>
                            {result && (
                                <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{result.strategyName}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 w-full min-h-[300px]">
                            {result ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={result.equityCurve}>
                                        <defs>
                                            <linearGradient id="colorNavBacktest" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis 
                                            dataKey="timestamp" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                                            tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short' })}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                                            tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                                            orientation="right"
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#09090b', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}
                                            labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold' }}
                                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'black' }}
                                            labelFormatter={(val) => new Date(val).toLocaleDateString()}
                                            formatter={(val: any) => {
                                                const numericVal = Number(val);
                                                return [`₹${formatIndianNumber(numericVal)}`, 'NAV'];
                                            }}
                                        />
                                        <Area type="monotone" dataKey="nav" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorNavBacktest)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-4">
                                    <History size={48} className="opacity-20" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Ready for Simulation Batch</span>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="glass-morphic-card rounded-[32px] overflow-hidden border-white/5">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-slate-400">
                                <History size={20} />
                                <h2 className="text-xl font-bold text-white tracking-tight">Trade Ledger</h2>
                            </div>
                            {result && (
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">{result.trades.length} Executions</span>
                            )}
                        </div>
                        <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-widest border-b border-white/5 sticky top-0 backdrop-blur-md">
                                        <th className="px-8 py-4 font-bold">Type</th>
                                        <th className="px-8 py-4 font-bold">Execution Price</th>
                                        <th className="px-8 py-4 font-bold">Quantity</th>
                                        <th className="px-8 py-4 font-bold">Reasoning</th>
                                        <th className="px-8 py-4 font-bold text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {result?.trades.length > 0 ? (
                                        [...result.trades].reverse().map((trade: any) => (
                                            <tr key={trade.id} className="hover:bg-white/[0.03] transition-all group">
                                                <td className="px-8 py-4">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight border",
                                                        trade.type === 'BUY'
                                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                                    )}>
                                                        {trade.type}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-4 text-xs font-mono text-slate-300">₹{trade.price.toFixed(2)}</td>
                                                <td className="px-8 py-4 text-xs font-mono text-slate-300">{trade.quantity}</td>
                                                <td className="px-8 py-4 text-[10px] text-slate-500 font-medium italic">{trade.reason}</td>
                                                <td className="px-8 py-4 text-right text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                                    {new Date(trade.timestamp).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center opacity-40">
                                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Awaiting Simulation Results</span>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
