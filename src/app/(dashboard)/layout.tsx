'use client';

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, Settings, PieChart, Zap, Briefcase, Globe, Menu, X, TrendingUp, TrendingDown, Activity, Trophy } from "lucide-react";
import { UserNav } from "@/components/user-nav";
import { CandleLoader } from "@/components/ui/candle-loader";

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [indices, setIndices] = useState<any[]>([]);
    const [marketStatus, setMarketStatus] = useState<any>(null);
    const router = useRouter();
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch indices on mount
        const fetchIndices = async () => {
            try {
                const [indexRes, statusRes] = await Promise.all([
                    fetch('/api/market/indices'),
                    fetch('/api/market/status')
                ]);
                const indexData = await indexRes.json();
                const statusData = await statusRes.json();
                setIndices(indexData);
                setMarketStatus(statusData);
            } catch (err) {
                console.error("Failed to fetch market data", err);
            }
        };
        fetchIndices();
        const interval = setInterval(fetchIndices, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setSearchResults([]);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/stock/search?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();
                setSearchResults(data);
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSearch = (val: string) => {
        setSearchQuery(val);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-black text-slate-200">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-[90] lg:hidden animate-in fade-in duration-300 cursor-pointer"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 w-72 border-r border-white/5 bg-[#08080a] flex-shrink-0 flex flex-col shadow-2xl shadow-black z-[100] transition-all duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="px-10 pt-10 pb-8 flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <span className="text-xl font-bold text-white shadow-sm">S</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-bold tracking-tight text-white font-outfit leading-none">StockIntel</span>
                                <span className="text-[10px] text-blue-500 font-mono tracking-widest uppercase mt-1">Intelligence</span>
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSidebarOpen(false);
                            }}
                            className="lg:hidden p-2 text-slate-500 hover:text-white bg-white/5 rounded-lg border border-white/5"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-2">
                            <span className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-50">Main Menu</span>
                            <nav className="space-y-1">
                                <NavItem icon={<PieChart size={18} />} label="Dashboard" href="/" setOpen={setIsSidebarOpen} />
                                <NavItem icon={<Zap size={18} />} label="Market Scan" href="/market" setOpen={setIsSidebarOpen} />
                                <NavItem icon={<Briefcase size={18} />} label="Portfolio" href="/portfolio" setOpen={setIsSidebarOpen} />
                            </nav>
                        </div>

                        <div className="space-y-2">
                            <span className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-50">Analysis</span>
                            <nav className="space-y-1">
                                <NavItem icon={<Trophy size={18} />} label="Global Leaderboard" href="/leaderboard" setOpen={setIsSidebarOpen} />
                                <NavItem icon={<Globe size={18} />} label="News Intelligence" href="/news" setOpen={setIsSidebarOpen} />
                                <NavItem icon={<Search size={18} />} label="Strategy Finder" href="/search" setOpen={setIsSidebarOpen} />
                            </nav>
                        </div>
                    </div>
                </div>

                <UserNav />
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-[#050505] relative flex flex-col">
                <header className="h-32 border-b border-white/5 px-10 sticky top-0 bg-[#050505]/98 backdrop-blur-3xl z-50 flex justify-center">
                    <div className="w-full max-w-[1600px] flex items-start justify-between pt-10">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="lg:hidden p-3 text-slate-400 hover:text-white bg-white/5 rounded-xl border border-white/5 active:scale-95 transition-all"
                            >
                                <Menu size={20} />
                            </button>
                            <div className="relative group/search w-[300px] lg:w-[450px]" ref={searchRef}>
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-blue-500 transition-colors pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search symbols (e.g. RELIANCE)..."
                                    className="input-field !py-2.5 !pl-12 !pr-10 !bg-white/[0.03] !border-white/5 focus:!border-blue-500/50 transition-all text-sm"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                                {isSearching && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 scale-[0.4] origin-right">
                                        <CandleLoader />
                                    </div>
                                )}

                                {/* Search Results Dropdown */}
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 w-full mt-2 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl shadow-black p-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200 max-h-[480px] overflow-y-auto custom-scrollbar">
                                        {searchResults.map((result, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    router.push(`/stock/${encodeURIComponent(result.symbol)}`);
                                                    setSearchResults([]);
                                                    setSearchQuery("");
                                                }}
                                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-[13px] font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight truncate">
                                                            {(result.symbol || '').replace(/\.(NS|BO)$/, '')}
                                                        </div>
                                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-slate-500 font-black uppercase tracking-widest">
                                                            {result.symbol?.endsWith('.NS') ? 'NSE' :
                                                                result.symbol?.endsWith('.BO') ? 'BSE' :
                                                                    (result.symbol?.includes('.') ? result.symbol.split('.').pop() : 'EQUITY')}
                                                        </span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-bold truncate opacity-80 group-hover:opacity-100 transition-opacity">
                                                        {result.name}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] bg-white/5 px-2 py-1 rounded text-slate-600 font-bold uppercase tracking-widest group-hover:bg-blue-600/10 group-hover:text-blue-400">View Intel</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-6 lg:gap-8">
                            {/* Indian Market Indices */}
                            <div className="hidden md:flex items-center gap-6 lg:gap-8 text-[11px] font-mono border-x border-white/5 px-6 lg:px-8 h-8">
                                {indices.length > 0 ? indices.map((idx, i) => (
                                    <div key={i} className="flex flex-col">
                                        <span className="text-slate-600 uppercase text-[9px] tracking-tighter">{idx.symbol === '^NSEI' ? 'NIFTY 50' : 'SENSEX'}</span>
                                        <span className={`${(idx.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold flex items-center gap-1`}>
                                            {idx.price?.toLocaleString()}
                                            <span className="text-[9px] ml-1 opacity-80">
                                                {(idx.changePercent ?? 0) >= 0 ? '+' : ''}{idx.changePercent?.toFixed(2)}%
                                            </span>
                                        </span>
                                    </div>
                                )) : (
                                    <div className="flex items-center gap-2 text-slate-600 animate-pulse">
                                        <Activity size={12} />
                                        <span>Syncing Global Stream...</span>
                                    </div>
                                )}
                            </div>

                            {/* Market Status Pulse */}
                            {marketStatus && (
                                <div className="hidden xl:flex flex-col items-center justify-center border-r border-white/5 pr-8">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${marketStatus.isOpen ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                                        <span className={`text-[10px] font-black tracking-widest uppercase ${marketStatus.isOpen ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            NSE/BSE {marketStatus.label}
                                        </span>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter tabular-nums">
                                        {marketStatus.nextAction}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center gap-2 lg:gap-3">
                                <button className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all relative group">
                                    <Bell size={20} />
                                    <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-[#050505] group-hover:scale-110 transition-transform"></span>
                                </button>
                                <button className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all hidden sm:block">
                                    <Settings size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 px-10 pt-10 max-w-[1600px] mx-auto w-full pl-4">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavItem({ icon, label, href, setOpen }: { icon: React.ReactNode; label: string; href: string; setOpen: (val: boolean) => void }) {
    const pathname = usePathname();
    const active = pathname === href;

    return (
        <Link
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
            <span className={`transition-colors duration-300 ${active ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`}>{icon}</span>
            <span className="text-[13px] font-semibold tracking-wide">{label}</span>
        </Link>
    );
}
