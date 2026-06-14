import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getClasses, downloadTrombi } from "../api/client";
import type { Class } from "../types";
import Select from "../components/Select";

export default function Trombi() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classId, setClassId] = useState("");
  const [format, setFormat] = useState<"html" | "pdf">("html");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getClasses().then(setClasses).catch(console.error);
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return;
    setLoading(true);
    try {
      const blob = await downloadTrombi(Number(classId), format);
      const cls = classes.find((c) => c.id === Number(classId));
      const filename = `trombinoscope_${cls?.label ?? classId}_${cls?.year ?? ""}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Fichier "${filename}" téléchargé`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || "Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  }

  const selectedClass = classes.find((c) => c.id === Number(classId));

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">
        Générer un Trombinoscope
      </h2>
      <p className="text-gray-500 mb-8">
        Sélectionnez une classe et un format pour générer et télécharger le
        trombinoscope.
      </p>

      <form
        onSubmit={handleGenerate}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-6"
      >
        {/* Classe */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Classe
          </label>
          <Select
            value={classId}
            onChange={setClassId}
            placeholder="Sélectionner une classe"
            options={classes.map((c) => ({
              value: String(c.id),
              label: `${c.label} — ${c.year} (${c._count?.students ?? 0} élève(s))`,
            }))}
          />
          {selectedClass && (
            <p className="text-xs text-gray-400 mt-1">
              {selectedClass._count?.students ?? 0} élève(s) dans cette classe
            </p>
          )}
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Format
          </label>
          <div className="flex gap-3">
            {(["html", "pdf"] as const).map((f) => (
              <label
                key={f}
                className={`flex items-center gap-3 flex-1 border-2 rounded-xl p-4 cursor-pointer transition ${format === f ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="accent-indigo-600"
                />
                <div>
                  <p className="font-semibold text-sm">{f.toUpperCase()}</p>
                  <p className="text-xs text-gray-500">
                    {f === "html" ? "Page web" : "Document PDF imprimable"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!classId || loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-40"
        >
          {loading
            ? "Génération en cours..."
            : `Générer le trombinoscope (${format.toUpperCase()})`}
        </button>
      </form>

      {/* Info */}
      <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-5 text-sm text-gray-600 space-y-4">
        <p className="font-semibold text-gray-700">Comment ça marche ?</p>
        <ul className="list-disc list-inside space-y-1.5">
          <li>
            Sélectionnez une classe et un format, puis cliquez sur{" "}
            <span className="font-medium text-gray-700">Générer</span>{" "}
          </li>
          <li>Le fichier est généré avec les données et photos à jour.</li>
          <li>
            Chaque export est enregistré en base de données (historique
            consultable).
          </li>
        </ul>

        <div className="border-t border-gray-200 pt-4 space-y-1.5">
          <p className="font-semibold text-gray-700">Formats disponibles</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <span className="font-medium text-gray-700">HTML</span> — page web
              autonome, images intégrées, partageable par e-mail ou intranet.
            </li>
            <li>
              <span className="font-medium text-gray-700">PDF</span> — document
              prêt à imprimer, photos circulaires, mise en page A4.
            </li>
          </ul>
        </div>

        <div className="border-t border-gray-200 pt-4 space-y-1.5">
          <p className="font-semibold text-gray-700">Bonnes pratiques</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              Assurez-vous que les élèves ont bien une{" "}
              <span className="font-medium text-gray-700">photo uploadée</span>{" "}
              avant de générer — sinon leurs initiales s'affichent à la place.
            </li>
            <li>
              Si des élèves ont été ajoutés ou modifiés,{" "}
              <span className="font-medium text-gray-700">regénérez</span> un
              nouvel export pour avoir les données à jour.
            </li>
            <li>
              Les anciens exports ne se mettent pas à jour automatiquement.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
