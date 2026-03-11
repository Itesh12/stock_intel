"use client";
import React, { useState, useEffect } from "react";
import { BookOpen, Pencil, Trash2, Plus, Loader2, StickyNote, Tag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function TraderJournal() {
    const [entries, setEntries] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [newEntry, setNewEntry] = useState({ content: '', symbol: '', tags: '' });
    const [isSaving, setIsSaving] = useState(false);

    const fetchEntries = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/portfolio/journal');
            const data = await res.json();
            setEntries(data || []);
        } catch (err) {
            console.error("Failed to fetch journal", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
    }, []);

    const handleSave = async () => {
        if (!newEntry.content) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/portfolio/journal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newEntry,
                    tags: newEntry.tags.split(',').map(t => t.trim()).filter(Boolean)
                })
            });
            if (res.ok) {
                await fetchEntries();
                setNewEntry({ content: '', symbol: '', tags: '' });
                setIsAdding(false);
            }
        } catch (err) {
            console.error("Save failed", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this entry?')) return;
        try {
            const res = await fetch(`/api/portfolio/journal?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchEntries();
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BookOpen size={20} className="text-blue-500" />
                    <h2 className="text-xl font-bold text-white tracking-tight">Trader Journal</h2>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-blue-500/20"
                >
                    {isAdding ? 'Close' : 'New Note'}
                    <Plus size={14} />
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
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 mb-8 shadow-2xl">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Symbol (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. RELIANCE"
                                        value={newEntry.symbol}
                                        onChange={(e) => setNewEntry({ ...newEntry, symbol: e.target.value.toUpperCase() })}
                                        className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all uppercase font-bold"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tags (Comma separated)</label>
                                    <input
                                        type="text"
                                        placeholder="Breakout, High-Volume"
                                        value={newEntry.tags}
                                        onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                                        className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Observation & Logic</label>
                                <textarea
                                    placeholder="Why did you take this trade? What is the technical setup?"
                                    rows={4}
                                    value={newEntry.content}
                                    onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                                    className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all resize-none font-medium"
                                />
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !newEntry.content}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-900/20"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Archive Note
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoading ? (
                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-blue-500/20" size={32} /></div>
                ) : entries.length > 0 ? (
                    entries.map((entry, idx) => (
                        <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:bg-white/[0.05] transition-all group relative"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/10">
                                        <StickyNote size={14} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">
                                            {new Date(entry.createdAt).toLocaleDateString()} at {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {entry.symbol && (
                                            <div className="text-xs font-black text-blue-400 uppercase tracking-tighter leading-none">{entry.symbol} Context</div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(entry.id)}
                                    className="p-2 opacity-0 group-hover:opacity-100 rounded-lg text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <p className="text-sm text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                            {entry.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/[0.02]">
                                    {entry.tags.map((tag: string) => (
                                        <span key={tag} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                                            <Tag size={8} />
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ))
                ) : (
                    <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <BookOpen size={24} className="text-slate-600" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">No entries yet. Start journaling your strategy.</span>
                    </div>
                )}
            </div>
        </div>
    );
}
