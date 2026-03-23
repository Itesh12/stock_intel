"use client";
import React, { useState, useEffect } from "react";
import { Brain, ShieldCheck, Zap, BarChart3, Info, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { IntelligenceMemo } from "@/application/intelligence-service";

export default function StockIntelligenceMemo({ symbol }: { symbol: string }) {
    const [memo, setMemo] = useState<IntelligenceMemo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchMemo = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/stock/intelligence?symbol=${symbol}`);
                const data = await res.json();
                setMemo(data);
            } catch (err) {
                console.error("Failed to fetch intelligence memo", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMemo();
    }, [symbol]);

    if (isLoading) return <div className="h-[400px] flex items-center justify-center border border-white/5 bg-white/5 rounded-3xl animate-pulse"><Brain size={32} className="text-blue-500/20" /></div>;
    if (!memo) return null;

    return (
        <section className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Brain size={18} className="text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xs font-black text-white uppercase tracking-widest leading-none mb-1">Intelligence Memo</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Automated Research Node</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* 1. Recommendation Bento */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        "md:col-span-12 lg:col-span-8 p-6 rounded-3xl border flex flex-col justify-between gap-6",
                        memo.recommendation?.action === "BUY" ? "bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5" :
                        memo.recommendation?.action === "SELL" ? "bg-rose-500/5 border-rose-500/20 shadow-lg shadow-rose-500/5" :
                        "bg-blue-500/5 border-blue-500/20 shadow-lg shadow-blue-500/5"
                    )}
                >
                    <div className="flex justify-between items-start">
                        <div className="space-y-4 max-w-2xl">
                            <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black tracking-[0.2em] uppercase border",
                                memo.recommendation?.action === "BUY" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                memo.recommendation?.action === "SELL" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                                "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            )}>
                                AI ACTION: {memo.recommendation?.action || "HOLD"}
                            </span>
                            <h3 className="text-2xl font-black text-white tracking-tighter leading-tight italic">
                                "{memo.recommendation?.rationale || "Analyzing market data..."}"
                            </h3>
                        </div>
                        <div className="text-right">
                             <div className="text-4xl font-black text-white tracking-tighter mb-1 leading-none">{memo.overallScore}</div>
                             <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alpha Rating</div>
                        </div>
                    </div>
                </motion.div>

                {/* 2. Key Metrics Bento */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="md:col-span-6 lg:col-span-4 p-6 glass-morphic-card rounded-3xl flex flex-col justify-center gap-6"
                >
                    <div className="space-y-4">
                        {[
                            { label: "VALUATION", value: memo.keyMetrics.valuation, icon: BarChart3, color: "text-blue-400" },
                            { label: "MOMENTUM", value: memo.keyMetrics.momentum, icon: Zap, color: "text-amber-400" },
                            { label: "SENTIMENT", value: memo.keyMetrics.sentiment, icon: Brain, color: "text-purple-400" },
                            { label: "RISK PROFILE", value: memo.keyMetrics.riskProfile, icon: ShieldCheck, color: "text-emerald-400" }
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <item.icon size={14} className={cn("opacity-40 group-hover:opacity-100 transition-opacity", item.color)} />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                                </div>
                                <span className="text-[10px] font-black text-white tracking-widest">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* 3. Detailed Scores Bento */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="md:col-span-6 lg:col-span-12 p-6 glass-morphic-card rounded-3xl"
                >
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
                        {[
                            { label: "Fundamental", score: memo.breakdown.fundamental },
                            { label: "Technical", score: memo.breakdown.technical },
                            { label: "Liquidity", score: memo.breakdown.liquidity },
                            { label: "Risk Mitigation", score: memo.breakdown.risk },
                            { label: "Momentum", score: memo.breakdown.momentum }
                        ].map((m, idx) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">{m.label}</span>
                                    <span className="text-xs font-black text-white leading-none tracking-tighter">{m.score}</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${m.score}%` }}
                                        className="h-full bg-blue-500"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
