import type { Student } from "../types";
import Tooltip from "./Tooltip";
import { Camera, Pencil, Trash2, Loader2 } from "lucide-react";

export default function StudentsGrid({
  students,
  uploadingId,
  onEdit,
  onDelete,
  onPhotoUpload,
}: {
  students: Student[];
  uploadingId: number | null;
  onEdit: (s: Student) => void;
  onDelete: (s: Student) => void;
  onPhotoUpload: (s: Student) => void;
}) {
  if (students.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <div className="text-4xl mb-2">👤</div>
        <p className="text-sm">Aucun élève trouvé.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
      {students.map((s) => (
        <div
          key={s.id}
          className="group relative bg-white rounded-2xl border border-slate-200 hover:border-violet-300 hover:shadow-md transition-all p-4 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center ring-2 ring-white shadow-sm mb-3">
            {s.photoUrl ? (
              <img src={s.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-violet-600 font-bold text-xl">
                {s.firstName[0]}{s.lastName[0]}
              </span>
            )}
          </div>
          <p className="font-semibold text-slate-700 text-sm truncate w-full" title={`${s.firstName} ${s.lastName}`}>
            {s.firstName} {s.lastName}
          </p>
          <p className="text-xs text-slate-400 truncate w-full" title={s.email}>{s.email}</p>
          {s.class && (
            <span className="mt-2 inline-block bg-violet-100 text-violet-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {s.class.label} {s.class.year}
            </span>
          )}

          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg p-0.5">
            <Tooltip label="Photo">
              <button
                onClick={() => onPhotoUpload(s)}
                disabled={uploadingId === s.id}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
              >
                {uploadingId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
            </Tooltip>
            <Tooltip label="Modifier">
              <button
                onClick={() => onEdit(s)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors"
              >
                <Pencil size={14} />
              </button>
            </Tooltip>
            <Tooltip label="Supprimer">
              <button
                onClick={() => onDelete(s)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}
