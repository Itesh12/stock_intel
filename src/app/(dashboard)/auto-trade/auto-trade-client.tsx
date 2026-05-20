"use client";

import React, { useState, useEffect } from "react";
import { 
    Bot, 
    Plus, 
    Play, 
    Pause, 
    Trash2, 
    Settings, 
    History, 
    AlertTriangle, 
    Activity, 
    DollarSign, 
    ArrowUpRight, 
    ArrowDownRight, 
    CheckCircle2, 
    Info,
    RefreshCw,
    TrendingUp,
    Edit3,
    X
} from "lucide-react";
import { formatCurrency, formatSymbol } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Strategy {
    id: string;
    slug: string;
    name: string;
    riskLevel: string;
    winRate: string;
    objective: string;
}

interface BotActiveHolding {
    symbol: string;
    quantity: number;
    buyPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    purchaseDate: string;
}

interface BotData {
    id: string;
    name: string;
    strategySlug: string;
    strategyName: string;
    status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
    capitalAllocated: number;
    maxPositionSizePercent: number;
    riskPerTradePercent: number;
    maxTradesPerDay: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    minConfluenceScore: number;
    totalTradesExecuted: number;
    winCount: number;
    lossCount: number;
    totalPnL: number;
    todayTradeCount: number;
    createdAt: string;
    activeHoldings?: BotActiveHolding[];
}

interface Trade {
    id: string;
    symbol: string;
    quantity: number;
    price: number;
    totalValue: number;
    type: 'BUY' | 'SELL';
    timestamp: string;
    realizedPL?: number;
}

