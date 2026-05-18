"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { DataTable, StatusBadge } from "@/components/data-table";
import { api, getStoredUser, type CustomerSummary } from "@/lib/api";
import { formatCurrency, type Role } from "@bank/shared";

export default function KycPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    customerId: "",
    legalName: "",
    dateOfBirth: "1994-08-22",
    address: "12 Residency Road, Bengaluru",
    documentType: "PAN",
    documentNumberLast4: "4321"
  });

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);
    Promise.all([api.getCustomers(), api.getKycCases()]).then(([customersResult, casesResult]) => {
      const nextCustomers = customersResult.data ?? [];
      setCustomers(nextCustomers);
      setCases(casesResult.data ?? []);
      const firstCustomer = nextCustomers[0];
      if (firstCustomer) {
        setForm((prev) => ({ ...prev, customerId: firstCustomer.id, legalName: firstCustomer.name }));
      }
    });
  }, [router]);

  async function refreshCases() {
    const result = await api.getKycCases();
    setCases(result.data ?? []);
  }

  async function submitKyc(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    const result = await api.submitKyc(form);
    setMessage(result.error ?? "KYC submitted for review.");
    setSubmitting(false);
    await refreshCases();
  }

  async function review(caseId: string, decision: "approve" | "reject" | "request-info") {
    const result = await api.reviewKyc(caseId, decision);
    setMessage(result.error ?? "KYC decision saved.");
    await refreshCases();
  }

  return (
    <AppShell title="KYC" description="Strict KYC gate for transfers, limit increases, and loan submissions." active="/kyc" role={user?.role as Role | undefined}>
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="panel grid gap-4 p-5" onSubmit={submitKyc}>
          <div>
            <h2 className="text-lg font-semibold">Submit KYC</h2>
            <p className="mt-1 text-sm text-muted">Create a review case using customer profile and masked document details.</p>
          </div>
          <select className="field" value={form.customerId} onChange={(e) => {
            const customer = customers.find((item) => item.id === e.target.value);
            setForm({ ...form, customerId: e.target.value, legalName: customer?.name ?? form.legalName });
          }}>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
          <div className="grid gap-4 md:grid-cols-2">
            <input className="field" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="Legal name" />
            <input className="field" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            <input className="field md:col-span-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" />
            <select className="field" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
              <option value="PAN">PAN</option>
              <option value="AADHAAR">Aadhaar</option>
              <option value="PASSPORT">Passport</option>
              <option value="DRIVER_LICENSE">Driver license</option>
            </select>
            <input className="field" maxLength={4} value={form.documentNumberLast4} onChange={(e) => setForm({ ...form, documentNumberLast4: e.target.value })} placeholder="Document last 4" />
          </div>
          {message ? <div className="rounded-md border border-line bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
          <Button type="submit" className="w-fit" disabled={submitting || !form.customerId}>
            {submitting ? "Submitting..." : "Submit KYC"}
          </Button>
        </form>
        <div className="panel p-5">
          <h2 className="mb-4 text-lg font-semibold">KYC review cases</h2>
          <DataTable
            columns={["Customer", "Status", "Submitted", "Document", "Action"]}
            rows={cases.map((item) => ({
              Customer: item.customerName,
              Status: <StatusBadge status={item.status} />,
              Submitted: new Date(item.submittedAt).toLocaleDateString("en-IN"),
              Document: item.documentType ? `${item.documentType} ending ${item.documentNumberLast4}` : "-",
              Action: item.status === "APPROVED" || item.status === "REJECTED" ? "-" : (
                <div className="flex gap-2">
                  <button className="text-xs font-semibold text-emerald-700" onClick={() => review(item.id, "approve")}>Approve</button>
                  <button className="text-xs font-semibold text-amber-700" onClick={() => review(item.id, "request-info")}>More info</button>
                </div>
              )
            }))}
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {customers.map((customer) => (
              <div key={customer.id} className="rounded-md border border-line bg-slate-50 p-4">
                <p className="font-semibold">{customer.name}</p>
                <p className="mt-1 text-sm text-muted">{customer.email}</p>
                <p className="mt-3 text-sm">Daily limit: {formatCurrency(customer.dailyLimit)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
