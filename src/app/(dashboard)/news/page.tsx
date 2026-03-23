"use client";
import React, { useState, useEffect } from "react";
import { 
    TrendingUp, 
    TrendingDown, 
    Globe, 
    Search, 
    Filter, 
    Clock, 
    ExternalLink, 
    Activity,
    ShieldCheck,
    AlertCircle,
    Zap,
    Share2,
    Bookmark,
    ArrowUpRight,
    BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function NewsIntelligencePage() {
    const [news, setNews] = useState<any[]>([]);
    const [aggregate, setAggregate] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH'>('ALL');
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await fetch("/api/news");
                const data = await res.json();
                setNews(data.news || []);
                setAggregate(data.aggregate || null);
            } catch (err) {
                console.error("Failed to fetch news intelligence", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNews();
    }, []);

    const filteredNews = news.filter((item) => {
        const matchesFilter = filter === 'ALL' || item.sentiment.label === filter;
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             item.summary.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
                <div className="relative">
                    <div className="w-20 h-20 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <BarChart3 className="text-indigo-400 animate-pulse" size={24} />
                    </div>
                </div>
                <div className="space-y-2 text-center">
                    <span className="text-xs font-bold text-slate-500 tracking-[0.4em] uppercase">Market Intelligence Scan</span>
                    <p className="text-slate-400 text-sm animate-pulse italic">Connecting to global data streams...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-[1400px] mx-auto px-4 sm:px-6 py-6 pb-24">
            
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shadow-glow"></span>
                            Live Intelligence
                        </div>
                        <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={12} /> Last Sync: Just Now
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tighter font-outfit uppercase">News Intelligence</h1>
                    <p className="text-slate-500 text-sm font-medium max-w-xl leading-relaxed">
                        Global market pulse tracked by AI sentiment analysis. Filter through the noise to find high-impact growth signals.
                    </p>
                </div>

                {/* Sentiment Meter Widget */}
                {aggregate && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/5 border border-white/10 rounded-[32px] p-6 flex items-center gap-6 min-w-[320px]"
                    >
                        <div className="relative w-20 h-20">
                            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                                <circle className="text-white/5 stroke-current" strokeWidth="8" fill="transparent" r="42" cx="50" cy="50" />
                                <circle 
                                    className={cn(
                                        "stroke-current transition-all duration-1000 ease-out",
                                        aggregate.label === 'BULLISH' ? "text-emerald-500" : aggregate.label === 'BEARISH' ? "text-rose-500" : "text-amber-500"
                                    )} 
                                    strokeWidth="8" 
                                    strokeDasharray={264}
                                    strokeDashoffset={264 - (264 * Math.min(Math.abs(aggregate.score) * 1.5 + 0.3, 1))}
                                    strokeLinecap="round" 
                                    fill="transparent" 
                                    r="42" 
                                    cx="50" 
                                    cy="50" 
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={cn(
                                    "text-lg font-black leading-none",
                                    aggregate.label === 'BULLISH' ? "text-emerald-400" : aggregate.label === 'BEARISH' ? "text-rose-400" : "text-amber-400"
                                )}>
                                    {aggregate.score > 0 ? '+' : ''}{Math.round(aggregate.score * 100)}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Market Mood</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                                    aggregate.label === 'BULLISH' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : 
                                    aggregate.label === 'BEARISH' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : 
                                    "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                )}>
                                    {aggregate.label}
                                </span>
                            </div>
                            <div className="text-xl font-bold text-white tracking-tight">AI Consensus</div>
                            <div className="text-[10px] text-slate-500 font-medium">Confidence: {aggregate.confidence.toFixed(1)}%</div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
                    {(['ALL', 'BULLISH', 'BEARISH'] as const).map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setFilter(opt)}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                                filter === opt ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-500 hover:text-white"
                            )}
                        >
                            {opt}
                        </button>
                    ))}
                </div>

                <div className="relative group min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                    <input 
                        type="text" 
                        placeholder="Scan focus keywords..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all w-full"
                    />
                </div>
            </div>

            {/* News List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredNews.map((item, i) => (
                        <NewsCard key={i} item={item} index={i} />
                    ))}
                </AnimatePresence>
            </div>

            {filteredNews.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <AlertCircle className="text-slate-700 mb-4" size={48} />
                    <h3 className="text-xl font-bold text-white mb-2">No Reports Found</h3>
                    <p className="text-slate-500 text-sm max-w-sm">No intelligence reports match your current filter criteria or search query.</p>
                </div>
            )}
        </div>
    );
}

function NewsCard({ item, index }: { item: any; index: number }) {
    const isBullish = item.sentiment.label === 'BULLISH';
    const isBearish = item.sentiment.label === 'BEARISH';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
            className="group relative"
        >
            <div className={cn(
                "absolute -inset-px rounded-[32px] blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                isBullish ? "bg-emerald-500/20" : isBearish ? "bg-rose-500/20" : "bg-indigo-500/20"
            )} />
            
            <div className="relative glass-morphic-card rounded-[32px] p-6 sm:p-8 border-white/5 group-hover:border-white/20 transition-all duration-500 h-full flex flex-col gap-6">
                {/* Sentiment Badge */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-2xl border flex items-center justify-center shadow-lg",
                            isBullish ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                            isBearish ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                            "bg-white/5 border-white/10 text-slate-500"
                        )}>
                            {isBullish ? <TrendingUp size={18} /> : isBearish ? <TrendingDown size={18} /> : <Activity size={18} />}
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.source}</div>
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-400/80 tracking-normal">
                                <Clock size={10} /> {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(item.time).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                         <span className={cn(
                            "px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border",
                            isBullish ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                            isBearish ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                            "bg-white/5 border-white/10 text-slate-500"
                        )}>
                            {item.sentiment.label}
                        </span>
                    </div>
                </div>

                <div className="space-y-4 flex-1">
                    <h3 className="text-xl font-bold text-white tracking-tight leading-tight group-hover:text-indigo-400 transition-colors line-clamp-2 uppercase font-outfit">
                        {item.title}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 font-medium">
                        {item.summary}
                    </p>
                </div>

                <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                        {item.relatedSymbols?.slice(0, 3).map((sym: string) => (
                            <span key={sym} className="text-[9px] font-mono font-bold bg-white/5 text-slate-400 px-2 py-1 rounded-md border border-white/5">
                                ${sym.replace(/\.(NS|BO)$/, '')}
                            </span>
                        ))}
                    </div>

                    <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors group/link"
                    >
                        Read Report <ArrowUpRight size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                    </a>
                </div>
            </div>
        </motion.div>
    );
}
