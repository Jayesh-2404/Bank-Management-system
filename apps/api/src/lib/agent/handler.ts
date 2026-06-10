import { PrismaClient } from "@bank/db";
import { SYSTEM_PROMPT } from "./prompts.js";
import type { AgentQuery, AgentIntent, AgentResult } from "./types.js";

const prisma = new PrismaClient();

function buildWhereClause(filters: AgentIntent["filters"], bankId?: string) {
  const where: Record<string, unknown> = {};
  if (bankId) where.bankId = bankId;

  for (const f of filters) {
    if (f.field === "fullName" || f.field === "customerName") {
      where.fullName = f.operator === "contains"
        ? { contains: f.value, mode: "insensitive" }
        : f.operator === "startsWith"
          ? { startsWith: f.value, mode: "insensitive" }
          : f.value;
    } else if (f.field === "email" || f.field === "phone") {
      where[f.field] = f.operator === "contains"
        ? { contains: f.value, mode: "insensitive" }
        : f.value;
    } else if (f.field === "status") {
      where.status = f.operator === "in" ? { in: f.value } : f.value;
    } else if (f.field === "balance" || f.field === "amount" || f.field === "requestedAmount" || f.field === "dailyLimit") {
      if (f.operator === "gt") where[f.field] = { gt: f.value };
      else if (f.operator === "gte") where[f.field] = { gte: f.value };
      else if (f.operator === "lt") where[f.field] = { lt: f.value };
      else if (f.operator === "lte") where[f.field] = { lte: f.value };
      else if (f.operator === "between") {
        const arr = f.value as [number, number];
        where[f.field] = { gte: arr[0], lte: arr[1] };
      }
    } else if (f.field === "createdAt") {
      if (f.operator === "gt" || f.operator === "gte") where.createdAt = { [f.operator]: new Date(f.value as string) };
      else if (f.operator === "lt" || f.operator === "lte") where.createdAt = { [f.operator]: new Date(f.value as string) };
      else if (f.operator === "between") {
        const arr = f.value as [string, string];
        where.createdAt = { gte: new Date(arr[0]), lte: new Date(arr[1]) };
      }
    }
  }
  return where;
}

