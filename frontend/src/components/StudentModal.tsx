import { useRef, useState } from "react";
import { toast } from "sonner";
import { createStudent, updateStudent, uploadPhoto } from "../api/client";
import type { Class, Student } from "../types";
import Modal from "./Modal";
import Field from "./Field";
import Select from "./Select";
import CropModal from "./CropModal";
import { Camera, Crop } from "lucide-react";
import { fileToDataUrl } from "../utils/fileToDataUrl";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  classId: number | "";
}

export default function StudentModal({
  editing,
  classes,
  onClose,
  onSaved,
}: {
  editing: Student | null;
  classes: Class[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          firstName: editing.firstName,
          lastName: editing.lastName,
          email: editing.email,
          classId: editing.classId ?? "",
        }
      : { firstName: "", lastName: "", email: "", classId: "" },
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    editing?.photoUrl ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Crop
  const [cropDataUrl, setCropDataUrl] = useState<string | null>(null);
  const originalDataUrlRef = useRef<string | null>(null);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";
    const dataUrl = await fileToDataUrl(file);
    originalDataUrlRef.current = dataUrl;
    setCropDataUrl(dataUrl);
  }

  function handleCropConfirm(blob: Blob) {
    setCropDataUrl(null);
    const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(blob));
  }

  function handleCropCancel() {
    setCropDataUrl(null);
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!editing && form.classId === "") return;
    setLoading(true);
    setError("");
    try {
      const classId = form.classId === "" ? null : Number(form.classId);
      let studentId: number;
      if (editing) {
        await updateStudent(editing.id, { ...form, classId });
        studentId = editing.id;
      } else {
        const created = await createStudent({ ...form, classId: classId! });
        studentId = created.id;
      }
      if (photoFile) await uploadPhoto(studentId, photoFile);
      toast.success(editing ? "Élève modifié" : "Élève créé");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  }

  const initials =
    `${form.firstName?.[0] ?? ""}${form.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <>
      <Modal
        title={editing ? "Modifier l'élève" : "Nouvel élève"}
        onClose={onClose}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          {/* Photo */}
          <div className="flex flex-col items-center gap-2 pb-5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative group w-20 h-20 rounded-full overflow-hidden ring-2 ring-violet-200 hover:ring-violet-400 transition-all"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xl">
                  {initials || <Camera size={24} className="text-violet-400" />}
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={20} className="text-white" />
              </div>
            </button>
            {photoPreview && (
              <button
                type="button"
                onClick={async () => {
                  if (originalDataUrlRef.current) {
                    setCropDataUrl(originalDataUrlRef.current);
                  } else {
                    const res = await fetch(photoPreview!);
                    const blob = await res.blob();
                    const file = new File([blob], "photo.jpg", { type: blob.type });
                    const dataUrl = await fileToDataUrl(file);
                    originalDataUrlRef.current = dataUrl;
                    setCropDataUrl(dataUrl);
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
              >
                <Crop size={13} />
                Rogner
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Prénom"
              value={form.firstName}
              onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
            />
            <Field
              label="Nom"
              value={form.lastName}
              onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
            />
          </div>
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          />
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Classe
            </label>
            <Select
              value={String(form.classId)}
              onChange={(v) =>
                setForm((f) => ({ ...f, classId: v === "" ? "" : Number(v) }))
              }
              placeholder="Sélectionner une classe"
              options={classes.map((c) => ({
                value: String(c.id),
                label: `${c.label} — ${c.year}`,
              }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors font-semibold"
            >
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </Modal>

      {cropDataUrl && (
        <CropModal
          imageUrl={cropDataUrl}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
