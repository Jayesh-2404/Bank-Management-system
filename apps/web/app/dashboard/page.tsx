"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeIndianRupee,
  ClipboardCheck,
  FileText,
  Landmark,
  LockKeyhole,
  Send,
  ShieldCheck,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { AccountCard } from "@/components/account-card";
import { AppShell } from "@/components/app-shell";
import { VolumeLineChart } from "@/components/charts";
import { DataTable, StatusBadge } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
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

interface ChartData {
  labels: string[];
  deposits: number[];
  withdrawals: number[];
}

interface DashboardUser {
  displayName: string;
  role: string;
  bankName?: string;
}

const defaultChart: ChartData = {
  labels: [],
  deposits: [],
  withdrawals: []
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bankName, setBankName] = useState("Bank");
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [chart, setChart] = useState<ChartData>(defaultChart);
  const [user, setUser] = useState<DashboardUser | null>(null);

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
        setChart(result.data.chart || defaultChart);
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

  const role = user.role as Role;

  if (role === "Customer") return <CustomerDashboard user={user} accounts={accounts} transactions={transactions} />;
  if (role === "Auditor") return <AuditorDashboard user={user} kpis={kpis} transactions={transactions} />;
  if (role === "LoanOfficer") return <LoanOfficerDashboard user={user} kpis={kpis} />;
  if (role === "Teller") return <TellerDashboard user={user} kpis={kpis} transactions={transactions} />;

  return <StaffDashboard user={user} kpis={kpis} accounts={accounts} transactions={transactions} bankName={bankName} chart={chart} />;
}

function CustomerDashboard({ user, accounts, transactions }: { user: DashboardUser; accounts: AccountData[]; transactions: TransactionData[] }) {
  const customerAccounts = accounts.filter((account) => account.customerName === user.displayName);
  const customerAccountIds = new Set(customerAccounts.map((account) => account.id));
  const personalTransactions = transactions.filter((tx) => {
    if (customerAccountIds.size === 0) return false;
    return customerAccountIds.has(tx.from ?? "") || customerAccountIds.has(tx.to ?? "");
  });
  const activityChart = buildCustomerActivityChart(personalTransactions, customerAccountIds);

  return (
    <AppShell title="My Banking" description="Your accounts, balances, and recent activity." active="/dashboard" role="Customer">
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            {customerAccounts.length === 0 ? (
              <EmptyPanel title="No accounts found" message="No customer accounts are available for this demo profile." />
            ) : customerAccounts.map((account) => (
              <AccountCard key={account.id} account={toAccountCard(account)} />
            ))}
          </div>

          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Personal activity</h2>
                <p className="text-sm text-muted">Money in and out across your accounts</p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">7 days</span>
            </div>
            <div className="h-72">
              {activityChart.hasData ? (
                <VolumeLineChart labels={activityChart.labels} deposits={activityChart.deposits} withdrawals={activityChart.withdrawals} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-line bg-slate-50 text-sm text-muted">
                  No activity to chart yet
                </div>
              )}
            </div>
          </div>

          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Recent personal transactions</h2>
              <Link href="/accounts" className="text-sm font-semibold text-teal-600 hover:underline">See all</Link>
            </div>
            <DataTable
              columns={["Date", "Description", "Amount", "Status"]}
              emptyMessage="No recent personal transactions"
              rows={personalTransactions.map((tx) => ({
                Date: formatDate(tx.createdAt),
                Description: tx.description || `${tx.type} transaction`,
                Amount: formatCurrency(tx.amount),
                Status: <StatusBadge status={tx.status} />
              }))}
            />
          </div>
        </div>

        <QuickActions
          title="Quick actions"
          actions={[
            { label: "Transfer Money", href: "/transfers", icon: Send },
            { label: "KYC Verification", href: "/kyc", icon: ShieldCheck },
            { label: "Apply for Loan", href: "/loans", icon: BadgeIndianRupee },
            { label: "Raise Limit", href: "/limits", icon: LockKeyhole }
          ]}
        />
      </div>
    </AppShell>
  );
}

