"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Trash2, Zap, Shield, Briefcase, Info, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
    id: string;
    title: string;
    message: string;
    type: "SIGNAL" | "SYSTEM" | "PORTFOLIO";
    severity: "INFO" | "WARNING" | "CRITICAL";
    timestamp: string;
    read: boolean;
}

const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const then = new Date(dateStr);
    const diff = now.getTime() - then.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
};

export function NotificationsPopover() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/notifications");
            const data = await res.json();
            if (Array.isArray(data)) setNotifications(data);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await fetch("/api/notifications", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (err) {
            console.error("Failed to mark as read", err);
        }
    };

    const markAllAsRead = async () => {
        setMarkingAll(true);
        try {
            await fetch("/api/notifications", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ all: true })
            });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err) {
            console.error("Failed to mark all as read", err);
        } finally {
            setMarkingAll(false);
        }
    };

    const getTypeIcon = (type: Notification["type"], severity: Notification["severity"]) => {
        switch (type) {
            case "SIGNAL": return <Zap size={14} className={severity === "CRITICAL" ? "text-rose-400" : "text-blue-400"} />;
            case "PORTFOLIO": return <Briefcase size={14} className="text-emerald-400" />;
            case "SYSTEM": return <Shield size={14} className="text-violet-400" />;
            default: return <Info size={14} className="text-slate-400" />;
        }
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl transition-all relative group border",
                    isOpen 
                        ? "bg-blue-600/20 border-blue-500/50 text-blue-400" 
                        : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
                )}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-[#050505] animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-4 w-80 sm:w-96 bg-[#0a0a0b]/95 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Intelligence Feed</h3>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-[10px] font-black text-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </div>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    disabled={markingAll}
                                    className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1.5"
                                >
                                    {markingAll ? <Loader2 size={10} className="animate-spin" /> : <CheckCheck size={12} />}
                                    Clear All
                                </button>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {loading && notifications.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Loader2 size={24} className="animate-spin text-blue-500 mx-auto mb-4 opacity-50" />
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Syncing Nodes...</p>
                                </div>
                            ) : notifications.length > 0 ? (
                                <div className="divide-y divide-white/5">
                                    {notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            onClick={() => !n.read && markAsRead(n.id)}
                                            className={cn(
                                                "p-5 hover:bg-white/[0.03] transition-all cursor-pointer relative group",
                                                !n.read && "bg-blue-600/[0.02]"
                                            )}
                                        >
                                            {!n.read && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
                                            )}
                                            <div className="flex gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105",
                                                    n.read ? "bg-white/5 border-white/5" : "bg-blue-600/10 border-blue-500/20"
                                                )}>
                                                    {getTypeIcon(n.type, n.severity)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1 gap-2">
                                                        <span className={cn(
                                                            "text-xs font-black truncate tracking-tight",
                                                            n.read ? "text-slate-400" : "text-white"
                                                        )}>
                                                            {n.title}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-600 whitespace-nowrap">
                                                            {formatRelativeTime(n.timestamp)}
                                                        </span>
                                                    </div>
                                                    <p className={cn(
                                                        "text-[11px] leading-relaxed line-clamp-2",
                                                        n.read ? "text-slate-500" : "text-slate-300"
                                                    )}>
                                                        {n.message}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center opacity-30">
                                    <Bell size={32} className="mx-auto mb-4 text-slate-700" />
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                                        Terminal Silence<br />
                                        No active transmissions detected
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-white/[0.02] border-t border-white/5 text-center">
                            <button className="text-[9px] font-black text-slate-600 hover:text-blue-400 uppercase tracking-[0.2em] transition-colors">
                                Neural Alert Settings
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
