'use client';

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, Settings, PieChart, Zap, Briefcase, Globe, Menu, X, TrendingUp, TrendingDown, Activity, Trophy, Scale, FlaskConical, BookOpen, Palette } from "lucide-react";
import { UserNav } from "@/components/user-nav";
import { CandleLoader } from "@/components/ui/candle-loader";
import ThemeSwitcher from "@/components/theme/ThemeSwitcher";
import TerminalFooter from "@/components/ui/terminal-footer";
import { NotificationsPopover } from "@/components/ui/notifications-popover";

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

                        <div className="space-y-2">
                            <span className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-50">Alpha Hub</span>
                            <nav className="space-y-1">
                                <NavItem icon={<Scale size={18} />} label="Stock Duel" href="/comparison" setOpen={setIsSidebarOpen} />
                                <NavItem icon={<FlaskConical size={18} />} label="Backtesting Lab" href="/backtesting" setOpen={setIsSidebarOpen} />
                                <NavItem icon={<BookOpen size={18} />} label="Trader Journal" href="/journal" setOpen={setIsSidebarOpen} />
                            </nav>
                        </div>
                    </div>
                </div>

                <UserNav />
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden w-full bg-[#050505] relative flex flex-col">
                <header className="h-24 sticky top-0 z-50 flex justify-center w-full px-4 md:px-8 lg:px-12 pointer-events-none">
                    <div className="mt-4 w-full max-w-[1600px] h-16 bg-[#050505]/60 backdrop-blur-3xl border border-white/10 rounded-[28px] flex items-center px-4 md:px-6 shadow-2xl stealth-border-glow pointer-events-auto transition-all">
                        {/* Left Pillar: Menu */}
                        <div className="flex items-center shrink-0 min-w-[44px]">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="lg:hidden flex h-11 w-11 items-center justify-center text-slate-400 hover:text-white bg-white/5 rounded-2xl border border-white/5 active:scale-95 transition-all"
                            >
                                <Menu size={18} />
                            </button>
                        </div>

                        {/* Center Pillar: Search (Flexible & Centered) */}
                        <div className="flex-1 flex justify-center px-4 md:px-10">
                            <div className="relative group/search w-full max-w-[520px]" ref={searchRef}>
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-blue-400 transition-colors pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search nodes..."
                                    className="h-11 !py-0 !pl-11 !pr-10 !bg-white/[0.04] !border-white/5 focus:!border-blue-500/30 transition-all text-[13px] rounded-2xl w-full font-medium placeholder:text-slate-600 shadow-inner"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value.toUpperCase())}
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

                        {/* Right Pillar: Indices & Actions */}
                        <div className="flex items-center gap-4 shrink-0 justify-end min-w-[44px]">
                            {/* Indian Market Indices */}
                            <div className="hidden min-[1150px]:flex items-center gap-6 text-[11px] font-mono border-x border-white/5 px-6 h-8">
                                {indices.length > 0 ? indices.map((idx, i) => (
                                    <div key={i} className="flex flex-col whitespace-nowrap">
                                        <span className="text-slate-600 uppercase text-[9px] tracking-tighter leading-none mb-0.5">{idx.symbol === '^NSEI' ? 'NIFTY 50' : 'SENSEX'}</span>
                                        <span className={`${(idx.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold flex items-center gap-1 leading-none`}>
                                            {idx.price?.toLocaleString()}
                                            <span className="text-[9px] opacity-80 font-medium">
                                                {(idx.changePercent ?? 0) >= 0 ? '+' : ''}{idx.changePercent?.toFixed(2)}%
                                            </span>
                                        </span>
                                    </div>
                                )) : (
                                    <div className="flex items-center gap-2 text-slate-600 animate-pulse whitespace-nowrap">
                                        <Activity size={12} />
                                        <span>Syncing Stream...</span>
                                    </div>
                                )}
                            </div>

                            {/* Market Status Pulse */}
                            {marketStatus && (
                                <div className="hidden min-[1400px]:flex flex-col items-center justify-center border-r border-white/5 pr-4 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${marketStatus.isOpen ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                                        <span className={`text-[9px] font-black tracking-widest uppercase ${marketStatus.isOpen ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            NSE/BSE {marketStatus.label}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <ThemeSwitcher />
                                <NotificationsPopover />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 px-4 md:px-8 lg:px-12 pt-6 lg:pt-10 pb-16 max-w-[1600px] mx-auto w-full flex flex-col justify-between">
                    <div className="flex-1">
                        {children}
                    </div>
                    <div className="mt-32 pt-16 border-t border-white/5">
                        <TerminalFooter />
                    </div>
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
