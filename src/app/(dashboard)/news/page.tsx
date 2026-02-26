export default function NewsIntelligencePage() {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex items-end justify-between border-b border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-glow"></span>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">Semantic Stream</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight font-outfit">News Intelligence</h1>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Real-time sentiment analysis and high-impact event indexing.</p>
                </div>
            </div>

            <div className="glass-morphic-card rounded-[40px] p-20 flex flex-col items-center justify-center text-center">
                <div className="w-32 h-32 rounded-full border border-indigo-500/20 flex items-center justify-center mb-10 relative">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin-slow"></div>
                    <div className="w-24 h-24 rounded-full bg-indigo-500/10 flex items-center justify-center">
                        <span className="text-4xl text-white">📡</span>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4 font-outfit">Scanning Global Channels...</h2>
                <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    The platform is currently listening for high-impact financial events and regulatory shifts. Ensure your institutional API keys are active to enable deep-stream processing.
                </p>
            </div>
        </div>
    );
}
