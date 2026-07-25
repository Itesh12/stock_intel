"use client";

import React, { useState } from 'react';
import {
    ArrowLeft, Target, ShieldCheck, TrendingUp, Zap,
    BarChart3, Activity, Info, ChevronRight, Crown,
    AlertCircle, Landmark, ShoppingCart, Loader2, History,
    Wallet, CheckCircle2, X, Layers, ArrowUpRight, Plus, Minus,
    SlidersHorizontal, CheckSquare, Square
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, formatIndianNumber } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { GlobalLoader } from '@/components/ui/global-loader';
import StrategyBacktestPanel from '@/components/strategy/StrategyBacktestPanel';

export interface BucketItem {
    symbol: string;
    name: string;
    price: number;
    quantity: number;
    enabled: boolean;
}

export default function StrategyClient({ initialStrategy, strategySlug }: { initialStrategy: any, strategySlug: string }) {
    const router = useRouter();
    const [strategy, setStrategy] = useState<any>(initialStrategy);
    const [isScanning, setIsScanning] = useState(false);
    const [isFetching, setIsFetching] = useState(false);

    // Bucket Buy States
    const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
    const [isFetchingWallet, setIsFetchingWallet] = useState(false);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [walletCash, setWalletCash] = useState<number | null>(null);
    const [customBudget, setCustomBudget] = useState<number>(0);
    const [bucketItems, setBucketItems] = useState<BucketItem[]>([]);
    const [isExecutingBucket, setIsExecutingBucket] = useState(false);
    const [bucketResult, setBucketResult] = useState<any | null>(null);

    const fetchStrategy = async () => {
        setIsFetching(true);
        try {
            const res = await fetch(`/api/strategy/${strategySlug}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setStrategy(data);
        } catch (err) {
            console.error("Failed to fetch strategy", err);
        } finally {
            setIsFetching(false);
        }
    };

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

    // Calculate equal split quantities for enabled items
    const calculateEqualQuantities = (budget: number, items: BucketItem[]): BucketItem[] => {
        const enabledCount = items.filter(i => i.enabled).length;
        if (enabledCount === 0 || budget <= 0) {
            return items.map(i => ({ ...i, quantity: 0 }));
        }

        const perStockAllocation = budget / enabledCount;
        return items.map(item => {
            if (!item.enabled || item.price <= 0) {
                return { ...item, quantity: 0 };
            }
            const qty = Math.floor(perStockAllocation / item.price);
            return { ...item, quantity: qty };
        });
    };

    const handleOpenBucketModal = async () => {
        setIsBucketModalOpen(true);
        setIsFetchingWallet(true);
        setIsLoadingPrices(true);
        setBucketResult(null);

        const recommendedSymbols = strategy.recommendations?.slice(0, 20) || [];

        // 1. Fetch Wallet Balance
        let currentCash = 1000000;
        try {
            const res = await fetch('/api/portfolio/me');
            const data = await res.json();
            if (data && typeof data.cashBalance === 'number') {
                currentCash = data.cashBalance;
            }
        } catch (err) {
            console.error("Failed to fetch wallet balance", err);
        } finally {
            setWalletCash(currentCash);
            setCustomBudget(currentCash);
            setIsFetchingWallet(false);
        }

        // 2. Fetch Live Real Prices for Recommended Symbols via POST /api/market/quotes
        try {
            const res = await fetch('/api/market/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: recommendedSymbols })
            });
            const data = await res.json();
            const quotes = data.quotes || [];

            const initialItems: BucketItem[] = quotes.map((q: any) => ({
                symbol: q.symbol,
                name: q.name || q.symbol,
                price: q.price || 0,
                quantity: 0,
                enabled: true
            }));

            const calculated = calculateEqualQuantities(currentCash, initialItems);
            setBucketItems(calculated);
        } catch (err) {
            console.error("Failed to fetch live quotes for bucket", err);
        } finally {
            setIsLoadingPrices(false);
        }
    };

    const handleBudgetChange = (newBudget: number) => {
        const validBudget = Math.max(0, newBudget);
        setCustomBudget(validBudget);
        setBucketItems(prev => calculateEqualQuantities(validBudget, prev));
    };

    const handleQuickBudgetPercent = (pct: number) => {
        if (!walletCash) return;
        const target = Math.floor((walletCash * pct) / 100);
        handleBudgetChange(target);
    };

    const handleToggleStock = (symbol: string) => {
        setBucketItems(prev => {
            const updated = prev.map(item =>
                item.symbol === symbol ? { ...item, enabled: !item.enabled } : item
            );
            return calculateEqualQuantities(customBudget, updated);
        });
    };

    const handleQuantityChange = (symbol: string, newQty: number) => {
        const qty = Math.max(0, newQty);
        setBucketItems(prev =>
            prev.map(item =>
                item.symbol === symbol ? { ...item, quantity: qty, enabled: qty > 0 ? true : item.enabled } : item
            )
        );
    };

    const handleExecuteBucketBuy = async () => {
        const activeOrders = bucketItems
            .filter(i => i.enabled && i.quantity > 0)
            .map(i => ({
                symbol: i.symbol,
                quantity: i.quantity,
                price: i.price,
                name: i.name
            }));

        if (activeOrders.length === 0) {
            alert("No stocks with quantity > 0 selected for purchase.");
            return;
        }

        setIsExecutingBucket(true);
        try {
            const res = await fetch('/api/portfolio/bucket-buy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategyId: strategy.id,
                    orders: activeOrders
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Bucket buy failed");

            setBucketResult(data);
        } catch (err: any) {
            alert(err.message || "Failed to execute bucket purchase.");
        } finally {
            setIsExecutingBucket(false);
        }
    };

    React.useEffect(() => {
        setStrategy(initialStrategy);

        let active = true;
        const checkAndScan = async () => {
            const updatedAt = initialStrategy.recommendationsUpdatedAt ? new Date(initialStrategy.recommendationsUpdatedAt) : null;
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            if (!updatedAt || updatedAt < oneHourAgo) {
                setIsScanning(true);
                try {
                    await fetch(`/api/strategy/${strategySlug}/scan`, { method: 'POST' });
                    if (active) {
                        await fetchStrategy();
                    }
                } catch (err) {
                    console.error("Auto scan failed", err);
                } finally {
                    if (active) {
                        setIsScanning(false);
                    }
                }
            } else {
                if (active) {
                    await fetchStrategy();
                }
            }
        };
        checkAndScan();

        return () => {
            active = false;
        };
    }, [strategySlug, initialStrategy]);

    if (!strategy) return null;

    const recommendedList = strategy.recommendations?.slice(0, 20) || [];
    const stockCount = recommendedList.length;

    // Derived Bucket Totals
    const enabledItems = bucketItems.filter(i => i.enabled);
    const totalRequiredCost = bucketItems.reduce((sum, item) => item.enabled ? sum + item.quantity * item.price : sum, 0);
    const availableCashValue = walletCash || 0;
    const isExceedingWallet = totalRequiredCost > availableCashValue;
    const activeOrderCount = bucketItems.filter(i => i.enabled && i.quantity > 0).length;

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

                    <AnimatePresence>
                        {isScanning && (
                            <GlobalLoader 
                                fullScreen={true} 
                                title={`Scanning Entire NSE For ${strategy.name}`} 
                                steps={[
                                    { label: 'Validating Strategy Rules', threshold: 10 },
                                    { label: 'Querying 3,000+ Symbols', threshold: 30 },
                                    { label: 'Evaluating Technicals', threshold: 60 },
                                    { label: 'Ranking Top 20', threshold: 90 }
                                ]}
                            />
                        )}
                    </AnimatePresence>
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
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleScan}
                                    disabled={isScanning}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] hover:bg-white/10 transition-all disabled:opacity-50"
                                >
                                    {isScanning ? (
                                       <div className="w-2.5 h-2.5"><GlobalLoader minimal={true} /></div>
                                    ) : <Activity size={10} />}
                                    {isScanning ? "Scanning..." : "Scan"}
                                </button>
                            </div>
                        </div>

                        {/* PROMINENT 1-CLICK BUCKET BUY BANNER */}
                        {recommendedList.length > 0 && (
                            <button
                                onClick={handleOpenBucketModal}
                                className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-900/30 flex items-center justify-between group border border-emerald-400/20 active:scale-95"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-white/20">
                                        <Zap size={16} fill="currentColor" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs font-black">Buy Bucket ({stockCount} Stocks)</div>
                                        <div className="text-[9px] text-emerald-100/80 font-bold tracking-widest">Custom Allocation & Quantity Controls</div>
                                    </div>
                                </div>
                                <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </button>
                        )}

                        <div className="glass-morphic-card rounded-[32px] overflow-hidden border-emerald-500/10 min-h-[200px] flex flex-col">
                            <div className="p-6 bg-emerald-500/5 border-b border-white/5 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Recommended Stocks ({stockCount})</span>
                            </div>
                            <div className="p-4 sm:p-6 flex-1">
                                {isFetching && (!strategy.recommendations || strategy.recommendations.length === 0) ? (
                                    <div className="p-10 text-center flex flex-col items-center justify-center h-full gap-4">
                                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                                        <div className="text-[10px] font-bold text-white uppercase tracking-widest">Checking for stocks...</div>
                                    </div>
                                ) : recommendedList.length > 0 ? (
                                    <div className={cn("flex flex-col gap-3 transition-opacity duration-300", isFetching && "opacity-60 pointer-events-none")}>
                                        {recommendedList.map((symbol: string) => (
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
                    <div className="glass-morphic-card rounded-[24px] p-8 border-emerald-500/20 bg-emerald-950/20 flex flex-col items-center justify-center text-center gap-4 border">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Zap size={24} />
                        </div>
                        <h4 className="text-lg font-bold text-white font-outfit uppercase">Deploy Strategy Bucket</h4>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Configure budget and buy recommended stocks in 1-click.</p>
                        <button
                            onClick={handleOpenBucketModal}
                            disabled={stockCount === 0}
                            className="w-full mt-2 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Zap size={16} fill="currentColor" />
                            1-Click Bucket Buy
                        </button>
                    </div>
                </div>
            </div>

            {/* Backtesting Engine Section */}
            <div className="mt-8 md:mt-12 space-y-6">
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

            {/* ENHANCED INTERACTIVE BUCKET BUY DIALOG */}
            <AnimatePresence>
                {isBucketModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0e0e11] border border-white/10 rounded-[32px] max-w-2xl w-full overflow-hidden shadow-2xl relative my-auto"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <Layers size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-white uppercase tracking-tight font-outfit">Strategy Bucket Allocation</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Configure Budget & Share Quantities</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setIsBucketModalOpen(false); setBucketResult(null); }}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                                {bucketResult ? (
                                    /* RESULT SUCCESS SCREEN */
                                    <div className="text-center space-y-6 py-4">
                                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                                            <CheckCircle2 size={36} />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-white font-outfit uppercase tracking-tight">Bucket Purchased!</h4>
                                            <p className="text-xs text-slate-400 font-medium mt-1">Successfully executed {bucketResult.executedCount} orders from {strategy.name}.</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Capital Invested</div>
                                                <div className="text-base font-black text-emerald-400">₹{formatIndianNumber(bucketResult.totalCapitalSpent || 0)}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Remaining Wallet Cash</div>
                                                <div className="text-base font-black text-white">₹{formatIndianNumber(bucketResult.remainingCash || 0)}</div>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-left">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Executed Orders ({bucketResult.executedTrades?.length})</div>
                                            <div className="max-h-48 overflow-y-auto divide-y divide-white/5 bg-black/40 rounded-xl p-3 border border-white/5 space-y-1">
                                                {bucketResult.executedTrades?.map((t: any) => (
                                                    <div key={t.symbol} className="flex items-center justify-between py-2 text-xs">
                                                        <div>
                                                            <span className="font-bold text-white uppercase">{t.symbol.replace('.NS', '')}</span>
                                                            <span className="text-[10px] text-slate-500 font-mono block">{t.quantity} shares @ ₹{t.price?.toFixed(2)}</span>
                                                        </div>
                                                        <span className="font-black text-emerald-400">₹{formatIndianNumber(t.totalCost)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <Link
                                                href="/portfolio"
                                                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all text-center shadow-lg shadow-blue-600/20"
                                            >
                                                View Portfolio
                                            </Link>
                                            <button
                                                onClick={() => { setIsBucketModalOpen(false); setBucketResult(null); }}
                                                className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* PRE-PURCHASE INTERACTIVE CONFIGURATION FORM */
                                    <>
                                        {/* Wallet Cash & Target Budget Bar */}
                                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                    <Wallet size={14} className="text-blue-400" />
                                                    Available Wallet Cash
                                                </div>
                                                <div className="text-base font-black text-white font-mono">
                                                    {isFetchingWallet ? "Checking..." : `₹${formatIndianNumber(availableCashValue)}`}
                                                </div>
                                            </div>

                                            {/* Custom Investment Amount Input */}
                                            <div className="space-y-2 pt-2 border-t border-white/5">
                                                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                                                    <span className="uppercase tracking-wider">Bucket Investment Budget:</span>
                                                    <span className="text-emerald-400 font-mono">₹{formatIndianNumber(customBudget)}</span>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="relative flex-1">
                                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₹</span>
                                                        <input
                                                            type="number"
                                                            value={customBudget || ''}
                                                            onChange={e => handleBudgetChange(Number(e.target.value))}
                                                            placeholder="Enter investment amount"
                                                            className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none transition-colors"
                                                        />
                                                    </div>

                                                    {/* Quick Budget Percent Buttons */}
                                                    <div className="flex items-center gap-1">
                                                        {[25, 50, 75, 100].map(pct => (
                                                            <button
                                                                key={pct}
                                                                onClick={() => handleQuickBudgetPercent(pct)}
                                                                className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-[10px] font-black text-slate-300 hover:text-emerald-400 border border-white/5 transition-all"
                                                            >
                                                                {pct}%
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Validation Alert Banners */}
                                        {isExceedingWallet && (
                                            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
                                                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                                                <div>
                                                    <span className="font-bold uppercase tracking-wider block">Wallet Balance Exceeded</span>
                                                    Total bucket cost (₹{formatIndianNumber(totalRequiredCost)}) exceeds available wallet cash (₹{formatIndianNumber(availableCashValue)}). Please lower your budget or reduce share quantities.
                                                </div>
                                            </div>
                                        )}

                                        {/* Interactive Itemized Stock Table */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                                <span>Stock Breakdown ({enabledItems.length} Selected)</span>
                                                <span>Live Price & Allocated Shares</span>
                                            </div>

                                            {isLoadingPrices ? (
                                                <div className="p-8 text-center flex flex-col items-center justify-center gap-3 bg-black/30 rounded-2xl border border-white/5">
                                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Fetching Live Stock Prices...</div>
                                                </div>
                                            ) : (
                                                <div className="max-h-64 overflow-y-auto divide-y divide-white/5 bg-black/40 rounded-2xl border border-white/10">
                                                    {bucketItems.map((item) => {
                                                        const itemCost = item.quantity * item.price;
                                                        return (
                                                            <div
                                                                key={item.symbol}
                                                                className={cn(
                                                                    "p-3 sm:p-4 flex items-center justify-between gap-4 transition-colors",
                                                                    item.enabled ? "bg-white/[0.01]" : "opacity-40 bg-black/20"
                                                                )}
                                                            >
                                                                {/* Checkbox & Symbol */}
                                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                    <button
                                                                        onClick={() => handleToggleStock(item.symbol)}
                                                                        className="text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                                                                    >
                                                                        {item.enabled ? (
                                                                            <CheckSquare size={18} className="text-emerald-500" />
                                                                        ) : (
                                                                            <Square size={18} className="text-slate-600" />
                                                                        )}
                                                                    </button>

                                                                    <div className="min-w-0">
                                                                        <div className="font-black text-white text-sm uppercase tracking-tight flex items-center gap-2">
                                                                            {item.symbol.replace('.NS', '')}
                                                                            {item.price > 0 && (
                                                                                <span className="text-[10px] text-slate-400 font-mono font-normal">
                                                                                    @ ₹{item.price.toFixed(2)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {item.enabled && item.quantity === 0 && (
                                                                            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block mt-0.5">
                                                                                Price exceeds per-stock split
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Quantity Adjust Controls */}
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleQuantityChange(item.symbol, item.quantity - 1)}
                                                                        disabled={!item.enabled || item.quantity <= 0}
                                                                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 flex items-center justify-center transition-all border border-white/5"
                                                                    >
                                                                        <Minus size={12} />
                                                                    </button>

                                                                    <input
                                                                        type="number"
                                                                        value={item.quantity}
                                                                        disabled={!item.enabled}
                                                                        onChange={e => handleQuantityChange(item.symbol, Number(e.target.value))}
                                                                        className="w-12 py-1 text-center bg-black/60 border border-white/10 rounded-lg text-white font-mono text-xs font-bold focus:border-emerald-500 focus:outline-none"
                                                                    />

                                                                    <button
                                                                        onClick={() => handleQuantityChange(item.symbol, item.quantity + 1)}
                                                                        disabled={!item.enabled}
                                                                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 flex items-center justify-center transition-all border border-white/5"
                                                                    >
                                                                        <Plus size={12} />
                                                                    </button>
                                                                </div>

                                                                {/* Item Cost */}
                                                                <div className="text-right shrink-0 w-24">
                                                                    <div className="text-xs font-black text-emerald-400 font-mono">
                                                                        ₹{formatIndianNumber(itemCost)}
                                                                    </div>
                                                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                                        {item.quantity} Qty
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Total Summary Footer */}
                                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-300 font-bold uppercase tracking-wider">Total Bucket Cost:</span>
                                                <span className={cn("font-mono font-black text-sm", isExceedingWallet ? "text-rose-400" : "text-emerald-400")}>
                                                    ₹{formatIndianNumber(totalRequiredCost)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>Remaining Wallet Cash:</span>
                                                <span className="font-mono font-bold text-white">
                                                    ₹{formatIndianNumber(Math.max(0, availableCashValue - totalRequiredCost))}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => setIsBucketModalOpen(false)}
                                                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleExecuteBucketBuy}
                                                disabled={isExecutingBucket || isExceedingWallet || activeOrderCount === 0}
                                                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/40 flex items-center justify-center gap-2"
                                            >
                                                {isExecutingBucket ? (
                                                    <div className="w-4 h-4"><GlobalLoader minimal={true} /></div>
                                                ) : <Zap size={16} fill="currentColor" />}
                                                {isExecutingBucket ? "Executing Orders..." : `Execute ${activeOrderCount} Orders`}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


