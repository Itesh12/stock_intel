"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
    Shield, 
    Zap, 
    Check, 
    Play, 
    Pause, 
    Trash2, 
    Settings, 
    History, 
    AlertTriangle, 
    AlertCircle, 
    TrendingUp, 
    DollarSign, 
    Activity, 
    X, 
    SlidersHorizontal, 
    Sliders, 
    RefreshCw, 
    ArrowLeft, 
    ArrowUpRight, 
    ArrowDownRight, 
    Terminal,
    BookOpen,
    HelpCircle,
    Info,
    ListChecks,
    Clock,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    XCircle,
    MinusCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, formatSymbol } from "@/lib/utils";
import Link from "next/link";

interface Strategy {
    id: string;
    slug: string;
    name: string;
    description: string;
    objective: string;
}

interface AssistantHolding {
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
}

interface LogMessage {
    id: string;
    botId: string;
    timestamp: string;
    level: "INFO" | "WARN" | "ERROR";
    category: "SCAN" | "TRADE_ENTRY" | "TRADE_EXIT" | "RISK_GUARD" | "SYSTEM";
    message: string;
    metadata?: any;
}

interface AssistantClientProps {
    initialAssistant: any;
    strategy: Strategy | null;
    cashBalance: number;
    reservedCash: number;
    availableCash: number;
    initialHoldings: AssistantHolding[];
}

