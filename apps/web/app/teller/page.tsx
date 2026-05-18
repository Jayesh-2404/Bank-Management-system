"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { DataTable, StatusBadge } from "@/components/data-table";
import { api, getStoredUser, type AccountSummary } from "@/lib/api";
import { formatCurrency, type Role } from "@bank/shared";

export default function TellerPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ accountId: "", amount: 5000, operation: "DEPOSIT" as "DEPOSIT" | "WITHDRAWAL", actedOnBehalf: true });

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);
    api.getAccounts().then((result) => {
      const nextAccounts = result.data ?? [];
      setAccounts(nextAccounts);
      setForm((prev) => ({ ...prev, accountId: nextAccounts[0]?.id ?? "" }));
    });
  }, [router]);

  async function submitCash(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    const result = await api.cashTransaction(form);
    setMessage(result.error ?? `${form.operation === "DEPOSIT" ? "Deposit" : "Withdrawal"} posted.`);
    const accountsResult = await api.getAccounts();
    setAccounts(accountsResult.data ?? []);
    setSubmitting(false);
  }

  return (
    <AppShell title="Teller Operations" description="Customer onboarding, account opening, deposits, withdrawals, and teller-assisted transfer mode." active="/teller" role={user?.role as Role | undefined}>
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <form className="panel grid gap-4 p-5" onSubmit={submitCash}>
          <div>
            <h2 className="text-lg font-semibold">Cash operation</h2>
            <p className="mt-1 text-sm text-muted">Post branch deposits and withdrawals with audit trail.</p>
          </div>
          <select className="field" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.customerName} - {account.product} ending {account.accountNumber.slice(-4)}
              </option>
            ))}
          </select>
          <div className="grid gap-4 md:grid-cols-2">
            <select className="field" value={form.operation} onChange={(e) => setForm({ ...form, operation: e.target.value as "DEPOSIT" | "WITHDRAWAL" })}>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
            </select>
            <input className="field" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={form.actedOnBehalf} onChange={(e) => setForm({ ...form, actedOnBehalf: e.target.checked })} />
            Teller acting on behalf of customer
          </label>
          {message ? <div className="rounded-md border border-line bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
          <Button type="submit" className="w-fit" disabled={submitting || !form.accountId || form.amount <= 0}>
            {submitting ? "Posting..." : "Post transaction"}
          </Button>
        </form>
        <div className="panel p-5">
          <h2 className="mb-4 text-lg font-semibold">Branch accounts</h2>
          <DataTable
            columns={["Customer", "Account", "Available", "Status"]}
            rows={accounts.map((account) => ({
              Customer: account.customerName,
              Account: account.accountNumber,
              Available: formatCurrency(account.availableBalance),
              Status: <StatusBadge status={account.status} />
            }))}
          />
        </div>
      </div>
    </AppShell>
  );
}
