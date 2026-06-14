import { useState } from "react";
import { toast } from "sonner";
import { importCsv } from "../api/client";
import type { ImportResult } from "../types";
import CsvFormatInfo from "../components/CsvFormatInfo";
import CsvDropZone from "../components/CsvDropZone";
import ImportResults from "../components/ImportResults";

export default function ImportCsv() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await importCsv(file);
      setResult(res);
      const errCount = res.errors ?? 0;
      if (errCount > 0) {
        toast.warning(`Import terminé : ${res.created} créés, ${errCount} en erreur`);
      } else {
        toast.success(`Import réussi : ${res.created} élève(s) créé(s)`);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      const msg = e?.response?.data?.message || "Erreur lors de l'import";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl">
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-1">
            Import
          </p>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Import CSV
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Importez des élèves en masse via un fichier CSV.
          </p>
        </div>

        <CsvFormatInfo />

        <form onSubmit={handleSubmit} className="space-y-4">
          <CsvDropZone
            file={file}
            onChange={(f) => {
              setFile(f);
              setResult(null);
            }}
          />

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!file || loading}
              className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 shadow-sm"
            >
              {loading ? "Import en cours..." : "Importer"}
            </button>
            {(file || result) && (
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </form>

        {result && <ImportResults result={result} />}
      </div>
    </div>
  );
}
