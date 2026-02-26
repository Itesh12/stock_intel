'use client';

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useSnackbar } from "@/components/ui/snackbar";
import { useLoader } from "@/components/ui/loader-provider";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const { showSnackbar } = useSnackbar();
    const { showLoader, hideLoader } = useLoader();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        showLoader("Authenticating Credentials...");

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                showSnackbar("Invalid email or password. Access Denied.", "error");
                hideLoader();
            } else {
                showSnackbar("Access Granted. Synchronizing Portfolio...", "success");
                setTimeout(() => {
                    hideLoader();
                    window.location.href = "/";
                }, 1000);
            }
        } catch (error) {
            showSnackbar("System error. Connection refused.", "error");
            hideLoader();
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent">
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-6 font-outfit">
                        <span className="text-3xl font-black text-white">S</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white font-outfit tracking-tight">Sign In</h1>
                    <p className="text-slate-500 mt-2 text-sm text-center">Access your professional portfolio and market intelligence.</p>
                </div>

                <div className="glass-card p-10 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>

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

                        <div className="space-y-2">
                            <label className="label-text">Password</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-slate-500 group-focus-within/input:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-blue-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <div className="flex justify-end px-1 pt-1">
                                <Link href="/auth/forgot-password" title="Recover account" className="text-[11px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-wider transition-colors">Forgot Password?</Link>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary w-full h-[54px]"
                        >
                            <>
                                Sign In
                                <ArrowRight size={18} />
                            </>
                        </button>
                    </form>
                </div>

                <p className="mt-8 text-center text-sm text-slate-500">
                    New to StockIntel? <Link href="/auth/register" className="text-blue-500 font-bold hover:text-blue-400 transition-colors">Create Account</Link>
                </p>
            </div>
        </div>
    );
}
