"use client";
import React, { useState } from "react";
import { Palette, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme, THEMES } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl transition-all relative group border",
                    isOpen
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
                )}
                title="Theme Engine"
            >
                <Palette size={18} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -8 }}
                            className="absolute right-0 top-full mt-2 z-50 w-64 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                            style={{ background: 'var(--theme-card)' }}
                        >
                            <div className="px-4 pt-4 pb-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Palette size={12} className="text-slate-500" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Premium Theme Engine</span>
                                </div>
                            </div>
                            <div className="p-2 space-y-1">
                                {THEMES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { setTheme(t.id); setIsOpen(false); }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all hover:bg-white/5 text-left group",
                                            theme === t.id && "bg-white/[0.07]"
                                        )}
                                    >
                                        <div
                                            className="w-9 h-9 rounded-xl border border-white/10 shrink-0 shadow-lg"
                                            style={{
                                                background: `radial-gradient(circle at 30% 30%, ${t.glow}70, ${t.preview})`,
                                                boxShadow: theme === t.id ? `0 0 16px ${t.glow}60` : 'none'
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black text-white leading-none mb-0.5">{t.label}</div>
                                            <div className="text-[9px] font-medium text-slate-600">{t.desc}</div>
                                        </div>
                                        {theme === t.id && (
                                            <div style={{ color: t.glow }}>
                                                <Check size={14} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <div className="px-4 py-3 border-t border-white/5 text-[8px] font-bold text-slate-700 uppercase tracking-widest text-center">
                                Saved automatically
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
