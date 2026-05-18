"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <form className="panel grid gap-4 p-5" onSubmit={submitApplication}>
          <div>
            <h2 className="text-lg font-semibold">New loan application</h2>
            <p className="mt-1 text-sm text-muted">Submit an application against active loan products.</p>
          </div>
          <select className="field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
          <select className="field" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name} ({product.annualRate}% p.a.)</option>
            ))}
          </select>
          <div className="grid gap-4 md:grid-cols-2">
            <input className="field" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            <input className="field" type="number" value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: Number(e.target.value) })} />
            <input className="field" type="number" value={form.incomeMonthly} onChange={(e) => setForm({ ...form, incomeMonthly: Number(e.target.value) })} />
            <input className="field" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>
          {message ? <div className="rounded-md border border-line bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
          <Button type="submit" className="w-fit" disabled={submitting || !form.customerId || !form.productId}>
            {submitting ? "Submitting..." : "Submit application"}
          </Button>
        </form>
        <div className="panel p-5">
          <h2 className="mb-4 text-lg font-semibold">Applications</h2>
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
