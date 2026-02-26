'use client';

import { useSession, signOut } from "next-auth/react";

export function UserNav() {
    const { data: session } = useSession();

    if (!session?.user) return null;

    return (
        <div className="mt-auto p-6 border-t border-white/5 bg-gradient-to-t from-black/20 to-transparent">
            <div
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.08] transition-all duration-300 cursor-pointer group"
                onClick={() => signOut()}
            >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-bold text-white shadow-inner group-hover:from-blue-600 group-hover:to-indigo-600 transition-all duration-500">
                    {session.user.name?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate leading-tight group-hover:text-blue-400 transition-colors">{session.user.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5 uppercase tracking-tighter opacity-50">Premium Analyst</div>
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 group-hover:text-red-400 group-hover:bg-red-400/10 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                </div>
            </div>
        </div>
    );
}
