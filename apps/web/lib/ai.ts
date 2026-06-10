import { apiFetch } from "./api";

export interface AgentResult {
  response: string;
  intent: string;
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

export const ai = {
  query: async (query: string) =>
    apiFetch<AgentResult>("/agent/query", {
      method: "POST",
      body: JSON.stringify({ query })
    }),

  search: async (params: { q?: string; type?: string; status?: string; page?: number; limit?: number }) =>
    apiFetch<AgentResult>("/agent/search", {
      method: "POST",
      body: JSON.stringify(params)
    }),

  getInsights: async () =>
    apiFetch<AgentInsights>("/agent/insights")
};
