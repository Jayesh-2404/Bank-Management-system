"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeIndianRupee, CalendarDays, FileText, Percent, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { DataTable, StatusBadge } from "@/components/data-table";
import { api, getStoredUser, type CustomerSummary } from "@/lib/api";
import { formatCurrency, type Role } from "@bank/shared";

export default function LoansPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    productId: "",
    amount: 750000,
    termMonths: 84,
    incomeMonthly: 125000,
    purpose: "Home renovation"
  });

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);
    Promise.all([api.getCustomers(), api.getLoanProducts(), api.getLoanApplications()]).then(([customersResult, productsResult, applicationsResult]) => {
      const nextCustomers = customersResult.data ?? [];
      const nextProducts = productsResult.data ?? [];
      setCustomers(nextCustomers);
      setProducts(nextProducts);
      setApplications(applicationsResult.data ?? []);
      setForm((prev) => ({
        ...prev,
        customerId: nextCustomers[0]?.id ?? "",
        productId: nextProducts[0]?.id ?? ""
      }));
    });
  }, [router]);

  async function refreshApplications() {
    const result = await api.getLoanApplications();
    setApplications(result.data ?? []);
  }

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    const result = await api.submitLoanApplication(form);
    setMessage(result.error ?? "Loan application submitted.");
    setSubmitting(false);
    await refreshApplications();
  }

  return (
    <AppShell title="Loans" description="Customer applications, officer review, final approval, disbursement, repayment schedules, and portfolio snapshots." active="/loans" role={user?.role as Role | undefined}>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <LoanInsight icon={FileText} label="Applications" value={String(applications.length)} />
        <LoanInsight icon={BadgeIndianRupee} label="Requested value" value={formatCurrency(applications.reduce((sum, item) => sum + Number(item.amount ?? 0), 0))} />
        <LoanInsight icon={Percent} label="Products" value={String(products.length)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <form className="panel grid gap-5 p-6" onSubmit={submitApplication}>
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-ink">New loan application</h2>
            <p className="mt-1 text-sm text-muted">Submit an application against active loan products.</p>
          </div>
          <div className="grid gap-2">
            <label className="label">Customer</label>
            <select className="field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className="label">Loan product</label>
            <select className="field" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name} ({product.annualRate}% p.a.)</option>
              ))}
            </select>
          </div>
          {products.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {products.slice(0, 2).map((product) => (
                <div key={product.id} className="rounded-xl border border-line bg-slate-50 p-4">
                  <p className="font-semibold text-ink">{product.name}</p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted">Rate</span>
                    <span className="font-semibold text-teal-700">{product.annualRate}% p.a.</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="label">Amount</label>
              <input className="field" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <label className="label">Term months</label>
              <input className="field" type="number" value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <label className="label">Monthly income</label>
              <input className="field" type="number" value={form.incomeMonthly} onChange={(e) => setForm({ ...form, incomeMonthly: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <label className="label">Purpose</label>
              <input className="field" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </div>
          </div>
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-teal-700" />
              <div>
                <p className="text-sm font-semibold text-ink">{formatCurrency(form.amount)} over {form.termMonths} months</p>
                <p className="text-xs text-slate-700">Income declared: {formatCurrency(form.incomeMonthly)} monthly</p>
              </div>
            </div>
          </div>
          {message ? <div className="rounded-xl border border-line bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
          <Button type="submit" className="w-fit" disabled={submitting || !form.customerId || !form.productId}>
            {submitting ? "Submitting..." : "Submit application"}
          </Button>
        </form>
        <div className="panel p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-ink">Applications</h2>
            <p className="mt-1 text-sm text-muted">Loan requests and review status.</p>
          </div>
          <DataTable
            columns={["Customer", "Product", "Amount", "Term", "Purpose", "Status"]}
            rows={applications.map((item) => ({
              Customer: item.customerName,
              Product: item.productName,
              Amount: formatCurrency(item.amount),
              Term: `${item.termMonths} months`,
              Purpose: item.purpose,
              Status: <StatusBadge status={item.status} />
            }))}
            emptyMessage="No loan applications yet."
          />
        </div>
      </div>
    </AppShell>
  );
}

function LoanInsight({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
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
