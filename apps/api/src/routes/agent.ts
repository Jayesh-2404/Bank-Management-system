import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hasPermission, verifyAccessToken } from "@bank/auth";
import { demoBankId } from "@bank/shared";
import { handleAgentQuery } from "../lib/agent/handler.js";
import { getInsights } from "../lib/agent/insights.js";

function authHook(permission?: "reports:read") {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const accessSecret = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
    const principal = await verifyAccessToken(auth.slice(7), accessSecret).catch(() => null);
    if (!principal) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    if (permission && !hasPermission(principal, permission)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    (request as any).principal = principal;
  };
}

export async function agentRoutes(app: FastifyInstance) {
  app.post("/agent/query", {
    preHandler: authHook("reports:read")
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = (request as any).principal;
    const body = request.body as { query?: string };
    const query = body?.query;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return reply.code(400).send({ error: "Query is required" });
    }

    const result = await handleAgentQuery({
      query: query.trim(),
      bankId: principal.bankId ?? demoBankId,
      role: principal.roles[0] ?? "BankAdmin"
    });

    return result;
  });

  app.get("/agent/insights", {
    preHandler: authHook("reports:read")
  }, async (request: FastifyRequest) => {
    const principal = (request as any).principal;
    const bankId = principal.bankId ?? demoBankId;

    const insights = await getInsights(bankId);
    return insights;
  });

  app.post("/agent/search", {
    preHandler: authHook("reports:read")
  }, async (request: FastifyRequest) => {
    const principal = (request as any).principal;
    const bankId = principal.bankId ?? demoBankId;
    const body = request.body as { q?: string; type?: string; status?: string; page?: number; limit?: number } | undefined;
    const q = body?.q;
    const type = body?.type;
    const status = body?.status;

    const result = await handleAgentQuery({
      query: q || `Show ${type || "customers"} ${status ? `with status ${status}` : ""}`,
      bankId,
      role: principal.roles[0] ?? "BankAdmin"
    });

    return result;
  });
}
