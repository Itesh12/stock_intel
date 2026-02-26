"use client";
import React, { useState, useEffect } from "react";
import { Trophy, Crown, Medal, TrendingUp, TrendingDown, Users, Search, Filter, Loader2, ArrowRight, User as UserIcon } from "lucide-react";
import { formatCurrency, formatIndianNumber, cn } from "@/lib/utils";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch('/api/leaderboard');
                const data = await res.json();
                setLeaderboard(data);
            } catch (err) {
                console.error("Failed to fetch leaderboard", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    const filteredLeaderboard = leaderboard.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin"></div>
                    <Trophy className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500" size={24} />
                </div>
                <span className="text-xs font-bold text-slate-500 tracking-[0.4em] uppercase">Aggregating Alpha Data</span>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-[1400px] mx-auto px-6 py-6 pb-20">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                        <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Global Arena</div>
                        <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Users size={12} /> {leaderboard.length} Active Traders
                        </span>
                    </div>
                    <h1 className="text-5xl font-bold text-white tracking-tighter font-outfit">Apex Rankings</h1>
                    <p className="text-slate-500 text-sm font-medium max-w-xl">
                        The definitive arena for virtual alpha. Ranks are determined by historical portfolio ROI from the initial 10L capital injection.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Search Elite Traders..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all w-full md:w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Top 3 Podium Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredLeaderboard.slice(0, 3).map((trader, i) => (
                    <PodiumCard key={trader.userId} trader={trader} position={i + 1} />
                ))}
            </div>

            {/* Leaderboard Table */}
            <div className="glass-morphic-card rounded-[32px] overflow-hidden border-white/5 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                                <th className="px-10 py-6 font-bold text-center w-20">Rank</th>
                                <th className="px-10 py-6 font-bold">Trader Hierarchy</th>
                                <th className="px-10 py-6 font-bold">Structural NAV</th>
                                <th className="px-10 py-6 font-bold text-right">Growth Index</th>
                                <th className="px-10 py-6 font-bold text-right w-32">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredLeaderboard.slice(3).map((trader) => (
                                <LeaderboardRow key={trader.userId} trader={trader} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function PodiumCard({ trader, position }: { trader: any, position: number }) {
    const colors = {
        1: "from-amber-400 to-yellow-600 shadow-yellow-900/20 shadow-2xl border-yellow-500/20",
        2: "from-slate-300 to-slate-500 shadow-slate-900/20 shadow-xl border-slate-500/20",
        3: "from-amber-600 to-rose-700 shadow-rose-900/20 shadow-xl border-rose-500/20"
    };

    const icons = {
        1: <Crown className="text-yellow-400" size={24} />,
        2: <Medal className="text-slate-400" size={24} />,
        3: <Medal className="text-amber-600" size={24} />
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: position * 0.1 }}
            className={cn(
                "relative bg-gradient-to-br p-px rounded-[32px] overflow-hidden group",
                colors[position as keyof typeof colors]
            )}
        >
            <div className="bg-[#0A0A0B] rounded-[31px] p-8 h-full flex flex-col gap-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className={cn(
                    "absolute -right-10 -top-10 w-40 h-40 rounded-full blur-[80px] opacity-20",
                    position === 1 ? "bg-yellow-500" : position === 2 ? "bg-slate-400" : "bg-rose-500"
                )}></div>

                <div className="flex justify-between items-start relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform duration-500">
                        {icons[position as keyof typeof icons]}
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rank</span>
                        <span className="text-4xl font-black text-white font-outfit leading-none mt-1">#{position}</span>
                    </div>
                </div>

                <Link href={`/profile/${trader.userId}`} className="space-y-1 relative z-10 block group/link">
                    <h3 className="text-xl font-bold text-white font-outfit tracking-tight group-hover/link:text-blue-400 transition-colors uppercase">{trader.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <UserIcon size={12} className="text-blue-500" /> Professional Node
                    </div>
                </Link>

                <div className="pt-6 border-t border-white/5 mt-auto relative z-10">
                    <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Net Value</span>
                            <span className="text-lg font-bold text-white font-mono">₹{formatIndianNumber(trader.totalValue)}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Performance</span>
                            <span className={cn(
                                "text-lg font-black font-outfit",
                                trader.growthPercent >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}>
                                {trader.growthPercent >= 0 ? '+' : ''}{trader.growthPercent.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function LeaderboardRow({ trader }: { trader: any }) {
    const isPositive = trader.growthPercent >= 0;

    return (
        <tr className="hover:bg-white/[0.03] transition-all group border-b border-white/[0.02] last:border-0">
            <td className="px-10 py-6 text-center">
                <span className="text-lg font-black text-slate-600 group-hover:text-white transition-colors font-mono">
                    {trader.rank}
                </span>
            </td>
            <td className="px-10 py-6">
                <Link href={`/profile/${trader.userId}`} className="flex items-center gap-4 group/rowlink">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-slate-300 group-hover/rowlink:bg-blue-600 group-hover/rowlink:text-white transition-all duration-300 shadow-sm border border-white/5">{trader.name[0]}</div>
                    <div>
                        <div className="font-bold text-white text-base tracking-tight leading-none mb-1 group-hover/rowlink:text-blue-400 transition-colors uppercase">{trader.name}</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-slate-700"></div> TRADER_NODE_{trader.userId.slice(0, 4)}
                        </div>
                    </div>
                </Link>
            </td>
            <td className="px-10 py-6 text-sm font-bold text-white font-mono tracking-tighter">
                ₹{formatIndianNumber(trader.totalValue)}
            </td>
            <td className="px-10 py-6 text-right">
                <div className={cn(
                    "text-base font-black font-outfit tracking-tight flex items-center justify-end gap-1.5",
                    isPositive ? "text-emerald-400" : "text-rose-400"
                )}>
                    {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {isPositive ? '+' : ''}{trader.growthPercent.toFixed(2)}%
                </div>
            </td>
            <td className="px-10 py-6 text-right">
                <span className={cn(
                    "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                    trader.rank <= 10
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        : "bg-white/5 border-white/10 text-slate-500"
                )}>
                    {trader.rank <= 10 ? 'Elite' : 'Active'}
                </span>
            </td>
        </tr>
    );
}
