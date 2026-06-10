import { PrismaClient } from "@bank/db";
import type { AgentInsights, InsightMetric, InsightAnomaly } from "./types.js";

const prisma = new PrismaClient();

let cache: { data: AgentInsights; expiresAt: number } | null = null;
const CACHE_TTL = 300_000;

function formatRupees(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function trend(current: number, previous: number): string {
  if (previous === 0) return "New";
  const pct = ((current - previous) / previous) * 100;
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  if (pct < 0) return `${pct.toFixed(1)}%`;
  return "0%";
}

export async function getInsights(bankId?: string): Promise<AgentInsights> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.data;
  }

  const where = bankId ? { bankId } : {};

  const thirtyDaysAgo = new Date(now - 86400000 * 30);
  const sixtyDaysAgo = new Date(now - 86400000 * 60);

  const [
    totalCustomers,
    customersLast30d,
    customersPrev30d,
    totalAccounts,
    postedTx,
    postedTxPrev,
    deposits,
    withdrawals,
    kycStats,
    loanStats,
    pendingApprovals,
    failedTx
  ] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.count({ where: { ...where, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.customer.count({ where: { ...where, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.customerAccount.count({ where }),
    prisma.transaction.count({ where: { ...where, status: "POSTED", createdAt: { gte: thirtyDaysAgo } } }),
    prisma.transaction.count({ where: { ...where, status: "POSTED", createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.transaction.aggregate({ where: { ...where, type: "DEPOSIT", createdAt: { gte: thirtyDaysAgo } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...where, type: "WITHDRAWAL", createdAt: { gte: thirtyDaysAgo } }, _sum: { amount: true } }),
    prisma.customerKyc.groupBy({ by: ["status"], where, _count: true }),
    prisma.loanApplication.groupBy({ by: ["status"], where, _count: true }),
    prisma.transaction.count({ where: { ...where, status: "PENDING_APPROVAL" } }),
    prisma.transaction.count({ where: { ...where, status: { in: ["FAILED", "REJECTED"] }, createdAt: { gte: thirtyDaysAgo } } })
  ]);

  const depositTotal = Number(deposits._sum.amount || 0);
  const withdrawalTotal = Number(withdrawals._sum.amount || 0);

  const kycStatusMap: Record<string, number> = {};
  for (const k of kycStats) kycStatusMap[k.status] = k._count;

  const loanStatusMap: Record<string, number> = {};
  for (const l of loanStats) loanStatusMap[l.status] = l._count;

  const submittedKyc = kycStatusMap["SUBMITTED"] || 0;
  const approvedKyc = kycStatusMap["APPROVED"] || 0;
  const totalKyc = submittedKyc + approvedKyc + (kycStatusMap["IN_REVIEW"] || 0) + (kycStatusMap["REJECTED"] || 0) + (kycStatusMap["NEEDS_MORE_INFO"] || 0);
  const kycConversion = totalKyc > 0 ? Math.round((approvedKyc / totalKyc) * 100) : 0;

  const metrics: InsightMetric[] = [
    { label: "Total Customers", value: totalCustomers.toLocaleString("en-IN"), trend: trend(customersLast30d, customersPrev30d), tone: "teal" },
    { label: "Total Accounts", value: totalAccounts.toLocaleString("en-IN"), trend: `${(totalAccounts / Math.max(totalCustomers, 1)).toFixed(1)}/cust`, tone: "blue" },
    { label: "30d Transactions", value: postedTx.toLocaleString("en-IN"), trend: trend(postedTx, postedTxPrev), tone: "teal" },
    { label: "Deposit Volume", value: formatRupees(depositTotal), trend: `${depositTotal > withdrawalTotal ? "+" : ""}${trend(depositTotal, withdrawalTotal)}`, tone: depositTotal > withdrawalTotal ? "teal" : "amber" },
    { label: "KYC Conversion", value: `${kycConversion}%`, trend: `${submittedKyc} pending`, tone: submittedKyc > 5 ? "amber" : "teal" },
    { label: "Pending Approvals", value: pendingApprovals.toString(), trend: pendingApprovals > 0 ? `${pendingApprovals} items` : "None", tone: pendingApprovals > 5 ? "red" : pendingApprovals > 0 ? "amber" : "teal" },
    { label: "Failed Transactions", value: failedTx.toString(), trend: failedTx > 0 ? `${failedTx} in 30d` : "None", tone: failedTx > 3 ? "red" : "teal" },
    { label: "Loans Submitted", value: (loanStatusMap["SUBMITTED"] || 0).toString(), trend: `Total ${totalKyc > 0 ? Object.values(loanStatusMap).reduce((a, b) => a + b, 0) : 0}`, tone: "blue" }
  ];

  const anomalies: InsightAnomaly[] = [];

  if (failedTx >= 3) {
    anomalies.push({ type: "failed_tx", severity: "high", title: "Failed Transactions", description: `${failedTx} transactions failed in last 30 days`, count: failedTx });
  }

  if (pendingApprovals > 5) {
    anomalies.push({ type: "approval_backlog", severity: "medium", title: "Approval Backlog", description: `${pendingApprovals} items awaiting approval`, count: pendingApprovals });
  }

  if (submittedKyc > 5) {
    anomalies.push({ type: "kyc_backlog", severity: "low", title: "KYC Backlog", description: `${submittedKyc} KYC cases pending review`, count: submittedKyc });
  }

  const kycInReview = kycStatusMap["IN_REVIEW"] || 0;
  if (kycInReview > 3) {
    anomalies.push({ type: "kyc_in_review", severity: "low", title: "KYC In Review", description: `${kycInReview} cases currently being reviewed`, count: kycInReview });
  }

  const insights: AgentInsights = {
    metrics,
    anomalies,
    generatedAt: new Date().toISOString()
  };

  cache = { data: insights, expiresAt: now + CACHE_TTL };
  return insights;
}
