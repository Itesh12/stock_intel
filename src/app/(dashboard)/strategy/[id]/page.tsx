"use client";

import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Target, ShieldCheck, TrendingUp, Zap,
    BarChart3, Activity, Info, ChevronRight, Crown,
    AlertCircle, Landmark, ShoppingCart, Loader2, History
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import StrategyBacktestPanel from '@/components/strategy/StrategyBacktestPanel';

export default function StrategyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const strategySlug = params.id as string;
    const [strategy, setStrategy] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);

    const fetchStrategy = async () => {
        try {
            const res = await fetch(`/api/strategy/${strategySlug}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setStrategy(data);
        } catch (err) {
            console.error("Failed to fetch strategy", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStrategy();
    }, [strategySlug]);

    const handleScan = async () => {
        setIsScanning(true);
        try {
            await fetch(`/api/strategy/${strategySlug}/scan`, { method: 'POST' });
            await fetchStrategy();
        } catch (err) {
            console.error("Manual scan failed", err);
        } finally {
            setIsScanning(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 size={48} className="text-blue-500 animate-spin opacity-20" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">Loading Strategy</span>
            </div>
        );
    }

    if (!strategy) return null;

    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-[1200px] mx-auto px-4 sm:px-6 py-4 md:py-6 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-6">
                <Link href="/search" className="group flex items-center gap-2 text-slate-400 hover:text-white transition-all text-xs font-semibold uppercase tracking-wider">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Strategy Finder
                </Link>

                <div className="flex flex-col lg:flex-row justify-between gap-8 py-4">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                Trading Model v1.0
                            </span>
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Crown size={12} className="text-yellow-500" />
                                {strategy.trader}
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tighter font-outfit uppercase">
                            {strategy.name}
                        </h1>
                        <p className="text-slate-400 max-w-2xl text-xs leading-relaxed font-medium capitalize">
                            {strategy.longDescription}
                        </p>
                    </div>
                </div>
            </div>

            {/* Core Objective Card */}
            <div className="glass-morphic-card rounded-[32px] p-6 sm:p-8 lg:p-10 border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <Target size={150} />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                        <Activity size={16} />
                        What this strategy does
                    </h3>
                    <p className="text-lg lg:text-xl font-bold text-white font-outfit leading-relaxed">
                        {strategy.objective}
                    </p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Workflow Column */}
                <div className="lg:col-span-8 space-y-6">
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em] mb-4">How it Works</h3>
                    <div className="space-y-4">
                        {strategy.steps.map((step: any, idx: number) => (
                            <div key={step.id} className="glass-morphic-card rounded-3xl p-6 border-white/5 hover:border-white/10 transition-all group">
                                <div className="flex items-start gap-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl font-black text-blue-500 font-mono group-hover:scale-110 transition-transform cursor-default">
                                        {step.id}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-lg font-bold text-white font-outfit uppercase tracking-tight">{step.title}</h4>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{step.description}</span>
                                        </div>
                                        {step.formula && (
                                            <div className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] text-blue-400">
                                                {step.formula}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {step.requirements.map((req: string, i: number) => (
                                                <span key={i} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
                                                    <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                                                    {req}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Alpha & Risk Column */}
                <div className="lg:col-span-4 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-morphic-card p-6 rounded-[24px] border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Risk Rating</span>
                            <span className={cn(
                                "text-sm font-black uppercase font-outfit",
                                strategy.riskLevel === 'HIGH' ? "text-rose-400" : "text-emerald-400"
                            )}>
                                {strategy.riskLevel}
                            </span>
                        </div>
                        <div className="glass-morphic-card p-6 rounded-[24px] border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Win Probability</span>
                            <span className="text-sm font-black text-white font-mono">{strategy.winRate}</span>
                        </div>
                    </div>

                    {/* Alpha Matches List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-3">
                                <Zap size={18} />
                                Top Stock Matches
                            </h3>
                            <button
                                onClick={handleScan}
                                disabled={isScanning}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                            >
                                {isScanning ? <Loader2 size={10} className="animate-spin" /> : <Activity size={10} />}
                                {isScanning ? "Scanning..." : "Find Stocks"}
                            </button>
                        </div>
                        <div className="glass-morphic-card rounded-[32px] overflow-hidden border-emerald-500/10 min-h-[200px] flex flex-col">
                            <div className="p-6 bg-emerald-500/5 border-b border-white/5">
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Recommended Stocks (Top 20)</span>
                            </div>
                            <div className="p-4 sm:p-6 flex-1">
                                {strategy.recommendations && strategy.recommendations.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {strategy.recommendations.slice(0, 20).map((symbol: string) => (
                                            <Link key={symbol} href={`/stock/${symbol}`} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/20 transition-all group shadow-sm">
                                                <div className="w-12 h-12 rounded-[10px] bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-sm font-black group-hover:bg-emerald-500 group-hover:text-black transition-all shrink-0">
                                                    {symbol.split('.')[0][0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-base font-black text-white uppercase tracking-tight truncate group-hover:text-emerald-300 transition-colors">
                                                        {symbol.replace('.NS', '')}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">NSE India Equity</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest hidden sm:block">View Data</span>
                                                    <ChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0" />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-10 text-center flex flex-col items-center justify-center h-full gap-4 opacity-50">
                                        <div className="w-12 h-12 rounded-full border border-dashed border-emerald-500/30 flex items-center justify-center">
                                            <Target size={20} className="text-emerald-500/50" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-white uppercase tracking-widest">No Stocks Found</div>
                                            <p className="text-[9px] font-medium text-slate-500 mt-1 uppercase tracking-wider">No stocks currently meet this strategy's rules.</p>
                                        </div>
                                        <button
                                            onClick={handleScan}
                                            className="text-[9px] font-black text-emerald-500 uppercase tracking-widest hover:underline"
                                        >
                                            Force Refresh
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Risk Management */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-rose-500 uppercase tracking-[0.3em] flex items-center gap-3">
                            <ShieldCheck size={18} />
                            Safety Rules
                        </h3>
                        <div className="glass-morphic-card rounded-[32px] p-6 border-rose-500/10 space-y-4 bg-rose-500/5">
                            {strategy.riskManagement.map((rule: string, idx: number) => (
                                <div key={idx} className="flex gap-3">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"></div>
                                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-wide">
                                        {rule}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="glass-morphic-card rounded-[24px] p-8 border-blue-500/10 bg-blue-600/10 flex flex-col items-center justify-center text-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <ShoppingCart size={24} />
                        </div>
                        <h4 className="text-lg font-bold text-white font-outfit uppercase">Start Investing</h4>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Invest money in these recommended stocks.</p>
                        <Link href="/market" className="w-full mt-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                            Go to Market
                        </Link>
                    </div>
                </div>
            </div>

            {/* Backtesting Engine Section */}
            <div className="mt-8 md:mt-16 space-y-8">
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-bold text-white tracking-tighter font-outfit uppercase flex items-center gap-4">
                        <History size={28} className="text-blue-500" />
                        Time Machine
                    </h2>
                    <p className="text-slate-400 max-w-2xl text-xs font-bold uppercase tracking-widest">
                        Run a real-data historical simulation to verify this strategy's predictive edge over the Nifty 50.
                    </p>
                </div>
                <StrategyBacktestPanel strategyId={strategySlug} />
            </div>
        </div>
    );
}
