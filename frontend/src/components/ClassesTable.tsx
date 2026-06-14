import { useNavigate } from "react-router-dom";
import type { Class } from "../types";
import Table from "./Table";
import Tooltip from "./Tooltip";
import { Users, Pencil, Trash2 } from "lucide-react";

const COLUMNS = ["Label", "Année", "Élèves", "Créée le", ""];

export default function ClassesTable({
  classes,
  onEdit,
  onDelete,
}: {
  classes: Class[];
  onEdit: (cls: Class) => void;
  onDelete: (cls: Class) => void;
}) {
  const navigate = useNavigate();

  return (
    <Table columns={COLUMNS} empty={{ icon: "🎓", message: "Aucune classe. Créez-en une !" }}>
      {classes.map((cls) => (
        <tr key={cls.id} className="hover:bg-slate-50 transition-colors">
          <td className="px-6 py-4 font-semibold text-slate-700">{cls.label}</td>
          <td className="px-6 py-4 text-slate-500">{cls.year}</td>
          <td className="px-6 py-4">
            <span className="inline-block bg-violet-100 text-violet-600 text-xs font-semibold px-3 py-1 rounded-full">
              {cls._count?.students ?? 0} élève{(cls._count?.students ?? 0) !== 1 ? "s" : ""}
            </span>
          </td>
          <td className="px-6 py-4 text-slate-400 text-xs">
            {new Date(cls.createdAt).toLocaleDateString("fr-FR")}
          </td>
          <td className="px-6 py-4 text-right">
            <div className="flex items-center justify-end gap-1">
              <Tooltip label="Voir les élèves">
                <button onClick={() => navigate(`/students?classId=${cls.id}`)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <Users size={16} />
                </button>
              </Tooltip>
              <Tooltip label="Modifier">
                <button onClick={() => onEdit(cls)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                  <Pencil size={16} />
                </button>
              </Tooltip>
              <Tooltip label="Supprimer">
                <button onClick={() => onDelete(cls)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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
