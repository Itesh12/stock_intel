import { useTransition } from "react";

export default function TimeframeSelector({
    current,
    onSelect
}: {
    current: string;
    onSelect: (value: string) => void;
}) {
    const [isPending, startTransition] = useTransition();

    const options = [
        { label: "1D", value: "1d" },
        { label: "1M", value: "1mo" },
        { label: "3M", value: "3mo" },
        { label: "6M", value: "6mo" },
        { label: "1Y", value: "1y" },
        { label: "5Y", value: "5y" },
        { label: "YTD", value: "ytd" },
        { label: "ALL", value: "all" }
    ];

    const handleSelect = (value: string) => {
        startTransition(() => {
            onSelect(value);
        });
    };

    return (
        <div className={`flex p-1 bg-white/5 rounded-xl border border-white/5 items-center transition-opacity ${isPending ? 'opacity-50' : 'opacity-100'}`}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    disabled={isPending}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${current === opt.value
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-slate-500 hover:text-slate-300"
                        }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