export default function AutoTradeClient({
    initialBots,
    initialStrategies,
    cashBalance
}: {
    initialBots: BotData[];
    initialStrategies: Strategy[];
    cashBalance: number;
}) {
    const [bots, setBots] = useState<BotData[]>(initialBots);
    const [currentCashBalance, setCurrentCashBalance] = useState(cashBalance);
    const [activeTab, setActiveTab] = useState<'bots' | 'create' | 'history'>('bots');
    const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
    const [historyTrades, setHistoryTrades] = useState<Trade[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // Form State
    const [formName, setFormName] = useState("");
    const [formStrategySlug, setFormStrategySlug] = useState(initialStrategies[0]?.slug || "");
    const [formCapital, setFormCapital] = useState(Math.min(100000, cashBalance));
    const [formMaxPosPercent, setFormMaxPosPercent] = useState(20);
    const [formRiskPercent, setFormRiskPercent] = useState(2);
    const [formMaxTrades, setFormMaxTrades] = useState(3);
    const [formStopLoss, setFormStopLoss] = useState(7);
    const [formTakeProfit, setFormTakeProfit] = useState(15);
    const [formMinScore, setFormMinScore] = useState(70);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Edit Modal State
    const [editingBot, setEditingBot] = useState<BotData | null>(null);
    const [editName, setEditName] = useState("");
    const [editCapital, setEditCapital] = useState(0);
    const [editMinScore, setEditMinScore] = useState(0);
    const [editMaxPosPercent, setEditMaxPosPercent] = useState(0);
    const [editMaxTrades, setEditMaxTrades] = useState(0);
    const [editStopLoss, setEditStopLoss] = useState(0);
    const [editTakeProfit, setEditTakeProfit] = useState(0);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Details Modal/Drawer State
    const [detailsBot, setDetailsBot] = useState<BotData | null>(null);

    // Sync detailsBot when bots updates (e.g., auto refresh)
    useEffect(() => {
        if (detailsBot) {
            const updated = bots.find(b => b.id === detailsBot.id);
            if (updated) {
                setDetailsBot(updated);
            }
        }
    }, [bots, detailsBot?.id]);

    const handleRefreshStats = async () => {
        setIsRefreshing(true);
        try {
            const [listRes, portRes] = await Promise.all([
                fetch("/api/auto-trade"),
                fetch("/api/portfolio/me")
            ]);
            if (listRes.ok) {
                const refreshedBots = await listRes.json();
                setBots(refreshedBots);
            }
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }
        } catch (err) {
            console.error("Manual refresh failed:", err);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-refresh stats every 10 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const [listRes, portRes] = await Promise.all([
                    fetch("/api/auto-trade"),
                    fetch("/api/portfolio/me")
                ]);
                if (listRes.ok) {
                    const refreshedBots = await listRes.json();
                    setBots(refreshedBots);
                }
                if (portRes.ok) {
                    const portData = await portRes.json();
                    setCurrentCashBalance(portData.cashBalance);
                }
            } catch (err) {
                console.error("Auto-refresh failed:", err);
            }
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleStartEdit = (bot: BotData) => {
        setEditingBot(bot);
        setEditName(bot.name);
        setEditCapital(bot.capitalAllocated);
        setEditMinScore(bot.minConfluenceScore);
        setEditMaxPosPercent(bot.maxPositionSizePercent);
        setEditMaxTrades(bot.maxTradesPerDay);
        setEditStopLoss(bot.stopLossPercent);
        setEditTakeProfit(bot.takeProfitPercent);
        setEditError(null);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBot) return;
        setIsSavingEdit(true);
        setEditError(null);

        if (editCapital > currentCashBalance) {
            setEditError(`Capital allocated exceeds current portfolio cash balance (${formatCurrency(currentCashBalance)})`);
            setIsSavingEdit(false);
            return;
        }

        try {
            const res = await fetch(`/api/auto-trade/${editingBot.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName,
                    capitalAllocated: Number(editCapital),
                    maxPositionSizePercent: Number(editMaxPosPercent),
                    maxTradesPerDay: Number(editMaxTrades),
                    stopLossPercent: Number(editStopLoss),
                    takeProfitPercent: Number(editTakeProfit),
                    minConfluenceScore: Number(editMinScore),
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to update bot");
            }

            setBots(prev => prev.map(b => b.id === editingBot.id ? data : b));
            setEditingBot(null);

            // Fetch updated cash balance
            const portRes = await fetch("/api/portfolio/me");
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }
        } catch (err: any) {
            setEditError(err.message);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Fetch history for selected bot
    useEffect(() => {
        if (selectedBotId) {
            setLoadingHistory(true);
            fetch(`/api/auto-trade/${selectedBotId}/history`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setHistoryTrades(data);
                    }
                })
                .catch(err => console.error("Error loading history:", err))
                .finally(() => setLoadingHistory(false));
        } else {
            setHistoryTrades([]);
        }
    }, [selectedBotId]);

    // Handle bot creation
    const handleCreateBot = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError(null);
        setFormSuccess(null);

        if (formCapital > currentCashBalance) {
            setFormError(`Capital allocated exceeds current portfolio cash balance (${formatCurrency(currentCashBalance)})`);
            setIsSubmitting(false);
            return;
        }

        try {
            const res = await fetch("/api/auto-trade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formName,
                    strategySlug: formStrategySlug,
                    capitalAllocated: Number(formCapital),
                    maxPositionSizePercent: Number(formMaxPosPercent),
                    riskPerTradePercent: Number(formRiskPercent),
                    maxTradesPerDay: Number(formMaxTrades),
                    stopLossPercent: Number(formStopLoss),
                    takeProfitPercent: Number(formTakeProfit),
                    minConfluenceScore: Number(formMinScore),
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to launch bot");
            }

            setBots(prev => [data, ...prev]);
            setFormSuccess(`Bot "${formName}" successfully deployed and activated!`);
            // Reset
            setFormName("");

            // Fetch updated cash balance
            const portRes = await fetch("/api/portfolio/me");
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }

            setTimeout(() => {
                setActiveTab('bots');
                setFormSuccess(null);
            }, 1500);
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Toggle Bot Status
    const handleToggleStatus = async (botId: string, currentStatus: string) => {
        setActionLoading(botId);
        const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        try {
            const res = await fetch(`/api/auto-trade/${botId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus })
            });

            if (res.ok) {
                const updated = await res.json();
                setBots(prev => prev.map(b => b.id === botId ? updated : b));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    // Delete Bot
    const handleDeleteBot = async (botId: string) => {
        if (!confirm("Are you sure you want to permanently delete this bot? All configurations will be lost.")) return;
        setActionLoading(botId);
        try {
            const res = await fetch(`/api/auto-trade/${botId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                setBots(prev => prev.filter(b => b.id !== botId));
                if (selectedBotId === botId) {
                    setSelectedBotId(null);
                }

                // Fetch updated cash balance
                const portRes = await fetch("/api/portfolio/me");
                if (portRes.ok) {
                    const portData = await portRes.json();
                    setCurrentCashBalance(portData.cashBalance);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    // Trigger Manual Run for testing
    const handleManualTrigger = async () => {
        setActionLoading("trigger");
        try {
            const res = await fetch("/api/auto-trade/trigger", {
                method: "POST"
            });
            const data = await res.json();
            alert(`Trigger complete!\nLimit order checks: Executed ${data.limitOrders?.executed || 0}, Failed ${data.limitOrders?.failed || 0}`);
            
            // Refresh bot list and cash balance
            const [listRes, portRes] = await Promise.all([
                fetch("/api/auto-trade"),
                fetch("/api/portfolio/me")
            ]);
            if (listRes.ok) {
                const refreshedBots = await listRes.json();
                setBots(refreshedBots);
            }
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }
        } catch (err) {
            console.error(err);
            alert("Trigger failed. Check logs.");
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-[1400px] mx-auto px-4 sm:px-6 py-4 md:py-6 pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                        <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity size={10} className="animate-pulse" /> Live Simulation
                        </div>
                        <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-semibold text-indigo-400 uppercase tracking-wider">
                            v1.1.0-beta
                        </div>
                        <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Bot size={12} /> {bots.length} Active Bots
                        </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tighter font-outfit flex items-center gap-4">
                        Auto Trade Hub <Bot className="text-indigo-400" size={40} />
                    </h1>
                    <p className="text-slate-500 text-sm font-medium max-w-2xl">
                        Deploy algorithmic execution agents on your quant scanner models. Bots will scan, size positions, execute trades, and manage target exits/stop-losses in your virtual portfolio automatically.
                    </p>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={handleManualTrigger}
                        disabled={actionLoading === "trigger"}
                        className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 flex items-center gap-2 transition-all"
                    >
                        <RefreshCw size={16} className={cn("text-slate-400", actionLoading === "trigger" && "animate-spin")} />
                        {actionLoading === "trigger" ? "Running Engine..." : "Trigger Manual Scan"}
                    </button>
                    <button 
                        onClick={() => setActiveTab('create')}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all"
                    >
                        <Plus size={16} /> Deploy New Bot
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Capital</span>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">{formatCurrency(currentCashBalance)}</h3>
                    <p className="text-xs text-slate-500 mt-2 font-medium">Virtual cash balance available for bot allocation</p>
                </div>

                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bots Performance</span>
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    {(() => {
                        const totalPnL = bots.reduce((sum, b) => sum + b.totalPnL, 0);
                        const isProfit = totalPnL >= 0;
                        return (
                            <>
                                <h3 className={cn("text-2xl font-bold tracking-tight flex items-center gap-1", isProfit ? "text-emerald-400" : "text-rose-400")}>
                                    {isProfit ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                                    {formatCurrency(totalPnL)}
                                </h3>
                                <p className="text-xs text-slate-500 mt-2 font-medium">Combined realized returns from all active & stopped bots</p>
                            </>
                        );
                    })()}
                </div>

                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Bot Trades</span>
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <Activity size={16} />
                        </div>
                    </div>
                    {(() => {
                        const totalTrades = bots.reduce((sum, b) => sum + b.totalTradesExecuted, 0);
                        const wins = bots.reduce((sum, b) => sum + b.winCount, 0);
                        const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0.0";
                        return (
                            <>
                                <h3 className="text-2xl font-bold text-white tracking-tight">{totalTrades} Executed</h3>
                                <p className="text-xs text-slate-500 mt-2 font-medium">Win Rate: <span className="text-emerald-400 font-semibold">{winRate}%</span> across all bots</p>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-2">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('bots')}
                        className={cn(
                            "px-6 py-3 font-semibold text-sm rounded-xl transition-all flex items-center gap-2",
                            activeTab === 'bots' ? "bg-white/5 text-white border border-white/10" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <Bot size={16} /> My Trading Bots
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={cn(
                            "px-6 py-3 font-semibold text-sm rounded-xl transition-all flex items-center gap-2",
                            activeTab === 'create' ? "bg-white/5 text-white border border-white/10" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <Plus size={16} /> Deploy Configuration
                    </button>
                    {selectedBotId && (
                        <button
                            onClick={() => setActiveTab('history')}
                            className={cn(
                                "px-6 py-3 font-semibold text-sm rounded-xl transition-all flex items-center gap-2",
                                activeTab === 'history' ? "bg-white/5 text-white border border-white/10" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            <History size={16} /> Bot History: {bots.find(b => b.id === selectedBotId)?.name}
                        </button>
                    )}
                </div>
                <button
                    onClick={handleRefreshStats}
                    disabled={isRefreshing}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-2 self-start sm:self-auto shadow-md"
                >
                    <RefreshCw size={12} className={cn(isRefreshing && "animate-spin")} />
                    {isRefreshing ? "Refreshing..." : "Refresh Stats"}
                </button>
            </div>

            {/* Content Area */}
            <div className="mt-6">
                <AnimatePresence mode="wait">
                    {/* MY BOTS TAB */}
                    {activeTab === 'bots' && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {bots.length === 0 ? (
                                <div className="glass-morphic-card p-12 text-center rounded-[32px] border-white/5 flex flex-col items-center">
                                    <Bot size={48} className="text-slate-600 mb-4" />
                                    <h3 className="text-lg font-bold text-white mb-2">No Active Trading Bots</h3>
                                    <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                                        You haven't deployed any automated execution configurations yet. Set up a bot to trade scanner alerts automatically.
                                    </p>
                                    <button 
                                        onClick={() => setActiveTab('create')}
                                        className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Launch Your First Bot
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {bots.map((bot) => (
                                        <BotCard 
                                            key={bot.id} 
                                            bot={bot} 
                                            onToggleStatus={handleToggleStatus} 
                                            onDelete={handleDeleteBot}
                                            onEdit={handleStartEdit}
                                            onShowDetails={setDetailsBot}
                                            onViewHistory={(id) => {
                                                setSelectedBotId(id);
                                                setActiveTab('history');
                                            }}
                                            actionLoading={actionLoading}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* DEPLOY BOT TAB */}
                    {activeTab === 'create' && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="glass-morphic-card p-8 sm:p-10 rounded-[32px] border-white/5 max-w-4xl"
                        >
                            <h2 className="text-2xl font-bold text-white mb-2 font-outfit flex items-center gap-2">
                                <Plus className="text-indigo-400" size={24} /> Configure Algorithmic Bot
                            </h2>
                            <p className="text-slate-500 text-sm mb-8">
                                Define capital, risk settings, entry thresholds, and target levels. Bots run indefinitely, checking strategy scanner outputs on every scheduled cycle.
                            </p>

                            <form onSubmit={handleCreateBot} className="space-y-8">
                                {formError && (
                                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2.5">
                                        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                                        <span>{formError}</span>
                                    </div>
                                )}

                                {formSuccess && (
                                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2.5">
                                        <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                                        <span>{formSuccess}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bot Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            placeholder="e.g. Swing Breakout Alpha"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Strategy Source</label>
                                        <select
                                            value={formStrategySlug}
                                            onChange={(e) => setFormStrategySlug(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                        >
                                            {initialStrategies.map((s) => (
                                                <option key={s.slug} value={s.slug} className="bg-slate-950 text-white">
                                                    {s.name} ({s.winRate})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Capital Allocated (INR)</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formatCurrency(formCapital)}</span>
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min={5000}
                                            max={Math.max(5000, currentCashBalance)}
                                            value={formCapital}
                                            onChange={(e) => setFormCapital(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                        />
                                        {currentCashBalance < 5000 ? (
                                            <div className="text-xs text-rose-400 font-semibold mt-2 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                                <span>Your portfolio's cash balance ({formatCurrency(currentCashBalance)}) is below the minimum required ₹5,000. Go to the <Link href="/portfolio" className="text-indigo-400 underline hover:text-indigo-300">Portfolio</Link> page to inject capital.</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-slate-500 font-medium block mt-1">Max budget available to this bot for purchases. Available cash: {formatCurrency(currentCashBalance)}</span>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Min Confluence Score to enter</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formMinScore} / 100</span>
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                min={50}
                                                max={90}
                                                step={5}
                                                value={formMinScore}
                                                onChange={(e) => setFormMinScore(Number(e.target.value))}
                                                className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">Min score recommended by strategy engine to filter trade entries.</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-white/5 pt-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Max Position Size</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formMaxPosPercent}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min={5}
                                            max={100}
                                            step={5}
                                            value={formMaxPosPercent}
                                            onChange={(e) => setFormMaxPosPercent(Number(e.target.value))}
                                            className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-500 font-medium">Max allocation per single stock purchase.</span>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Risk Per Trade</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formRiskPercent}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min={0.5}
                                            max={5}
                                            step={0.5}
                                            value={formRiskPercent}
                                            onChange={(e) => setFormRiskPercent(Number(e.target.value))}
                                            className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-500 font-medium">Capital risk margin per setup.</span>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Max Trades / Day</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formMaxTrades} trades</span>
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min={1}
                                            max={10}
                                            value={formMaxTrades}
                                            onChange={(e) => setFormMaxTrades(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Stop Loss Trigger</span>
                                            <span className="text-rose-400 font-bold font-mono">-{formStopLoss}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min={2}
                                            max={15}
                                            step={0.5}
                                            value={formStopLoss}
                                            onChange={(e) => setFormStopLoss(Number(e.target.value))}
                                            className="w-full accent-rose-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-500 font-medium">Triggers automated sell limit when price falls by this percent.</span>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Take Profit Target</span>
                                            <span className="text-emerald-400 font-bold font-mono">+{formTakeProfit}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min={5}
                                            max={30}
                                            step={1}
                                            value={formTakeProfit}
                                            onChange={(e) => setFormTakeProfit(Number(e.target.value))}
                                            className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-500 font-medium">Triggers exit order when stock rises to target.</span>
                                    </div>
                                </div>

                                <div className="border-t border-white/5 pt-6 flex justify-end gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setActiveTab('bots')}
                                        className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                                    >
                                        {isSubmitting ? "Deploying..." : "Launch Bot Instance"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {/* BOT HISTORY TAB */}
                    {activeTab === 'history' && selectedBotId && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="glass-morphic-card rounded-[32px] overflow-hidden border-white/5"
                        >
                            <div className="p-6 md:p-8 bg-white/[0.01] border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white font-outfit">
                                        Trade Log: {bots.find(b => b.id === selectedBotId)?.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                        Chronological list of all executions performed by this automated strategy bot.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setSelectedBotId(null)}
                                    className="text-xs font-semibold text-slate-400 hover:text-white bg-white/5 px-4 py-2 rounded-xl transition-all"
                                >
                                    Close Logs
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                {loadingHistory ? (
                                    <div className="p-20 text-center text-slate-500 text-sm font-medium flex justify-center items-center gap-2">
                                        <RefreshCw className="animate-spin text-slate-500" size={18} /> Loading execution log...
                                    </div>
                                ) : historyTrades.length === 0 ? (
                                    <div className="p-20 text-center text-slate-500 text-sm font-medium flex flex-col items-center">
                                        <Activity size={32} className="text-slate-700 mb-3" />
                                        No executions recorded yet. This bot is waiting for qualified strategy signals.
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                                                <th className="px-6 py-4 md:py-5 font-bold">Execution Date</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Symbol</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Type</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Shares</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Execution Price</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Total Value</th>
                                                <th className="px-6 py-4 md:py-5 font-bold text-right">Realized Return</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-sm">
                                            {historyTrades.map((t) => (
                                                <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="px-6 py-4 text-slate-400 font-medium">
                                                        {new Date(t.timestamp).toLocaleString("en-IN", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            hour: "2-digit",
                                                            minute: "2-digit"
                                                        })}
                                                    </td>
                                                    <td className="px-6 py-4 text-white font-bold tracking-tight">
                                                        {formatSymbol(t.symbol)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-bold tracking-wider",
                                                            t.type === 'BUY' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                                        )}>
                                                            {t.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-300 font-mono font-medium">
                                                        {t.quantity}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-300 font-mono font-medium">
                                                        {formatCurrency(t.price)}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-300 font-mono font-medium">
                                                        {formatCurrency(t.totalValue)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {t.realizedPL !== undefined ? (
                                                            <span className={cn(
                                                                "font-mono font-bold",
                                                                t.realizedPL >= 0 ? "text-emerald-400" : "text-rose-400"
                                                            )}>
                                                                {t.realizedPL >= 0 ? "+" : ""}
                                                                {formatCurrency(t.realizedPL)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500 font-medium">--</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

        {/* Edit Bot Modal */}
        <AnimatePresence>
            {editingBot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setEditingBot(null)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh] z-10 glass-morphic-card"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Settings className="text-indigo-400" size={20} /> Edit Bot Configuration
                            </h3>
                            <button
                                onClick={() => setEditingBot(null)}
                                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {editError && (
                            <div className="p-4 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle size={14} /> {editError}
                            </div>
                        )}

                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Bot Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Allocated Capital (₹)</label>
                                    <input
                                        type="number"
                                        value={editCapital}
                                        onChange={e => setEditCapital(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Min Confluence Score</label>
                                    <input
                                        type="number"
                                        value={editMinScore}
                                        onChange={e => setEditMinScore(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                        min="0"
                                        max="100"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Max Position Size (%)</label>
                                    <input
                                        type="number"
                                        value={editMaxPosPercent}
                                        onChange={e => setEditMaxPosPercent(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                        min="5"
                                        max="100"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Max Trades / Day</label>
                                    <input
                                        type="number"
                                        value={editMaxTrades}
                                        onChange={e => setEditMaxTrades(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                        min="1"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Stop Loss (%)</label>
                                    <input
                                        type="number"
                                        value={editStopLoss}
                                        onChange={e => setEditStopLoss(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-rose-400 focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                        min="0.1"
                                        step="0.1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Take Profit (%)</label>
                                    <input
                                        type="number"
                                        value={editTakeProfit}
                                        onChange={e => setEditTakeProfit(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-emerald-400 focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                        min="0.1"
                                        step="0.1"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setEditingBot(null)}
                                    className="flex-1 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-sm transition-all border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
                                >
                                    {isSavingEdit ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={14} /> Saving...
                                        </>
                                    ) : (
                                        "Save Changes"
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* Bot Live Tracker Drawer */}
        <AnimatePresence>
            {detailsBot && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setDetailsBot(null)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-2xl bg-slate-900 border-l border-white/10 h-full p-6 sm:p-8 shadow-2xl flex flex-col justify-between z-10 overflow-y-auto"
                    >
                        <div>
                            {/* Drawer Header */}
                            <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-6 mb-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-2xl font-bold text-white tracking-tight">{detailsBot.name}</h3>
                                        <span className={cn(
                                            "h-2.5 w-2.5 rounded-full",
                                            detailsBot.status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : detailsBot.status === 'PAUSED' ? "bg-amber-500" : "bg-rose-500"
                                        )}></span>
                                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md">
                                            {detailsBot.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Strategy: <span className="text-indigo-400 font-semibold">{detailsBot.strategyName}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => setDetailsBot(null)}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total P&L</span>
                                    <span className={cn(
                                        "text-lg font-mono font-bold mt-1.5 block",
                                        detailsBot.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {detailsBot.totalPnL >= 0 ? "+" : ""}
                                        {formatCurrency(detailsBot.totalPnL)}
                                    </span>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Win Rate</span>
                                    <span className="text-lg font-mono font-bold text-slate-300 mt-1.5 block">
                                        {detailsBot.totalTradesExecuted > 0 
                                            ? ((detailsBot.winCount / detailsBot.totalTradesExecuted) * 100).toFixed(0) 
                                            : "0"}%
                                    </span>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Trades Executed</span>
                                    <span className="text-lg font-mono font-bold text-slate-300 mt-1.5 block">
                                        {detailsBot.totalTradesExecuted}
                                    </span>
                                </div>
                            </div>

                            {/* Section 1: Live Positions */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                        <Activity className="text-emerald-400" size={16} /> Live Active Positions
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Live Price Updates
                                    </span>
                                </div>

                                {(!detailsBot.activeHoldings || detailsBot.activeHoldings.length === 0) ? (
                                    <div className="border border-white/5 bg-white/[0.01] rounded-2xl p-8 text-center flex flex-col items-center justify-center">
                                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3 animate-pulse">
                                            <Bot size={20} />
                                        </div>
                                        <p className="text-sm text-slate-300 font-bold mb-1">No Active Positions</p>
                                        <p className="text-xs text-slate-500 max-w-sm">
                                            This bot has no open simulated stock purchases right now. It is actively checking real-time scan signals to identify purchase candidates based on its configuration.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-white/5 bg-white/[0.02]">
                                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Symbol</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Qty</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Avg Price</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Current</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Unrealized P&L</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {detailsBot.activeHoldings.map((h, idx) => {
                                                        const isPosProfit = h.unrealizedPnL >= 0;
                                                        return (
                                                            <tr key={idx} className="hover:bg-white/[0.01] transition-all">
                                                                <td className="px-4 py-3.5">
                                                                    <div className="font-bold text-white text-sm">{formatSymbol(h.symbol)}</div>
                                                                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                                                        {new Date(h.purchaseDate).toLocaleDateString(undefined, {
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit'
                                                                        })}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-mono text-sm text-slate-300 font-medium">
                                                                    {h.quantity}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-mono text-sm text-slate-300 font-medium">
                                                                    {formatCurrency(h.buyPrice)}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-mono text-sm text-white font-bold flex items-center justify-end gap-1.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                                                    {formatCurrency(h.currentPrice)}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right">
                                                                    <div className={cn(
                                                                        "font-mono font-bold text-sm",
                                                                        isPosProfit ? "text-emerald-400" : "text-rose-400"
                                                                    )}>
                                                                        {isPosProfit ? "+" : ""}
                                                                        {formatCurrency(h.unrealizedPnL)}
                                                                    </div>
                                                                    <div className={cn(
                                                                        "text-[10px] font-mono font-semibold mt-0.5",
                                                                        isPosProfit ? "text-emerald-500" : "text-rose-500"
                                                                    )}>
                                                                        {isPosProfit ? "+" : ""}
                                                                        {h.unrealizedPnLPercent.toFixed(2)}%
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Configuration Rules */}
                            <div className="mt-8 space-y-4">
                                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Settings className="text-indigo-400" size={16} /> Configuration Rules & Targets
                                </h4>
                                <div className="grid grid-cols-2 gap-4 bg-white/[0.01] border border-white/5 rounded-2xl p-4 sm:p-5 text-xs font-semibold text-slate-400">
                                    <div className="space-y-3">
                                        <div className="flex justify-between border-b border-white/5 pb-2">
                                            <span className="text-slate-500">Allocated Budget:</span>
                                            <span className="text-slate-200 font-mono">{formatCurrency(detailsBot.capitalAllocated)}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/5 pb-2">
                                            <span className="text-slate-500">Max Sizing per Position:</span>
                                            <span className="text-slate-200 font-mono">{detailsBot.maxPositionSizePercent}% (Max {formatCurrency((detailsBot.capitalAllocated * detailsBot.maxPositionSizePercent) / 100)})</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Risk per Position:</span>
                                            <span className="text-slate-200 font-mono">{detailsBot.riskPerTradePercent}%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between border-b border-white/5 pb-2">
                                            <span className="text-slate-500">Take Profit (TP):</span>
                                            <span className="text-emerald-400 font-mono">+{detailsBot.takeProfitPercent}%</span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/5 pb-2">
                                            <span className="text-slate-500">Stop Loss (SL):</span>
                                            <span className="text-rose-400 font-mono">-{detailsBot.stopLossPercent}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Min. Confluence Score:</span>
                                            <span className="text-indigo-400 font-mono">&ge; {detailsBot.minConfluenceScore}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Close Button */}
                        <div className="border-t border-white/5 pt-6 mt-8">
                            <button
                                onClick={() => setDetailsBot(null)}
                                className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-all border border-white/10 hover:text-white"
                            >
                                Close Tracker View
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
);
}

function BotCard({ 
    bot, 
    onToggleStatus, 
    onDelete, 
    onEdit,
    onViewHistory, 
    onShowDetails,
    actionLoading 
}: { 
    bot: BotData; 
    onToggleStatus: (id: string, stat: string) => void;
    onDelete: (id: string) => void;
    onEdit: (bot: BotData) => void;
    onViewHistory: (id: string) => void;
    onShowDetails: (bot: BotData) => void;
    actionLoading: string | null;
}) {
    const isRunning = bot.status === 'ACTIVE';
    const isProfit = bot.totalPnL >= 0;
    const totalTrades = bot.totalTradesExecuted;
    const winRate = totalTrades > 0 ? ((bot.winCount / totalTrades) * 100).toFixed(0) : "0";

    return (
        <div className="glass-morphic-card rounded-3xl p-6 sm:p-7 border-white/5 bg-white/[0.01] hover:border-white/10 transition-all flex flex-col justify-between group">
            <div>
                {/* Bot Identity Header */}
                <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h4 
                                onClick={() => onShowDetails(bot)}
                                className="text-lg font-bold text-white tracking-tight hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-1.5 group/title"
                            >
                                {bot.name}
                                <span className="opacity-0 group-hover/title:opacity-100 transition-opacity text-slate-500 text-[10px] font-normal">(View Details)</span>
                            </h4>
                            <span className={cn(
                                "h-2 w-2 rounded-full",
                                bot.status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : bot.status === 'PAUSED' ? "bg-amber-500" : "bg-rose-500"
                            )}></span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            Strategy: <span className="text-indigo-400 font-semibold">{bot.strategyName}</span>
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => onEdit(bot)}
                            disabled={actionLoading === bot.id}
                            title="Edit Bot Settings"
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all"
                        >
                            <Edit3 size={14} />
                        </button>
                        <button
                            onClick={() => onToggleStatus(bot.id, bot.status)}
                            disabled={actionLoading === bot.id}
                            title={isRunning ? "Pause Bot" : "Resume Bot"}
                            className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center border transition-all",
                                isRunning 
                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20" 
                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            )}
                        >
                            {actionLoading === bot.id ? (
                                <RefreshCw className="animate-spin" size={14} />
                            ) : isRunning ? (
                                <Pause size={14} />
                            ) : (
                                <Play size={14} />
                            )}
                        </button>
                        <button
                            onClick={() => onDelete(bot.id)}
                            disabled={actionLoading === bot.id}
                            title="Delete Bot"
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Performance overview */}
                <div className="grid grid-cols-3 gap-4 my-6 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Bot P&L</span>
                        <span className={cn(
                            "text-sm font-mono font-bold mt-1 block",
                            isProfit ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {isProfit ? "+" : ""}
                            {formatCurrency(bot.totalPnL)}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Win Rate</span>
                        <span className="text-sm font-mono font-bold text-slate-300 mt-1 block">
                            {winRate}% <span className="text-xs text-slate-500">({bot.winCount} w)</span>
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Daily limit</span>
                        <span className="text-sm font-mono font-bold text-slate-300 mt-1 block">
                            {bot.todayTradeCount} / {bot.maxTradesPerDay}
                        </span>
                    </div>
                </div>

                {/* Configurations parameters list */}
                <div className="space-y-2.5 text-xs font-semibold text-slate-400">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Capital Limit:</span>
                        <span className="text-slate-300 font-mono">{formatCurrency(bot.capitalAllocated)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Execution Filters:</span>
                        <span className="text-indigo-400 font-mono">Confluence Score &ge; {bot.minConfluenceScore}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Max Sizing / Trade:</span>
                        <span className="text-slate-300 font-mono">{bot.maxPositionSizePercent}% of capital</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Risk Target bounds:</span>
                        <span className="text-slate-300 font-mono">SL: -{bot.stopLossPercent}% | TP: +{bot.takeProfitPercent}%</span>
                    </div>
                </div>
            </div>

            <div className="border-t border-white/5 mt-6 pt-4 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Status: <span className={cn(
                        "font-semibold",
                        isRunning ? "text-emerald-400" : "text-rose-400"
                    )}>{bot.status}</span>
                </span>
                <div className="flex gap-4">
                    <button
                        onClick={() => onShowDetails(bot)}
                        className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                    >
                        <TrendingUp size={12} /> Live Tracker
                    </button>
                    <button
                        onClick={() => onViewHistory(bot.id)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                    >
                        <History size={12} /> Execution Logs
                    </button>
                </div>
            </div>
        </div>
    );
}
