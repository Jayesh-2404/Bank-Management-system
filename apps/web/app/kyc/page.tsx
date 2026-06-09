"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, ShieldCheck, UserCheck, Users } from "lucide-react";
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
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
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

  async function refreshAll() {
    const [customersResult, casesResult] = await Promise.all([api.getCustomers(), api.getKycCases()]);
    setCustomers(customersResult.data ?? []);
    setCases(casesResult.data ?? []);
  }

  async function submitKyc(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    const result = await api.submitKyc(form);
    setMessage(result.error ?? "KYC submitted for review.");
    setSubmitting(false);
    await refreshAll();
  }

  async function review(caseId: string, decision: "approve" | "reject" | "request-info", notes?: string) {
    setMessage("");
    const result = await api.reviewKyc(caseId, decision, notes);
    setMessage(result.error ?? "KYC decision saved.");
    setConfirmReject(null);
    setRejectReason("");
    await refreshAll();
  }

  function handleRejectClick(caseId: string) {
    setConfirmReject(caseId);
    setRejectReason("");
  }

  function confirmRejectAction() {
    if (confirmReject) {
      review(confirmReject, "reject", rejectReason);
    }
  }

  const isStaff = user?.role && ["BankAdmin", "BranchManager"].includes(user.role);

  return (
    <AppShell title="KYC" description="Strict KYC gate for transfers, limit increases, and loan submissions." active="/kyc" role={user?.role as Role | undefined}>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <KycInsight icon={Users} label="Customers" value={String(customers.length)} />
        <KycInsight icon={FileCheck2} label="Open cases" value={String(cases.filter((item) => !["APPROVED", "REJECTED"].includes(item.status)).length)} />
        <KycInsight icon={ShieldCheck} label="Approved" value={String(cases.filter((item) => item.status === "APPROVED").length)} />
      </div>

      {message ? (
        <div className="mb-5 rounded-xl border border-line bg-slate-50 p-3 text-sm text-slate-700">{message}</div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">KYC review cases</h2>
              <p className="mt-1 text-sm text-muted">Review and decide on pending KYC submissions.</p>
            </div>
            <button
              className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              onClick={refreshAll}
            >
              Refresh
            </button>
          </div>
          <DataTable
            columns={["Customer", "Status", "Submitted", "Document", "Action"]}
            rows={cases.map((item) => ({
              Customer: item.customerName,
              Status: <StatusBadge status={item.status} />,
              Submitted: new Date(item.submittedAt).toLocaleDateString("en-IN"),
              Document: item.documentType ? `${item.documentType} ending ${item.documentNumberLast4}` : "-",
              Action: item.status === "APPROVED" || item.status === "REJECTED" ? "-" : (
                <div className="flex gap-2">
                  <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => review(item.id, "approve")}>Approve</button>
                  <button className="text-xs font-semibold text-red-700 hover:text-red-800" onClick={() => handleRejectClick(item.id)}>Reject</button>
                  <button className="text-xs font-semibold text-amber-700 hover:text-amber-800" onClick={() => review(item.id, "request-info")}>More info</button>
                </div>
              )
            }))}
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {customers.map((customer) => (
              <div key={customer.id} className="rounded-xl border border-line bg-slate-50 p-4">
                <p className="font-semibold text-ink">{customer.name}</p>
                <p className="mt-1 text-sm text-muted">{customer.email}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusBadge status={customer.kycStatus} />
                  <p className="text-sm font-semibold text-slate-700">{formatCurrency(customer.dailyLimit)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isStaff && (
          <form className="panel grid gap-5 p-6 h-fit" onSubmit={submitKyc}>
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                <UserCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-ink">Submit KYC</h2>
              <p className="mt-1 text-sm text-muted">Create a review case using customer profile and masked document details.</p>
            </div>
            <div className="grid gap-2">
              <label className="label">Customer</label>
              <select className="field" value={form.customerId} onChange={(e) => {
                const customer = customers.find((item) => item.id === e.target.value);
                setForm({ ...form, customerId: e.target.value, legalName: customer?.name ?? form.legalName });
              }}>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="label">Legal name</label>
                <input className="field" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="Legal name" />
              </div>
              <div className="grid gap-2">
                <label className="label">Date of birth</label>
                <input className="field" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label className="label">Address</label>
                <input className="field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" />
              </div>
              <div className="grid gap-2">
                <label className="label">Document</label>
                <select className="field" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
                  <option value="PAN">PAN</option>
                  <option value="AADHAAR">Aadhaar</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVER_LICENSE">Driver license</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="label">Document last 4</label>
                <input className="field" maxLength={4} value={form.documentNumberLast4} onChange={(e) => setForm({ ...form, documentNumberLast4: e.target.value })} placeholder="Document last 4" />
              </div>
            </div>
            <Button type="submit" className="w-fit" disabled={submitting || !form.customerId}>
              {submitting ? "Submitting..." : "Submit KYC"}
            </Button>
          </form>
        )}
      </div>

      {confirmReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-panel">
            <h3 className="text-lg font-semibold text-ink">Reject KYC</h3>
            <p className="mt-1 text-sm text-muted">Provide a reason for rejecting this KYC application.</p>
            <textarea
              className="field mt-4 min-h-[100px] w-full"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setConfirmReject(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                onClick={confirmRejectAction}
                disabled={!rejectReason.trim()}
              >
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function KycInsight({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
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
