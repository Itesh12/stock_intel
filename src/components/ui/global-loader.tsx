"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface LoaderStep {
    label: string;
    threshold: number; // 0-100
}

interface GlobalLoaderProps {
    /** 
     * If provided, controls the progress. 
     * If unprovided, the loader will automatically increment to simulate loading.
     */
    progress?: number; 
    title?: string;
    steps?: LoaderStep[];
    fullScreen?: boolean;
    onComplete?: () => void;
}

const DEFAULT_STEPS: LoaderStep[] = [
    { label: "System Check", threshold: 20 },
    { label: "Data Flow", threshold: 50 },
    { label: "Market Activity", threshold: 80 },
    { label: "Ready", threshold: 95 }
];

export function GlobalLoader({ 
    progress: externalProgress, 
    title = "Loading Data", 
    steps = DEFAULT_STEPS,
    fullScreen = false,
    onComplete
}: GlobalLoaderProps) {
    const [internalProgress, setInternalProgress] = useState(0);

    const isControlled = externalProgress !== undefined;
    const progress = Math.min(100, Math.max(0, isControlled ? externalProgress : internalProgress));

    useEffect(() => {
        if (isControlled) {
            // Wait a drop of time after 100% so the UI visually finishes stroke 
            if (progress >= 100 && onComplete) {
                const tm = setTimeout(() => { onComplete() }, 400);
                return () => clearTimeout(tm);
            }
            return;
        }

        const interval = setInterval(() => {
            setInternalProgress(prev => {
                // If it's pure simulation, we never hit 100. We wait for unmount.
                if (prev >= 99) return 99;
                
                // Asymptotic approach to 99%
                const remaining = 99 - prev;
                let jump = Math.max(0.1, remaining * (Math.random() * 0.15));
                
                // Fast start to give impression of speed
                if (prev < 40) {
                    jump = Math.random() * 12 + 4;
                } else if (prev >= 95) {
                    jump = Math.random() * 0.4; // Creep very slowly at the end
                }

                return Math.min(99, prev + jump);
            });
        }, 120);

        return () => clearInterval(interval);
    }, [isControlled, externalProgress, onComplete, progress]);

    const content = (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn(
                "flex flex-col items-center justify-center space-y-12 w-full",
                fullScreen ? "fixed inset-0 z-[200] bg-black/80 backdrop-blur-2xl" : "min-h-[500px] h-[60vh] py-12"
            )}
        >
            <div className="relative w-72 h-72">
                <svg className="w-full h-full -rotate-90">
                    <circle
                        cx="144"
                        cy="144"
                        r="130"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        className="text-white/5"
                    />
                    <motion.circle
                        cx="144"
                        cy="144"
                        r="130"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray="816.8"
                        initial={{ strokeDashoffset: 816.8 }}
                        animate={{ strokeDashoffset: 816.8 - (816.8 * progress) / 100 }}
                        className="text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black text-white font-mono">{Math.round(progress)}%</span>
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.4em] mt-2 text-center break-words max-w-[150px] leading-relaxed">{title}</span>
                </div>
            </div>

            {steps && steps.length > 0 && (
                <div className={cn(
                    "grid gap-4 md:gap-6 w-full max-w-4xl px-6",
                    steps.length === 4 ? "grid-cols-2 lg:grid-cols-4" : 
                    steps.length === 3 ? "grid-cols-1 md:grid-cols-3" : 
                    "grid-cols-2"
                )}>
                    {steps.map((step, idx) => (
                        <StatusPulse key={idx} label={step.label} active={progress >= step.threshold} />
                    ))}
                </div>
            )}
        </motion.div>
    );

    return content;
}

function StatusPulse({ label, active }: { label: string; active: boolean }) {
    return (
        <div className={cn(
            "flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-700",
            active ? "bg-blue-600/5 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.05)]" : "bg-white/[0.01] border-white/5 opacity-40"
        )}>
            <div className={cn(
                "w-2 h-2 shrink-0 rounded-full transition-all duration-700",
                active ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" : "bg-slate-800"
            )}></div>
            <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                active ? "text-blue-400" : "text-slate-700"
            )}>{label}</span>
        </div>
    );
}
