import { useEffect, useState } from "react";
import { getClasses } from "../api/client";
import type { Class } from "../types";
import StatCard from "../components/StatCard";
import QuickLinkCard from "../components/QuickLinkCard";
import Table from "../components/Table";

const QUICK_LINKS = [
  { to: "/classes", label: "Gérer les classes",  sub: "Classes & années",  iconBg: "bg-violet-100", iconColor: "text-violet-600", border: "hover:border-violet-300" },
  { to: "/students", label: "Gérer les élèves",  sub: "Profils & photos",  iconBg: "bg-emerald-100", iconColor: "text-emerald-600", border: "hover:border-emerald-300" },
  { to: "/import",  label: "Importer un CSV",    sub: "Import en masse",   iconBg: "bg-amber-100",  iconColor: "text-amber-600",  border: "hover:border-amber-300" },
  { to: "/trombi",  label: "Générer un trombi",  sub: "HTML ou PDF",       iconBg: "bg-rose-100",   iconColor: "text-rose-500",   border: "hover:border-rose-300" },
];

export default function Dashboard() {
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => { getClasses().then(setClasses).catch(console.error); }, []);

  const totalStudents = classes.reduce((s, c) => s + (c._count?.students ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mb-10">
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-2">Tableau de bord</p>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Vue d'ensemble</h1>
        <p className="text-sm text-slate-400 mt-1">Gérez vos classes et élèves depuis un seul endroit.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
        <StatCard label="Classes"        value={classes.length} accent="violet" />
        <StatCard label="Élèves"         value={totalStudents}  accent="emerald" />
        <StatCard label="Formats export" value="HTML & PDF"     accent="amber" />
      </div>

      <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-4">Accès rapide</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {QUICK_LINKS.map((link) => <QuickLinkCard key={link.to} {...link} />)}
      </div>

      {classes.length > 0 && (
        <>
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-4">Classes enregistrées</p>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <Table columns={["Classe", "Année", "Élèves"]} empty={{ icon: "🎓", message: "" }}>
              {classes.map((cls) => (
                <tr key={cls.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-700">{cls.label}</td>
                  <td className="px-6 py-4 text-slate-400">{cls.year}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-block bg-violet-100 text-violet-600 text-xs font-semibold px-3 py-1 rounded-full">
                      {cls._count?.students ?? 0} élève{(cls._count?.students ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
