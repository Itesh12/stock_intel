"use client";
import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Play, RotateCcw, TrendingUp, History, Target, Loader2 } from "lucide-react";
import { formatIndianNumber, cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function StrategyBacktestPanel({ strategyId }: { strategyId: string }) {
    const [days, setDays] = useState(365);
    const [isSimulating, setIsSimulating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("Ready");
    const [result, setResult] = useState<any>(null);

    const runSim = async () => {
        setIsSimulating(true);
        setStatusMessage("Initializing Data Pool...");
        setProgress(0);
        setResult(null);

        try {
            // Step 1: Init pool
            const initRes = await fetch(`/api/strategy/${strategyId}/backtest/init`);
            const { symbols } = await initRes.json();

            if (!symbols || symbols.length === 0) {
                throw new Error("Failed to initialize discovery pool.");
            }

            // Step 2: Batch loop
            const chunkSize = 10;
            const totalChunks = Math.ceil(symbols.length / chunkSize);
            let allMatches: any[] = [];

            for (let i = 0; i < totalChunks; i++) {
                setStatusMessage(`Scanning ${i * chunkSize} to ${Math.min((i + 1) * chunkSize, symbols.length)} of ${symbols.length} high-liquidity stocks...`);
                
                const chunk = symbols.slice(i * chunkSize, (i + 1) * chunkSize);
                
                const batchRes = await fetch(`/api/strategy/${strategyId}/backtest/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: chunk, days })
                });

                const data = await batchRes.json();
                if (data.matches) {
                    allMatches = [...allMatches, ...data.matches];
                }

                setProgress(Math.round(((i + 1) / totalChunks) * 100));
            }

            setStatusMessage("Compiling Equity Curve...");

            if (allMatches.length === 0) {
                setStatusMessage("Simulation Finished: No stocks matched the strategy criteria on the historical entry date.");
                setIsSimulating(false);
                return;
            }

            // Step 3: Aggregate Results
            const winners = allMatches.filter(m => m.totalReturn >= 0);
            const losers = allMatches.filter(m => m.totalReturn < 0);

            const winRate = (winners.length / allMatches.length) * 100;
            const avgReturn = allMatches.reduce((a, b) => a + b.totalReturn, 0) / allMatches.length;
            
            const sumWin = winners.reduce((a, b) => a + b.totalReturn, 0);
            const sumLoss = Math.abs(losers.reduce((a, b) => a + b.totalReturn, 0));
            const profitFactor = sumLoss === 0 ? 99.99 : sumWin / sumLoss;

            // Build an aggregate equity curve (equally weighted average of all matches per day)
            // Assumption: all 'performance' arrays have dates aligned approx well.
            const dateMap = new Map<string, { sum: number, count: number }>();
            
            allMatches.forEach(match => {
                match.performance.forEach((p: any) => {
                    const dStr = p.date.substring(0, 10);
                    if (!dateMap.has(dStr)) dateMap.set(dStr, { sum: 0, count: 0 });
                    const m = dateMap.get(dStr)!;
                    m.sum += p.returnPercent;
                    m.count += 1;
                });
            });

            const equityCurve = Array.from(dateMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, data]) => {
                    return {
                        timestamp: date,
                        nav: 100000 * (1 + (data.sum / data.count) / 100) // Start at 1 Lakh virtual NAV
                    };
                });

            // Find Max Drawdown roughly
            let peak = equityCurve[0]?.nav || 100000;
            let maxDrawdown = 0;
            equityCurve.forEach(pt => {
                if (pt.nav > peak) peak = pt.nav;
                const dd = ((peak - pt.nav) / peak) * 100;
                if (dd > maxDrawdown) maxDrawdown = dd;
            });

            setResult({
                winRate,
                totalReturnPercent: avgReturn,
                profitFactor,
                maxDrawdown,
                matches: allMatches,
                equityCurve
            });
            setStatusMessage("Completed");

        } catch (err) {
            console.error("Backtest Orchestrator Failed", err);
            setStatusMessage("Simulation Error: " + (err as any).message);
        } finally {
            setIsSimulating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Control Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-morphic-card rounded-3xl p-6 border-blue-500/10 bg-blue-500/5">
                        <div className="flex items-center gap-3 mb-6 font-outfit uppercase tracking-widest text-[10px] font-black text-blue-400">
                            <Target size={14} />
                            Time Machine Engine
                        </div>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Range Horizon (Past to Present)</label>
                                <select 
                                    value={days}
                                    onChange={(e) => setDays(parseInt(e.target.value))}
                                    disabled={isSimulating}
                                    className="w-full bg-black/40 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-100 focus:border-blue-400 focus:outline-none transition-all appearance-none disabled:opacity-50"
                                >
                                    <option value={30}>30 Days (Tactical)</option>
                                    <option value={90}>90 Days (Momentum)</option>
                                    <option value={180}>180 Days (Strategic)</option>
                                    <option value={365}>1 Year (Structural)</option>
                                </select>
                            </div>

                            <button
                                onClick={runSim}
                                disabled={isSimulating}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-4 shadow-xl shadow-blue-600/20"
                            >
                                {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                                {isSimulating ? "Processing Real Data..." : "Run Historical Simulation"}
                            </button>
                            
                            {isSimulating && (
                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                        <span>{statusMessage}</span>
                                        <span className="text-blue-400">{progress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {result && (
                        <div className="glass-morphic-card rounded-3xl p-6 border-emerald-500/10 bg-emerald-500/5">
                            <div className="flex items-center gap-3 mb-6 font-outfit uppercase tracking-widest text-[10px] font-black text-emerald-400">
                                <TrendingUp size={14} />
                                Simulation Outcome
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Agg. Return</div>
                                    <div className={cn("text-xl font-black font-outfit", result.totalReturnPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {result.totalReturnPercent >= 0 ? '+' : ''}{result.totalReturnPercent.toFixed(2)}%
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Win Rate</div>
                                    <div className="text-xl font-black font-outfit text-white">
                                        {result.winRate.toFixed(1)}%
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Max Drawdown</div>
                                    <div className="text-sm font-black font-mono text-rose-400/80">
                                        -{result.maxDrawdown.toFixed(2)}%
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Profit Factor</div>
                                    <div className="text-sm font-black font-mono text-blue-400">
                                        {result.profitFactor === 99.99 ? "MAX" : result.profitFactor.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Results View */}
                <div className="lg:col-span-3 space-y-6">
                    <section className="glass-morphic-card rounded-[32px] p-6 lg:p-8 border-white/5 min-h-[400px] flex flex-col bg-white/[0.01]">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Strategy Equity Trajectory</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Aggregated Performance of All Matched Stocks</p>
                            </div>
                            {result && (
                                <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{result.matches.length} Historical Matches</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 w-full min-h-[300px]">
                            {result?.equityCurve ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={result.equityCurve}>
                                        <defs>
                                            <linearGradient id="colorNav" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis 
                                            dataKey="timestamp" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                                            tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short' })}
                                        />
                                        <YAxis 
                                            domain={['auto', 'auto']}
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                                            tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                                            orientation="right"
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#09090b', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                                            labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold' }}
                                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'black' }}
                                            labelFormatter={(val) => new Date(val).toLocaleDateString()}
                                            formatter={(val: any) => [`₹${formatIndianNumber(val)}`, 'Simulated NAV']}
                                        />
                                        <Area type="monotone" dataKey="nav" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorNav)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-4">
                                    {isSimulating ? (
                                        <>
                                            <Loader2 size={48} className="opacity-20 animate-spin text-blue-500" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 text-blue-400">Chronotracking Engine Active</span>
                                        </>
                                    ) : (
                                        <>
                                            <History size={48} className="opacity-20" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Ready to initiate time-travel sequence</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Extracted Matches Table */}
                    {result?.matches && result.matches.length > 0 && (
                        <section className="glass-morphic-card rounded-[32px] overflow-hidden border-white/5 bg-white/[0.01]">
                            <div className="p-6 md:p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3 text-slate-400">
                                    <History size={18} />
                                    <h2 className="text-lg font-bold text-white tracking-tight">Historical Discoveries</h2>
                                </div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-pretty">
                                    Stocks that met criteria {days} days ago
                                </span>
                            </div>
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.02] text-slate-400 text-[10px] uppercase tracking-widest border-b border-white/5 sticky top-0 backdrop-blur-md">
                                            <th className="px-6 md:px-8 py-4 font-black">Symbol</th>
                                            <th className="px-6 py-4 font-black text-right">Entry (Then)</th>
                                            <th className="px-6 md:px-8 py-4 font-black text-right">Exit (Now)</th>
                                            <th className="px-6 md:px-8 py-4 font-black text-right">Forward Return</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {result.matches.sort((a: any, b: any) => b.totalReturn - a.totalReturn).map((match: any) => (
                                            <tr key={match.symbol} className="hover:bg-white/[0.03] transition-all group">
                                                <td className="px-6 md:px-8 py-4">
                                                    <span className="font-black text-white text-xs tracking-tight">{match.symbol}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-xs font-mono text-slate-400">₹{match.entryPrice?.toFixed(1)}</td>
                                                <td className="px-6 md:px-8 py-4 text-right text-xs font-mono text-slate-200">₹{match.exitPrice?.toFixed(1)}</td>
                                                <td className="px-6 md:px-8 py-4 text-right">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-tighter border",
                                                        match.totalReturn >= 0 ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-rose-400 bg-rose-400/10 border-rose-400/20"
                                                    )}>
                                                        {match.totalReturn >= 0 ? '+' : ''}{match.totalReturn.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