function AuditorDashboard({ user, kpis, transactions }: { user: DashboardUser; kpis: KpiData[]; transactions: TransactionData[] }) {
  const auditorKpis = [
    getKpi(kpis, "Open KYC cases", "Open KYC Cases"),
    getKpi(kpis, "Loan pipeline", "Loan Pipeline Value"),
    getKpi(kpis, "Posted volume", "Posted Volume")
  ];

  return (
    <AppShell title="Audit Overview" description="Compliance and transaction monitoring." active="/dashboard" role={user.role as Role}>
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-5">
          <KpiGrid kpis={auditorKpis} columns="xl:grid-cols-3" />
          <div className="panel p-5">
            <h2 className="mb-4 text-lg font-semibold text-ink">Recent transactions</h2>
            <TransactionTable transactions={transactions} />
          </div>
        </div>
        <LinkPanel
          title="Compliance links"
          links={[
            { label: "View Ledger", href: "/ledger" },
            { label: "Audit Logs", href: "/audit" },
            { label: "Reports", href: "/reports" }
          ]}
        />
      </div>
    </AppShell>
  );
}

function LoanOfficerDashboard({ user, kpis }: { user: DashboardUser; kpis: KpiData[] }) {
  const loanKpis = [
    getKpi(kpis, "Loan pipeline", "Loan Pipeline"),
    getKpi(kpis, "Open KYC cases", "Open KYC Cases")
  ];

  return (
    <AppShell title="Loan Operations" description="Application pipeline and approvals." active="/dashboard" role={user.role as Role}>
      <div className="grid gap-5">
        <KpiGrid kpis={loanKpis} columns="xl:grid-cols-2" />
        <div className="grid gap-5 md:grid-cols-2">
          <WorkflowPanel
            icon={BadgeIndianRupee}
            title="Loan Applications"
            description="Review submitted applications, loan products, and customer requests."
            actionLabel="View All Loans"
            href="/loans"
          />
          <WorkflowPanel
            icon={ClipboardCheck}
            title="Pending Approvals"
            description="Open approval workflows assigned to loan operations."
            actionLabel="View Approvals"
            href="/approvals"
          />
        </div>
      </div>
    </AppShell>
  );
}

function TellerDashboard({ user, kpis, transactions }: { user: DashboardUser; kpis: KpiData[]; transactions: TransactionData[] }) {
  const tellerKpis = [
    getKpi(kpis, "Posted volume", "Posted Volume"),
    getKpi(kpis, "Total deposits", "Total Deposits")
  ];

  return (
    <AppShell title="Teller Station" description="Cash operations and account management." active="/dashboard" role={user.role as Role}>
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-5">
          <KpiGrid kpis={tellerKpis} columns="xl:grid-cols-2" />
          <div className="panel p-5">
            <h2 className="mb-4 text-lg font-semibold text-ink">Recent transactions</h2>
            <TransactionTable transactions={transactions} />
          </div>
        </div>
        <QuickActions
          title="Counter actions"
          actions={[
            { label: "Cash Deposit / Withdrawal", href: "/teller", icon: WalletCards },
            { label: "New Transfer", href: "/transfers", icon: Send },
            { label: "Manage Accounts", href: "/accounts", icon: Landmark }
          ]}
        />
      </div>
    </AppShell>
  );
}

