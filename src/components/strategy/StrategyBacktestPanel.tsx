"use client";
import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Play, TrendingUp, History, Target, Loader2, GaugeCircle, BarChart, ChevronDown, Rocket } from "lucide-react";
import { formatIndianNumber, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function StrategyBacktestPanel({ strategyId }: { strategyId: string }) {
    const [days, setDays] = useState(365);
    const [isSimulating, setIsSimulating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("Awaiting execution trigger...");
    const [result, setResult] = useState<any>(null);

    const runSim = async () => {
        setIsSimulating(true);
        setStatusMessage("Initializing Discovery Pool...");
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
                setStatusMessage(`Time-Traveling & Screening ${i * chunkSize} to ${Math.min((i + 1) * chunkSize, symbols.length)} of ${symbols.length} stocks...`);
                
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

                // Hard Sleep to stop Yahoo Finance API from rejecting 300+ incoming rapid-fire chunks 
                // and returning empty data brackets.
                if (i < totalChunks - 1) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }

            setStatusMessage("Compiling Historical Trajectories...");

            if (allMatches.length === 0) {
                setStatusMessage("Simulation Complete: No valid algorithmic setups formed inside the specified lookback horizon.");
                setResult({ empty: true });
                setIsSimulating(false);
                return;
            }

            // Step 3: Sort by pre-calculated matching score (how strictly it met the algorithmic definition on the entry day)
            // Then take ONLY the Top 20 best to prevent massive UI rendering arrays and lookahead biases.
            const top20Matches = allMatches
                .sort((a, b) => b.score - a.score)
                .slice(0, 20);

            // Step 4: Aggregate Results
            const winners = top20Matches.filter(m => m.totalReturn >= 0);
            const losers = top20Matches.filter(m => m.totalReturn < 0);

            const winRate = (winners.length / top20Matches.length) * 100;
            const avgReturn = top20Matches.reduce((a, b) => a + b.totalReturn, 0) / top20Matches.length;
            
            const sumWin = winners.reduce((a, b) => a + b.totalReturn, 0);
            const sumLoss = Math.abs(losers.reduce((a, b) => a + b.totalReturn, 0));
            const profitFactor = sumLoss === 0 ? 99.99 : sumWin / sumLoss;

            // Build an aggregate equity curve (equally weighted average of all top 20 matches per day)
            const dateMap = new Map<string, { sum: number, count: number }>();
            
            top20Matches.forEach(match => {
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
                matches: top20Matches,
                equityCurve
            });
            setStatusMessage("Completed.");

        } catch (err) {
            console.error("Backtest Orchestrator Failed", err);
            setStatusMessage("Simulation Fault: Could not fetch comprehensive data sets.");
            setResult({ empty: true });
        } finally {
            setIsSimulating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Horizontal Control Engine */}
            <div className="glass-morphic-card rounded-3xl p-4 md:p-6 border-blue-500/10 bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 lg:gap-8">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                            <Rocket size={20} className={isSimulating ? "animate-bounce" : ""} />
                        </div>
                        <div>
                            <h3 className="text-white text-sm font-bold font-outfit uppercase tracking-wider">Engine Core Configuration</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Time-Horizon Entry Point</p>
                        </div>
                    </div>

                    <div className="flex-1 w-full md:max-w-xs relative group">
                        <select 
                            value={days}
                            onChange={(e) => setDays(parseInt(e.target.value))}
                            disabled={isSimulating}
                            className="w-full bg-black/40 border border-blue-500/20 hover:border-blue-500/50 rounded-2xl px-5 py-4 text-xs font-black text-white uppercase tracking-widest focus:border-blue-400 focus:outline-none transition-all appearance-none disabled:opacity-50 cursor-pointer shadow-inner"
                        >
                            <option value={30}>30 Days Ago</option>
                            <option value={90}>90 Days Ago</option>
                            <option value={180}>180 Days Ago</option>
                            <option value={365}>365 Days Ago</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500/50 group-hover:text-blue-400 pointer-events-none transition-all" size={16} />
                    </div>

                    <div className="w-full md:w-auto">
                        <button
                            onClick={runSim}
                            disabled={isSimulating}
                            className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(37,99,235,0.2)] hover:shadow-[0_0_40px_rgba(37,99,235,0.4)] relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                            {isSimulating ? "SIMULATING..." : "START BURN"}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {isSimulating && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-6 pt-6 border-t border-blue-500/10 overflow-hidden"
                        >
                            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
                                <span className="animate-pulse">{statusMessage}</span>
                                <span className="text-blue-400 font-mono">{progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-blue-500/20">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.2 }}
                                    className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]" 
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Main Results View */}
            <div className="space-y-6">
                <section className="glass-morphic-card rounded-[32px] p-4 sm:p-6 lg:p-8 border-white/5 min-h-[400px] flex flex-col bg-white/[0.01]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-white/5 pb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                                <BarChart className="text-blue-500" size={24} />
                                Historical Execution Path
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Aggregated Performance of Top 20 algorithmic Matches</p>
                        </div>
                        {result && result.matches && (
                            <div className="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-inner">
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-b border-transparent">
                                    {result.matches.length} Top Qualifiers
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 w-full min-h-[350px] relative">
                        {result?.equityCurve ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={result.equityCurve} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorNavBar" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                    <XAxis 
                                        dataKey="timestamp" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                                        tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short' })}
                                        dy={10}
                                    />
                                    <YAxis 
                                        domain={['auto', 'auto']}
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#475569', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                                        tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                                        orientation="right"
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '20px', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 16px' }}
                                        labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                                        itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'black', fontFamily: 'monospace' }}
                                        labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                        formatter={(val: any) => [`₹${formatIndianNumber(val)}`, 'Simulation NAV']}
                                    />
                                    <Area type="monotone" dataKey="nav" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorNavBar)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : result?.empty ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 gap-4">
                                <div className="w-16 h-16 rounded-full border border-dashed border-slate-700/50 flex items-center justify-center">
                                    <Target size={24} className="opacity-40" />
                                </div>
                                <div className="text-center">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 block mb-1">Zero Valid Matches Formed</span>
                                    <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest max-w-[250px] inline-block leading-relaxed">The algorithm returned no acceptable setups based on mathematical requirements {days} days ago.</span>
                                </div>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 gap-5">
                                <History size={56} className="opacity-10" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 text-blue-500/50">Awaiting Time Machine Ignition</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* KPI Breakdown and Table (Grid split) */}
                {result?.matches && result.matches.length > 0 && (
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                        {/* KPIs */}
                        <div className="xl:col-span-1 grid grid-cols-2 xl:grid-cols-1 gap-4">
                            <div className="glass-morphic-card rounded-[24px] p-5 border-emerald-500/10 bg-emerald-500/5 shadow-inner">
                                <div className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <TrendingUp size={12} /> Mean Return
                                </div>
                                <div className={cn("text-2xl font-black font-mono tracking-tighter", result.totalReturnPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                    {result.totalReturnPercent >= 0 ? '+' : ''}{result.totalReturnPercent.toFixed(2)}%
                                </div>
                            </div>
                            <div className="glass-morphic-card rounded-[24px] p-5 border-white/5 bg-white/[0.01]">
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <Target size={12} /> Win Prob
                                </div>
                                <div className="text-2xl font-black font-mono tracking-tighter text-white">
                                    {result.winRate.toFixed(1)}%
                                </div>
                            </div>
                            <div className="glass-morphic-card rounded-[24px] p-5 border-rose-500/10 bg-rose-500/5 shadow-inner">
                                <div className="text-[9px] font-bold text-rose-500/70 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <GaugeCircle size={12} /> Risk (Drawdown)
                                </div>
                                <div className="text-xl font-black font-mono tracking-tighter text-rose-400/90">
                                    -{result.maxDrawdown.toFixed(2)}%
                                </div>
                            </div>
                            <div className="glass-morphic-card rounded-[24px] p-5 border-blue-500/10 bg-blue-500/5 shadow-inner">
                                <div className="text-[9px] font-bold text-blue-500/70 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <BarChart size={12} /> Profit Factor
                                </div>
                                <div className="text-xl font-black font-mono tracking-tighter text-blue-400">
                                    {result.profitFactor === 99.99 ? "∞" : result.profitFactor.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* Top Matches Extracted Data */}
                        <div className="xl:col-span-3 glass-morphic-card rounded-[32px] overflow-hidden border-white/5 bg-white/[0.01]">
                            <div className="p-6 md:p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.01]">
                                <div className="flex items-center gap-3 text-slate-400">
                                    <History size={18} className="text-blue-500" />
                                    <h2 className="text-lg font-bold text-white tracking-tight">Time-Travel Extractions</h2>
                                </div>
                                <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-xl uppercase tracking-[0.2em]">
                                    Best 20 Qualifiers ({days} Days Ago)
                                </span>
                            </div>
                            <div className="p-4 sm:p-6 sm:pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {result.matches.map((match: any) => (
                                        <div key={match.symbol} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-black group-hover:bg-slate-700 transition-all shrink-0">
                                                    {match.symbol.split('.')[0][0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-white text-xs tracking-tight uppercase truncate max-w-[90px]">{match.symbol.replace('.NS', '')}</span>
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">₹{match.entryPrice?.toFixed(1)} Entry</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={cn(
                                                    "inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-black tracking-tighter font-mono min-w-[50px]",
                                                    match.totalReturn >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                                                )}>
                                                    {match.totalReturn >= 0 ? '+' : ''}{match.totalReturn.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
