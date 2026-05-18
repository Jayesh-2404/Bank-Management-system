"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountCard } from "@/components/account-card";
import { AppShell } from "@/components/app-shell";
import { DataTable, StatusBadge } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { VolumeLineChart } from "@/components/charts";
import { api, getStoredUser } from "@/lib/api";
import { formatCurrency, type Role } from "@bank/shared";

interface KpiData {
  label: string;
  value: string;
  trend: string;
}

interface AccountData {
  id: string;
  accountNumber: string;
  publicHandle?: string;
  product: string;
  status: string;
  balance: number;
  availableBalance: number;
  customerName?: string;
}

interface TransactionData {
  id: string;
  type: string;
  status: string;
  amount: number;
  description?: string;
  from?: string;
  to?: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bankName, setBankName] = useState("Bank");
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [user, setUser] = useState<{ displayName: string; role: string; bankName?: string } | null>(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);
    
    api.getDashboard().then((result) => {
      if (result.data) {
        setBankName(result.data.bankName || "Bank");
        setKpis(result.data.kpis || []);
        setAccounts(result.data.accounts || []);
        setTransactions(result.data.transactions || []);
      }
      setLoading(false);
    });
  }, [router]);

  if (loading || !user) {
    return (
      <AppShell title="Dashboard" description="Loading...">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title="Overview" 
      description="Role-based banking operations dashboard with balances, volume, approvals, and exceptions."
      active="/dashboard"
      role={user.role as Role}
    >
      <div className="grid gap-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <MetricCard key={kpi.label} label={kpi.label} value={kpi.value} trend={kpi.trend} tone="teal" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-5">
            {accounts[0] && (
              <AccountCard 
                account={{
                  accountNumber: accounts[0].accountNumber,
                  id: accounts[0].id,
                  publicHandle: accounts[0].publicHandle ?? "",
                  product: accounts[0].product,
                  status: accounts[0].status as "ACTIVE" | "FROZEN" | "CLOSED",
                  availableBalance: accounts[0].availableBalance
                }} 
              />
            )}
            <div className="panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent transactions</h2>
                <a href="/accounts" className="text-sm font-semibold text-amber-500 hover:underline">See all</a>
              </div>
              <DataTable
                columns={["Description", "Type", "Amount", "Status"]}
                rows={transactions.map((tx) => ({
                  Description: tx.description || `${tx.type}`,
                  Type: tx.type,
                  Amount: formatCurrency(tx.amount),
                  Status: <StatusBadge status={tx.status} />
                }))}
              />
            </div>
          </div>
          <div className="grid gap-5">
            <div className="panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Monthly volume</h2>
                <span className="text-sm text-muted">1 May - 11 May 2026</span>
              </div>
              <div className="h-80">
                <VolumeLineChart 
                  labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
                  deposits={[42, 58, 63, 71, 92, 88, 110]}
                  withdrawals={[28, 31, 36, 42, 39, 45, 51]}
                />
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="mb-4 text-lg font-semibold">Approval queue</h2>
              <DataTable 
                columns={["ID", "Type", "Customer", "Amount", "Status"]} 
                rows={[
                  { ID: "APR-1042", Type: "KYC", Customer: "Lindsley Sudiro", Amount: "-", Status: "Submitted" },
                  { ID: "APR-1043", Type: "Transfer", Customer: user.displayName, Amount: formatCurrency(78000), Status: "Pending" },
                  { ID: "APR-1044", Type: "Loan", Customer: "Rohit Malhotra", Amount: formatCurrency(750000), Status: "In review" }
                ]} 
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
