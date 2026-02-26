'use client';

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, RefreshCw, Undo2 } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setSuccess(true);
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent">
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-6 font-outfit">
                        <RefreshCw size={28} className="text-white animate-spin-slow" />
                    </div>
                    <h1 className="text-3xl font-bold text-white font-outfit tracking-tight">Recover Password</h1>
                    <p className="text-slate-500 mt-2 text-sm text-center px-6">Enter your email address and we'll send you recovery instructions.</p>
                </div>

                <div className="glass-card p-10 relative overflow-hidden">
                    {success ? (
                        <div className="text-center space-y-6 py-4 animate-in zoom-in-95 duration-500">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Mail size={24} className="text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Instructions Sent</h3>
                                <p className="text-slate-500 text-sm font-medium">We've sent a recovery link to your email address. Please check your inbox.</p>
                            </div>
                            <Link href="/auth/login" className="btn-secondary w-full">
                                <ArrowLeft size={18} />
                                Return to Sign In
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="label-text">Email Address</label>
                                <div className="relative group/input">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail size={18} className="text-slate-500 group-focus-within/input:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="input-field"
                                        placeholder="your@email.com"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary w-full"
                            >
                                {loading ? "Sending..." : "Send Instructions"}
                            </button>

                            <Link href="/auth/login" className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-white transition-colors pt-2 font-medium">
                                <Undo2 size={14} />
                                Back to Sign In
                            </Link>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
