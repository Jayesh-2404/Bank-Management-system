"use client";

import { useState } from "react";
import { Search, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/button";
import { DataTable, StatusBadge } from "@/components/data-table";
import { ai, type AgentResult } from "@/lib/ai";

const searchTypes = [
  { value: "", label: "All" },
  { value: "customers", label: "Customers" },
  { value: "accounts", label: "Accounts" },
  { value: "transactions", label: "Transactions" },
  { value: "kyc", label: "KYC" },
  { value: "loans", label: "Loans" }
];

const statusFilters: Record<string, string[]> = {
  customers: ["ACTIVE", "LOCKED", "DISABLED"],
  accounts: ["ACTIVE", "FROZEN", "CLOSED"],
  transactions: ["POSTED", "PENDING_APPROVAL", "FAILED", "REJECTED"],
  kyc: ["SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED", "NEEDS_MORE_INFO"],
  loans: ["SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED", "DISBURSED"]
};

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q && !searchType) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await ai.search({
      ...(q ? { q } : {}),
      ...(searchType ? { type: searchType } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    } as any);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setResult(res.data);
    }
    setLoading(false);
  }

  function renderResults() {
    if (!result || !result.data || result.data.length === 0) {
      return <p className="py-8 text-center text-sm text-muted">No results found</p>;
    }

    const data = result.data as Array<Record<string, unknown>>;
    const cols = Object.keys(data[0]!).filter((k) => k !== "id");
    return (
      <DataTable
        columns={cols.map((c) => c.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()))}
        rows={data.slice(0, 20).map((row) => {
          const r: Record<string, React.ReactNode> = {};
          for (const c of cols) {
            const v = row[c];
            if (c === "status" || c === "accountStatus") {
              r[c] = <StatusBadge status={String(v)} />;
            } else if (typeof v === "number") {
              r[c] = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
            } else if (v instanceof Date || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v))) {
              r[c] = new Date(String(v)).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
            } else {
              r[c] = String(v ?? "-");
            }
          }
          return r;
        })}
      />
    );
  }

  const currentStatuses = statusFilters[searchType] || [];

  return (
    <div className="space-y-5">
      <form onSubmit={handleSearch} className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-xs font-semibold text-muted">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, account number..."
                className="w-full rounded-lg border border-line bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-ink outline-none placeholder:text-muted focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">Type</label>
            <select
              value={searchType}
              onChange={(e) => { setSearchType(e.target.value); setStatusFilter(""); }}
              className="rounded-lg border border-line bg-slate-50 px-3 py-2.5 text-sm text-ink outline-none focus:border-teal-500"
            >
              {searchTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {currentStatuses.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-line bg-slate-50 px-3 py-2.5 text-sm text-ink outline-none focus:border-teal-500"
              >
                <option value="">All Statuses</option>
                {currentStatuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted opacity-0">Search</label>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="rounded-xl border border-line bg-white">
          <div className="border-b border-line px-5 py-3">
            <p className="text-sm font-semibold text-ink">{result.response}</p>
            {result.total !== undefined && (
              <p className="mt-0.5 text-xs text-muted">{result.total} total result{result.total !== 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="p-5">
            {renderResults()}
          </div>
        </div>
      )}

      {!result && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-4 h-12 w-12 text-muted/30" />
          <p className="text-sm text-muted">Enter a search term or select a type to find data</p>
        </div>
      )}
    </div>
  );
}
