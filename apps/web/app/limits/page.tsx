"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <form className="panel grid gap-4 p-5" onSubmit={submitRequest}>
          <div>
            <h2 className="text-lg font-semibold">Request limit increase</h2>
            <p className="mt-1 text-sm text-muted">Requests route to bank and branch managers after KYC checks.</p>
          </div>
          <select className="field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
          <input className="field" type="number" value={form.requestedDailyLimit} onChange={(e) => setForm({ ...form, requestedDailyLimit: Number(e.target.value) })} />
          <textarea className="field min-h-32" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          {message ? <div className="rounded-md border border-line bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
          <Button type="submit" className="w-fit" disabled={submitting || !form.customerId || form.reason.length < 10}>
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
        </form>
        <div className="panel p-5">
          <h2 className="mb-4 text-lg font-semibold">Effective customer limits</h2>
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
