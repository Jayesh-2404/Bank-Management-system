"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Download, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, StatusBadge } from "@/components/data-table";
import { api, getStoredUser, type AccountSummary, type BankStatement } from "@/lib/api";
import { formatCurrency, type Role } from "@bank/shared";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function generateStatementPdf(stmt: BankStatement) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const primary = "#0f766e";
  const gray = "#64748b";
  const dark = "#1e293b";

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Monthly Statement", margin, 20);
  doc.setFontSize(10);
  doc.text(stmt.monthLabel, margin, 30);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, margin, 36);

  let y = 50;

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y - 5, contentWidth, 24, "F");
  doc.setTextColor(dark);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(stmt.account.bankName, margin, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(gray);
  doc.text(`${stmt.account.customerName}  |  ${stmt.account.product}  |  ${stmt.account.accountNumber}`, margin, y + 10);
  if (stmt.account.publicHandle) {
    doc.text(`@${stmt.account.publicHandle}`, margin, y + 16);
  }
  y += 28;

  const metrics = [
    { label: "Opening Balance", value: formatCurrency(stmt.summary.openingBalance) },
    { label: "Total Credits", value: formatCurrency(stmt.summary.totalCredit) },
    { label: "Total Debits", value: formatCurrency(stmt.summary.totalDebit) },
    { label: "Closing Balance", value: formatCurrency(stmt.summary.closingBalance) }
  ];
  const boxW = (contentWidth - 6) / 4;
  metrics.forEach((m, i) => {
    const x = margin + i * (boxW + 2);
    doc.setFillColor(248, 250, 252);
    doc.rect(x, y - 5, boxW, 18, "F");
    doc.setFontSize(7);
    doc.setTextColor(gray);
    doc.text(m.label.toUpperCase(), x + 3, y + 2);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(dark);
    doc.text(m.value, x + 3, y + 11);
    doc.setFont("helvetica", "normal");
  });
  y += 22;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [["Date", "Description", "Type", "Debit", "Credit", "Balance"]],
    body: stmt.transactions.map((tx) => [
      formatDate(tx.date),
      tx.description,
      tx.type.replaceAll("_", " "),
      tx.direction === "DEBIT" ? formatCurrency(tx.amount) : "-",
      tx.direction === "CREDIT" ? formatCurrency(tx.amount) : "-",
      formatCurrency(tx.runningBalance)
    ]),
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "left"
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 28 },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 26, halign: "right" }
    },
    foot: [[
      "",
      { content: `Total transactions: ${stmt.transactions.length}`, styles: { fontStyle: "bold", fontSize: 7.5, textColor: gray } },
      "",
      "",
      "",
      ""
    ]],
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [30, 41, 59]
    }
  });

  const lastY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(7);
  doc.setTextColor(gray);
  doc.text("This is a computer-generated statement.", margin, lastY);
  doc.text(`bancuip  |  ${stmt.account.bankName}`, pageWidth - margin, lastY, { align: "right" });

  doc.save(`statement-${stmt.account.accountNumber}-${stmt.month}.pdf`);
}

export default function StatementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [statementLoading, setStatementLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    if (storedUser.role !== "Customer") {
      router.push("/dashboard");
      return;
    }
    setUser(storedUser);

    api.getAccounts().then((result) => {
      if (result.error) setError(result.error);
      const nextAccounts = result.data ?? [];
      setAccounts(nextAccounts);
      setSelectedAccountId(nextAccounts[0]?.id ?? "");
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (!selectedAccountId || !month) {
      setStatement(null);
      return;
    }

    setStatementLoading(true);
    setError("");
    api.getStatement(selectedAccountId, month).then((result) => {
      if (result.error) {
        setError(result.error);
        setStatement(null);
      } else {
        setStatement(result.data ?? null);
      }
      setStatementLoading(false);
    });
  }, [selectedAccountId, month]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  function handleDownloadPdf() {
    if (!statement) return;
    setDownloading(true);
    try {
      generateStatementPdf(statement);
    } catch (err) {
      console.error("PDF generation failed", err);
    }
    setDownloading(false);
  }

  if (loading || !user) {
    return (
      <AppShell title="Statements" description="Loading monthly statement..." active="/statements">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Statements"
      description="Monthly posted transactions for your account."
      active="/statements"
      role={user.role as Role}
    >
      <div className="grid gap-5">
        <div className="panel p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="grid gap-2">
              <label className="label" htmlFor="account">Account</label>
              <select
                id="account"
                className="field"
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                disabled={accounts.length === 0}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.product} ending {account.accountNumber.slice(-4)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="label" htmlFor="month">Month</label>
              <input
                id="month"
                className="field"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        {statementLoading ? (
          <div className="panel flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        ) : statement ? (
          <>
            <div className="panel p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-ink">{statement.monthLabel}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {statement.account.product} - {statement.account.accountNumber}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <button
                    className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                  >
                    <Download className="h-4 w-4" />
                    {downloading ? "Downloading..." : "Download PDF"}
                  </button>
                  <div className="text-right text-sm text-muted">
                    <p className="font-semibold text-ink">{statement.account.customerName}</p>
                    <p>{statement.account.bankName}</p>
                    <p>{statement.account.publicHandle ? `@${statement.account.publicHandle}` : selectedAccount?.status}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <StatementMetric label="Opening" value={formatCurrency(statement.summary.openingBalance)} />
              <StatementMetric label="Credits" value={formatCurrency(statement.summary.totalCredit)} tone="credit" />
              <StatementMetric label="Debits" value={formatCurrency(statement.summary.totalDebit)} tone="debit" />
              <StatementMetric label="Closing" value={formatCurrency(statement.summary.closingBalance)} />
            </div>

            <div className="panel p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-ink">Transactions</h2>
                <p className="mt-1 text-sm text-muted">{statement.transactions.length} posted transactions</p>
              </div>
              <DataTable
                columns={["Date", "Details", "Debit", "Credit", "Balance", "Status"]}
                emptyMessage="No posted transactions for this month."
                rows={statement.transactions.map((tx) => {
                  const Icon = tx.direction === "CREDIT" ? ArrowDownLeft : ArrowUpRight;
                  return {
                    Date: formatDate(tx.date),
                    Details: (
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tx.direction === "CREDIT" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-ink">{tx.description}</p>
                          <p className="text-xs text-muted">{tx.type.replaceAll("_", " ")}</p>
                        </div>
                      </div>
                    ),
                    Debit: tx.direction === "DEBIT" ? formatCurrency(tx.amount) : "-",
                    Credit: tx.direction === "CREDIT" ? formatCurrency(tx.amount) : "-",
                    Balance: formatCurrency(tx.runningBalance),
                    Status: <StatusBadge status={tx.status} />
                  };
                })}
              />
            </div>
          </>
        ) : (
          <div className="panel p-8 text-center text-sm text-muted">
            No statement available. Select an account and month.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatementMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "credit" | "debit" }) {
  const toneClass = tone === "credit" ? "text-emerald-700" : tone === "debit" ? "text-red-600" : "text-ink";
  return (
    <div className="panel p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-2 text-xl font-bold tracking-normal ${toneClass}`}>{value}</p>
    </div>
  );
}
