"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { DataTable, StatusBadge } from "@/components/data-table";
import { api, getStoredUser, type CustomerSummary } from "@/lib/api";
import { formatCurrency, type Role } from "@bank/shared";

export default function LimitsPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    requestedDailyLimit: 500000,
    reason: "Need higher daily transfer limit for business payments."
  });

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);
    api.getCustomers().then((result) => {
      const nextCustomers = result.data ?? [];
      setCustomers(nextCustomers);
      setForm((prev) => ({ ...prev, customerId: nextCustomers[0]?.id ?? "" }));
    });
  }, [router]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    const result = await api.submitLimitRequest(form);
    setMessage(result.error ?? "Limit increase request submitted.");
    setSubmitting(false);
  }

  return (
    <AppShell title="Transfer Limits" description="View effective limits, request increases, and route approvals through branch and bank policy." active="/limits" role={user?.role as Role | undefined}>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <LimitInsight icon={Users} label="Customers" value={String(customers.length)} />
        <LimitInsight icon={Gauge} label="Average limit" value={formatCurrency(customers.length ? customers.reduce((sum, customer) => sum + customer.dailyLimit, 0) / customers.length : 0)} />
        <LimitInsight icon={ShieldCheck} label="Eligibility" value="KYC gated" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <form className="panel grid gap-5 p-6" onSubmit={submitRequest}>
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-ink">Request limit increase</h2>
            <p className="mt-1 text-sm text-muted">Requests route to bank and branch managers after KYC checks.</p>
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
            <label className="label">Requested daily limit</label>
            <input className="field" type="number" value={form.requestedDailyLimit} onChange={(e) => setForm({ ...form, requestedDailyLimit: Number(e.target.value) })} />
          </div>
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">Request preview</p>
            <p className="mt-2 text-2xl font-bold text-ink">{formatCurrency(form.requestedDailyLimit)}</p>
            <p className="mt-1 text-sm text-slate-700">Daily transfer ceiling after approval</p>
          </div>
          <div className="grid gap-2">
            <label className="label">Reason</label>
            <textarea className="field min-h-32" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          {message ? <div className="rounded-xl border border-line bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
          <Button type="submit" className="w-fit" disabled={submitting || !form.customerId || form.reason.length < 10}>
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
        </form>
        <div className="panel p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-ink">Effective customer limits</h2>
            <p className="mt-1 text-sm text-muted">Current KYC state and transfer ceilings.</p>
          </div>
          <DataTable
            columns={["Customer", "KYC", "Daily limit", "Contact"]}
            rows={customers.map((customer) => ({
              Customer: customer.name,
              KYC: <StatusBadge status={customer.kycStatus} />,
              "Daily limit": formatCurrency(customer.dailyLimit),
              Contact: customer.email
            }))}
            emptyMessage="No customer limits available."
          />
        </div>
      </div>
    </AppShell>
  );
}

function LimitInsight({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
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
