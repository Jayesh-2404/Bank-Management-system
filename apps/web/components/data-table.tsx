import { cn } from "@/lib/utils";

export function DataTable({
  columns,
  rows,
  emptyMessage = "No records found"
}: {
  columns: string[];
  rows: Array<Record<string, React.ReactNode>>;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-4 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-muted" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={index} className={cn("border-t border-line", index % 2 === 1 && "bg-slate-50/50")}>
                {columns.map((column) => (
                  <td key={column} className="whitespace-nowrap px-4 py-4 text-slate-700">
                    {row[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  POSTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-200",
  IN_REVIEW: "bg-blue-50 text-blue-700 ring-blue-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 ring-amber-200",
  NEEDS_MORE_INFO: "bg-amber-50 text-amber-700 ring-amber-200",
  FROZEN: "bg-amber-50 text-amber-700 ring-amber-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
  CLOSED: "bg-slate-100 text-slate-600 ring-slate-200",
  REVERSED: "bg-slate-100 text-slate-600 ring-slate-200"
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", statusStyles[status] ?? "bg-slate-100 text-slate-700 ring-slate-200")}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
