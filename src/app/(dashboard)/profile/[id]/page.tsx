"use client";
import React, { useState, useEffect } from "react";
import { Trophy, Crown, Medal, TrendingUp, TrendingDown, Users, Briefcase, Globe, ArrowRight, User as UserIcon, ShieldCheck, MapPin, Zap } from "lucide-react";
import { formatCurrency, formatIndianNumber, cn } from "@/lib/utils";
import Link from "next/link";
import { motion } from "framer-motion";

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch(`/api/profile/${id}`);
                const data = await res.json();
                setProfile(data);
            } catch (err) {
                console.error("Failed to fetch profile", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, [id]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin"></div>
                <span className="text-xs font-bold text-slate-500 tracking-[0.4em] uppercase">Retrieving Trader Matrix</span>
            </div>
        );
    }

    if (!profile || profile.error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <ShieldCheck className="text-rose-500 mb-6" size={48} />
                <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter">Access Entity Failed</h1>
                <p className="text-slate-500 max-w-sm">The requested trader node does not exist or has been privatized from the global rankings.</p>
                <Link href="/leaderboard" className="mt-8 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-white hover:bg-white/10 transition-all">
                    Back to Leaderboard
                </Link>
            </div>
        );
    }

    const isPositive = profile.growthPercent >= 0;

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-[1200px] mx-auto px-6 py-6 pb-20">
            {/* Profile Hero */}
            <div className="relative glass-morphic-card rounded-[40px] p-10 overflow-hidden border-white/10">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[100px] -mr-48 -mt-48"></div>

                <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-blue-500/40 border-4 border-white/10">
                            {profile.name[0]}
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-[#0A0A0B] border border-white/10 flex items-center justify-center shadow-lg">
                            <Crown className="text-yellow-400" size={20} />
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                            <h1 className="text-4xl font-black text-white tracking-tighter uppercase font-outfit">{profile.name}</h1>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Verified Trader</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-blue-500" /> Web Node Alpha
                            </div>
                            <div className="flex items-center gap-2">
                                <Zap size={14} className="text-amber-500" /> {profile.holdingsCount} Active Sectors
                            </div>
                            <div className="flex items-center gap-2 text-white">
                                <Trophy size={14} className="text-yellow-500" /> Rank #1
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Growth Index</span>
                        <div className={cn(
                            "text-5xl font-black font-outfit tracking-tighter",
                            isPositive ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {isPositive ? '+' : ''}{profile.growthPercent.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-morphic-card rounded-[32px] p-8 border-white/5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Total Valuation</span>
                    <div className="text-3xl font-black text-white font-mono tracking-tighter">₹{formatIndianNumber(profile.totalValue)}</div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-3 py-1.5 rounded-xl border border-emerald-500/10 w-fit">
                        <TrendingUp size={12} /> High Performance
                    </div>
                </div>

                <div className="glass-morphic-card rounded-[32px] p-8 border-white/5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Portfolio Breadth</span>
                    <div className="text-3xl font-black text-white font-mono tracking-tighter">{profile.holdingsCount} Positions</div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-400 bg-blue-500/5 px-3 py-1.5 rounded-xl border border-blue-500/10 w-fit">
                        <Briefcase size={12} /> Diversified
                    </div>
                </div>

                <div className="glass-morphic-card rounded-[32px] p-8 border-white/5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Account Tier</span>
                    <div className="text-3xl font-black text-white font-outfit tracking-tighter">ELITE WHALE</div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-500 bg-amber-500/5 px-3 py-1.5 rounded-xl border border-amber-500/10 w-fit">
                        <Crown size={12} /> Top 0.1% Globally
                    </div>
                </div>
            </div>

            {/* Allocation Insight */}
            <div className="glass-morphic-card rounded-[32px] overflow-hidden border-white/5">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Globe size={20} className="text-blue-500" />
                        <h2 className="text-xl font-bold text-white tracking-tight uppercase">Public Disclosure: Allocation</h2>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-widest border-b border-white/5">
                                <th className="px-8 py-5 font-bold">Security Symbol</th>
                                <th className="px-8 py-5 font-bold">Strategic Sector</th>
                                <th className="px-8 py-5 font-bold text-right">Portfolio weight</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {profile.holdings.map((holding: any, i: number) => (
                                <tr key={i} className="hover:bg-white/[0.03] transition-all">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-blue-400 border border-white/5">{holding.symbol[0]}</div>
                                            <span className="font-bold text-white tracking-tight uppercase">{holding.symbol}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{holding.sector || "Other"}</span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex items-center justify-end gap-3 font-mono font-bold text-white">
                                            {holding.weight.toFixed(2)}%
                                            <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${holding.weight}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
