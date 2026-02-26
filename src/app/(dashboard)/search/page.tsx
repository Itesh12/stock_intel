"use client";

import React, { useState, useEffect } from 'react';
import { ArrowRight, Target, Zap, ShieldCheck, Trophy, Crown, Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function StrategyFinderPage() {
    const [strategies, setStrategies] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStrategies = async () => {
            try {
                const res = await fetch('/api/strategy');
                const data = await res.json();
                setStrategies(data);
            } catch (err) {
                console.error("Failed to fetch strategies", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStrategies();
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 size={48} className="text-blue-500 animate-spin opacity-20" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">Propagating Model Matrix</span>
            </div>
        );
    }
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex items-end justify-between border-b border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-glow"></span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em]">Strategy Discovery Engine</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight font-outfit uppercase">Strategy Finder</h1>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Quantitative models from legendary traders, adapted for high-alpha discovery.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {strategies.map((strategy) => (
                    <Link key={strategy.id} href={`/strategy/${strategy.id}`} className="group relative">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[32px] blur opacity-0 group-hover:opacity-20 transition duration-500"></div>
                        <div className="relative glass-morphic-card rounded-[32px] p-8 border-white/5 hover:border-white/10 transition-all flex flex-col h-full h-[400px]">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                                    <Target size={24} />
                                </div>
                                <div className={cn(
                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                    strategy.riskLevel === 'HIGH' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                )}>
                                    {strategy.riskLevel} RISK
                                </div>
                            </div>

                            <div className="space-y-2 flex-1">
                                <h3 className="text-xl font-bold text-white font-outfit tracking-tight group-hover:text-blue-400 transition-colors uppercase leading-tight">
                                    {strategy.name}
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <Crown size={12} className="text-yellow-500" />
                                    {strategy.trader}
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed mt-4 line-clamp-3">
                                    {strategy.description}
                                </p>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Target Accuracy</span>
                                    <span className="text-lg font-black text-white font-mono">{strategy.winRate}</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <ArrowRight size={20} />
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}

                {/* Placeholder for future admin-added strategies */}
                <div className="glass-morphic-card rounded-[32px] p-8 border-dashed border-white/10 flex flex-col items-center justify-center text-center group h-[400px]">
                    <div className="w-16 h-16 rounded-full border border-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform bg-white/[0.02]">
                        <Zap size={24} className="text-slate-700" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">More Models Incoming</h3>
                    <p className="text-[10px] text-slate-700 mt-2 max-w-[200px]">Administrators are currently calibrating new high-frequency algorithms.</p>
                </div>
            </div>
        </div>
    );
}
