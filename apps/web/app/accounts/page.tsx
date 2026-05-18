"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountCard } from "@/components/account-card";
import { AppShell } from "@/components/app-shell";
import { DataTable, StatusBadge } from "@/components/data-table";
import { api, getStoredUser, type AccountSummary, type TransactionSummary } from "@/lib/api";
import { formatCurrency, type Role } from "@bank/shared";

export default function AccountsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);

    api.getAccounts().then((result) => {
      if (result.error) {
        setError(result.error);
      }
      const nextAccounts = result.data ?? [];
      setAccounts(nextAccounts);
      const requestedAccountId = new URLSearchParams(window.location.search).get("account");
      const firstAccountId = requestedAccountId && nextAccounts.some((account) => account.id === requestedAccountId)
        ? requestedAccountId
        : nextAccounts[0]?.id ?? "";
      setSelectedAccountId(firstAccountId);
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (!selectedAccountId) {
      setTransactions([]);
      return;
    }
    api.getAccountTransactions(selectedAccountId).then((result) => {
      setTransactions(result.data ?? []);
    });
  }, [selectedAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  if (loading || !user) {
    return (
      <AppShell title="Accounts" description="Loading accounts..." active="/accounts">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Accounts"
      description="Open accounts, inspect balances, aliases, holds, and customer account status."
      active="/accounts"
      role={user.role as Role}
    >
      <div className="grid gap-5">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={{
                id: account.id,
                accountNumber: account.accountNumber,
                publicHandle: account.publicHandle ?? "",
                product: account.product,
                status: account.status,
                availableBalance: account.availableBalance
              }}
            />
          ))}
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Customer accounts</h2>
              <p className="mt-1 text-sm text-muted">Live balances and handles from the API.</p>
            </div>
            {accounts.length > 0 ? (
              <select className="field md:max-w-xs" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.product} ending {account.accountNumber.slice(-4)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <DataTable
            columns={["Customer", "Account", "Product", "Balance", "Available", "Status", "Handle"]}
            rows={accounts.map((account) => ({
              Customer: account.customerName,
              Account: account.accountNumber,
              Product: account.product,
              Balance: formatCurrency(account.balance),
              Available: formatCurrency(account.availableBalance),
              Status: <StatusBadge status={account.status} />,
              Handle: account.publicHandle ? `@${account.publicHandle}` : "-"
            }))}
            emptyMessage="No accounts available for this user."
          />
        </div>

        <div className="panel p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Transaction history</h2>
            <p className="mt-1 text-sm text-muted">
              {selectedAccount ? `${selectedAccount.product} ending ${selectedAccount.accountNumber.slice(-4)}` : "Select an account to inspect movement."}
            </p>
          </div>
          <DataTable
            columns={["Date", "Movement", "Counterparty", "Amount", "Status"]}
            rows={transactions.map((tx) => {
              const isCredit = tx.to === selectedAccountId;
              const counterparty = isCredit ? tx.from : tx.to;
              return {
                Date: new Date(tx.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
                Movement: tx.description ?? tx.type.replaceAll("_", " "),
                Counterparty: counterparty ? `...${counterparty.slice(-6)}` : "Bank counter",
                Amount: <span className={isCredit ? "font-semibold text-emerald-700" : "font-semibold text-slate-800"}>{isCredit ? "+" : "-"}{formatCurrency(tx.amount)}</span>,
                Status: <StatusBadge status={tx.status} />
              };
            })}
            emptyMessage="No transactions recorded for this account."
          />
        </div>
      </div>
    </AppShell>
  );
}
