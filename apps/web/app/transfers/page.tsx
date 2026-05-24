"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Landmark, Send, ShieldCheck, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/data-table";
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
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <TransferInsight icon={WalletCards} label="Source accounts" value={String(accounts.length)} />
        <TransferInsight icon={ShieldCheck} label="Policy checks" value="KYC + limits" />
        <TransferInsight icon={Landmark} label="Routes" value="Handle, account, IFSC" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="panel grid gap-5 p-6" onSubmit={handleSubmit}>
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <Send className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-ink">New transfer</h2>
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

          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-800">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Recipient confirmation shows only masked names after account/handle resolution to reduce enumeration risk.</span>
            </div>
          </div>
          <button 
            type="submit" 
            className="w-fit rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting || !formData.fromAccountId || !formData.recipient || formData.amount <= 0}
          >
            {submitting ? "Processing..." : "Submit transfer"}
          </button>
        </form>

        <div className="panel p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-ink">Transfer history</h2>
            <p className="mt-1 text-sm text-muted">Recent movements for the selected source account.</p>
          </div>
          <div className="grid gap-3">
            {transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-slate-50 p-8 text-center text-sm text-muted">
                No transfers yet for this account.
              </div>
            ) : transactions.map((tx) => {
              const isCredit = tx.to === formData.fromAccountId;
              const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
              return (
                <div key={tx.id} className="flex flex-col gap-4 rounded-xl border border-line bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full ${isCredit ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-ink">{tx.description || tx.type.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs text-muted">{new Date(tx.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-right">
                      <p className={`font-semibold ${isCredit ? "text-emerald-700" : "text-slate-900"}`}>{isCredit ? "+" : "-"}{formatCurrency(tx.amount)}</p>
                      <p className="text-xs text-muted">{isCredit ? "Incoming" : "Outgoing"}</p>
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function TransferInsight({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return (
    <div className="panel flex items-center gap-4 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
        <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
