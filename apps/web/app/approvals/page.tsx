"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { DataTable, StatusBadge } from "@/components/data-table";
import { api, getStoredUser, type TransactionSummary } from "@/lib/api";
import { formatCurrency, type Role } from "@bank/shared";

export default function ApprovalsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const result = await api.getDashboard();
    setTransactions((result.data?.transactions ?? []).filter((tx: TransactionSummary) => tx.status === "PENDING_APPROVAL"));
  }

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);
    refresh();
  }, [router]);

  async function approve(id: string) {
    const result = await api.approveTransaction(id);
    setMessage(result.error ?? "Transfer approved and posted.");
    await refresh();
  }

  return (
    <AppShell title="Approvals" description="Unified queue for KYC decisions, limit requests, loan decisions, and threshold-based transaction approvals." active="/approvals" role={user?.role as Role | undefined}>
      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Pending transfer approvals</h2>
            <p className="mt-1 text-sm text-muted">High-value transfers requiring bank or branch manager review.</p>
          </div>
          <Button type="button" variant="outline" onClick={refresh}>Refresh</Button>
        </div>
        {message ? <div className="mb-4 rounded-md border border-line bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
        <DataTable
          columns={["ID", "Type", "Amount", "Status", "Created", "Action"]}
          rows={transactions.map((tx) => ({
            ID: tx.id.slice(0, 8),
            Type: tx.type.replaceAll("_", " "),
            Amount: formatCurrency(tx.amount),
            Status: <StatusBadge status={tx.status} />,
            Created: new Date(tx.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
            Action: <button className="text-sm font-semibold text-teal-700" onClick={() => approve(tx.id)}>Approve</button>
          }))}
          emptyMessage="No transfers are waiting for approval."
        />
      </div>
    </AppShell>
  );
}
