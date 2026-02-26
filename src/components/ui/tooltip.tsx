"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom';
}

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative flex items-center group"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className={cn(
                    "absolute left-1/2 -translate-x-1/2 z-[100] w-64 p-3 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200 pointer-events-none",
                    position === 'top' ? "bottom-full mb-3" : "top-full mt-3"
                )}>
                    <div className="text-[8px] uppercase tracking-[0.2em] font-black text-blue-500 mb-1.5 opacity-80">
                        System Intelligence
                    </div>
                    <div className="text-[10px] font-medium text-slate-300 leading-relaxed">
                        {content}
                    </div>
                    {/* Arrow */}
                    <div className={cn(
                        "absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-black/95 border-r border-b border-white/10 rotate-45",
                        position === 'top' ? "top-full -mt-[5px]" : "bottom-full -mb-[5px] rotate-[225deg]"
                    )}></div>
                </div>
            )}
        </div>
    );
}
