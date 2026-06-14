import type { ImportResult } from "../types";

export default function ImportResults({ result }: { result: ImportResult }) {
  return (
    <div className="mt-8 space-y-4">
      <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Résultats</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
          <p className="text-4xl font-extrabold text-emerald-600 tracking-tight">{result.created}</p>
          <div className="h-1 bg-emerald-100 rounded-full my-3 mx-4" />
          <p className="text-xs text-slate-500 font-medium">Élève(s) créé(s) / mis à jour</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
          <p className="text-4xl font-extrabold text-red-500 tracking-tight">{result.errors}</p>
          <div className="h-1 bg-red-100 rounded-full my-3 mx-4" />
          <p className="text-xs text-slate-500 font-medium">Erreur(s)</p>
        </div>
      </div>

      {result.details.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <p className="px-6 py-4 font-semibold text-sm text-slate-700 border-b border-slate-100">Détails ligne par ligne</p>
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {result.details.map((d, i) => (
              <div key={i} className="px-6 py-3 flex items-start gap-3">
                <span className={`mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${d.error ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
                  {d.error ? "ERR" : "OK"}
                </span>
                <div className="text-xs">
                  <span className="font-semibold text-slate-700">{d.row.first_name} {d.row.last_name}</span>
                  <span className="text-slate-400 ml-2">{d.row.email}</span>
                  {d.error && <p className="text-red-500 mt-0.5">{d.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
