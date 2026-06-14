import { Download } from "lucide-react";
import { toast } from "sonner";

const TIPS = [
  "Si la classe n'existe pas, elle sera créée automatiquement",
  "Si l'email existe déjà, l'élève sera mis à jour",
  "La colonne photo_url est optionnelle",
  "Taille max : 2 MB",
];

const SAMPLE_CSV = `first_name,last_name,email,class_label,year,photo_url
Alice,Dupont,alice.dupont@example.com,BTS SIO,2024-2025,
Bob,Martin,bob.martin@example.com,BTS SIO,2024-2025,
Camille,Bernard,camille.bernard@example.com,M1 MIAGE,2024-2025,
David,Petit,david.petit@example.com,M1 MIAGE,2024-2025,https://example.com/photo.jpg
`;

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "exemple_eleves.csv";
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Exemple téléchargé");
}

export default function CsvFormatInfo() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Format attendu</p>
        <button
          type="button"
          onClick={downloadSample}
          className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download size={13} />
          Télécharger un exemple
        </button>
      </div>
      <pre className="text-xs text-violet-700 bg-violet-50 rounded-xl p-4 border border-violet-100 overflow-x-auto leading-relaxed">
        {`first_name,last_name,email,class_label,year,photo_url\nAlice,Dupont,alice@example.com,BTS SIO,2024-2025,\nBob,Martin,bob@example.com,BTS SIO,2024-2025,`}
      </pre>
      <div className="mt-4 space-y-2">
        {TIPS.map((tip, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-violet-100 text-violet-600 text-xs flex items-center justify-center font-bold flex-shrink-0">·</span>
            <p className="text-xs text-slate-500">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
