'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

type SnackbarType = 'success' | 'error' | 'info';

interface SnackbarMessage {
    id: string;
    message: string;
    type: SnackbarType;
}

interface SnackbarContextType {
    showSnackbar: (message: string, type?: SnackbarType) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const SnackbarProvider = ({ children }: { children: ReactNode }) => {
    const [snackbars, setSnackbars] = useState<SnackbarMessage[]>([]);

    const showSnackbar = useCallback((message: string, type: SnackbarType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setSnackbars((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setSnackbars((prev) => prev.filter((s) => s.id !== id));
        }, 4000);
    }, []);

    const removeSnackbar = (id: string) => {
        setSnackbars((prev) => prev.filter((s) => s.id !== id));
    };

    return (
        <SnackbarContext.Provider value={{ showSnackbar }}>
            {children}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-3 w-full max-w-sm px-4">
                {snackbars.map((snackbar) => (
                    <div
                        key={snackbar.id}
                        className="snackbar-item group"
                    >
                        {snackbar.type === 'success' && <CheckCircle2 className="text-emerald-400" size={20} />}
                        {snackbar.type === 'error' && <AlertCircle className="text-rose-400" size={20} />}
                        {snackbar.type === 'info' && <Info className="text-blue-400" size={20} />}

                        <span className="text-sm font-medium flex-1">{snackbar.message}</span>

                        <button
                            onClick={() => removeSnackbar(snackbar.id)}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <X size={14} className="text-slate-500" />
                        </button>
                    </div>
                ))}
            </div>
        </SnackbarContext.Provider>
    );
};

export const useSnackbar = () => {
    const context = useContext(SnackbarContext);
    if (!context) {
        throw new Error('useSnackbar must be used within a SnackbarProvider');
    }
    return context;
};
