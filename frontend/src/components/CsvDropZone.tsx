import { useRef } from "react";
import { FolderOpen } from "lucide-react";

export default function CsvDropZone({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={`bg-white rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
        file ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-violet-300"
      }`}
    >
      <FolderOpen size={48} className="mb-3 place-self-center text-violet-300" />
      {file ? (
        <p className="text-sm font-semibold text-violet-700">{file.name}</p>
      ) : (
        <div>
          <p className="text-sm font-medium text-slate-600 mb-1">Cliquez pour sélectionner un fichier</p>
          <p className="text-xs text-slate-400">Format .csv uniquement</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
