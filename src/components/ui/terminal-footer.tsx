"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, RefreshCcw, ShieldCheck, Database, Server, Terminal, Hexagon } from 'lucide-react';

export default function TerminalFooter() {
    const [time, setTime] = useState('18:55:50');

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setTime(now.toLocaleTimeString('en-GB', { hour12: false }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-24 border-t border-white/5 pt-16 pb-12 bg-black/20"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 px-4">
                {/* Brand Column */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                            <span className="text-white font-black text-xs tracking-tighter">SI</span>
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">StockIntel Terminal</h3>
                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">V2.4 Mastery Edition</p>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-[0.15em] max-w-sm">
                        Cryptographically audited financial pipeline. All data packets are synced with primary exchange protocols.
                    </p>
                </div>

                {/* Temporal Sync */}
                <div className="lg:col-span-2 space-y-6">
                    <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Temporal Sync</h4>
                    <ul className="space-y-4 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                        <li className="hover:text-blue-400 cursor-pointer transition-colors">Pipeline Logs</li>
                        <li className="hover:text-blue-400 cursor-pointer transition-colors">API Endpoint Audit</li>
                        <li className="hover:text-blue-400 cursor-pointer transition-colors">Registry Hash</li>
                    </ul>
                </div>

                {/* Support Hub */}
                <div className="lg:col-span-2 space-y-6">
                    <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Support Hub</h4>
                    <ul className="space-y-4 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                        <li className="hover:text-blue-400 cursor-pointer transition-colors">Matrix Support</li>
                        <li className="hover:text-blue-400 cursor-pointer transition-colors">Protocol Specs</li>
                        <li className="hover:text-blue-400 cursor-pointer transition-colors">Licensing</li>
                    </ul>
                </div>

                {/* Status Column */}
                <div className="lg:col-span-4 flex flex-col items-end justify-between py-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-slate-600 hover:text-blue-400 hover:border-blue-500/30 transition-all cursor-pointer">
                            <Globe size={16} />
                        </div>
                        <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-slate-600 hover:text-blue-400 hover:border-blue-500/30 transition-all cursor-pointer">
                            <RefreshCcw size={16} />
                        </div>
                    </div>
                    <div className="text-right space-y-1.5">
                        <div className="flex items-center justify-end gap-2 text-[10px] font-black text-slate-200 uppercase tracking-[0.3em]">
                            Registry Tracking Active
                        </div>
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
                            Last Packet: <span className="text-blue-500 font-mono">{time}</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
