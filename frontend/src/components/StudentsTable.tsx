import type { Student } from "../types";
import Table from "./Table";
import Tooltip from "./Tooltip";
import { Camera, Pencil, Trash2, Loader2 } from "lucide-react";

const COLUMNS = ["Photo", "Nom", "Email", "Classe", ""];

export default function StudentsTable({
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
  return (
    <Table columns={COLUMNS} empty={{ icon: "👤", message: "Aucun élève trouvé." }}>
      {students.map((s) => (
        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
          <td className="px-6 py-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center ring-2 ring-white">
              {s.photoUrl ? (
                <img src={s.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-violet-600 font-bold text-sm">
                  {s.firstName[0]}{s.lastName[0]}
                </span>
              )}
            </div>
          </td>
          <td className="px-6 py-4 font-semibold text-slate-700">{s.firstName} {s.lastName}</td>
          <td className="px-6 py-4 text-slate-400 text-xs">{s.email}</td>
          <td className="px-6 py-4">
            {s.class && (
              <span className="inline-block bg-violet-100 text-violet-600 text-xs font-semibold px-3 py-1 rounded-full">
                {s.class.label} {s.class.year}
              </span>
            )}
          </td>
          <td className="px-6 py-4 text-right">
            <div className="flex items-center justify-end gap-1">
              <Tooltip label="Changer la photo">
                <button onClick={() => onPhotoUpload(s)} disabled={uploadingId === s.id} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition-colors">
                  {uploadingId === s.id ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                </button>
              </Tooltip>

              <Tooltip label="Modifier">
                <button onClick={() => onEdit(s)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                  <Pencil size={16} />
                </button>
              </Tooltip>
              <Tooltip label="Supprimer">
                <button onClick={() => onDelete(s)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={16} />
                </button>
              </Tooltip>
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}
