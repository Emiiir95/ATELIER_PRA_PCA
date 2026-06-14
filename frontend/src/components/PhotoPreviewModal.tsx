import { Crop } from "lucide-react";

export default function PhotoPreviewModal({
  photoUrl,
  onConfirm,
  onCropManually,
}: {
  photoUrl: string;
  onConfirm: () => void;
  onCropManually: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Photo mise à jour</h2>
          <p className="text-sm text-slate-400 mt-1">
            La photo a été redimensionnée automatiquement en 300×300.
          </p>
        </div>

        <div className="flex justify-center">
          <img
            src={photoUrl}
            alt="Aperçu"
            className="w-36 h-36 rounded-full object-cover ring-4 ring-violet-100"
          />
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={onConfirm}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Confirmer
          </button>
          <button
            onClick={onCropManually}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Crop size={15} />
            Rogner manuellement
          </button>
        </div>
      </div>
    </div>
  );
}
