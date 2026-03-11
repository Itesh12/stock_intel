import TraderJournal from "@/components/portfolio/TraderJournal";

export default function JournalPage() {
    return (
        <div className="max-w-4xl mx-auto py-8 px-6 pb-20">
            <div className="mb-10 text-center">
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Private Trading Diary</span>
                </div>
                <h1 className="text-5xl font-black text-white tracking-tighter mb-4">Trader <span className="text-blue-500">Journal</span></h1>
                <p className="text-slate-500 font-medium text-sm max-w-lg mx-auto">
                    Document your trade rationale, market observations, and strategy notes. Your private intelligence library.
                </p>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-[32px] p-8">
                <TraderJournal />
            </div>
        </div>
    );
}
