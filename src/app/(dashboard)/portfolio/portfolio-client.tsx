"use client";
import React, { useState, useEffect } from "react";
import { 
    PieChart as PieChartIcon, 
    Briefcase, 
    TrendingUp, 
    ShieldAlert, 
    Cpu, 
    ArrowUpRight, 
    ArrowDownRight, 
    MoreHorizontal, 
    Database, 
    Wallet, 
    Plus, 
    ShoppingCart, 
    Ban, 
    Coins, 
    ArrowRight, 
    History, 
    RotateCcw, 
    ArrowUp, 
    ArrowDown,
    CheckSquare,
    Square,
    Minus,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Zap,
    X,
    ChevronRight,
    SlidersHorizontal,
    Calendar as CalendarIcon
} from "lucide-react";

export interface SellItem {
    symbol: string;
    name: string;
    heldQuantity: number;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    enabled: boolean;
}
import { formatCurrency, formatIndianNumber, cn, formatSymbol } from "@/lib/utils";
import { GlobalLoader } from "@/components/ui/global-loader";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell, 
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import PortfolioHeatmap from "@/components/portfolio/Heatmap";
import TraderJournal from "@/components/portfolio/TraderJournal";
import BacktestSimulator from "@/components/portfolio/BacktestSimulator";

export default function PortfolioClient({ 
    initialPortfolio, 
    initialTrades, 
    initialAnalytics, 
    initialLimitOrders 
}: { 
    initialPortfolio: any, 
    initialTrades: any[], 
    initialAnalytics: any, 
    initialLimitOrders: any[] 
}) {
    const [portfolio, setPortfolio] = useState<any>(initialPortfolio);
    const [trades, setTrades] = useState<any[]>(initialTrades);
    const [limitOrders, setLimitOrders] = useState<any[]>(initialLimitOrders);
    const [analytics, setAnalytics] = useState<any>(initialAnalytics);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'live' | 'backtest'>('live');

    // Batch Sell Modal States
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [isLoadingLivePrices, setIsLoadingLivePrices] = useState(false);
    const [isExecutingSell, setIsExecutingSell] = useState(false);
    const [sellItems, setSellItems] = useState<SellItem[]>([]);
    const [sellResult, setSellResult] = useState<any | null>(null);
    const [liquidationPercent, setLiquidationPercent] = useState<number>(100);

    const fetchPortfolio = async () => {
        setIsLoading(true);
        try {
            const [portRes, tradeRes, analyticsRes, limitRes] = await Promise.all([
                fetch('/api/portfolio/me'),
                fetch('/api/trade/history'),
                fetch('/api/portfolio/analytics'),
                fetch('/api/trade/limit')
            ]);
            const portData = await portRes.json();
            const tradeData = await tradeRes.json();
            const analyticsData = await analyticsRes.json();
            const limitData = await limitRes.json();

            setPortfolio(portData);
            setTrades(Array.isArray(tradeData) ? tradeData : []);
            setLimitOrders(Array.isArray(limitData) ? limitData : []);
            setAnalytics(analyticsData);
        } catch (err) {
            console.error("Failed to fetch dashboard data", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const interval = setInterval(fetchPortfolio, 60000); // 1-minute pulse
        return () => clearInterval(interval);
    }, []);

    const handleOpenSellModal = async () => {
        const currentHoldings = portfolio?.holdings || [];
        if (currentHoldings.length === 0) return;

        const initial: SellItem[] = currentHoldings.map((h: any) => ({
            symbol: h.symbol,
            name: h.name || h.symbol,
            heldQuantity: h.quantity,
            quantity: h.quantity,
            averagePrice: h.averagePrice || 0,
            currentPrice: h.currentPrice || h.averagePrice || 0,
            enabled: true
        }));

        setSellItems(initial);
        setIsSellModalOpen(true);
        setIsLoadingLivePrices(true);
        setSellResult(null);
        setLiquidationPercent(100);

        try {
            const symbols = currentHoldings.map((h: any) => h.symbol);
            const res = await fetch('/api/market/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols })
            });
            const data = await res.json();
            const quotes = data.quotes || [];
            const priceMap = new Map<string, number>();
            quotes.forEach((q: any) => {
                if (q.price > 0) priceMap.set(q.symbol, q.price);
            });

            setSellItems(prev => prev.map(item => ({
                ...item,
                currentPrice: priceMap.get(item.symbol) || item.currentPrice
            })));
        } catch (err) {
            console.warn("Failed to fetch live quotes for sell dialog:", err);
        } finally {
            setIsLoadingLivePrices(false);
        }
    };

    const handleQuantityChange = (symbol: string, newQty: number) => {
        setSellItems(prev =>
            prev.map(item => {
                if (item.symbol !== symbol) return item;
                const validQty = Math.max(0, Math.min(item.heldQuantity, Math.floor(newQty) || 0));
                return {
                    ...item,
                    quantity: validQty,
                    enabled: validQty > 0 ? true : item.enabled
                };
            })
        );
    };

    const handleToggleStock = (symbol: string) => {
        setSellItems(prev =>
            prev.map(item =>
                item.symbol === symbol ? { ...item, enabled: !item.enabled } : item
            )
        );
    };

    const handleToggleAll = (enable: boolean) => {
        setSellItems(prev => prev.map(item => ({ ...item, enabled: enable })));
    };

    const handleSetLiquidationPercent = (pct: number) => {
        setLiquidationPercent(pct);
        setSellItems(prev =>
            prev.map(item => {
                if (!item.enabled) return item;
                const calculatedQty = pct === 100
                    ? item.heldQuantity
                    : Math.max(1, Math.floor((item.heldQuantity * pct) / 100));
                return {
                    ...item,
                    quantity: Math.min(item.heldQuantity, calculatedQty)
                };
            })
        );
    };

    const handleExecuteSell = async () => {
        const activeOrders = sellItems
            .filter(i => i.enabled && i.quantity > 0)
            .map(i => ({
                symbol: i.symbol,
                quantity: i.quantity,
                price: i.currentPrice,
                name: i.name
            }));

        if (activeOrders.length === 0) {
            alert("No stocks with quantity > 0 selected for sale.");
            return;
        }

        setIsExecutingSell(true);
        try {
            const res = await fetch('/api/portfolio/bucket-sell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orders: activeOrders })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Sale execution failed");

            setSellResult(data);
            await fetchPortfolio();
        } catch (err: any) {
            alert(err.message || "Failed to execute sale.");
        } finally {
            setIsExecutingSell(false);
        }
    };

    // Calculation Engine
    const holdings = portfolio?.holdings || [];
    const totalInvested = holdings.reduce((acc: number, h: any) => acc + (h.quantity * h.averagePrice), 0);
    const totalUnrealizedPL = holdings.reduce((acc: number, h: any) => acc + (h.unrealizedPL || 0), 0);
    const totalUnrealizedPLPercent = totalInvested > 0 ? (totalUnrealizedPL / totalInvested) * 100 : 0;
    
    // Realized P&L from trades
    const safeTrades = Array.isArray(trades) ? trades : [];
    const realizedPL = safeTrades.filter(t => t.type === 'SELL').reduce((acc: number, t: any) => {
        return acc + (t.realizedPL || 0);
    }, 0);

    const combinedPL = realizedPL + totalUnrealizedPL;
    const combinedPLPercent = totalInvested > 0 ? (combinedPL / totalInvested) * 100 : 0;
    const isTotalPositive = combinedPL >= 0;

    // Derived Sell Calculations
    const enabledSellItems = sellItems.filter(i => i.enabled);
    const activeSellCount = sellItems.filter(i => i.enabled && i.quantity > 0).length;
    const totalSellShares = sellItems.reduce((sum, item) => item.enabled ? sum + item.quantity : sum, 0);
    const totalSellProceeds = sellItems.reduce((sum, item) => item.enabled ? sum + (item.quantity * item.currentPrice) : sum, 0);
    const totalSellRealizedPL = sellItems.reduce((sum, item) => item.enabled ? sum + ((item.currentPrice - item.averagePrice) * item.quantity) : sum, 0);
    const currentWalletCash = portfolio?.cashBalance || 0;
    const projectedWalletCash = currentWalletCash + totalSellProceeds;

    // Daily High Alphas & Underperformers (Strict filtering for non-zero movers)
    const gainers = [...holdings]
        .filter((h: any) => (h.dayChangePercent || 0) > 0)
        .sort((a: any, b: any) => (b.dayChangePercent || 0) - (a.dayChangePercent || 0))
        .slice(0, 3);

    const losers = [...holdings]
        .filter((h: any) => (h.dayChangePercent || 0) < 0)
        .sort((a: any, b: any) => (a.dayChangePercent || 0) - (b.dayChangePercent || 0))
        .slice(0, 3);

    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-[1600px] mx-auto px-4 sm:px-6 py-4 md:py-6 pb-20">
            <div className="flex items-end justify-between border-b border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Briefcase size={14} className="text-blue-500" />
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em]">Wealth Dashboard</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight font-outfit text-pretty">Portfolio Intelligence</h1>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Real-time tracking of combined P&L, sector concentration, and asset performance.</p>
                    <div className="flex items-center gap-6 mt-6">
                        <button 
                            onClick={() => setActiveTab('live')}
                            className={cn(
                                "text-[10px] font-black uppercase tracking-[0.3em] pb-2 transition-all relative",
                                activeTab === 'live' ? "text-blue-500" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            Live Positions
                            {activeTab === 'live' && <motion.div layoutId="portTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                        </button>
                        <button 
                            onClick={() => setActiveTab('backtest')}
                            className={cn(
                                "text-[10px] font-black uppercase tracking-[0.3em] pb-2 transition-all relative",
                                activeTab === 'backtest' ? "text-indigo-500" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            Quant History
                            {activeTab === 'backtest' && <motion.div layoutId="portTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
                        </button>
                        <button 
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('open-pnl-calendar'))}
                            className="text-[10px] font-black uppercase tracking-[0.3em] pb-2 transition-all text-slate-500 hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
                        >
                            <CalendarIcon size={13} className="text-emerald-400" />
                            P&L Calendar
                        </button>
                    </div>
                </div>

                {portfolio && (
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Available Capital</span>
                        <div className="text-2xl font-black text-emerald-400 font-outfit tracking-tighter">
                            ₹{formatIndianNumber(portfolio.cashBalance)}
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'live' ? (
                    <motion.div 
                        key="live"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6 md:space-y-10"
                    >
                        {/* KPI SECTION */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            <StatCard
                                title="Net Portfolio Value"
                                value={`₹${formatIndianNumber(portfolio?.totalValue || 0)}`}
                                indicator={`${(portfolio?.totalPLPercent || 0).toFixed(2)}%`}
                                subIndicator="INCEPTION TO DATE"
                                color={(portfolio?.totalPL || 0) >= 0 ? "emerald" : "blue"}
                            />
                            <StatCard
                                title="Combined Profit Intelligence"
                                value={`₹${formatIndianNumber(combinedPL)}`}
                                indicator={`${isTotalPositive ? '+' : ''}${combinedPLPercent.toFixed(2)}%`}
                                subIndicator="REALIZED + PAPER"
                                color={isTotalPositive ? "emerald" : "blue"}
                            />
                            <StatCard
                                title="Daily P&L Fluctuation"
                                value={`₹${formatIndianNumber(Math.abs(portfolio?.dayPnL || 0))}`}
                                indicator={`${(portfolio?.dayPnL || 0) >= 0 ? '+' : ''}${portfolio?.dayPnLPercent?.toFixed(2) || 0}%`}
                                subIndicator="REALTIME SESSION"
                                color={(portfolio?.dayPnL || 0) >= 0 ? "emerald" : "blue"}
                            />
                            <StatCard
                                title="Institutional Efficiency"
                                value={analytics?.sharpeRatio?.toFixed(2) || "0.00"}
                                indicator="SHARPE"
                                subIndicator={`Volatility: ${analytics?.volatility?.toFixed(1) || 0}%`}
                                color="blue"
                            />
                        </div>

                        {/* HIGH ALPHA SHELF */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="glass-morphic-card rounded-3xl p-6 border-emerald-500/10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Session Gainers</h3>
                                    <TrendingUp size={14} className="text-emerald-500" />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {gainers.length > 0 ? gainers.map(h => (
                                        <div key={h.symbol} className="bg-white/5 rounded-2xl p-3 border border-white/5 group hover:bg-emerald-500/10 transition-colors">
                                            <div className="text-xs font-black text-white">{formatSymbol(h.symbol)}</div>
                                            <div className="text-[10px] font-bold text-emerald-400">+{(h.dayChangePercent || 0).toFixed(2)}%</div>
                                        </div>
                                    )) : <div className="col-span-3 text-[10px] text-slate-600 font-bold uppercase py-2">No High Alphas Found</div>}
                                </div>
                            </div>
                            <div className="glass-morphic-card rounded-3xl p-6 border-rose-500/10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Session Losers</h3>
                                    <ArrowDownRight size={14} className="text-rose-500" />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {losers.length > 0 ? losers.map(h => (
                                        <div key={h.symbol} className="bg-white/5 rounded-2xl p-3 border border-white/5 group hover:bg-rose-500/10 transition-colors">
                                            <div className="text-xs font-black text-white">{formatSymbol(h.symbol)}</div>
                                            <div className="text-[10px] font-bold text-rose-400">{(h.dayChangePercent || 0).toFixed(2)}%</div>
                                        </div>
                                    )) : <div className="col-span-3 text-[10px] text-slate-600 font-bold uppercase py-2">No Underperformers</div>}
                                </div>
                            </div>
                        </div>

                        {/* CORE ANALYTICS GRID */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                            <div className="lg:col-span-3 space-y-10">
                                <section className="glass-morphic-card rounded-[32px] p-8 border-emerald-500/10 h-[400px]">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h2 className="text-xl font-bold text-white tracking-tight text-pretty">Capital Trajectory</h2>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Growth Curve Analysis (30D)</p>
                                        </div>
                                    </div>
                                    <div className="h-[280px] w-full">
                                        <PerformanceCurve data={portfolio?.performanceHistory || []} />
                                    </div>
                                </section>

                                {/* PROMINENT 1-CLICK LIQUIDATION BANNER */}
                                {holdings.length > 0 && (
                                    <button
                                        onClick={handleOpenSellModal}
                                        className="w-full p-4 rounded-2xl bg-gradient-to-r from-rose-600/90 via-red-600 to-orange-600/90 hover:from-rose-500 hover:via-red-500 hover:to-orange-500 text-white font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-rose-900/30 flex items-center justify-between group border border-rose-400/20 active:scale-[0.99]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md">
                                                <ArrowDownRight size={18} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-black flex items-center gap-2">
                                                    Sell Portfolio ({holdings.length} Stocks)
                                                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[9px] font-bold">1-Click Dialog</span>
                                                </div>
                                                <div className="text-[10px] text-rose-100/80 font-bold tracking-wider">
                                                    Liquidate entire portfolio or selectively customize sell quantities
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold tracking-widest uppercase bg-black/20 px-3 py-1.5 rounded-xl border border-white/10 hidden sm:inline-block">
                                                Est. Value: ₹{formatIndianNumber(holdings.reduce((sum: number, h: any) => sum + (h.quantity * (h.currentPrice || h.averagePrice)), 0))}
                                            </span>
                                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </button>
                                )}

                                <section className="glass-morphic-card rounded-[32px] overflow-hidden">
                                    <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.01]">
                                        <div>
                                            <h2 className="text-xl font-bold text-white tracking-tight">Deployment Ledger</h2>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                                {holdings.length} Active Positions • Real-time valuation
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10 hidden sm:inline-block">Active Flux</span>
                                            {holdings.length > 0 && (
                                                <button
                                                    onClick={handleOpenSellModal}
                                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-900/30 active:scale-95 border border-rose-400/20"
                                                >
                                                    <ArrowDownRight size={15} />
                                                    <span>Sell All ({holdings.length} Stocks)</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {holdings.length > 0 ? (
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-white/[0.01] text-slate-500 text-[10px] uppercase tracking-[0.25em] border-b border-white/5 font-outfit">
                                                        <th className="px-6 py-4 font-black">Asset Class</th>
                                                        <th className="px-6 py-4 font-black">Portfolio Weight</th>
                                                        <th className="px-6 py-4 font-black">Performance Delta</th>
                                                        <th className="px-6 py-4 font-black">Live Quote</th>
                                                        <th className="px-6 py-4 font-black text-right">Exposure Value</th>
                                                        <th className="px-6 py-4 font-black text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {holdings.map((holding: any) => (
                                                        <HoldingRow
                                                            key={holding.id}
                                                            holding={holding}
                                                            portfolioTotalValue={portfolio?.totalValue || 1}
                                                            onTradeSuccess={fetchPortfolio}
                                                        />
                                                    ))}
                                                    <tr className="bg-white/[0.03] border-t border-white/10 group hover:bg-white/[0.05] transition-colors">
                                                        <td colSpan={4} className="px-8 py-6 text-left">
                                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Paper Gains</span>
                                                        </td>
                                                        <td className="px-8 py-6 text-right">
                                                            <div className={cn(
                                                                "text-lg font-black font-outfit tracking-tight",
                                                                totalUnrealizedPL >= 0 ? "text-emerald-400" : "text-rose-400"
                                                            )}>
                                                                {totalUnrealizedPL >= 0 ? '+' : ''}₹{formatIndianNumber(totalUnrealizedPL)}
                                                            </div>
                                                            <div className={cn(
                                                                "text-[10px] font-bold",
                                                                totalUnrealizedPL >= 0 ? "text-emerald-500" : "text-rose-500"
                                                            )}>
                                                                {totalUnrealizedPLPercent.toFixed(2)}% ROI
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6"></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                                <Database className="text-slate-700 animate-pulse mb-6" size={48} strokeWidth={1} />
                                                <h3 className="text-xl font-bold text-slate-400 font-outfit mb-2">Liquidity Maximized</h3>
                                                <p className="text-xs text-slate-600 max-w-sm uppercase tracking-widest">No active asset exposure detected.</p>
                                                <Link href="/market" className="mt-8 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs transition-all shadow-xl shadow-blue-500/20 uppercase tracking-widest active:scale-95">
                                                    Scan Market
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {Array.isArray(limitOrders) && limitOrders.filter(o => o.status === 'PENDING').length > 0 && (
                                    <section className="glass-morphic-card rounded-[32px] overflow-hidden border-blue-500/10">
                                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Cpu size={20} className="text-blue-500" />
                                                <h2 className="text-xl font-bold text-white tracking-tight">Algorithmic Triggers</h2>
                                            </div>
                                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest bg-blue-500/5 px-2 py-1 rounded-md border border-blue-500/20">Pending Execution</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-widest border-b border-white/5">
                                                        <th className="px-8 py-5 font-bold">Operation</th>
                                                        <th className="px-8 py-5 font-bold">Security</th>
                                                        <th className="px-8 py-5 font-bold">Target</th>
                                                        <th className="px-8 py-5 font-bold text-center">Qty</th>
                                                        <th className="px-8 py-5 font-bold text-right">Requirement</th>
                                                        <th className="px-8 py-5 font-bold text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {Array.isArray(limitOrders) && limitOrders.filter(o => o.status === 'PENDING').map((order: any) => (
                                                        <tr key={order.id} className="hover:bg-blue-500/[0.02] transition-all group">
                                                            <td className="px-8 py-5">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight border",
                                                                    order.type === 'BUY' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                                                )}>{order.type} LIMIT</span>
                                                            </td>
                                                            <td className="px-8 py-5 font-bold text-white text-sm tracking-tight">{formatSymbol(order.symbol)}</td>
                                                            <td className="px-8 py-5 text-blue-400 font-mono text-sm">₹{order.targetPrice.toFixed(2)}</td>
                                                            <td className="px-8 py-5 text-center text-slate-300 font-bold font-mono text-sm">{order.quantity}</td>
                                                            <td className="px-8 py-5 text-right font-bold text-white">₹{formatIndianNumber(order.targetPrice * order.quantity)}</td>
                                                            <td className="px-8 py-5 text-right">
                                                                <button
                                                                    onClick={async () => {
                                                                        if (confirm('Cancel this algorithmic trigger?')) {
                                                                            const res = await fetch(`/api/trade/limit?id=${order.id}`, { method: 'DELETE' });
                                                                            if (res.ok) fetchPortfolio();
                                                                        }
                                                                    }}
                                                                    className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-white/10"
                                                                >
                                                                    <Ban size={12} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                )}
                            </div>

                            <div className="space-y-10">
                                <section className="glass-morphic-card rounded-[32px] p-8 border-blue-500/10">
                                    <FinanceManagement onDepositSuccess={fetchPortfolio} />
                                </section>

                                <section className="glass-morphic-card rounded-[32px] p-8 border-indigo-500/10 h-[500px] flex flex-col">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <PieChartIcon size={20} className="text-indigo-500" />
                                            <h2 className="text-lg font-bold text-white tracking-tight">Concentration Hub</h2>
                                        </div>
                                        <ResetPortfolioButton onReset={fetchPortfolio} />
                                    </div>

                                    <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar overflow-x-hidden">
                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Sector Allocation</div>
                                            <div className="h-[140px]">
                                                <ConcentrationChart 
                                                    data={Object.entries(portfolio?.sectorExposure || {}).map(([name, value]) => ({ name, value }))} 
                                                    colors={['#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899']}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Asset Concentration</div>
                                            <div className="h-[140px]">
                                                <ConcentrationChart 
                                                    data={holdings.map((h: any) => ({ name: formatSymbol(h.symbol), value: (h.marketValue / (portfolio?.totalValue || 1)) * 100 }))} 
                                                    colors={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1']}
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white/5 rounded-3xl p-6 border border-white/5 mt-auto">
                                            <div className="flex justify-between items-end mb-4">
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">Safety Grade</span>
                                                <span className="text-2xl font-black text-emerald-400 font-mono leading-none tracking-tighter">
                                                    {Math.min(100, Math.round((analytics?.sharpeRatio || 0) * 40))}<span className="text-[10px] text-slate-600 ml-1">/100</span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000" 
                                                    style={{ width: `${Math.min(100, Math.round((analytics?.sharpeRatio || 0) * 40))}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="glass-morphic-card rounded-[32px] p-8 border-white/5 h-[400px] flex flex-col">
                                    <div className="flex items-center gap-3 mb-6">
                                        <History size={18} className="text-slate-400" />
                                        <h2 className="text-lg font-bold text-white tracking-tight">Recent Activity</h2>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                        <div className="space-y-3">
                                            {Array.isArray(trades) && trades.length > 0 ? trades.map((trade, idx) => (
                                                <TradeItem key={idx} trade={trade} />
                                            )) : (
                                                <div className="py-12 text-center opacity-20">
                                                    <History size={32} className="mx-auto mb-4 text-slate-500" />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">No recent interactions</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>

                        {/* DAILY P&L CALENDAR DRAWER TRIGGER (BELOW PORTFOLIO) */}
                        <div className="glass-morphic-card rounded-[32px] p-6 sm:p-8 border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-black/40 to-teal-950/20 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-500 shadow-2xl">
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 p-8 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                                <CalendarIcon size={180} />
                            </div>

                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                                        <CalendarIcon size={26} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                                                Option A Realized P&L Ledger
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-bold">• Daily Performance Calendar</span>
                                        </div>
                                        <h3 className="text-xl sm:text-2xl font-bold text-white font-outfit uppercase tracking-tight">
                                            Daily Profit & Loss Calendar
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium max-w-xl mt-1 leading-relaxed">
                                            View color-coded daily trading performance, green/red day streaks, weekend activity, and itemized trade logs in a slide-out drawer.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('open-pnl-calendar'))}
                                    className="px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-900/30 flex items-center gap-3 shrink-0 active:scale-95 group-hover:shadow-emerald-500/20 border border-emerald-400/20"
                                >
                                    <CalendarIcon size={16} />
                                    <span>Open P&L Calendar Drawer</span>
                                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="backtest"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="min-h-[600px]"
                    >
                        <BacktestSimulator />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* INTERACTIVE BATCH SELL MODAL */}
            <AnimatePresence>
                {isSellModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-2xl bg-[#0d0e12] border border-rose-500/20 rounded-[32px] overflow-hidden shadow-2xl"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-rose-500/10 via-red-500/5 to-transparent">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                        <ArrowDownRight size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white font-outfit uppercase tracking-tight">
                                            Liquidate Portfolio
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                            Sell Entire Portfolio ({sellItems.length} Stocks) • Custom Quantity Controls
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setIsSellModalOpen(false); setSellResult(null); }}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                                {sellResult ? (
                                    /* RESULT SUCCESS SCREEN */
                                    <div className="text-center space-y-6 py-4">
                                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                                            <CheckCircle2 size={36} />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-white font-outfit uppercase tracking-tight">Positions Liquidated!</h4>
                                            <p className="text-xs text-slate-400 font-medium mt-1">
                                                Successfully executed {sellResult.executedCount} sell orders from your portfolio.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Proceeds Added</div>
                                                <div className="text-sm sm:text-base font-black text-emerald-400">
                                                    ₹{formatIndianNumber(sellResult.totalProceeds || 0)}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Realized P&L</div>
                                                <div className={cn(
                                                    "text-sm sm:text-base font-black",
                                                    (sellResult.totalRealizedPL || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                                                )}>
                                                    {(sellResult.totalRealizedPL || 0) >= 0 ? '+' : ''}₹{formatIndianNumber(sellResult.totalRealizedPL || 0)}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">New Wallet Balance</div>
                                                <div className="text-sm sm:text-base font-black text-white">
                                                    ₹{formatIndianNumber(sellResult.remainingCash || 0)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-left">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                                Executed Sell Orders ({sellResult.executedTrades?.length})
                                            </div>
                                            <div className="max-h-48 overflow-y-auto divide-y divide-white/5 bg-black/40 rounded-xl p-3 border border-white/5 space-y-1">
                                                {sellResult.executedTrades?.map((t: any) => (
                                                    <div key={t.symbol} className="flex items-center justify-between py-2 text-xs">
                                                        <div>
                                                            <span className="font-bold text-white uppercase">{formatSymbol(t.symbol)}</span>
                                                            <span className="text-[10px] text-slate-500 font-mono block">
                                                                {t.quantity} shares @ ₹{t.price?.toFixed(2)}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="font-black text-emerald-400 block">₹{formatIndianNumber(t.totalValue)}</span>
                                                            {t.realizedPL !== undefined && (
                                                                <span className={cn(
                                                                    "text-[10px] font-bold",
                                                                    t.realizedPL >= 0 ? "text-emerald-400" : "text-rose-400"
                                                                )}>
                                                                    {t.realizedPL >= 0 ? '+' : ''}₹{formatIndianNumber(Math.round(t.realizedPL))}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => { setIsSellModalOpen(false); setSellResult(null); }}
                                                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/30"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* PRE-SELL CONFIGURATION FORM */
                                    <>
                                        {/* Portfolio Liquidation Controls Card */}
                                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                    <Wallet size={14} className="text-rose-400" />
                                                    Current Wallet Balance
                                                </div>
                                                <div className="text-base font-black text-white font-mono">
                                                    ₹{formatIndianNumber(currentWalletCash)}
                                                </div>
                                            </div>

                                            {/* Quick Percentage Batch Sell Controls */}
                                            <div className="space-y-2 pt-2 border-t border-white/5">
                                                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                                                    <span className="uppercase tracking-wider">Quick Liquidation Percentage:</span>
                                                    <span className="text-rose-400 font-mono">{liquidationPercent}% of Holdings</span>
                                                </div>

                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5 flex-1">
                                                        {[25, 50, 75, 100].map(pct => (
                                                            <button
                                                                key={pct}
                                                                onClick={() => handleSetLiquidationPercent(pct)}
                                                                className={cn(
                                                                    "flex-1 py-2 rounded-xl text-xs font-black transition-all border",
                                                                    liquidationPercent === pct
                                                                        ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-900/30"
                                                                        : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:text-white"
                                                                )}
                                                            >
                                                                {pct === 100 ? "100% (ALL)" : `${pct}%`}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Select All / Deselect All */}
                                                    <button
                                                        onClick={() => handleToggleAll(enabledSellItems.length !== sellItems.length)}
                                                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider border border-white/5 transition-all whitespace-nowrap"
                                                    >
                                                        {enabledSellItems.length === sellItems.length ? "Deselect All" : "Select All"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Live Prices Status Bar */}
                                        {isLoadingLivePrices && (
                                            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                                                <Loader2 size={14} className="animate-spin" />
                                                <span>Refreshing live market quotes for all positions...</span>
                                            </div>
                                        )}

                                        {/* Interactive Itemized Stock Table */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                                <span>Position Breakdown ({enabledSellItems.length} of {sellItems.length} Selected)</span>
                                                <span>Shares to Sell & P&L</span>
                                            </div>

                                            <div className="max-h-72 overflow-y-auto divide-y divide-white/5 bg-black/40 rounded-2xl border border-white/10 custom-scrollbar">
                                                {sellItems.map((item) => {
                                                    const itemProceeds = item.quantity * item.currentPrice;
                                                    const itemPL = (item.currentPrice - item.averagePrice) * item.quantity;
                                                    const itemPLPct = item.averagePrice > 0 ? ((item.currentPrice - item.averagePrice) / item.averagePrice) * 100 : 0;
                                                    const isProfitable = itemPL >= 0;

                                                    return (
                                                        <div
                                                            key={item.symbol}
                                                            className={cn(
                                                                "p-3 sm:p-4 flex items-center justify-between gap-4 transition-colors",
                                                                item.enabled ? "bg-white/[0.01]" : "opacity-40 bg-black/20"
                                                            )}
                                                        >
                                                            {/* Checkbox & Symbol Info */}
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <button
                                                                    onClick={() => handleToggleStock(item.symbol)}
                                                                    className="text-slate-400 hover:text-rose-400 transition-colors shrink-0"
                                                                >
                                                                    {item.enabled ? (
                                                                        <CheckSquare size={18} className="text-rose-500" />
                                                                    ) : (
                                                                        <Square size={18} className="text-slate-600" />
                                                                    )}
                                                                </button>

                                                                <div className="min-w-0">
                                                                    <div className="font-black text-white text-sm uppercase tracking-tight flex items-center gap-2">
                                                                        {formatSymbol(item.symbol)}
                                                                        <span className="text-[10px] text-slate-400 font-mono font-normal">
                                                                            @ ₹{item.currentPrice.toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                                                            Entry: ₹{item.averagePrice.toFixed(1)}
                                                                        </span>
                                                                        <span className="text-[9px] font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                                                                            Held: {item.heldQuantity}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Quantity Adjust Controls */}
                                                            <div className="flex items-center gap-1.5">
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
                                                                    min={0}
                                                                    max={item.heldQuantity}
                                                                    onChange={e => handleQuantityChange(item.symbol, Number(e.target.value))}
                                                                    className="w-14 py-1 text-center bg-black/60 border border-white/10 rounded-lg text-white font-mono text-xs font-bold focus:border-rose-500 focus:outline-none"
                                                                />

                                                                <button
                                                                    onClick={() => handleQuantityChange(item.symbol, item.quantity + 1)}
                                                                    disabled={!item.enabled || item.quantity >= item.heldQuantity}
                                                                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 flex items-center justify-center transition-all border border-white/5"
                                                                >
                                                                    <Plus size={12} />
                                                                </button>

                                                                <button
                                                                    onClick={() => handleQuantityChange(item.symbol, item.heldQuantity)}
                                                                    disabled={!item.enabled || item.quantity === item.heldQuantity}
                                                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-[9px] font-black text-slate-400 hover:text-rose-400 border border-white/5 transition-all disabled:opacity-30"
                                                                >
                                                                    MAX
                                                                </button>
                                                            </div>

                                                            {/* Item Proceeds & Realized PL */}
                                                            <div className="text-right shrink-0 w-28">
                                                                <div className="text-xs font-black text-white font-mono">
                                                                    ₹{formatIndianNumber(itemProceeds)}
                                                                </div>
                                                                <div className={cn(
                                                                    "text-[9px] font-bold font-mono tracking-tight",
                                                                    isProfitable ? "text-emerald-400" : "text-rose-400"
                                                                )}>
                                                                    {isProfitable ? '+' : ''}₹{formatIndianNumber(Math.round(itemPL))} ({itemPLPct.toFixed(1)}%)
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Total Summary Footer */}
                                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-300 font-bold uppercase tracking-wider">Total Proceeds (Wallet Credit):</span>
                                                <span className="font-mono font-black text-sm text-emerald-400">
                                                    +₹{formatIndianNumber(totalSellProceeds)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>Estimated Realized Net P&L:</span>
                                                <span className={cn("font-mono font-bold", totalSellRealizedPL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                                    {totalSellRealizedPL >= 0 ? '+' : ''}₹{formatIndianNumber(Math.round(totalSellRealizedPL))}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>Projected Wallet Balance:</span>
                                                <span className="font-mono font-bold text-white">
                                                    ₹{formatIndianNumber(projectedWalletCash)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => setIsSellModalOpen(false)}
                                                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleExecuteSell}
                                                disabled={isExecutingSell || activeSellCount === 0}
                                                className="flex-1 py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-40 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-rose-900/40 flex items-center justify-center gap-2 active:scale-95"
                                            >
                                                {isExecutingSell ? (
                                                    <div className="w-4 h-4"><GlobalLoader minimal={true} /></div>
                                                ) : <ArrowDownRight size={16} />}
                                                {isExecutingSell ? "Liquidating Positions..." : `Liquidate ${activeSellCount} Stocks`}
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

function TradeItem({ trade }: { trade: any }) {
    const isBuy = trade.type === 'BUY';
    const hasPL = trade.realizedPL !== undefined && trade.realizedPL !== null;
    
    return (
        <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 rounded-2xl p-4 transition-all group">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-[8px] font-black uppercase px-2 py-0.5 rounded border",
                        isBuy ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    )}>{trade.type}</span>
                    <span className="text-sm font-bold text-white tracking-tight">{formatSymbol(trade.symbol)}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[8px] text-slate-600 font-bold uppercase">{new Date(trade.timestamp).toLocaleDateString()}</span>
                    {hasPL && (
                        <span className={cn(
                            "text-[9px] font-black",
                            trade.realizedPL >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {trade.realizedPL >= 0 ? '+' : ''}₹{formatIndianNumber(Math.round(trade.realizedPL))}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex justify-between items-end">
                <div className="text-[10px] text-slate-400 font-mono">
                    {trade.quantity} @ ₹{trade.price.toFixed(1)}
                </div>
                <div className="text-xs font-black text-white font-outfit tracking-tight">
                    ₹{formatIndianNumber(trade.totalValue)}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, indicator, subIndicator, color }: { title: string; value: string; indicator: string; subIndicator?: string; color: 'emerald' | 'blue' }) {
    const colorClass = color === 'emerald' ? 'text-emerald-400 bg-emerald-400/10' : 'text-blue-400 bg-blue-400/10';
    return (
        <div className="glass-morphic-card rounded-[24px] p-6 group hover:border-white/20 transition-all duration-500 shadow-sm">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 group-hover:text-slate-300 transition-colors">{title}</div>
            <div className="flex items-baseline justify-between gap-4">
                <div className="text-2xl font-black text-white font-outfit tracking-tighter">{value}</div>
                <div className="flex flex-col items-end gap-1">
                    <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-tight ${colorClass}`}>{indicator}</div>
                    {subIndicator && (
                        <div className="text-[9px] font-bold text-slate-600 uppercase tracking-tight text-right leading-tight max-w-[80px]">{subIndicator}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ResetPortfolioButton({ onReset }: { onReset: () => void }) {
    const [isResetting, setIsResetting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleReset = async () => {
        setIsResetting(true);
        try {
            const res = await fetch('/api/portfolio/reset', { method: 'POST' });
            if (res.ok) {
                onReset();
                setShowConfirm(false);
            }
        } catch (err) {
            console.error("Reset failed", err);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowConfirm(!showConfirm)}
                className="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all border border-white/10"
                title="Reset Portfolio"
            >
                <RotateCcw size={16} />
            </button>

            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute right-0 top-12 bg-[#0a0a0c] border border-rose-500/20 rounded-2xl p-4 shadow-2xl z-50 w-60 text-left backdrop-blur-xl"
                    >
                        <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-2">Nuclear Reset?</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed mb-4">This will wipe all holdings and history, resetting balance to 10 Lakhs. <span className="text-rose-400">Irreversible action.</span></p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleReset}
                                disabled={isResetting}
                                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                {isResetting ? (
                                   <div className="w-2.5 h-2.5"><GlobalLoader minimal={true} /></div>
                                ) : "Confirm Reset"}
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function HoldingRow({ holding, portfolioTotalValue, onTradeSuccess }: any) {
    const { symbol, quantity: qty, averagePrice: avg, currentPrice: cur, marketValue: val, unrealizedPL: pl, unrealizedPLPercent: plp } = holding;
    const isPositive = pl >= 0;
    const [isSelling, setIsSelling] = useState(false);
    const [sellQty, setSellQty] = useState(1);
    const [showSellAction, setShowSellAction] = useState(false);

    const weight = (val / portfolioTotalValue) * 100;
    const dayChangePercent = holding.dayChangePercent || 0;

    const handleSell = async () => {
        setIsSelling(true);
        try {
            const res = await fetch('/api/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, quantity: sellQty, type: 'SELL' })
            });
            if (res.ok) {
                onTradeSuccess();
                setShowSellAction(false);
            }
        } catch (err) {
            console.error("Sell failed", err);
        } finally {
            setIsSelling(false);
        }
    };

    return (
        <tr className="hover:bg-white/[0.03] transition-all group border-b border-white/[0.02] h-16">
            <td className="px-6 py-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center font-black text-[10px] text-slate-400 group-hover:from-blue-600/20 group-hover:to-blue-600/5 group-hover:text-blue-400 transition-all duration-500 border border-white/5">
                        {formatSymbol(symbol)[0]}
                    </div>
                    <div className="min-w-0">
                        <Link href={`/stock/${symbol}`} className="font-black text-white text-[13px] tracking-tight group-hover:text-blue-400 transition-colors uppercase block leading-none">
                            {formatSymbol(symbol)}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[7px] font-black text-slate-500 bg-white/5 px-1 rounded uppercase tracking-widest">NSE</span>
                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tight truncate max-w-[80px]">Equity Asset</span>
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-2">
                <div className="flex flex-col gap-1 w-20">
                    <div className="text-[11px] font-black text-white font-mono leading-none">
                        {weight.toFixed(1)}%
                    </div>
                    <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${weight}%` }}
                            className="h-full bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.4)]" 
                        />
                    </div>
                </div>
            </td>
            <td className="px-6 py-2">
                <div className="space-y-1">
                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] leading-none">
                        ENTRY <span className="text-white font-mono ml-1">₹{avg.toLocaleString()}</span>
                    </div>
                    <div className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black tracking-tighter border",
                        isPositive ? "text-emerald-400 bg-emerald-400/5 border-emerald-400/10" : "text-rose-400 bg-rose-400/5 border-rose-400/10"
                    )}>
                        {isPositive ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
                        ₹{formatIndianNumber(Math.abs(Math.round(pl)))} ({plp.toFixed(1)}%)
                    </div>
                </div>
            </td>
            <td className="px-6 py-2">
                <div className="font-black text-white text-[13px] tracking-tight font-mono leading-none">
                    ₹{cur.toLocaleString()}
                </div>
                <div className={cn(
                    "text-[9px] font-bold mt-0.5",
                    dayChangePercent >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'
                )}>
                    {dayChangePercent >= 0 ? '▲' : '▼'} {Math.abs(dayChangePercent).toFixed(1)}%
                </div>
            </td>
            <td className="px-6 py-2 text-right">
                <div className="font-black text-white text-sm tracking-tighter font-outfit leading-none mb-1">
                    ₹{formatIndianNumber(val)}
                </div>
                <div className="text-[8px] text-slate-600 font-black uppercase tracking-[0.25em]">
                    {qty} UNITS HELD
                </div>
            </td>
            <td className="px-6 py-2 text-right relative">
                <div className="flex items-center justify-end gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity duration-300">
                    <Link
                        href={`/stock/${symbol}`}
                        className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-white transition-all border border-white/5"
                    >
                        <Plus size={12} />
                    </Link>
                    <button
                        onClick={() => setShowSellAction(!showSellAction)}
                        className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-rose-400 transition-all border border-white/5"
                    >
                        <ShoppingCart size={12} />
                    </button>
                    <button className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-white transition-all border border-white/5">
                        <MoreHorizontal size={12} />
                    </button>
                </div>

                <AnimatePresence>
                    {showSellAction && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, x: 10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, x: 10 }}
                            className="absolute right-6 top-12 bg-[#0a0a0c]/98 border border-white/10 rounded-2xl p-4 shadow-3xl z-50 w-52 text-left backdrop-blur-3xl"
                        >
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Liquidate Inventory</label>
                            <div className="flex items-center gap-2 mb-3">
                                <input
                                    type="number"
                                    value={sellQty}
                                    max={qty}
                                    min={1}
                                    onChange={(e) => setSellQty(Math.min(qty, Math.max(1, parseInt(e.target.value) || 0)))}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 font-mono font-bold"
                                />
                                <button onClick={() => setSellQty(qty)} className="text-[8px] font-black text-blue-500 hover:text-white uppercase">ALL</button>
                            </div>
                            <button
                                onClick={handleSell}
                                disabled={isSelling}
                                className="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-[9px] font-black uppercase tracking-widest text-white shadow-lg"
                            >
                                Confirm Exit
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </td>
        </tr>
    );
}

function FinanceManagement({ onDepositSuccess }: { onDepositSuccess: () => void }) {
    const [amount, setAmount] = useState(100000);
    const [isDepositing, setIsDepositing] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    const presets = [
        { label: '1L', value: 100000 },
        { label: '5L', value: 500000 },
        { label: '10L', value: 1000000 }
    ];

    const handleDeposit = async () => {
        setIsDepositing(true);
        setStatus({ type: null, message: '' });
        try {
            const res = await fetch('/api/portfolio/add-funds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: 'Liquidity injected successfully' });
                onDepositSuccess();
                setTimeout(() => setStatus({ type: null, message: '' }), 3000);
            } else {
                setStatus({ type: 'error', message: data.error || 'Infection failed' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Network bottleneck' });
        } finally {
            setIsDepositing(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <Coins size={20} className="text-emerald-500" />
                <h2 className="text-lg font-bold text-white tracking-tight">Virtual Treasury</h2>
            </div>

            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Capital Injection</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-sm">₹</div>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-8 pr-4 py-4 text-white font-mono font-bold focus:outline-none focus:border-emerald-500 transition-all text-xl shadow-inner group-hover:bg-white/[0.08]"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {presets.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setAmount(p.value)}
                            className={cn(
                                "py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all active:scale-95",
                                amount === p.value
                                    ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-900/40"
                                    : "bg-white/5 border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleDeposit}
                    disabled={isDepositing || amount <= 0}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-emerald-900/20"
                >
                    {isDepositing ? (
                        <div className="w-4 h-4"><GlobalLoader minimal={true} /></div>
                    ) : <Plus size={16} />}
                    Inject Capital
                </button>

                <AnimatePresence>
                    {status.type && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn(
                                "p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3",
                                status.type === 'success'
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            )}
                        >
                            {status.type === 'success' ? <TrendingUp size={16} /> : <ShieldAlert size={16} />}
                            {status.message}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function ConcentrationChart({ data, colors }: { data: any[]; colors: string[] }) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full opacity-20">
                <PieChartIcon size={40} className="text-slate-500" strokeWidth={1} />
            </div>
        );
    }

    const total = data.reduce((acc, d) => acc + d.value, 0);
    const sortedRaw = [...data].sort((a, b) => b.value - a.value);
    const top5 = sortedRaw.slice(0, 5);
    const othersValue = sortedRaw.slice(5).reduce((acc, d) => acc + d.value, 0);
    
    const sortedData = othersValue > 0 
        ? [...top5, { name: 'Others', value: othersValue }]
        : top5;

    return (
        <div className="flex h-full items-center gap-2">
            <div className="w-[45%] h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                            data={sortedData}
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="80%"
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                        >
                            {sortedData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} className="focus:outline-none" />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#0a0a0c', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                padding: '8px 12px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                            }}
                            itemStyle={{ color: '#fff' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="w-[55%] space-y-2">
                {sortedData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between group" title={entry.name}>
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate group-hover:text-slate-300 transition-colors">{entry.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-white font-mono ml-2 shrink-0">{((entry.value / total) * 100).toFixed(0)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PerformanceCurve({ data }: { data: any[] }) {
    if (!data || data.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center h-[280px] opacity-30 gap-4 bg-slate-900/10 rounded-3xl border border-white/5">
                <TrendingUp size={48} className="text-slate-500" strokeWidth={1} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Awaiting Signal</span>
            </div>
        );
    }
    
    return (
        <div className="w-full h-[280px] relative">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <AreaChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['dataMin - 10000', 'dataMax + 10000']} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                        itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                        formatter={(value: any) => [`₹${formatIndianNumber(Math.round(Number(value)))}`, 'Value']}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="nav" 
                        stroke="#10b981" 
                        strokeWidth={6}
                        fill="#10b981"
                        fillOpacity={0.2}
                        animationDuration={0}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
