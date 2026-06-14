const STYLES = {
  violet: { dot: "bg-violet-600", value: "text-violet-600", bar: "bg-violet-200" },
  emerald: { dot: "bg-emerald-600", value: "text-emerald-600", bar: "bg-emerald-200" },
  amber:   { dot: "bg-amber-500",  value: "text-amber-600",  bar: "bg-amber-200"  },
} as const;

export default function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: keyof typeof STYLES;
}) {
  const s = STYLES[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <div className={`w-2 h-2 rounded-full ${s.dot}`} />
      </div>
      <p className={`text-4xl font-extrabold tracking-tight ${s.value}`}>{value}</p>
      <div className={`h-1 rounded-full ${s.bar} w-full`} />
    </div>
  );
}
