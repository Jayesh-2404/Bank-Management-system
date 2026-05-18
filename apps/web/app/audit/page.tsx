import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { auditLogs } from "@/lib/demo";

export default function AuditPage() {
  return (
    <AppShell title="Audit Logs" description="Append-only operational activity covering approvals, teller assistance, ledger postings, and security events." active="/audit">
      <div className="panel p-5">
        <DataTable columns={["id", "action", "actor", "resource", "time"]} rows={auditLogs} />
      </div>
    </AppShell>
  );
}
