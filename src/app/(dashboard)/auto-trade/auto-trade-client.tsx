"use client";

import React, { useState, useEffect } from "react";
import { 
    Bot, 
    Plus, 
    Play, 
    Pause, 
    Trash2, 
    Activity, 
    DollarSign, 
    ArrowUpRight, 
    ArrowDownRight, 
    RefreshCw,
    Shield,
    Sliders,
    X,
    AlertOctagon
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Strategy {
    id: string;
    slug: string;
    name: string;
    riskLevel: string;
    winRate: string;
    objective: string;
}

export default function AutoTradeClient({
    initialAssistants = [],
    initialStrategies,
    cashBalance
}: {
    initialBots?: any[];
    initialAssistants?: any[];
    initialStrategies: Strategy[];
    cashBalance: number;
}) {
    const router = useRouter();
    const [assistants, setAssistants] = useState<any[]>(initialAssistants);
    const [currentCashBalance, setCurrentCashBalance] = useState(cashBalance);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Emergency Stop Modal State
    const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
    const [flattenCheckbox, setFlattenCheckbox] = useState(false);
    const [isEmergencyHaltLoading, setIsEmergencyHaltLoading] = useState(false);

    // Toggle Strategy Assistant Status
    const handleToggleAssistantStatus = async (assistantId: string, currentStatus: string) => {
        setActionLoading(assistantId);
        const nextStatus = currentStatus === 'RUNNING' ? 'PAUSED' : 'RUNNING';
        try {
            const res = await fetch(`/api/strategy-assistants/${assistantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to switch status");
            
            setAssistants(prev => prev.map(a => a.id === assistantId ? data : a));
            
            // Sync portfolio cash because activation/pause affects reservation cash
            const portRes = await fetch(`/api/portfolio/me?t=${Date.now()}`);
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Delete Strategy Assistant
    const handleDeleteAssistant = async (assistantId: string) => {
        if (!confirm("⚠️ Delete this Strategy Assistant? Any non-deployed reservation cash is released immediately. Open positions remain active until closed/converted.")) return;
        const liquidate = confirm("Do you want to immediately liquidate (SELL) all open holdings managed by this assistant? (Click Cancel to detach them and convert to manual holdings)");
        
        setActionLoading(assistantId);
        try {
            const res = await fetch(`/api/strategy-assistants/${assistantId}?liquidate=${liquidate}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setAssistants(prev => prev.filter(a => a.id !== assistantId));
                
                // Sync portfolio cash
                const portRes = await fetch(`/api/portfolio/me?t=${Date.now()}`);
                if (portRes.ok) {
                    const portData = await portRes.json();
                    setCurrentCashBalance(portData.cashBalance);
                }
            }
        } catch (err: any) {
            alert(err.message || "Failed to delete assistant.");
        } finally {
            setActionLoading(null);
        }
    };

    // Refresh Portfolio Virtual Balance & Assistants
    const handleRefreshStats = async () => {
        setIsRefreshing(true);
        try {
            const [assistRes, portRes] = await Promise.all([
                fetch(`/api/strategy-assistants?t=${Date.now()}`),
                fetch(`/api/portfolio/me?t=${Date.now()}`)
            ]);
            if (assistRes.ok) {
                const refreshedAssistants = await assistRes.json();
                setAssistants(refreshedAssistants);
            }
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }
        } catch (err) {
            console.error("Refresh failed:", err);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-refresh loops every 12 seconds in the background
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const [assistRes, portRes] = await Promise.all([
                    fetch(`/api/strategy-assistants?t=${Date.now()}`),
                    fetch(`/api/portfolio/me?t=${Date.now()}`)
                ]);
                if (assistRes.ok) setAssistants(await assistRes.json());
                if (portRes.ok) {
                    const portData = await portRes.json();
                    setCurrentCashBalance(portData.cashBalance);
                }
            } catch (err) {
                console.error("Auto refresh background sync failed:", err);
            }
        }, 12000);
        return () => clearInterval(interval);
    }, []);

    // Emergency Halt execute
    const handleEmergencyHalt = async () => {
        setIsEmergencyHaltLoading(true);
        try {
            const res = await fetch("/api/strategy-assistants/emergency-stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ flattenPositions: flattenCheckbox })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to halt engine.");

            alert(`🚨 EMERGENCY STOP SUCCESSFUL!\nPaused assistants: ${data.pausedCount}\nCancelled entries: ${data.cancelledCount}\nLiquidated positions: ${data.liquidatedCount}`);
            
            // Reload all
            setIsEmergencyOpen(false);
            await handleRefreshStats();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsEmergencyHaltLoading(false);
        }
    };

    return (
        <div className="space-y-8 min-h-screen text-slate-100 pb-20">
            {/* Top Title Action Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                        <Shield className="text-indigo-500" size={32} />
                        Strategy Assistants Cockpit
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">
                        Guided quantitative automation with active risk circuit breakers
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleRefreshStats}
                        disabled={isRefreshing}
                        className={cn(
                            "p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white flex items-center justify-center",
                            isRefreshing && "animate-spin text-white"
                        )}
                        title="Force Synchronize Portfolios"
                    >
                        <RefreshCw size={18} />
                    </button>
                    
                    <button 
                        onClick={() => setIsEmergencyOpen(true)}
                        className="px-5 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all font-bold text-sm flex items-center gap-2 shadow-lg shadow-rose-950/20"
                    >
                        <AlertOctagon size={16} /> Emergency Halt
                    </button>

                    {assistants.length > 0 && (
                        <button 
                            onClick={() => router.push("/auto-trade/setup")}
                            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-950/20"
                        >
                            <Plus size={16} /> Deploy Assistant
                        </button>
                    )}
                </div>
            </div>

            {/* Performance Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Capital</span>
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                        {formatCurrency(currentCashBalance - assistants.reduce((sum, a) => sum + (a.status === 'RUNNING' ? a.allocatedCapital : 0), 0))}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2 font-medium">Virtual cash balance net of active reservations</p>
                </div>

                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Realized Returns</span>
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", assistants.reduce((sum, a) => sum + a.totalPnL, 0) >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                            <Activity size={16} />
                        </div>
                    </div>
                    {(() => {
                        const totalPnL = assistants.reduce((sum, a) => sum + a.totalPnL, 0);
                        const isProfit = totalPnL >= 0;
                        return (
                            <>
                                <h3 className={cn("text-2xl font-bold tracking-tight flex items-center gap-1", isProfit ? "text-emerald-400" : "text-rose-400")}>
                                    {isProfit ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                                    {formatCurrency(totalPnL)}
                                </h3>
                                <p className="text-xs text-slate-500 mt-2 font-medium">Combined realized returns from all modules</p>
                            </>
                        );
                    })()}
                </div>

                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Engine Efficiency</span>
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <Activity size={16} />
                        </div>
                    </div>
                    {(() => {
                        const totalTrades = assistants.reduce((sum, a) => sum + a.totalTradesExecuted, 0);
                        const wins = assistants.reduce((sum, a) => sum + a.winCount, 0);
                        const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0.0";
                        return (
                            <>
                                <h3 className="text-2xl font-bold text-white tracking-tight">{totalTrades} Executed</h3>
                                <p className="text-xs text-slate-500 mt-2 font-medium">Win Rate: <span className="text-emerald-400 font-semibold">{winRate}%</span> across executors</p>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Content Area */}
            <div className="mt-6">
                {assistants.length === 0 ? (
                    <div className="glass-morphic-card p-12 text-center rounded-[32px] border-white/5 flex flex-col items-center">
                        <Bot size={48} className="text-slate-600 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">No Deployments Found</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                            You haven't setup any Strategy Assistants yet. Deploy a guided Strategy Assistant to manage trade execution streams instantly.
                        </p>
                        <button 
                            onClick={() => router.push("/auto-trade/setup")}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2"
                        >
                            <Plus size={16} /> Run Setup Wizard
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Shield size={16} className="text-indigo-400" />
                            Active Strategy Assistants ({assistants.length})
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {assistants.map((assistant) => (
                                <AssistantCard 
                                    key={assistant.id}
                                    assistant={assistant}
                                    onToggleStatus={handleToggleAssistantStatus}
                                    onDelete={handleDeleteAssistant}
                                    actionLoading={actionLoading}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Emergency Stop Dialog */}
            <AnimatePresence>
                {isEmergencyOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsEmergencyOpen(false)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="glass-morphic-card w-full max-w-md p-6 sm:p-8 rounded-[32px] border-rose-500/20 bg-slate-900/90 relative z-10 overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-red-600 to-rose-500 animate-pulse" />
                            <div className="flex items-center gap-3 text-rose-400 mb-4">
                                <AlertOctagon size={32} />
                                <h3 className="text-lg font-bold text-white tracking-tight">Emergency Halt Engine</h3>
                            </div>
                            
                            <p className="text-slate-300 text-sm leading-relaxed mb-6">
                                This will instantly pause all Strategy Assistants in the system and cancel any pending limit buy/sell orders.
                            </p>

                            <label className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 mb-6 cursor-pointer hover:bg-rose-500/10 transition-all select-none">
                                <input
                                    type="checkbox"
                                    checked={flattenCheckbox}
                                    onChange={(e) => setFlattenCheckbox(e.target.checked)}
                                    className="mt-1 rounded bg-slate-950 border-rose-500/30 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-900"
                                />
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-white uppercase tracking-wider block">Flatten Active Holdings</span>
                                    <span className="text-[11px] text-rose-300">
                                        Check to immediately liquidate (sell at market) all active stocks currently managed by assistants.
                                    </span>
                                </div>
                            </label>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsEmergencyOpen(false)}
                                    className="flex-1 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-all border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleEmergencyHalt}
                                    disabled={isEmergencyHaltLoading}
                                    className="flex-1 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white font-bold text-sm transition-all shadow-lg shadow-rose-950/20 flex items-center justify-center gap-2"
                                >
                                    {isEmergencyHaltLoading ? (
                                        <RefreshCw size={16} className="animate-spin" />
                                    ) : (
                                        "Trigger Stop"
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function AssistantCard({
    assistant,
    onToggleStatus,
    onDelete,
    actionLoading
}: {
    assistant: any;
    onToggleStatus: (id: string, currentStatus: string) => void;
    onDelete: (id: string) => void;
    actionLoading: string | null;
}) {
    const isRunning = assistant.status === 'RUNNING';
    const isProfit = assistant.totalPnL >= 0;
    const totalTrades = assistant.totalTradesExecuted;
    const winRate = totalTrades > 0 ? ((assistant.winCount / totalTrades) * 100).toFixed(0) : "0";
    const activeHoldingsCount = assistant.activeHoldings ? assistant.activeHoldings.length : 0;
    const idleCapital = Math.max(0, assistant.allocatedCapital - assistant.deployedCapital);

    return (
        <div className="glass-morphic-card rounded-3xl p-6 sm:p-7 border border-white/5 bg-white/[0.01] hover:border-white/10 transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <div className="relative z-10">
                {/* Header */}
                <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link
                                href={`/auto-trade/assistant/${assistant.id}`}
                                className="text-base font-bold text-white tracking-tight hover:text-indigo-400 transition-colors flex items-center gap-1.5 group/title"
                            >
                                {assistant.name}
                                <span className="opacity-0 group-hover/title:opacity-100 transition-opacity text-slate-500 text-[10px] font-normal">(View Cockpit)</span>
                            </Link>
                            <span className={cn(
                                "h-2 w-2 rounded-full",
                                assistant.status === 'RUNNING' 
                                    ? "bg-emerald-500 animate-pulse" 
                                    : assistant.status === 'PAUSED' 
                                    ? "bg-amber-500" 
                                    : "bg-rose-500"
                            )}></span>
                            <span className={cn(
                                "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                                assistant.status === 'RUNNING' 
                                    ? "bg-emerald-500/10 text-emerald-400" 
                                    : assistant.status === 'PAUSED'
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-rose-500/10 text-rose-400"
                            )}>
                                {assistant.status}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            Strategy: <span className="text-indigo-400 font-semibold">{assistant.strategyName}</span>
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => onToggleStatus(assistant.id, assistant.status)}
                            disabled={actionLoading === assistant.id}
                            title={isRunning ? "Pause Assistant" : "Resume Assistant"}
                            className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center border transition-all",
                                isRunning 
                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20" 
                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            )}
                        >
                            {actionLoading === assistant.id ? (
                                <RefreshCw className="animate-spin" size={14} />
                            ) : isRunning ? (
                                <Pause size={14} />
                            ) : (
                                <Play size={14} />
                            )}
                        </button>
                        <button
                            onClick={() => onDelete(assistant.id)}
                            disabled={actionLoading === assistant.id}
                            title="Delete Assistant"
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-4 my-6 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Realized P&L</span>
                        <span className={cn(
                            "text-sm font-mono font-bold mt-1 block",
                            isProfit ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {isProfit ? "+" : ""}
                            {formatCurrency(assistant.totalPnL)}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Win Rate</span>
                        <span className="text-sm font-mono font-bold text-slate-300 mt-1 block">
                            {winRate}% <span className="text-xs text-slate-500">({assistant.winCount} w)</span>
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Open Slots</span>
                        <span className="text-sm font-mono font-bold text-slate-300 mt-1 block">
                            {activeHoldingsCount} / {assistant.maxConcurrentPositions}
                        </span>
                    </div>
                </div>

                {/* Configurations parameters list */}
                <div className="space-y-2.5 text-xs font-semibold text-slate-400">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Allocated Capital:</span>
                        <span className="text-slate-300 font-mono">₹{assistant.allocatedCapital.toLocaleString()} <span className="text-[10px] text-slate-500">(Deployed: ₹{assistant.deployedCapital.toLocaleString()})</span></span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Available Capital:</span>
                        <span className="text-emerald-400 font-mono">₹{idleCapital.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Confluence Trigger:</span>
                        <span className="text-indigo-400 font-mono">&ge; {assistant.minConfluenceScore}% Match</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Stop Loss / Take Profit:</span>
                        <span className="text-slate-300 font-mono">SL: -{assistant.stopLossPercent}% | TP: +{assistant.takeProfitPercent}%</span>
                    </div>
                </div>
            </div>

            <div className="border-t border-white/5 mt-6 pt-4 flex justify-between items-center relative z-10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Shield size={12} className="text-indigo-400" />
                    <span>Strategy Assistant</span>
                </span>
                <Link
                    href={`/auto-trade/assistant/${assistant.id}`}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                >
                    <Activity size={12} /> Go to Cockpit &rarr;
                </Link>
            </div>
        </div>
    );
}
