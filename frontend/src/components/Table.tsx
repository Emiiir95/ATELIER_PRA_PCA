export default function Table({
  columns,
  empty,
  children,
}: {
  columns: string[];
  empty: { icon: string; message: string };
  children: React.ReactNode;
}) {
  const hasRows = !!children && (Array.isArray(children) ? children.some(Boolean) : true);

  if (!hasRows) {
    return (
      <div className="text-center py-20">
        <p className="text-3xl mb-3">{empty.icon}</p>
        <p className="text-slate-400 text-sm">{empty.message}</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {columns.map((col) => (
            <th
              key={col}
              className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">{children}</tbody>
    </table>
  );
}
