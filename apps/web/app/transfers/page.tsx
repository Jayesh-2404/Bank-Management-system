"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DataTable, StatusBadge } from "@/components/data-table";
import { api, getStoredUser, type AccountSummary, type TransactionSummary } from "@/lib/api";
import { formatCurrency, type Role } from "@bank/shared";

export default function TransfersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [formData, setFormData] = useState({
    fromAccountId: "",
    recipientType: "HANDLE",
    recipient: "",
    ifscCode: "",
    amount: 12000,
    note: "Invoice settlement"
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);

    api.getAccounts().then((accountsResult) => {
      const nextAccounts = accountsResult.data ?? [];
      const requestedFromAccountId = new URLSearchParams(window.location.search).get("from");
      const sourceAccount = requestedFromAccountId && nextAccounts.some((account) => account.id === requestedFromAccountId)
        ? nextAccounts.find((account) => account.id === requestedFromAccountId)
        : nextAccounts[0];
      const recipientAccount = nextAccounts.find((account) => account.id !== sourceAccount?.id);
      setAccounts(nextAccounts);
      setFormData((prev) => ({
        ...prev,
        fromAccountId: sourceAccount?.id ?? "",
        recipient: recipientAccount?.publicHandle ?? recipientAccount?.accountNumber ?? ""
      }));
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (!formData.fromAccountId) {
      setTransactions([]);
      return;
    }
    api.getAccountTransactions(formData.fromAccountId).then((result) => {
      setTransactions(result.data ?? []);
    });
  }, [formData.fromAccountId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const payload = {
      ...formData,
      recipient: formData.recipient.replace(/^@/, "").trim(),
      ifscCode: formData.recipientType === "IFSC_ACCOUNT" ? formData.ifscCode.trim().toUpperCase() : undefined,
      note: formData.note.trim() || undefined
    };

    const result = await api.transfer(payload);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else if (result.data?.needsApproval) {
      setMessage({ type: "success", text: "Transfer submitted for approval. You will be notified once approved." });
    } else {
      setMessage({ type: "success", text: "Transfer completed successfully!" });
    }

    setSubmitting(false);

    api.getAccountTransactions(formData.fromAccountId).then((result) => {
      if (result.data) {
        setTransactions(result.data);
      }
    });
  }

  if (loading || !user) {
    return (
      <AppShell title="Transfers" description="Loading..." active="/transfers">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title="Transfers" 
      description="Resolve same-bank handles, account numbers, and inter-bank IFSC routes with KYC and limit checks." 
      active="/transfers"
      role={user.role as Role}
    >
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="panel grid gap-4 p-5" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-lg font-semibold">New transfer</h2>
            <p className="mt-1 text-sm text-muted">Choose an account, verify the recipient route, and submit for policy checks.</p>
          </div>
          <div className="grid gap-2">
            <label className="label" htmlFor="from">From account</label>
            <select 
              id="from" 
              className="field" 
              value={formData.fromAccountId}
              onChange={(e) => setFormData({ ...formData, fromAccountId: e.target.value })}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id} disabled={account.status !== "ACTIVE"}>
                  {account.product} - {account.accountNumber.slice(-4)} - {formatCurrency(account.availableBalance)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="label" htmlFor="recipientType">Recipient type</label>
              <select 
                id="recipientType" 
                className="field" 
                value={formData.recipientType}
                onChange={(e) => setFormData({ ...formData, recipientType: e.target.value })}
              >
                <option value="HANDLE">Handle (@username)</option>
                <option value="ACCOUNT_NUMBER">Account Number</option>
                <option value="IFSC_ACCOUNT">IFSC + Account (Inter-bank)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="label" htmlFor="recipient">Recipient</label>
              <input 
                id="recipient" 
                className="field" 
                value={formData.recipient}
                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                placeholder={formData.recipientType === "HANDLE" ? "lindsley.mcb" : "019284679911"}
              />
            </div>
          </div>
          {formData.recipientType === "IFSC_ACCOUNT" && (
            <div className="grid gap-2">
              <label className="label" htmlFor="ifscCode">IFSC code</label>
              <input
                id="ifscCode"
                className="field uppercase"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                placeholder="MCB0001234"
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="label" htmlFor="amount">Amount</label>
              <input 
                id="amount" 
                className="field" 
                type="number" 
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <label className="label" htmlFor="note">Note</label>
              <input 
                id="note" 
                className="field" 
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>
          </div>

          {message && (
            <div className={`rounded-xl p-3 text-sm ${message.type === "success" ? "bg-teal-50 text-teal-600" : "bg-red-50 text-red-600"}`}>
              {message.text}
            </div>
          )}

          <div className="rounded-md border border-teal-200 bg-teal-50 p-4 text-sm text-teal-700">
            Recipient confirmation shows only masked names after account/handle resolution to reduce enumeration risk.
          </div>
          <button 
            type="submit" 
            className="w-fit rounded-md bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting || !formData.fromAccountId || !formData.recipient || formData.amount <= 0}
          >
            {submitting ? "Processing..." : "Submit transfer"}
          </button>
        </form>

        <div className="panel p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Transfer history</h2>
            <p className="mt-1 text-sm text-muted">Recent movements for the selected source account.</p>
          </div>
          <DataTable
            columns={["Date", "Description", "Direction", "Amount", "Status"]}
            rows={transactions.map((tx) => {
              const isCredit = tx.to === formData.fromAccountId;
              return {
                Date: new Date(tx.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
                Description: tx.description || tx.type.replaceAll("_", " "),
                Direction: isCredit ? "Incoming" : "Outgoing",
                Amount: <span className={isCredit ? "font-semibold text-emerald-700" : "font-semibold text-slate-800"}>{isCredit ? "+" : "-"}{formatCurrency(tx.amount)}</span>,
                Status: <StatusBadge status={tx.status} />
              };
            })}
            emptyMessage="No transfers yet for this account."
          />
        </div>
      </div>
    </AppShell>
  );
}
