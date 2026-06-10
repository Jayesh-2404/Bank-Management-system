export const INTENTS = [
  "SEARCH_CUSTOMERS",
  "SEARCH_ACCOUNTS",
  "SEARCH_TRANSACTIONS",
  "SEARCH_KYC",
  "SEARCH_LOANS",
  "GET_COUNT",
  "GET_SUMMARY",
  "GET_INSIGHTS",
  "ANOMALY"
] as const;

export type Intent = (typeof INTENTS)[number];

export interface AgentQuery {
  query: string;
  bankId?: string;
  customerId?: string;
  role: string;
}

export interface AgentFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith" | "in" | "between";
  value: unknown;
}

export interface AgentIntent {
  intent: Intent;
  filters: AgentFilter[];
  sort?: { field: string; order: "asc" | "desc" };
  limit?: number;
  offset?: number;
  aggregate?: string;
  explanation: string;
}

export interface AgentResult {
  response: string;
  intent: Intent;
  data: unknown[];
  total?: number;
  query: string;
}

export interface InsightMetric {
  label: string;
  value: string;
  trend: string;
  tone: "teal" | "blue" | "amber" | "red";
}

export interface InsightAnomaly {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  count: number;
}

export interface AgentInsights {
  metrics: InsightMetric[];
  anomalies: InsightAnomaly[];
  generatedAt: string;
}