function StaffDashboard({
  user,
  kpis,
  accounts,
  transactions,
  bankName,
  chart
}: {
  user: DashboardUser;
  kpis: KpiData[];
  accounts: AccountData[];
  transactions: TransactionData[];
  bankName: string;
  chart: ChartData;
}) {
  const pendingApprovals = transactions.filter((tx) => tx.status === "PENDING_APPROVAL").slice(0, 5);

  return (
    <AppShell title="Overview" description="Bank-wide operations, volume, and approvals." active="/dashboard" role={user.role as Role}>
      <div className="grid gap-5">
        <KpiGrid kpis={kpis} columns="xl:grid-cols-4" />
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-5">
            {accounts[0] && <AccountCard account={toAccountCard(accounts[0])} />}
            <div className="panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Recent transactions</h2>
                  <p className="text-sm text-muted">{bankName}</p>
                </div>
                <Link href="/accounts" className="text-sm font-semibold text-teal-600 hover:underline">See all</Link>
              </div>
              <DataTable
                columns={["Description", "Type", "Amount", "Status"]}
                rows={transactions.map((tx) => ({
                  Description: tx.description || `${tx.type} transaction`,
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
                <h2 className="text-lg font-semibold text-ink">Monthly volume</h2>
                <span className="text-sm text-muted">API chart data</span>
              </div>
              <div className="h-80">
                <VolumeLineChart labels={chart.labels} deposits={chart.deposits} withdrawals={chart.withdrawals} />
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="mb-4 text-lg font-semibold text-ink">Approval queue</h2>
              <DataTable
                columns={["ID", "Type", "Amount", "Status"]}
                emptyMessage="No pending approvals"
                rows={pendingApprovals.map((tx) => ({
                  ID: tx.id.slice(0, 8),
                  Type: tx.type,
                  Amount: formatCurrency(tx.amount),
                  Status: <StatusBadge status={tx.status} />
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function KpiGrid({ kpis, columns }: { kpis: KpiData[]; columns: string }) {
  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${columns}`}>
      {kpis.map((kpi) => (
        <MetricCard key={kpi.label} label={kpi.label} value={kpi.value} trend={kpi.trend} tone="teal" />
      ))}
    </div>
  );
}

function TransactionTable({ transactions }: { transactions: TransactionData[] }) {
  return (
    <DataTable
      columns={["Date", "Type", "Amount", "Status"]}
      rows={transactions.map((tx) => ({
        Date: formatDate(tx.createdAt),
        Type: tx.type,
        Amount: formatCurrency(tx.amount),
        Status: <StatusBadge status={tx.status} />
      }))}
    />
  );
}

function QuickActions({ title, actions }: { title: string; actions: Array<{ label: string; href: string; icon: LucideIcon }> }) {
  return (
    <div className="panel h-fit p-5">
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      <div className="grid gap-3">
        {actions.map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 text-sm font-semibold text-ink transition hover:border-teal-500 hover:text-teal-700 hover:shadow-soft">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex-1">{label}</span>
            <ArrowRight className="h-4 w-4 text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function LinkPanel({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div className="panel h-fit p-5">
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      <div className="grid gap-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-teal-50 hover:text-teal-700">
            {link.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function WorkflowPanel({
  icon: Icon,
  title,
  description,
  actionLabel,
  href
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <div className="panel p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      <Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-600/20">
        {actionLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="panel p-6">
      <FileText className="h-8 w-8 text-muted" />
      <h2 className="mt-5 text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">{message}</p>
    </div>
  );
}

function toAccountCard(account: AccountData) {
  return {
    accountNumber: account.accountNumber,
    id: account.id,
    publicHandle: account.publicHandle ?? "",
    product: account.product,
    status: account.status as "ACTIVE" | "FROZEN" | "CLOSED",
    availableBalance: account.availableBalance
  };
}

function getKpi(kpis: KpiData[], label: string, displayLabel = label): KpiData {
  const found = kpis.find((kpi) => normalizeLabel(kpi.label) === normalizeLabel(label));
  return found ? { ...found, label: displayLabel } : { label: displayLabel, value: "-", trend: "No data" };
}

function normalizeLabel(label: string) {
  return label.toLowerCase().replaceAll(" ", "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function buildCustomerActivityChart(transactions: TransactionData[], accountIds: Set<string>) {
  const latestDate = transactions.length > 0
    ? new Date(Math.max(...transactions.map((tx) => new Date(tx.createdAt).getTime())))
    : new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(latestDate);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const labels = days.map((date) => new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date));
  const deposits = days.map(() => 0);
  const withdrawals = days.map(() => 0);

  transactions.forEach((tx) => {
    const txDate = new Date(tx.createdAt);
    const dayIndex = days.findIndex((date) => date.toDateString() === txDate.toDateString());
    if (dayIndex === -1) return;

    if (accountIds.has(tx.to ?? "")) {
      deposits[dayIndex] = (deposits[dayIndex] ?? 0) + tx.amount;
    }
    if (accountIds.has(tx.from ?? "")) {
      withdrawals[dayIndex] = (withdrawals[dayIndex] ?? 0) + tx.amount;
    }
  });

  return {
    labels,
    deposits,
    withdrawals,
    hasData: deposits.some((value) => value > 0) || withdrawals.some((value) => value > 0)
  };
}
