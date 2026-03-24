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
import { GlobalLoader } from "@/components/ui/global-loader";

export default function NewsIntelligencePage() {
    const [newsState, setNewsState] = useState<Record<string, { items: any[], offset: number, hasMore: boolean }>>({
        ALL: { items: [], offset: 0, hasMore: true },
        BULLISH: { items: [], offset: 0, hasMore: true },
        BEARISH: { items: [], offset: 0, hasMore: true }
    });
    
    const [aggregate, setAggregate] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH'>('ALL');
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDate, setSelectedDate] = useState<string>("");
    
    const COUNT = 10;

    const fetchNewsForTab = async (filter: string, isInitial = false, isReset = false) => {
        if (isInitial) setIsLoading(true);
        else setIsFetchingMore(true);

        try {
            const currentTabState = newsState[filter];
            const currentOffset = (isInitial || isReset) ? 0 : currentTabState.offset + COUNT;
            
            const url = `/api/news?count=${COUNT}&offset=${currentOffset}${selectedDate ? `&date=${selectedDate}` : ""}${filter !== 'ALL' ? `&sentiment=${filter}` : ""}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            setNewsState(prev => ({
                ...prev,
                [filter]: {
                    items: (isInitial || isReset) ? (data.news || []) : [...prev[filter].items, ...(data.news || [])],
                    offset: currentOffset,
                    hasMore: data.hasMore ?? false
                }
            }));

            // Only update aggregate if it's the first load or we have no aggregate
            if (isInitial || !aggregate) {
                setAggregate(data.aggregate || null);
            }
        } catch (err) {
            console.error(`Failed to fetch news for ${filter}`, err);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    };

    // Initial load for all tabs or when date changes
    useEffect(() => {
        const loadAll = async () => {
            setIsLoading(true);
            // Reset all states when date changes
            setNewsState({
                ALL: { items: [], offset: 0, hasMore: true },
                BULLISH: { items: [], offset: 0, hasMore: true },
                BEARISH: { items: [], offset: 0, hasMore: true }
            });
            await fetchNewsForTab(activeFilter, true, true);
        };
        loadAll();
    }, [selectedDate]);

    // If switching to a tab that hasn't been loaded yet
    useEffect(() => {
        if (newsState[activeFilter].items.length === 0 && newsState[activeFilter].hasMore && !isLoading) {
            fetchNewsForTab(activeFilter, true);
        }
    }, [activeFilter]);

    const currentTab = newsState[activeFilter];
    const filteredNews = currentTab.items.filter((item) => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             item.summary.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    if (isLoading && newsState[activeFilter].items.length === 0) {
        return <GlobalLoader title="Scanning Market News" />;
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-[1400px] mx-auto px-4 sm:px-6 py-6 pb-24">
            
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shadow-glow"></span>
                            Live Updates
                        </div>
                        <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={12} /> Real-time Feed
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tighter font-outfit uppercase">Market News</h1>
                    <p className="text-slate-500 text-sm font-medium max-w-xl leading-relaxed">
                        Check what's happening in the market right now. See if the news is good (Bullish) or bad (Bearish) for stocks.
                    </p>
                </div>

                {/* Date Picker & Sentiment Meter */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Premium Date Picker */}
                    <div className="group bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center gap-2 h-[60px] hover:border-indigo-500/30 transition-all">
                        <div className="pl-3 py-1.5 text-slate-500 group-hover:text-indigo-400 transition-colors">
                            <Clock size={16} />
                        </div>
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="bg-transparent border-none text-xs font-bold text-white focus:ring-0 uppercase tracking-widest outline-none pr-2 [color-scheme:dark]"
                        />
                        {selectedDate && (
                            <button 
                                onClick={() => setSelectedDate("")}
                                className="pr-3 text-[10px] font-bold text-indigo-400 hover:text-white transition-colors"
                            >
                                CLEAR
                            </button>
                        )}
                    </div>

                    {aggregate && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white/5 border border-white/10 rounded-[32px] p-4 flex items-center gap-4 min-w-[280px] h-[72px]"
                        >
                            <div className="relative w-12 h-12">
                                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                                    <circle className="text-white/5 stroke-current" strokeWidth="10" fill="transparent" r="40" cx="50" cy="50" />
                                    <circle 
                                        className={cn(
                                            "stroke-current transition-all duration-1000 ease-out",
                                            aggregate.label === 'BULLISH' ? "text-emerald-500" : aggregate.label === 'BEARISH' ? "text-rose-500" : "text-amber-500"
                                        )} 
                                        strokeWidth="10" 
                                        strokeDasharray={251}
                                        strokeDashoffset={251 - (251 * Math.min(Math.abs(aggregate.score) * 1.5 + 0.3, 1))}
                                        strokeLinecap="round" 
                                        fill="transparent" 
                                        r="40" 
                                        cx="50" 
                                        cy="50" 
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className={cn(
                                        "text-[10px] font-black leading-none",
                                        aggregate.label === 'BULLISH' ? "text-emerald-400" : aggregate.label === 'BEARISH' ? "text-rose-400" : "text-amber-400"
                                    )}>
                                        {Math.round(aggregate.confidence)}%
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border",
                                        aggregate.label === 'BULLISH' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : 
                                        aggregate.label === 'BEARISH' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : 
                                        "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                    )}>
                                        {aggregate.label}
                                    </span>
                                </div>
                                <div className="text-sm font-bold text-white tracking-tight">AI Summary</div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
                    {(['ALL', 'BULLISH', 'BEARISH'] as const).map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setActiveFilter(opt)}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                                activeFilter === opt ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-500 hover:text-white"
                            )}
                        >
                            {opt === 'ALL' ? 'Everything' : opt}
                        </button>
                    ))}
                </div>

                <div className="relative group min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search news..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all w-full"
                    />
                </div>
            </div>

            {/* News List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
                {isLoading && isFetchingMore && currentTab.items.length === 0 ? (
                    <div className="col-span-full flex items-center justify-center py-20">
                        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredNews.map((item, i) => (
                            <NewsCard key={`${activeFilter}-${i}`} item={item} index={i} />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {currentTab.items.length > 0 && (
                <div className="flex flex-col items-center gap-4 pt-10">
                    <button
                        onClick={() => fetchNewsForTab(activeFilter)}
                        disabled={isFetchingMore || !currentTab.hasMore}
                        className={cn(
                            "px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed",
                            isFetchingMore && "animate-pulse"
                        )}
                    >
                        {isFetchingMore ? (
                            <>
                                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
                                Loading {activeFilter.toLowerCase()} news...
                            </>
                        ) : !currentTab.hasMore ? (
                            <>
                                End of {activeFilter.toLowerCase()} feed
                                <ShieldCheck size={14} className="text-emerald-400" />
                            </>
                        ) : (
                            <>
                                Load More {activeFilter === 'ALL' ? '' : activeFilter} News
                                <Filter size={14} className="text-indigo-400" />
                            </>
                        )}
                    </button>
                    {!currentTab.hasMore && (
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest animate-pulse">
                            No more reports available for this scan
                        </p>
                    )}
                </div>
            )}

            {filteredNews.length === 0 && !isLoading && (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <AlertCircle className="text-slate-700 mb-4" size={48} />
                    <h3 className="text-xl font-bold text-white mb-2">No news found</h3>
                    <p className="text-slate-500 text-sm max-w-sm">
                        {selectedDate 
                            ? `We couldn't find any news reports for ${new Date(selectedDate).toLocaleDateString()}.`
                            : `We couldn't find any ${activeFilter !== 'ALL' ? activeFilter.toLowerCase() : ''} news matching your search.`
                        }
                    </p>
                    {selectedDate && (
                        <button 
                            onClick={() => setSelectedDate("")}
                            className="mt-6 px-6 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest hover:bg-indigo-500/20 transition-all"
                        >
                            Reset Date Filter
                        </button>
                    )}
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
            <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block h-full cursor-pointer"
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
                        <p className="text-slate-400 text-sm leading-relaxed line-clamp-4 font-medium italic border-l-2 border-indigo-500/20 pl-4">
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

                        <div 
                            className="flex items-center gap-2 text-[10px] font-bold text-slate-500 group-hover:text-white uppercase tracking-widest transition-colors group/link"
                        >
                            View Story <ArrowUpRight size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                        </div>
                    </div>
                </div>
            </a>
        </motion.div>
    );
}