export default function AssistantClient({
    initialAssistant,
    strategy,
    cashBalance,
    reservedCash,
    availableCash,
    initialHoldings
}: AssistantClientProps) {
    const router = useRouter();
    const [assistant, setAssistant] = useState(initialAssistant);
    const [holdings, setHoldings] = useState<AssistantHolding[]>(initialHoldings);
    
    // UI Tabs State
    const [activeTab, setActiveTab] = useState<"positions" | "decisions" | "logs" | "signals" | "timeline">("positions");
    
    // Logs and SSE Telemetry State
    const [logs, setLogs] = useState<LogMessage[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<"CONNECTED" | "CONNECTING" | "DISCONNECTED">("DISCONNECTED");
    const [heartbeatTime, setHeartbeatTime] = useState<Date | null>(null);
    const [staleScannerWarning, setStaleScannerWarning] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const terminalEndRef = useRef<HTMLDivElement | null>(null);

    // Explainability State
    const [signals, setSignals] = useState<any[]>([]);
    const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
    const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);
    const [explainabilityEnabled, setExplainabilityEnabled] = useState(false);

    // Overrides / Modals State
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [modalType, setModalType] = useState<"pause" | "emergency" | "convert" | "close" | "delete" | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    
    // Settings Drawer State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [settingsSuccess, setSettingsSuccess] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(false);
    
    // Settings Form States
    const [formName, setFormName] = useState(assistant.name);
    const [formCapital, setFormCapital] = useState(assistant.allocatedCapital);
    const [formMaxPosPercent, setFormMaxPosPercent] = useState(assistant.maxPositionSizePercent);
    const [formStopLoss, setFormStopLoss] = useState(assistant.stopLossPercent);
    const [formTakeProfit, setFormTakeProfit] = useState(assistant.takeProfitPercent);
    const [formMinScore, setFormMinScore] = useState(assistant.minConfluenceScore);
    const [formMaxDailyLoss, setFormMaxDailyLoss] = useState(assistant.maxDailyLoss);
    const [formMaxConcurrent, setFormMaxConcurrent] = useState(assistant.maxConcurrentPositions);
    const [formCooldown, setFormCooldown] = useState(assistant.cooldownPeriodMinutes);
    const [formMaxSectorPercent, setFormMaxSectorPercent] = useState(assistant.maxSectorAllocationPercent);
    const [formDrawdownPercent, setFormDrawdownPercent] = useState(assistant.drawdownProtectionPercent);
    const [formUseTrailing, setFormUseTrailing] = useState(assistant.useTrailingStop);

    // Load Logs History and Subscribe to Live SSE Telemetry Stream
    useEffect(() => {
        let isMounted = true;

        const loadLogsAndConnect = async () => {
            try {
                // 1. Fetch historical logs
                const res = await fetch(`/api/strategy-assistants/${assistant.id}/logs`);
                if (res.ok && isMounted) {
                    const data = await res.json();
                    setLogs(data);
                    if (data.length > 0) {
                        setHeartbeatTime(new Date(data[data.length - 1].timestamp));
                    }
                }
            } catch (err) {
                console.error("Failed to load historical logs:", err);
            }

            if (!isMounted) return;

            // 2. Connect SSE stream
            setConnectionStatus("CONNECTING");
            const es = new EventSource(`/api/strategy-assistants/${assistant.id}/logs?stream=true`);
            eventSourceRef.current = es;

            es.onopen = () => {
                if (isMounted) {
                    setConnectionStatus("CONNECTED");
                    setHeartbeatTime(new Date());
                }
            };

            es.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    // Check heartbeat
                    if (event.data === "" || event.data.trim() === ": heartbeat") {
                        setHeartbeatTime(new Date());
                        return;
                    }

                    const newLog = JSON.parse(event.data);
                    setLogs((prev) => [...prev, newLog]);
                    setHeartbeatTime(new Date());
                } catch (err) {
                    console.error("SSE parse error:", err);
                }
            };

            es.onerror = () => {
                if (isMounted) {
                    setConnectionStatus("DISCONNECTED");
                }
            };
        };

        loadLogsAndConnect();

        // 3. Scanner Stale Check timer (runs every 10 seconds)
        const checkStaleTimer = setInterval(() => {
            if (!isMounted) return;
            const now = new Date();
            // Fallback to current time if no logs received yet
            const lastTick = heartbeatTime || now;
            const diffMin = Math.floor((now.getTime() - lastTick.getTime()) / 60000);
            if (diffMin >= 15) {
                setStaleScannerWarning(`Stale Signals: Scanner heartbeat was last updated ${diffMin} minutes ago.`);
            } else {
                setStaleScannerWarning(null);
            }
        }, 10000);

        return () => {
            isMounted = false;
            clearInterval(checkStaleTimer);
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [assistant.id, heartbeatTime]);

    // Scroll logs window to bottom
    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs, activeTab]);

    // Load explainability data (signals + timeline) when tab becomes active
    const loadExplainability = useCallback(async () => {
        try {
            const [sigRes, tlRes] = await Promise.all([
                fetch(`/api/strategy-assistants/${assistant.id}/signals?limit=50`),
                fetch(`/api/strategy-assistants/${assistant.id}/timeline?limit=50`)
            ]);
            if (sigRes.ok) {
                const sigData = await sigRes.json();
                setSignals(sigData.signals || []);
                setExplainabilityEnabled(true);
            } else if (sigRes.status === 403) {
                setExplainabilityEnabled(false);
            }
            if (tlRes.ok) {
                const tlData = await tlRes.json();
                setTimelineEvents(tlData.events || []);
            }
        } catch (err) {
            console.error("Failed to load explainability data:", err);
        }
    }, [assistant.id]);

    useEffect(() => {
        if (activeTab === "signals" || activeTab === "timeline") {
            loadExplainability();
        }
    }, [activeTab, loadExplainability]);

    // Handle Pause/Resume status toggle
    const handleToggleStatus = async () => {
        setActionLoading("status");
        const nextStatus = assistant.status === "RUNNING" ? "PAUSED" : "RUNNING";
        try {
            const res = await fetch(`/api/strategy-assistants/${assistant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to toggle status");
            setAssistant(data);
            setModalType(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "Failed to update assistant state.");
        } finally {
            setActionLoading(null);
        }
    };

    // Handle Manual Position Close
    const handleClosePosition = async () => {
        if (!selectedSymbol) return;
        setActionLoading("close");
        try {
            const res = await fetch(`/api/strategy-assistants/${assistant.id}/close-position`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol: selectedSymbol })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to close position");
            
            // Remove from holdings local state
            setHoldings(prev => prev.filter(h => h.symbol !== selectedSymbol));
            
            // Reload assistant settings metrics
            const updatedRes = await fetch(`/api/strategy-assistants`);
            if (updatedRes.ok) {
                const list = await updatedRes.json();
                const matched = list.find((a: any) => a.id === assistant.id);
                if (matched) setAssistant(matched);
            }

            setModalType(null);
            setSelectedSymbol(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "Failed to close position.");
        } finally {
            setActionLoading(null);
        }
    };

    // Handle Converting Holding to Manual
    const handleConvertPosition = async () => {
        if (!selectedSymbol) return;
        setActionLoading("convert");
        try {
            const res = await fetch(`/api/strategy-assistants/${assistant.id}/convert-manual`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol: selectedSymbol })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to convert holding");

            // Remove from holdings
            setHoldings(prev => prev.filter(h => h.symbol !== selectedSymbol));

            // Reload assistant metrics
            const updatedRes = await fetch(`/api/strategy-assistants`);
            if (updatedRes.ok) {
                const list = await updatedRes.json();
                const matched = list.find((a: any) => a.id === assistant.id);
                if (matched) setAssistant(matched);
            }

            setModalType(null);
            setSelectedSymbol(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "Failed to convert holding.");
        } finally {
            setActionLoading(null);
        }
    };

    // Handle Global Emergency Stop
    const handleEmergencyStop = async () => {
        setActionLoading("emergency");
        try {
            const res = await fetch(`/api/strategy-assistants/emergency-stop`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ flattenPositions: true })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Emergency stop failed");

            // Clear holdings local state since they are flattened
            setHoldings([]);

            // Reload assistant
            const updatedRes = await fetch(`/api/strategy-assistants`);
            if (updatedRes.ok) {
                const list = await updatedRes.json();
                const matched = list.find((a: any) => a.id === assistant.id);
                if (matched) setAssistant(matched);
            }

            setModalType(null);
            router.refresh();
        } catch (err: any) {
            alert(err.message || "Failed to execute emergency stop.");
        } finally {
            setActionLoading(null);
        }
    };

    // Handle Delete Assistant
    const handleDeleteAssistant = async (liquidate: boolean) => {
        setActionLoading("delete");
        try {
            const res = await fetch(`/api/strategy-assistants/${assistant.id}?liquidate=${liquidate}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to delete assistant");
            
            router.push("/auto-trade");
            router.refresh();
        } catch (err: any) {
            alert(err.message || "Failed to delete assistant.");
            setActionLoading(null);
        }
    };

    // Handle Settings drawer edits
    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSettingsError(null);
        setSettingsSuccess(false);
        setSettingsLoading(true);

        // Validation: allocatedCapital cannot be reduced below deployedCapital
        if (formCapital < assistant.deployedCapital) {
            setSettingsError(`Budget (₹${formCapital.toLocaleString()}) cannot be smaller than current deployed capital (₹${assistant.deployedCapital.toLocaleString()}).`);
            setSettingsLoading(false);
            return;
        }

        const payload = {
            name: formName,
            allocatedCapital: formCapital,
            maxPositionSizePercent: formMaxPosPercent,
            stopLossPercent: formStopLoss,
            takeProfitPercent: formTakeProfit,
            minConfluenceScore: formMinScore,
            maxDailyLoss: formMaxDailyLoss,
            maxConcurrentPositions: formMaxConcurrent,
            cooldownPeriodMinutes: formCooldown,
            maxSectorAllocationPercent: formMaxSectorPercent,
            drawdownProtectionPercent: formDrawdownPercent,
            useTrailingStop: formUseTrailing
        };

        try {
            const res = await fetch(`/api/strategy-assistants/${assistant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save settings");

            setAssistant(data);
            setSettingsSuccess(true);
            setTimeout(() => {
                setIsSettingsOpen(false);
                setSettingsSuccess(false);
            }, 1000);
            router.refresh();
        } catch (err: any) {
            setSettingsError(err.message || "Failed to save assistant settings.");
        } finally {
            setSettingsLoading(false);
        }
    };

    // Filters for decisions feed vs system audit logs
    const filteredDecisions = logs.filter(l => l.category === "SCAN" || l.category === "TRADE_ENTRY" || l.category === "TRADE_EXIT");
    const filteredLogs = logs.filter(l => l.category === "RISK_GUARD" || l.category === "SYSTEM" || l.category === "TRADE_EXIT" || l.category === "TRADE_ENTRY");

    // Colors mapping for category levels
    const getLogColorClass = (log: LogMessage) => {
        if (log.level === "ERROR") return "text-rose-400";
        if (log.level === "WARN") return "text-amber-400";
        if (log.category === "TRADE_ENTRY") return "text-emerald-400 font-semibold";
        if (log.category === "TRADE_EXIT") return "text-indigo-400";
        return "text-slate-300";
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 md:px-8 relative">
            <div className="w-full max-w-6xl space-y-6">
                
                {/* Back to Home header */}
                <div className="flex items-center justify-between">
                    <Link 
                        href="/auto-trade" 
                        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Auto Trade Dashboard
                    </Link>
                    
                    {/* Telemetry status badge */}
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-xs">
                        <span className={`w-2 h-2 rounded-full ${
                            connectionStatus === "CONNECTED" 
                                ? "bg-emerald-500 animate-pulse" 
                                : connectionStatus === "CONNECTING"
                                ? "bg-amber-500 animate-spin"
                                : "bg-rose-500"
                        }`} />
                        <span className="text-[10px] font-bold text-slate-400">
                            Telemetry: {connectionStatus}
                        </span>
                    </div>
                </div>

                {/* Stale warnings */}
                {staleScannerWarning && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl flex items-center gap-3 text-xs leading-relaxed animate-pulse">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                        <div>
                            <span className="font-semibold text-white">Scanner Telemetry Delayed:</span> {staleScannerWarning} Verify background workers are active.
                        </div>
                    </div>
                )}

                {/* Main Header Card */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-extrabold text-white">{assistant.name}</h1>
                                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                    assistant.status === "RUNNING"
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                        : assistant.status === "PAUSED"
                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                                        : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                                }`}>
                                    {assistant.status}
                                </span>
                                <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border border-slate-700">
                                    Paper Mode
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">Scanner Engine: <span className="text-indigo-400 font-semibold">{assistant.strategyName}</span></p>
                        </div>

                        {/* Top Control Buttons */}
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => setModalType("pause")}
                                className={`font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-[0.98] ${
                                    assistant.status === "RUNNING"
                                        ? "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
                                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                }`}
                            >
                                {assistant.status === "RUNNING" ? (
                                    <>
                                        <Pause className="w-4 h-4" />
                                        Pause Assistant
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4" />
                                        Resume Assistant
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => setModalType("emergency")}
                                className="bg-rose-950/40 hover:bg-rose-950/60 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-[0.98]"
                            >
                                <AlertTriangle className="w-4 h-4 text-rose-400" />
                                Halt & Close All
                            </button>

                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-3.5 py-2.5 rounded-xl transition-all"
                            >
                                <Settings className="w-4 h-4" />
                            </button>

                            <button
                                onClick={() => setModalType("delete")}
                                className="bg-slate-900 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 px-3.5 py-2.5 rounded-xl transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Cockpit Stats Cards */}
                    <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 border-t border-slate-800/80 pt-6">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Allocated Capital</span>
                            <div className="text-lg font-bold text-white">{formatCurrency(assistant.allocatedCapital)}</div>
                            <span className="text-[9px] text-slate-500 block">Isolate budget lock</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Deployed Capital</span>
                            <div className="text-lg font-bold text-indigo-400">{formatCurrency(assistant.deployedCapital)}</div>
                            <span className="text-[9px] text-slate-500 block">Locked in active trades</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Available Capital</span>
                            <div className="text-lg font-extrabold text-emerald-400">
                                {formatCurrency(Math.max(0, assistant.allocatedCapital - assistant.deployedCapital))}
                            </div>
                            <span className="text-[9px] text-slate-500 block">Idle budget remaining</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Realized PnL</span>
                            <div className={`text-lg font-bold flex items-center gap-1 ${
                                assistant.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}>
                                {assistant.totalPnL >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                {assistant.totalPnL >= 0 ? "+" : ""}
                                {formatCurrency(assistant.totalPnL)}
                            </div>
                            <span className="text-[9px] text-slate-500 block">Win Rate: {assistant.winCount + assistant.lossCount > 0 ? ((assistant.winCount / (assistant.winCount + assistant.lossCount)) * 100).toFixed(1) : "0.0"}% ({assistant.totalTradesExecuted} trades)</span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Tabs & Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    
                    {/* Main Workspace (Left 2 Columns) */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Custom Tab Steppers */}
                        <div className="flex border-b border-slate-800/80 bg-slate-900/40 p-1.5 rounded-2xl border border-slate-800 flex-wrap gap-1">
                            {[
                                { id: "positions", label: `Positions (${holdings.length})`, icon: Activity },
                                { id: "decisions", label: "Decisions", icon: BookOpen },
                                { id: "signals", label: "Signal Queue", icon: ListChecks },
                                { id: "timeline", label: "Timeline", icon: Clock },
                                { id: "logs", label: "Audit Logs", icon: Terminal }
                            ].map((tab) => {
                                const Icon = tab.icon;
                                const isSelected = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                                            isSelected
                                                ? "bg-slate-800 text-white shadow-md"
                                                : "text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Positions Tab */}
                        {activeTab === "positions" && (
                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 min-h-[400px]">
                                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-indigo-400" />
                                    Algorithmic Holdings
                                </h3>

                                {holdings.length === 0 ? (
                                    <div className="py-24 text-center text-slate-500 space-y-2">
                                        <Info className="w-10 h-10 mx-auto opacity-30 text-indigo-500" />
                                        <div className="text-sm font-semibold">No active positions.</div>
                                        <div className="text-xs max-w-sm mx-auto opacity-75">The Strategy Assistant is currently running and monitoring scanner recommendations matching the confluence score.</div>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-800/80 text-slate-500 font-bold uppercase tracking-wider">
                                                    <th className="pb-3.5">Asset</th>
                                                    <th className="pb-3.5">Qty</th>
                                                    <th className="pb-3.5">Buy Price</th>
                                                    <th className="pb-3.5">Current Price</th>
                                                    <th className="pb-3.5">Market Value</th>
                                                    <th className="pb-3.5">Unrealized PnL</th>
                                                    <th className="pb-3.5 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {holdings.map((h) => {
                                                    const cost = h.quantity * h.averagePrice;
                                                    const currentVal = h.quantity * h.currentPrice;
                                                    const pnl = currentVal - cost;
                                                    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                                                    return (
                                                        <tr key={h.symbol} className="hover:bg-slate-900/30 transition-colors">
                                                            <td className="py-4 font-bold text-white">{formatSymbol(h.symbol)}</td>
                                                            <td className="py-4">{h.quantity}</td>
                                                            <td className="py-4">{formatCurrency(h.averagePrice)}</td>
                                                            <td className="py-4">{formatCurrency(h.currentPrice)}</td>
                                                            <td className="py-4">{formatCurrency(currentVal)}</td>
                                                            <td className={`py-4 font-semibold ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                                {pnl >= 0 ? "+" : ""}
                                                                {formatCurrency(pnl)} ({pnlPercent.toFixed(1)}%)
                                                            </td>
                                                            <td className="py-4 text-right flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedSymbol(h.symbol);
                                                                        setModalType("convert");
                                                                    }}
                                                                    className="bg-slate-800/80 hover:bg-indigo-950/20 hover:text-indigo-400 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors font-semibold text-[10px]"
                                                                >
                                                                    Convert Manual
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedSymbol(h.symbol);
                                                                        setModalType("close");
                                                                    }}
                                                                    className="bg-slate-800/80 hover:bg-rose-950/20 hover:text-rose-400 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors font-semibold text-[10px]"
                                                                >
                                                                    Close Position
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Decisions Feed Tab */}
                        {activeTab === "decisions" && (
                            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 font-mono text-[11px] leading-relaxed min-h-[400px] flex flex-col justify-between">
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                    <div className="text-slate-500 border-b border-slate-800 pb-2 mb-2 uppercase text-[10px] font-bold">
                                        ⚡ Chronological Scanner Judgments
                                    </div>
                                    {filteredDecisions.length === 0 ? (
                                        <div className="py-24 text-center text-slate-600">
                                            Waiting for new scanner ticks...
                                        </div>
                                    ) : (
                                        filteredDecisions.map((log, idx) => (
                                            <div key={log.id || idx} className="space-y-1.5">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                                    <span className={getLogColorClass(log)}>{log.message}</span>
                                                </div>
                                                {log.metadata && log.metadata.reason && (
                                                    <div className="text-slate-500 pl-20">
                                                        └─ Reason: {log.metadata.reason}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                    <div ref={terminalEndRef} />
                                </div>
                            </div>
                        )}

                        {/* System Audit Logs Tab */}
                        {activeTab === "logs" && (
                            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 font-mono text-[11px] leading-relaxed min-h-[400px] flex flex-col justify-between">
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                    <div className="text-slate-500 border-b border-slate-800 pb-2 mb-2 uppercase text-[10px] font-bold">
                                        🤖 System Audit Log Feed
                                    </div>
                                    {filteredLogs.length === 0 ? (
                                        <div className="py-24 text-center text-slate-600">
                                            No system logs recorded.
                                        </div>
                                    ) : (
                                        filteredLogs.map((log, idx) => (
                                            <div key={log.id || idx} className="flex items-start gap-2">
                                                <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                                <span className={getLogColorClass(log)}>{log.message}</span>
                                            </div>
                                        ))
                                    )}
                                    <div ref={terminalEndRef} />
                                </div>
                            </div>
                        )}

                        {/* Signal Queue Tab */}
                        {activeTab === "signals" && (
                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 min-h-[400px]">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <ListChecks className="w-4 h-4 text-indigo-400" />
                                        Signal Queue
                                    </h3>
                                    <button
                                        onClick={loadExplainability}
                                        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Refresh
                                    </button>
                                </div>

                                {!explainabilityEnabled ? (
                                    <div className="py-24 text-center space-y-3">
                                        <Info className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
                                        <div className="text-sm font-semibold text-slate-500">Explainability Disabled</div>
                                        <div className="text-xs text-slate-600 max-w-xs mx-auto">Enable <code className="text-indigo-400">ENABLE_EXPLAINABILITY=true</code> in your environment to activate signal tracking.</div>
                                    </div>
                                ) : signals.length === 0 ? (
                                    <div className="py-24 text-center space-y-2">
                                        <ListChecks className="w-10 h-10 mx-auto opacity-20 text-indigo-400" />
                                        <div className="text-sm font-semibold text-slate-500">No signals recorded yet.</div>
                                        <div className="text-xs text-slate-600">Signals appear here when the scanner evaluates a recommendation.</div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {signals.map((sig: any) => {
                                            const isExpanded = expandedSignalId === sig.id;
                                            const statusColor = sig.status === 'APPROVED' || sig.status === 'EXECUTED'
                                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                                                : sig.status === 'REJECTED' || sig.status === 'EXPIRED'
                                                ? 'text-rose-400 bg-rose-500/10 border-rose-500/25'
                                                : sig.status === 'PROCESSING'
                                                ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                                                : 'text-slate-400 bg-slate-800/50 border-slate-700';

                                            const StatusIcon = sig.status === 'APPROVED' || sig.status === 'EXECUTED'
                                                ? CheckCircle2
                                                : sig.status === 'REJECTED' || sig.status === 'EXPIRED'
                                                ? XCircle
                                                : MinusCircle;

                                            return (
                                                <div key={sig.id} className="border border-slate-800/80 rounded-2xl overflow-hidden">
                                                    <button
                                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
                                                        onClick={() => setExpandedSignalId(isExpanded ? null : sig.id)}
                                                    >
                                                        <StatusIcon className={`w-4 h-4 flex-shrink-0 ${
                                                            sig.status === 'APPROVED' || sig.status === 'EXECUTED' ? 'text-emerald-400' :
                                                            sig.status === 'REJECTED' || sig.status === 'EXPIRED' ? 'text-rose-400' : 'text-amber-400'
                                                        }`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-xs font-bold text-white">{sig.symbol?.replace('.NS','')}</span>
                                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusColor}`}>
                                                                    {sig.status}
                                                                </span>
                                                                <span className="text-[9px] text-slate-500 uppercase tracking-wide">{sig.strategy}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                                                                <span>Score: <span className="text-indigo-300 font-semibold">{sig.score}/100</span></span>
                                                                <span>Confidence: <span className="text-indigo-300 font-semibold">{sig.confidence}%</span></span>
                                                                <span>{new Date(sig.createdAt).toLocaleTimeString()}</span>
                                                            </div>
                                                        </div>
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                                    </button>

                                                    {isExpanded && sig.reasoning && (
                                                        <div className="border-t border-slate-800/80 px-4 py-3 bg-slate-900/60 space-y-3">
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Decision Reasoning</div>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                {(sig.reasoning.reasons || []).map((r: any, i: number) => (
                                                                    <div key={i} className="flex items-start gap-2.5">
                                                                        {r.status === 'PASS' ? (
                                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                                                        ) : r.status === 'FAIL' ? (
                                                                            <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                                                                        ) : (
                                                                            <MinusCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                                                        )}
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-[10px] font-semibold text-slate-300">{r.label}</div>
                                                                            <div className="text-[9px] text-slate-500 leading-relaxed">{r.description}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="flex items-center gap-3 pt-2 border-t border-slate-800/50">
                                                                <span className="text-[9px] text-slate-500 uppercase tracking-wider">Final Confidence</span>
                                                                <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                                                                    <div
                                                                        className={`h-1.5 rounded-full transition-all ${
                                                                            sig.reasoning.confidence >= 70 ? 'bg-emerald-500' :
                                                                            sig.reasoning.confidence >= 45 ? 'bg-amber-500' : 'bg-rose-500'
                                                                        }`}
                                                                        style={{ width: `${sig.reasoning.confidence}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-white">{sig.reasoning.confidence}%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Assistant Timeline Tab */}
                        {activeTab === "timeline" && (
                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 min-h-[400px]">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-indigo-400" />
                                        Assistant Timeline
                                    </h3>
                                    <button
                                        onClick={loadExplainability}
                                        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Refresh
                                    </button>
                                </div>

                                {!explainabilityEnabled ? (
                                    <div className="py-24 text-center space-y-3">
                                        <Info className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
                                        <div className="text-sm font-semibold text-slate-500">Explainability Disabled</div>
                                        <div className="text-xs text-slate-600 max-w-xs mx-auto">Enable <code className="text-indigo-400">ENABLE_EXPLAINABILITY=true</code> to activate the timeline.</div>
                                    </div>
                                ) : timelineEvents.length === 0 ? (
                                    <div className="py-24 text-center space-y-2">
                                        <Clock className="w-10 h-10 mx-auto opacity-20 text-indigo-400" />
                                        <div className="text-sm font-semibold text-slate-500">No events recorded yet.</div>
                                        <div className="text-xs text-slate-600">Timeline events appear here as the assistant takes action.</div>
                                    </div>
                                ) : (
                                    <div className="relative pl-4 space-y-0">
                                        {/* Vertical Timeline Line */}
                                        <div className="absolute left-4 top-3 bottom-3 w-px bg-slate-800/80" />
                                        {timelineEvents.map((ev: any, idx: number) => {
                                            const dotColor = ev.eventType === 'TRADE_EXECUTED'
                                                ? 'bg-emerald-500'
                                                : ev.eventType === 'SIGNAL_APPROVED'
                                                ? 'bg-indigo-500'
                                                : ev.eventType === 'SIGNAL_REJECTED'
                                                ? 'bg-rose-500'
                                                : ev.eventType === 'RISK_STOPPED'
                                                ? 'bg-rose-600'
                                                : ev.eventType === 'POSITION_CLOSED'
                                                ? 'bg-amber-500'
                                                : 'bg-slate-600';

                                            return (
                                                <div key={ev.id || idx} className="flex gap-4 pb-5 relative">
                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 relative z-10 ${dotColor} ring-2 ring-slate-900`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-xs font-semibold text-white">{ev.title}</span>
                                                            <span className="text-[9px] text-slate-500">{new Date(ev.createdAt).toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{ev.description}</p>
                                                        {ev.metadata && ev.metadata.symbol && (
                                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                                {ev.metadata.symbol && (
                                                                    <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                                                                        {ev.metadata.symbol.replace('.NS','')}
                                                                    </span>
                                                                )}
                                                                {ev.metadata.score && (
                                                                    <span className="text-[9px] text-slate-500">Score: {ev.metadata.score}</span>
                                                                )}
                                                                {ev.metadata.confidence && (
                                                                    <span className="text-[9px] text-indigo-400">Confidence: {ev.metadata.confidence}%</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* Parameters Guard Sidebar (Right Column) */}
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 space-y-6">
                        <div className="border-b border-slate-800 pb-4">
                            <h3 className="text-sm font-bold text-white mb-1">Safety Constraints Guard</h3>
                            <p className="text-[10px] text-slate-400">Risk parameters enforcing loss circuit breakers and budget locks on execution.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-[11px] text-slate-400">Stop Loss (SL)</span>
                                <span className="text-xs font-bold text-white">-{assistant.stopLossPercent}%</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-[11px] text-slate-400">Take Profit (TP)</span>
                                <span className="text-xs font-bold text-white">+{assistant.takeProfitPercent}%</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-[11px] text-slate-400">Trailing Stop Loss</span>
                                <span className="text-xs font-bold text-indigo-400">{assistant.useTrailingStop ? "Enabled" : "Disabled"}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-[11px] text-slate-400">Min Confluence Score</span>
                                <span className="text-xs font-bold text-white">{assistant.minConfluenceScore}% Match</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-[11px] text-slate-400">Max Concurrent Positions</span>
                                <span className="text-xs font-bold text-white">{assistant.maxConcurrentPositions} slots</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-[11px] text-slate-400">Daily Loss Circuit Breaker</span>
                                <span className="text-xs font-bold text-rose-400">{formatCurrency(assistant.maxDailyLoss)} Limit</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-[11px] text-slate-400">Cooldown Period</span>
                                <span className="text-xs font-bold text-white">{assistant.cooldownPeriodMinutes} minutes</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-[11px] text-slate-400">Max Sector Allocation</span>
                                <span className="text-xs font-bold text-white">{assistant.maxSectorAllocationPercent}% Limit</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[11px] text-slate-400">Drawdown Protection</span>
                                <span className="text-xs font-bold text-white">{assistant.drawdownProtectionPercent}% Threshold</span>
                            </div>
                        </div>

                        {strategy && (
                            <div className="bg-indigo-950/15 border border-indigo-500/10 p-4 rounded-2xl space-y-2">
                                <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                                    <Shield className="w-4 h-4" />
                                    Active Strategy Catalyst
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">{strategy.objective}</p>
                            </div>
                        )}
                    </div>

                </div>

            </div>

            {/* Overrides Confirmation Modals */}
            <AnimatePresence>
                {modalType && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
                        >
                            <button
                                onClick={() => setModalType(null)}
                                className="absolute right-4 top-4 text-slate-500 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {modalType === "pause" && (
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                                        <Pause className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Pause "{assistant.name}"?</h3>
                                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                            Active positions remain open. Their SL/TP levels will still be monitored. No new trades will be initiated while paused. Non-deployed cash (₹{Math.max(0, assistant.allocatedCapital - assistant.deployedCapital).toLocaleString()}) is released back to your available portfolio balance.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setModalType(null)}
                                            className="flex-1 border border-slate-800 hover:border-slate-700 font-semibold text-xs py-3 rounded-xl transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            disabled={actionLoading === "status"}
                                            onClick={handleToggleStatus}
                                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-3 rounded-xl transition-all disabled:opacity-50"
                                        >
                                            {actionLoading === "status" ? "Pausing..." : "Confirm Pause"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {modalType === "emergency" && (
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center animate-pulse">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Trigger Emergency Halt?</h3>
                                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                            This will pause all active assistants and cancel all pending entry orders. Since flatten positions is checked, the system will immediately close all assistant-managed positions at current market prices. Manual portfolio holdings will <span className="text-emerald-400 font-bold uppercase">NOT</span> be affected.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setModalType(null)}
                                            className="flex-1 border border-slate-800 hover:border-slate-700 font-semibold text-xs py-3 rounded-xl transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            disabled={actionLoading === "emergency"}
                                            onClick={handleEmergencyStop}
                                            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-3 rounded-xl transition-all disabled:opacity-50"
                                        >
                                            {actionLoading === "emergency" ? "Halting..." : "Confirm Halt & Sell"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {modalType === "convert" && (
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                        <Check className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Convert {selectedSymbol ? formatSymbol(selectedSymbol) : ""} to Manual?</h3>
                                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                            This will cancel the active Stop Loss and Take Profit orders managed by the assistant for this ticker. You will be responsible for manually tracking and exiting this position. Deployed budget limits will be released.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setModalType(null)}
                                            className="flex-1 border border-slate-800 hover:border-slate-700 font-semibold text-xs py-3 rounded-xl transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            disabled={actionLoading === "convert"}
                                            onClick={handleConvertPosition}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-3 rounded-xl transition-all disabled:opacity-50"
                                        >
                                            {actionLoading === "convert" ? "Converting..." : "Confirm Conversion"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {modalType === "close" && (
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                                        <Trash2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Liquidate {selectedSymbol ? formatSymbol(selectedSymbol) : ""}?</h3>
                                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                            This will immediately execute a virtual market sell order to close this holding. Associated SL/TP exit orders will be cancelled. Realized profit or loss will be updated immediately.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setModalType(null)}
                                            className="flex-1 border border-slate-800 hover:border-slate-700 font-semibold text-xs py-3 rounded-xl transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            disabled={actionLoading === "close"}
                                            onClick={handleClosePosition}
                                            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-3 rounded-xl transition-all disabled:opacity-50"
                                        >
                                            {actionLoading === "close" ? "Selling..." : "Confirm Close"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {modalType === "delete" && (
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                                        <Trash2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Delete "{assistant.name}"?</h3>
                                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                            Select whether you want to immediately liquidate all open holdings managed by this assistant or detach them and convert them to manual holdings.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            disabled={actionLoading === "delete"}
                                            onClick={() => handleDeleteAssistant(false)}
                                            className="flex-1 border border-slate-700 hover:border-slate-650 text-slate-200 font-semibold text-[10px] py-3 rounded-xl transition-all disabled:opacity-50"
                                        >
                                            Convert Positions & Delete
                                        </button>
                                        <button
                                            disabled={actionLoading === "delete"}
                                            onClick={() => handleDeleteAssistant(true)}
                                            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[10px] py-3 rounded-xl transition-all disabled:opacity-50"
                                        >
                                            Liquidate & Delete
                                        </button>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Slide Settings Drawer */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSettingsOpen(false)}
                            className="fixed inset-0 bg-black z-40"
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "tween", duration: 0.3 }}
                            className="fixed right-0 top-0 bottom-0 max-w-md w-full bg-slate-900 border-l border-slate-800 z-50 p-6 overflow-y-auto space-y-6 shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-white">Assistant Parameters Settings</h3>
                                    <p className="text-[10px] text-slate-400">Modify running parameters on the fly.</p>
                                </div>
                                <button
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="text-slate-500 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {settingsError && (
                                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{settingsError}</span>
                                </div>
                            )}

                            {settingsSuccess && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs flex gap-2">
                                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>Settings updated successfully!</span>
                                </div>
                            )}

                            <form onSubmit={handleSaveSettings} className="space-y-5">
                                {/* Name Input */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assistant Name</label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-700 outline-none"
                                        required
                                    />
                                </div>

                                {/* Capital Input */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Allocated Capital (₹)</label>
                                    <input
                                        type="number"
                                        value={formCapital}
                                        onChange={(e) => setFormCapital(parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-950 border border-slate-855 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-700 outline-none"
                                        required
                                    />
                                    <span className="text-[9px] text-slate-500 block">Current deployed: ₹{assistant.deployedCapital.toLocaleString()}</span>
                                </div>

                                {/* Max Position Slider */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                        <span className="text-slate-400">Max Trade Sizing</span>
                                        <span className="text-indigo-400">{formMaxPosPercent}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="5"
                                        max="100"
                                        step="5"
                                        value={formMaxPosPercent}
                                        onChange={(e) => setFormMaxPosPercent(parseInt(e.target.value))}
                                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>

                                {/* Stop Loss Slider */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                        <span className="text-slate-400">Stop Loss (SL)</span>
                                        <span className="text-indigo-400">{formStopLoss}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="2.0"
                                        max="15.0"
                                        step="0.5"
                                        value={formStopLoss}
                                        onChange={(e) => setFormStopLoss(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>

                                {/* Take Profit Slider */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                        <span className="text-slate-400">Take Profit (TP)</span>
                                        <span className="text-indigo-400">{formTakeProfit}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="5.0"
                                        max="30.0"
                                        step="0.5"
                                        value={formTakeProfit}
                                        onChange={(e) => setFormTakeProfit(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>

                                {/* Min Confluence Slider */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                        <span className="text-slate-400">Min Confluence match</span>
                                        <span className="text-indigo-400">{formMinScore}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="50"
                                        max="95"
                                        step="5"
                                        value={formMinScore}
                                        onChange={(e) => setFormMinScore(parseInt(e.target.value))}
                                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>

                                {/* Concurrent Slots Slider */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                        <span className="text-slate-400">Max Position slots</span>
                                        <span className="text-indigo-400">{formMaxConcurrent} slots</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="1"
                                        value={formMaxConcurrent}
                                        onChange={(e) => setFormMaxConcurrent(parseInt(e.target.value))}
                                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>

                                {/* Max Daily Loss */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Max Daily Loss (₹)</label>
                                    <input
                                        type="number"
                                        value={formMaxDailyLoss}
                                        onChange={(e) => setFormMaxDailyLoss(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-700 outline-none"
                                        required
                                    />
                                </div>

                                {/* Cooldown minutes */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cooldown Period (Minutes)</label>
                                    <input
                                        type="number"
                                        value={formCooldown}
                                        onChange={(e) => setFormCooldown(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-700 outline-none"
                                        required
                                    />
                                </div>

                                {/* Max Sector Exposure */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                        <span className="text-slate-400">Max Sector Exposure</span>
                                        <span className="text-indigo-400">{formMaxSectorPercent}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        step="5"
                                        value={formMaxSectorPercent}
                                        onChange={(e) => setFormMaxSectorPercent(parseInt(e.target.value))}
                                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>

                                {/* Peak Drawdown Protection */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                        <span className="text-slate-400">Peak Drawdown Protection</span>
                                        <span className="text-indigo-400">{formDrawdownPercent}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="2"
                                        max="30"
                                        step="1"
                                        value={formDrawdownPercent}
                                        onChange={(e) => setFormDrawdownPercent(parseInt(e.target.value))}
                                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>

                                {/* Trailing SL */}
                                <div className="flex items-center gap-3 pt-2">
                                    <input
                                        type="checkbox"
                                        id="edit-trailing"
                                        checked={formUseTrailing}
                                        onChange={(e) => setFormUseTrailing(e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/50 focus:ring-offset-slate-900 focus:ring-1 border-slate-850 bg-slate-950"
                                    />
                                    <label htmlFor="edit-trailing" className="text-xs font-semibold text-slate-300 select-none cursor-pointer">
                                        Enable Trailing Stop Loss
                                    </label>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-slate-800/80">
                                    <button
                                        type="button"
                                        onClick={() => setIsSettingsOpen(false)}
                                        className="flex-1 border border-slate-800 hover:border-slate-700 font-semibold text-xs py-3 rounded-xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={settingsLoading}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-3 rounded-xl transition-all disabled:opacity-50"
                                    >
                                        {settingsLoading ? "Saving..." : "Save Settings"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
