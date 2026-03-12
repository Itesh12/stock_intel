"use client";
import React, { useState, useEffect } from "react";
import { Newspaper, TrendingUp, TrendingDown, Minus, Info, Loader2, ExternalLink, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function StockNewsSentiment({ symbol }: { symbol: string }) {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/stock/news?symbol=${symbol}`);
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error("News fetch failed", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchNews();
    }, [symbol]);

    if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-blue-500/20" size={32} /></div>;
    if (!data || !data.news || data.news.length === 0) return (
        <div className="py-10 text-center opacity-30 border border-white/5 rounded-3xl bg-white/5">
            <Newspaper size={32} className="mx-auto mb-4 text-slate-600" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">No recent intelligence found for {symbol}</span>
        </div>
    );

    const { aggregate } = data;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4 max-h-[400px] md:max-h-[500px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                    {data.news.map((item: any, idx: number) => (
                        <motion.a
                            key={item.uuid || idx}
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white/[0.03] border border-white/5 p-4 sm:p-5 rounded-2xl block hover:bg-white/[0.07] transition-all group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[8px] font-black tracking-widest uppercase border",
                                    item.sentiment.label === 'BULLISH' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                    item.sentiment.label === 'BEARISH' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                                    "bg-slate-500/10 border-slate-500/20 text-slate-400"
                                )}>
                                    {item.sentiment.label}
                                </span>
                                <ExternalLink size={12} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                            </div>
                            <h3 className="text-sm font-bold text-white mb-2 leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">{item.title}</h3>
                            <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 leading-relaxed font-medium">{item.summary}</p>
                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                                <span>{item.publisher}</span>
                                <span>{new Date(item.providerPublishTime * 1000).toLocaleDateString()}</span>
                            </div>
                        </motion.a>
                    ))}
                </div>

                <div className="space-y-6">
                    <div className="glass-morphic-card rounded-3xl p-5 md:p-6 border-blue-500/10">
                        <div className="flex items-center gap-2 mb-6">
                            <TrendingUp size={16} className="text-blue-400" />
                            <h2 className="text-[11px] font-black text-white uppercase tracking-widest">Alpha Sentiment</h2>
                        </div>
                        
                        <div className="flex flex-col items-center text-center py-4">
                            <div className={cn(
                                "w-20 h-20 rounded-full flex items-center justify-center mb-4 border-2 shadow-2xl transition-all duration-500",
                                aggregate.label === 'BULLISH' ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/20" :
                                aggregate.label === 'BEARISH' ? "border-rose-500/50 bg-rose-500/10 text-rose-400 shadow-rose-500/20" :
                                "border-slate-500/50 bg-slate-500/10 text-slate-400 shadow-slate-500/20"
                            )}>
                                {aggregate.label === 'BULLISH' ? <TrendingUp size={32} /> : 
                                 aggregate.label === 'BEARISH' ? <TrendingDown size={32} /> : 
                                 <Minus size={32} />}
                            </div>
                            <div className="text-2xl font-black text-white mb-1 tracking-tighter">{aggregate.label}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aggregate Rating</div>
                        </div>

                        <div className="mt-8 space-y-4">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase">AI Confidence</span>
                                <span className="text-xs font-black text-white">{aggregate.confidence.toFixed(0)}%</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${aggregate.confidence}%` }}
                                    className={cn(
                                        "h-full transition-all duration-1000",
                                        aggregate.label === 'BULLISH' ? "bg-emerald-500" :
                                        aggregate.label === 'BEARISH' ? "bg-rose-500" : "bg-slate-500"
                                    )} 
                                />
                            </div>
                        </div>

                        <div className="mt-8 p-4 bg-white/5 border border-white/5 rounded-2xl flex gap-3">
                            <div className="shrink-0 text-blue-400"><Info size={14} /></div>
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                                "Our heuristic analysis detected significant structural drivers. Probability of trend continuation is currently high."
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
