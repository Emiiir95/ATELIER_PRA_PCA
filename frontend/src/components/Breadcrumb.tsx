import { useNavigate } from "react-router-dom";

export default function Breadcrumb({
  parent,
  parentPath,
  current,
}: {
  parent: string;
  parentPath: string;
  current?: string;
}) {
  const navigate = useNavigate();

  if (!current) {
    return (
      <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-1">
        {parent}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm mb-2">
      <button
        onClick={() => navigate(parentPath)}
        className="text-violet-600 hover:underline font-medium"
      >
        {parent}
      </button>
      <span className="text-violet-600">›</span>
      <span className="text-slate-600 font-medium">{current}</span>
    </div>
  );
}