function parseFiltersFromKeywords(query: string): Partial<AgentIntent> {
  const q = query.toLowerCase();
  const result: Partial<AgentIntent> = { filters: [], limit: 20, explanation: `Processing: "${query}"` };

  if (/customer|user|person|client/i.test(q)) result.intent = "SEARCH_CUSTOMERS";
  else if (/account|balance|savings/i.test(q)) result.intent = "SEARCH_ACCOUNTS";
  else if (/transaction|transfer|payment|deposit|withdrawal/i.test(q)) result.intent = "SEARCH_TRANSACTIONS";
  else if (/kyc|verification|document|identity/i.test(q)) result.intent = "SEARCH_KYC";
  else if (/loan|borrow|credit|mortgage/i.test(q)) result.intent = "SEARCH_LOANS";
  else if (/count|how many|total/i.test(q)) result.intent = "GET_COUNT";
  else if (/anomaly|suspicious|unusual|flag|fraud/i.test(q)) result.intent = "ANOMALY";
  else result.intent = "GET_INSIGHTS";

  const statusMatch = q.match(/(pending|approved|rejected|active|frozen|closed|submitted|in.review|needs.more.info)/i);
  if (statusMatch) {
    const raw = statusMatch[1]!;
    result.filters!.push({
      field: "status",
      operator: "eq",
      value: raw === "in review" ? "IN_REVIEW" : raw.toUpperCase().replace(/ /g, "_")
    });
  }

  const nameMatch = q.match(/(?:named|called|for|by)\s+["']?(\w+\s*\w*)["']?/i);
  if (nameMatch) {
    result.filters!.push({ field: "fullName", operator: "contains", value: nameMatch[1]!.trim() });
  }

  const amountMatch = q.match(/(\d[\d,]*)\s*(lakh|crore|k|thousand|₹)?/i);
  if (amountMatch) {
    let val = parseFloat(amountMatch[1]!.replace(/,/g, ""));
    const unit = (amountMatch[2] || "").toLowerCase();
    if (unit === "k" || unit === "thousand") val *= 1000;
    else if (unit === "lakh") val *= 100000;
    else if (unit === "crore") val *= 10000000;
    const direct = /over|above|more than|greater|>=?/i.test(q) ? "gte" : /under|below|less than|<=?/i.test(q) ? "lte" : "eq";
    const field = /transaction|transfer|payment/i.test(q) ? "amount" : "balance";
    result.filters!.push({ field: field as "amount" | "balance", operator: direct as "gte" | "lte" | "eq", value: val });
  }

  return result;
}

function formatResults(intent: string, data: unknown[], total: number, query: string): string {
  if (total === 0) return "No results found.";

  const counts: Record<string, string> = {
    SEARCH_CUSTOMERS: `Found ${total} customer${total === 1 ? "" : "s"}`,
    SEARCH_ACCOUNTS: `Found ${total} account${total === 1 ? "" : "s"}`,
    SEARCH_TRANSACTIONS: `Found ${total} transaction${total === 1 ? "" : "s"}`,
    SEARCH_KYC: `Found ${total} KYC case${total === 1 ? "" : "s"}`,
    SEARCH_LOANS: `Found ${total} loan application${total === 1 ? "" : "s"}`,
    GET_COUNT: "Showing entity counts",
    GET_INSIGHTS: "Here are the insights"
  };

  return counts[intent] || `Found ${total} result${total === 1 ? "" : "s"}`;
}

function anomaliesFromResults(results: Record<string, unknown>, bankId?: string) {
  const anomalies: Array<{ type: string; severity: "high" | "medium" | "low"; title: string; description: string; count: number }> = [];

  const failedTx = results.failedTransactions;
  if (Array.isArray(failedTx) && failedTx.length >= 3) {
    anomalies.push({
      type: "failed_transactions",
      severity: "high",
      title: "Multiple failed transactions",
      description: `${failedTx.length} transactions have failed recently`,
      count: failedTx.length
    });
  }

  const largeTx = results.largeTransactions;
  if (Array.isArray(largeTx) && largeTx.length > 0) {
    anomalies.push({
      type: "large_transactions",
      severity: "medium",
      title: "Large value transactions",
      description: `${largeTx.length} transactions over ₹1,00,000 detected`,
      count: largeTx.length
    });
  }

  const pendingKyc = results.pendingKyc;
  if (typeof pendingKyc === "number" && pendingKyc > 5) {
    anomalies.push({
      type: "kyc_backlog",
      severity: "medium",
      title: "KYC approval backlog",
      description: `${pendingKyc} KYC cases pending review`,
      count: pendingKyc
    });
  }

  return anomalies;
}

export async function handleAgentQuery(agentQuery: AgentQuery): Promise<AgentResult> {
  const { query, bankId, role } = agentQuery;

  let parsedIntent: Partial<AgentIntent>;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { text: `User query: "${query}"\nUser role: ${role}\nBank ID: ${bankId || "unknown"}` }
      ]);
      const text = result.response.text().trim();
      const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*$/gm, "").trim();
      parsedIntent = JSON.parse(cleaned) as AgentIntent;
    } catch {
      parsedIntent = parseFiltersFromKeywords(query);
    }
  } else {
    parsedIntent = parseFiltersFromKeywords(query);
  }

  parsedIntent.filters = parsedIntent.filters || [];
  const intent = parsedIntent.intent || "GET_INSIGHTS";
  const limit = parsedIntent.limit || 20;
  const orderBy = parsedIntent.sort ? { [parsedIntent.sort.field]: parsedIntent.sort.order } : { createdAt: "desc" as const };

  try {
    let data: unknown[] = [];
    let total = 0;

    switch (intent) {
      case "SEARCH_CUSTOMERS": {
        const where = buildWhereClause(parsedIntent.filters, bankId);
        const [rows, count] = await Promise.all([
          prisma.customer.findMany({
            where: where as any,
            take: limit,
            skip: parsedIntent.offset || 0,
            orderBy: orderBy as any,
            select: { id: true, fullName: true, email: true, phone: true, dailyLimit: true, createdAt: true }
          }),
          prisma.customer.count({ where: where as any })
        ]);
        data = rows;
        total = count;
        break;
      }

      case "SEARCH_ACCOUNTS": {
        const where: Record<string, unknown> = {};
        if (bankId) where.bankId = bankId;
        for (const f of parsedIntent.filters) {
          if (f.field === "balance") {
            if (f.operator === "gte") {
              where.balance = { ledgerBalance: { gte: f.value } };
            } else if (f.operator === "lte") {
              where.balance = { ledgerBalance: { lte: f.value } };
            }
          }
          if (f.field === "status") where.accountStatus = f.value;
          if (f.field === "fullName" || f.field === "customerName") {
            where.customer = { fullName: { contains: f.value, mode: "insensitive" } };
          }
        }
        const [rows, count] = await Promise.all([
          prisma.customerAccount.findMany({
            where: where as any,
            take: limit,
            skip: parsedIntent.offset || 0,
            include: { customer: { select: { fullName: true } }, balance: { select: { ledgerBalance: true, availableBalance: true } } },
            orderBy: { createdAt: "desc" }
          }),
          prisma.customerAccount.count({ where: where as any })
        ]);
        data = rows.map((r) => ({
          id: r.id,
          accountNumber: r.accountNumber,
          publicHandle: r.publicHandle,
          status: r.accountStatus,
          customerName: r.customer.fullName,
          balance: Number(r.balance?.ledgerBalance || 0),
          availableBalance: Number(r.balance?.availableBalance || 0),
          createdAt: r.createdAt.toISOString()
        }));
        total = count;
        break;
      }

      case "SEARCH_TRANSACTIONS": {
        const where: Record<string, unknown> = {};
        if (bankId) where.bankId = bankId;
        for (const f of parsedIntent.filters) {
          if (f.field === "amount") {
            if (f.operator === "gte") where.amount = { gte: f.value };
            else if (f.operator === "lte") where.amount = { lte: f.value };
            else where.amount = f.value;
          }
          if (f.field === "status") where.status = f.value;
        }
        const [rows, count] = await Promise.all([
          prisma.transaction.findMany({
            where: where as any,
            take: limit,
            skip: parsedIntent.offset || 0,
            orderBy: { createdAt: "desc" },
            select: { id: true, type: true, status: true, amount: true, createdAt: true }
          }),
          prisma.transaction.count({ where: where as any })
        ]);
        data = rows.map((r) => ({ ...r, amount: Number(r.amount) }));
        total = count;
        break;
      }

      case "SEARCH_KYC": {
        const where: Record<string, unknown> = {};
        if (bankId) where.bankId = bankId;
        for (const f of parsedIntent.filters) {
          if (f.field === "status") where.status = f.value;
        }
        const [rows, count] = await Promise.all([
          prisma.customerKyc.findMany({
            where: where as any,
            take: limit,
            skip: parsedIntent.offset || 0,
            orderBy: { submittedAt: "desc" },
            select: { id: true, status: true, legalName: true, submittedAt: true, customer: { select: { fullName: true } } }
          }),
          prisma.customerKyc.count({ where: where as any })
        ]);
        data = rows.map((r) => ({ id: r.id, status: r.status, legalName: r.legalName, customerName: r.customer.fullName, submittedAt: r.submittedAt.toISOString() }));
        total = count;
        break;
      }

      case "SEARCH_LOANS": {
        const where: Record<string, unknown> = {};
        if (bankId) where.bankId = bankId;
        for (const f of parsedIntent.filters) {
          if (f.field === "status") where.status = f.value;
        }
        const [rows, count] = await Promise.all([
          prisma.loanApplication.findMany({
            where: where as any,
            take: limit,
            skip: parsedIntent.offset || 0,
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true, requestedAmount: true, termMonths: true, createdAt: true, customer: { select: { fullName: true } }, product: { select: { name: true } } }
          }),
          prisma.loanApplication.count({ where: where as any })
        ]);
        data = rows.map((r) => ({ id: r.id, status: r.status, customerName: r.customer.fullName, product: r.product.name, requestedAmount: Number(r.requestedAmount), termMonths: r.termMonths, createdAt: r.createdAt.toISOString() }));
        total = count;
        break;
      }

      case "GET_COUNT": {
        const [customers, accounts, transactions, kycCases, loanApps] = await Promise.all([
          prisma.customer.count({ where: bankId ? { bankId } : {} }),
          prisma.customerAccount.count({ where: bankId ? { bankId } : {} }),
          prisma.transaction.count({ where: bankId ? { bankId } : {} }),
          prisma.customerKyc.count({ where: bankId ? { bankId } : {} }),
          prisma.loanApplication.count({ where: bankId ? { bankId } : {} })
        ]);
        const counts = { customers, accounts, transactions, kycCases, loanApplications: loanApps };
        data = [counts];
        total = Object.values(counts).reduce((a, b) => a + b, 0);
        break;
      }

      case "ANOMALY": {
        const txWhere = bankId ? { bankId } : {};
        const [failedTx, largeTx, pendingKycCount] = await Promise.all([
          prisma.transaction.findMany({
            where: { ...txWhere, status: { in: ["FAILED", "REJECTED"] }, createdAt: { gte: new Date(Date.now() - 86400000 * 7) } } as any,
            take: 50
          }),
          prisma.transaction.findMany({
            where: { ...txWhere, amount: { gte: 100000 }, createdAt: { gte: new Date(Date.now() - 86400000 * 7) } } as any,
            take: 50
          }),
          prisma.customerKyc.count({
            where: { ...(bankId ? { bankId } : {}), status: { in: ["SUBMITTED", "IN_REVIEW", "NEEDS_MORE_INFO"] } } as any
          })
        ]);
        const anomalies = anomaliesFromResults({ failedTransactions: failedTx, largeTransactions: largeTx, pendingKyc: pendingKycCount }, bankId);
        data = anomalies as unknown as unknown[];
        total = anomalies.length;
        break;
      }

      default: {
        const [customerCount, accountCount, txCount, kycCount, loanCount] = await Promise.all([
          prisma.customer.count({ where: bankId ? { bankId } : {} }),
          prisma.customerAccount.count({ where: bankId ? { bankId } : {} }),
          prisma.transaction.count({ where: bankId ? { bankId } : {} }),
          prisma.customerKyc.count({ where: bankId ? { bankId } : {} }),
          prisma.loanApplication.count({ where: bankId ? { bankId } : {} })
        ]);
        data = [{
          customers: customerCount,
          accounts: accountCount,
          transactions: txCount,
          kycCases: kycCount,
          loanApplications: loanCount
        }];
        total = 1;
        break;
      }
    }

    return {
      response: formatResults(intent, data, total, query),
      intent,
      data,
      total,
      query
    };
  } catch (error) {
    return {
      response: "An error occurred while processing your query. Please try again.",
      intent: intent as any,
      data: [],
      query
    };
  }
}
