import { Link } from "react-router-dom";

export default function QuickLinkCard({
  to,
  label,
  sub,
  iconBg,
  iconColor,
  border,
}: {
  to: string;
  label: string;
  sub: string;
  iconBg: string;
  iconColor: string;
  border: string;
}) {
  return (
    <Link
      to={to}
      className={`group bg-white rounded-2xl border border-slate-200 ${border} hover:shadow-md p-5 flex flex-col gap-3 transition-all duration-200`}
    >
      <div className={`w-9 h-9 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center`}>
        <span className="text-lg font-bold">→</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 leading-tight">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      </div>
    </Link>
  );
}
