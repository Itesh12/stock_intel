"use client";
import React, { useState, useEffect } from "react";
import { Bell, BellOff, Trash2, Plus, Loader2, TrendingUp, TrendingDown, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AlertManager({ symbol, currentPrice }: { symbol: string; currentPrice: number }) {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newAlert, setNewAlert] = useState({ targetPrice: '', condition: 'ABOVE' as 'ABOVE' | 'BELOW' });

    const fetchAlerts = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/stock/alerts?symbol=${symbol}`);
            const data = await res.json();
            setAlerts(data || []);
        } catch (err) {
            console.error("Failed to fetch alerts", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Check if any active alert has been triggered
    useEffect(() => {
        fetchAlerts();
    }, [symbol]);

    useEffect(() => {
        if (!alerts.length || !currentPrice) return;
        alerts.forEach(alert => {
            if (!alert.isActive) return;
            const triggered =
                (alert.condition === 'ABOVE' && currentPrice >= alert.targetPrice) ||
                (alert.condition === 'BELOW' && currentPrice <= alert.targetPrice);
            if (triggered && typeof window !== 'undefined' && 'Notification' in window) {
                Notification.requestPermission().then(perm => {
                    if (perm === 'granted') {
                        new Notification(`🚨 ${symbol} Alert Triggered!`, {
                            body: `Price is ${alert.condition === 'ABOVE' ? 'above' : 'below'} ₹${alert.targetPrice}. Current: ₹${currentPrice}`,
                            icon: '/favicon.ico'
                        });
                    }
                });
            }
        });
    }, [currentPrice, alerts, symbol]);

    const handleSave = async () => {
        if (!newAlert.targetPrice) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/stock/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, ...newAlert, targetPrice: parseFloat(newAlert.targetPrice) })
            });
            if (res.ok) {
                await fetchAlerts();
                setNewAlert({ targetPrice: '', condition: 'ABOVE' });
                setIsAdding(false);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`/api/stock/alerts?id=${id}`, { method: 'DELETE' });
            setAlerts(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <Bell size={16} className="text-amber-400" />
                    <span className="text-sm font-black text-white tracking-tight">Price Alerts</span>
                    {alerts.filter(a => a.isActive).length > 0 && (
                        <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                            {alerts.filter(a => a.isActive).length} Active
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-amber-400 bg-amber-400/10 hover:bg-amber-400 hover:text-black rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                >
                    {isAdding ? 'Cancel' : 'New Alert'} <Plus size={11} />
                </button>
            </div>

            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-amber-400/5 border border-amber-400/10 rounded-2xl p-4 space-y-3">
                            <div className="flex gap-3">
                                <div className="flex gap-2 flex-1">
                                    {(['ABOVE', 'BELOW'] as const).map(cond => (
                                        <button
                                            key={cond}
                                            onClick={() => setNewAlert(p => ({ ...p, condition: cond }))}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                newAlert.condition === cond
                                                    ? cond === 'ABOVE' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-rose-500/20 border-rose-500/30 text-rose-400"
                                                    : "bg-white/5 border-white/5 text-slate-500"
                                            )}
                                        >
                                            {cond === 'ABOVE' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {cond}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    step="0.05"
                                    placeholder={`₹ Target`}
                                    value={newAlert.targetPrice}
                                    onChange={e => setNewAlert(p => ({ ...p, targetPrice: e.target.value }))}
                                    className="w-28 bg-black/20 border border-white/5 rounded-xl px-3 py-2 text-sm font-bold text-white text-center focus:outline-none focus:border-amber-400 transition-all"
                                />
                            </div>
                            <div className="text-[9px] text-slate-500 font-bold">
                                Current: <span className="text-white font-black">₹{currentPrice?.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !newAlert.targetPrice}
                                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                                Set Alert
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {isLoading ? (
                <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-amber-400/30" /></div>
            ) : alerts.length > 0 ? (
                <div className="space-y-2">
                    {alerts.map(alert => {
                        const triggered = alert.condition === 'ABOVE'
                            ? currentPrice >= alert.targetPrice
                            : currentPrice <= alert.targetPrice;
                        return (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-all group",
                                    triggered ? "bg-amber-400/10 border-amber-400/20" : "bg-white/[0.03] border-white/5"
                                )}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={cn(
                                        "w-6 h-6 rounded-lg flex items-center justify-center",
                                        alert.condition === 'ABOVE' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                    )}>
                                        {alert.condition === 'ABOVE' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-white leading-none">₹{alert.targetPrice.toFixed(2)}</div>
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{alert.condition} target</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {triggered && <CheckCircle size={14} className="text-amber-400" />}
                                    <button
                                        onClick={() => handleDelete(alert.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <div className="py-6 text-center border border-white/5 rounded-2xl bg-white/[0.02]">
                    <BellOff size={20} className="mx-auto mb-2 text-slate-700" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No alerts configured</span>
                </div>
            )}
        </div>
    );
}
