import { useState } from "react";
import { toast } from "sonner";
import { createClass, updateClass } from "../api/client";
import type { Class } from "../types";
import Modal from "./Modal";
import Field from "./Field";

export default function ClassModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Class | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    editing ? { label: editing.label, year: editing.year } : { label: "", year: "" }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editing) await updateClass(editing.id, form);
      else await createClass(form);
      toast.success(editing ? "Classe modifiée" : "Classe créée");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={editing ? "Modifier la classe" : "Nouvelle classe"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{error}</p>
        )}
        <Field label="Label" value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="ex: BTS SIO" />
        <Field label="Année" value={form.year} onChange={(v) => setForm((f) => ({ ...f, year: v }))} placeholder="ex: 2024-2025" />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors font-semibold">
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
