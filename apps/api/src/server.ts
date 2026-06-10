import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  customerSignupSchema,
  demoBankId,
  formatCurrency,
  kycSubmitSchema,
  limitChangeSchema,
  loanApplicationSchema,
  loginSchema,
  roleLabels,
  transferSchema,
  type Role
} from "@bank/shared";
import { hasPermission, hashPassword, signAccessToken, verifyAccessToken, verifyPassword, type AuthPrincipal } from "@bank/auth";
import { PrismaClient } from "@bank/db";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const prisma = new PrismaClient();

const app = Fastify({
  logger: true,
  genReqId: () => crypto.randomUUID()
});

const accessSecret = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const statementQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format")
});

async function createNotification(params: {
  userId?: string;
  bankId?: string;
  type: string;
  title: string;
  message: string;
  metadata?: object;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId ?? "00000000-0000-4000-8000-000000000001",
      bankId: params.bankId ?? null,
      type: params.type as any,
      title: params.title,
      message: params.message,
      metadata: params.metadata as any
    }
  });
}

async function logAudit(params: {
  bankId?: string;
  actorUserId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: object;
}) {
  return prisma.auditLog.create({
    data: {
      bankId: params.bankId ?? null,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId ?? null,
      metadata: params.metadata as any
    }
  });
}

async function principalFromToken(token: string): Promise<AuthPrincipal | null> {
  try {
    return await verifyAccessToken(token, accessSecret);
  } catch {
    return null;
  }
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}

async function getUserFromDb(email: string) {
  const result = await Promise.race([
    prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        customers: true,
        roles: {
          include: { bank: true, branch: true }
        }
      }
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
  ]);
  return result;
}

async function buildPrincipal(user: Awaited<ReturnType<typeof getUserFromDb>>, loginType?: "STAFF" | "CUSTOMER"): Promise<AuthPrincipal | null> {
  if (!user) return null;
  const primaryRole = loginType === "CUSTOMER"
    ? user.roles.find((role) => role.role === "Customer")
    : loginType === "STAFF"
      ? user.roles.find((role) => role.role !== "Customer")
      : user.roles[0];
  if (!primaryRole) return null;
  const auditorScope = user.roles.find((r) => r.role === "Auditor")?.auditorScope as "PLATFORM" | "BANK" | null | undefined;
  return {
    userId: user.id,
    ...(user.customers[0]?.id ? { customerId: user.customers[0].id } : {}),
    ...(primaryRole.bankId ? { bankId: primaryRole.bankId } : {}),
    ...(primaryRole.branchId ? { branchId: primaryRole.branchId } : {}),
    roles: user.roles.map((r) => r.role as Role),
    ...(auditorScope ? { auditorScope } : {})
  };
}

function canAccessAccount(principal: AuthPrincipal, account: { bankId: string; customerId: string; customer?: { userId?: string | null } }) {
  if (principal.roles.includes("PlatformAdmin")) return true;
  if (principal.roles.includes("Customer")) {
    return account.customerId === principal.customerId || account.customer?.userId === principal.userId;
  }
  return principal.bankId === account.bankId;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function createAccountNumber() {
  return `01${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`;
}

function createPublicHandle(email: string) {
  const localPart = email.split("@")[0] ?? "customer";
  const base = localPart
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 20) || "customer";
  return `${base}.${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
}

function getMonthRange(month: string) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const label = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(start);
  return { start, end, label };
}

function transactionDirection(tx: { fromCustomerAccountId?: string | null; toCustomerAccountId?: string | null }, accountId: string) {
  return tx.toCustomerAccountId === accountId ? "CREDIT" : "DEBIT";
}

function signedTransactionAmount(tx: { amount: unknown; fromCustomerAccountId?: string | null; toCustomerAccountId?: string | null }, accountId: string) {
  const amount = Number(tx.amount);
  return transactionDirection(tx, accountId) === "CREDIT" ? amount : -amount;
}

function transactionDescription(tx: { type: string; fromCustomerAccountId?: string | null; toCustomerAccountId?: string | null }, accountId: string) {
  if (tx.type === "DEPOSIT") return "Cash deposit";
  if (tx.type === "WITHDRAWAL") return "Cash withdrawal";
  if (tx.type === "TRANSFER" || tx.type === "INTERBANK_TRANSFER") {
    return transactionDirection(tx, accountId) === "CREDIT" ? "Transfer received" : "Transfer sent";
  }
  if (tx.type === "WELCOME_BONUS") return "Welcome bonus";
  return tx.type.replaceAll("_", " ");
}

await app.register(cors, {
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true
});
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(swagger, {
  openapi: {
    info: {
      title: "Bank Management System API",
      version: "0.1.0"
    }
  }
});
await app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/", async () => ({
  service: "bank-api",
  status: "ok",
  health: "/health",
  docs: "/docs"
}));

app.get("/health", async () => ({
  status: "ok",
  service: "bank-api",
  timestamp: new Date().toISOString()
}));

app.post("/auth/signup/customer", async (request, reply) => {
  const parsed = customerSignupSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
  }
  const body = parsed.data;
  const existingUser = await prisma.user.findUnique({ where: { email: body.email } });
  if (existingUser) {
    return reply.code(409).send({ error: "An account already exists for this email" });
  }

  const branch = await prisma.branch.findFirst({
    where: { bankId: demoBankId },
    orderBy: { createdAt: "asc" }
  });
  if (!branch) {
    return reply.code(503).send({ error: "Customer signup is not available yet" });
  }

  const accountProduct = await prisma.accountProduct.findFirst({
    where: { bankId: demoBankId, isActive: true, type: "SAVINGS" },
    orderBy: { createdAt: "asc" }
  }) ?? await prisma.accountProduct.findFirst({
    where: { bankId: demoBankId, isActive: true },
    orderBy: { createdAt: "asc" }
  });
  if (!accountProduct) {
    return reply.code(503).send({ error: "Customer account opening is not available yet" });
  }

  try {
    const passwordHash = await hashPassword(body.password);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          phone: body.phone,
          displayName: body.fullName,
          passwordHash,
          roles: {
            create: {
              role: "Customer",
              bankId: demoBankId,
              branchId: branch.id
            }
          },
          customers: {
            create: {
              bankId: demoBankId,
              branchId: branch.id,
              fullName: body.fullName,
              email: body.email,
              phone: body.phone
            }
          }
        },
        include: { customers: true }
      });

      const customer = user.customers[0];
      if (!customer) {
        throw new Error("Customer profile was not created");
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const account = await tx.customerAccount.create({
            data: {
              bankId: demoBankId,
              branchId: branch.id,
              customerId: customer.id,
              productId: accountProduct.id,
              accountNumber: createAccountNumber(),
              publicHandle: createPublicHandle(body.email),
              balance: {
                create: {
                  ledgerBalance: 5000,
                  availableBalance: 5000
                }
              }
            }
          });

          const bonusTx = await tx.transaction.create({
            data: {
              bankId: demoBankId,
              type: "WELCOME_BONUS",
              status: "POSTED",
              amount: 5000,
              toCustomerAccountId: account.id,
              initiatedByUserId: user.id
            }
          });

          await tx.transactionEvent.create({
            data: {
              transactionId: bonusTx.id,
              status: "POSTED",
              note: "Welcome bonus"
            }
          });

          return;
        } catch (error) {
          if (isUniqueConstraintError(error) && attempt < 4) {
            continue;
          }
          throw error;
        }
      }

      throw new Error("Could not allocate a unique account number");
    }, { timeout: 15000 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return reply.code(409).send({ error: "An account already exists for this email or phone" });
    }
    throw error;
  }

  const user = await getUserFromDb(body.email);
  const principal = await buildPrincipal(user, "CUSTOMER");
  if (!user || !principal) {
    return reply.code(500).send({ error: "Customer signup failed" });
  }

  const primaryRole = user.roles.find((role) => role.role === "Customer");
  const account = principal.customerId
    ? await prisma.customerAccount.findFirst({
        where: { customerId: principal.customerId },
        include: { product: true, balance: true },
        orderBy: { createdAt: "desc" }
      })
    : null;

  const accessToken = await signAccessToken(principal, accessSecret);

  return reply.code(201).send({
    accessToken,
    user: {
      id: user.id,
      displayName: user.displayName,
      role: "Customer",
      roleLabel: roleLabels.Customer,
      bankId: primaryRole?.bankId,
      bankName: primaryRole?.bank?.name,
      customerId: principal.customerId
    },
    account: account ? {
      id: account.id,
      accountNumber: account.accountNumber,
      publicHandle: account.publicHandle,
      product: account.product.name,
      balance: Number(account.balance?.ledgerBalance ?? 0),
      availableBalance: Number(account.balance?.availableBalance ?? 0)
    } : null
  });
});

const demoLoginIdentities: Record<string, { email: string; loginType: "STAFF" | "CUSTOMER" }> = {
  PlatformAdmin: { email: "platform@bancuip.test", loginType: "STAFF" },
  BankAdmin: { email: "admin@meridian.test", loginType: "STAFF" },
  BranchManager: { email: "manager@meridian.test", loginType: "STAFF" },
  Teller: { email: "teller@meridian.test", loginType: "STAFF" },
  LoanOfficer: { email: "loan@meridian.test", loginType: "STAFF" },
  Auditor: { email: "auditor@meridian.test", loginType: "STAFF" },
  Customer: { email: "customer@meridian.test", loginType: "CUSTOMER" }
};

const demoAuthPassword = process.env.DEMO_AUTH_PASSWORD ?? "Password123!";

app.post("/auth/login", async (request, reply) => {
  try {
    const body = loginSchema.parse(request.body);
    const identifier = body.identifier.trim().toLowerCase();

    const demoIdentity = Object.values(demoLoginIdentities).find((identity) => identity.email === identifier);
    const user = await getUserFromDb(identifier).catch(() => null);

    if (user && user.status === "ACTIVE") {
      const hasCustomerRole = user.roles.some((role) => role.role === "Customer");
      const hasStaffRole = user.roles.some((role) => role.role !== "Customer");
      const canUseLoginType = body.loginType === "CUSTOMER" ? hasCustomerRole : hasStaffRole;
      if (!canUseLoginType) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const isPasswordValid = await verifyPassword(user.passwordHash, body.password);
      if (!isPasswordValid) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const principal = await buildPrincipal(user, body.loginType);
      if (!principal) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const accessToken = await signAccessToken(principal, accessSecret);
      const primaryRole = body.loginType === "CUSTOMER"
        ? user.roles.find((role) => role.role === "Customer")
        : user.roles.find((role) => role.role !== "Customer");

      return {
        accessToken,
        user: {
          id: user.id,
          displayName: user.displayName,
          role: primaryRole!.role,
          roleLabel: roleLabels[primaryRole!.role as Role],
          bankId: primaryRole!.bankId,
          bankName: primaryRole!.bank?.name,
          customerId: principal.customerId
        }
      };
    }

    if (demoIdentity && body.password === demoAuthPassword) {
      const demoRole = Object.entries(demoLoginIdentities).find(([, v]) => v.email === identifier)?.[0] as Role | undefined;
      if (demoRole && demoIdentity.loginType === body.loginType) {
        const demoPrincipal: AuthPrincipal = {
          userId: `demo-${demoRole}`,
          ...(demoRole !== "PlatformAdmin" ? { bankId: demoBankId } : {}),
          roles: [demoRole]
        };
        const accessToken = await signAccessToken(demoPrincipal, accessSecret);
        return {
          accessToken,
          user: {
            id: `demo-${demoRole}`,
            displayName: demoRole === "Customer" ? "Amanda Kayle" : roleLabels[demoRole],
            role: demoRole,
            roleLabel: roleLabels[demoRole],
            bankId: demoRole === "PlatformAdmin" ? undefined : demoBankId,
            bankName: demoRole === "PlatformAdmin" ? undefined : "Meridian Cooperative Bank"
          }
        };
      }
    }

    return reply.code(401).send({ error: "Invalid credentials" });
  } catch (error) {
    request.log.error(error, "Login failed");
    return reply.code(500).send({ error: "Login service is temporarily unavailable" });
  }
});

app.get("/auth/me", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const user = await prisma.user.findUnique({
    where: { id: principal.userId },
    include: { customers: true, roles: { include: { bank: true } } }
  });
  if (!user) throw new Error("User not found");
  const primaryRole = user.roles[0];
  if (!primaryRole) throw new Error("User has no assigned role");
  return {
    id: user.id,
    displayName: user.displayName,
    role: primaryRole.role,
    roleLabel: roleLabels[primaryRole.role as Role],
    bankId: primaryRole.bankId,
    bankName: primaryRole.bank?.name,
    customerId: user.customers[0]?.id
  };
});

app.get("/banks", async () => {
  const banks = await prisma.bank.findMany({
    include: {
      _count: { select: { customers: true, branches: true } }
    }
  });
  return { data: banks };
});

app.get("/dashboard", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const bankId = principal.bankId ?? demoBankId;
  const isCustomer = principal.roles.includes("Customer");
  const accountWhere = isCustomer
    ? { bankId, customerId: principal.customerId ?? "00000000-0000-4000-8000-000000000000" }
    : { bankId };

  const [accounts, kycCases, loanApplications, bank] = await Promise.all([
    prisma.customerAccount.findMany({
      where: accountWhere,
      include: { balance: true, customer: true, product: true }
    }),
    prisma.customerKyc.findMany({
      where: {
        bankId,
        ...(isCustomer ? { customerId: principal.customerId ?? "00000000-0000-4000-8000-000000000000" } : {}),
        status: { in: ["SUBMITTED", "IN_REVIEW", "NEEDS_MORE_INFO"] }
      },
      include: { customer: true }
    }),
    prisma.loanApplication.findMany({
      where: {
        bankId,
        ...(isCustomer ? { customerId: principal.customerId ?? "00000000-0000-4000-8000-000000000000" } : {}),
        status: { in: ["SUBMITTED", "IN_REVIEW"] }
      },
      include: { customer: true, product: true }
    }),
    prisma.bank.findUnique({ where: { id: bankId } })
  ]);
  const accountIds = accounts.map((account) => account.id);
  const transactions = await prisma.transaction.findMany({
    where: isCustomer
      ? {
          bankId,
          OR: [
            { fromCustomerAccountId: { in: accountIds } },
            { toCustomerAccountId: { in: accountIds } }
          ]
        }
      : { bankId },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance?.ledgerBalance ?? 0), 0);
  const postedVolume = transactions.filter((tx) => tx.status === "POSTED").reduce((sum, tx) => sum + Number(tx.amount), 0);

  return {
    kpis: [
      { label: "Total deposits", value: formatCurrency(totalBalance), trend: "+8.2%" },
      { label: "Posted volume", value: formatCurrency(postedVolume), trend: "+12.4%" },
      { label: "Open KYC cases", value: String(kycCases.length), trend: `${kycCases.filter(k => k.status !== "APPROVED").length} urgent` },
      { label: "Loan pipeline", value: formatCurrency(loanApplications.reduce((sum, l) => sum + Number(l.requestedAmount), 0)), trend: `${loanApplications.length} reviews` }
    ],
    bankName: bank?.name ?? "Bank",
    accounts: accounts.map((acc) => ({
      id: acc.id,
      bankId: acc.bankId,
      customerId: acc.customerId,
      customerName: acc.customer.fullName,
      accountNumber: acc.accountNumber,
      publicHandle: acc.publicHandle,
      product: acc.product.name,
      status: acc.accountStatus,
      balance: Number(acc.balance?.ledgerBalance ?? 0),
      availableBalance: Number(acc.balance?.availableBalance ?? 0)
    })),
    transactions: transactions.slice(0, 8).map((tx) => ({
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amount: Number(tx.amount),
      from: tx.fromCustomerAccountId,
      to: tx.toCustomerAccountId,
      createdAt: tx.createdAt.toISOString(),
      description: `${tx.type} transaction`
    })),
    chart: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      deposits: [42, 58, 63, 71, 92, 88, 110],
      withdrawals: [28, 31, 36, 42, 39, 45, 51]
    }
  };
});

app.get("/customers", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  if (principal.roles.includes("Customer") && !principal.customerId) {
    return { data: [] };
  }
  const where = principal.roles.includes("Customer")
    ? { id: principal.customerId }
    : { bankId: principal.bankId ?? demoBankId };
  const customers = await prisma.customer.findMany({
    where,
    include: { kycCases: { orderBy: { submittedAt: "desc" }, take: 1 } }
  });
  return { data: customers.map((c) => ({
    id: c.id,
    bankId: c.bankId,
    name: c.fullName,
    email: c.email,
    phone: c.phone,
    kycStatus: c.kycCases[0]?.status ?? "NOT_STARTED",
    dailyLimit: Number(c.dailyLimit)
  })) };
});

app.get("/accounts", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  if (principal.roles.includes("Customer") && !principal.customerId) {
    return { data: [] };
  }
  const where = principal.roles.includes("Customer")
    ? { customerId: principal.customerId }
    : { bankId: principal.bankId ?? demoBankId };
  const accounts = await prisma.customerAccount.findMany({
    where,
    include: { balance: true, customer: true, product: true }
  });
  return { data: accounts.map((acc) => ({
    id: acc.id,
    bankId: acc.bankId,
    customerId: acc.customerId,
    customerName: acc.customer.fullName,
    accountNumber: acc.accountNumber,
    publicHandle: acc.publicHandle,
    product: acc.product.name,
    status: acc.accountStatus,
    balance: Number(acc.balance?.ledgerBalance ?? 0),
    availableBalance: Number(acc.balance?.availableBalance ?? 0)
  })) };
});

app.get<{ Params: { accountId: string } }>("/accounts/:accountId/transactions", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const { accountId } = request.params;
  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    include: { customer: true }
  });
  if (!account || !canAccessAccount(principal, account)) {
    return { data: [] };
  }
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [
        { fromCustomerAccountId: accountId },
        { toCustomerAccountId: accountId }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return { data: transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    status: tx.status,
    amount: Number(tx.amount),
    from: tx.fromCustomerAccountId,
    to: tx.toCustomerAccountId,
    createdAt: tx.createdAt.toISOString()
  })) };
});

app.get<{ Params: { accountId: string }; Querystring: { month?: string } }>("/accounts/:accountId/statement", { preHandler: requireAuth }, async (request, reply) => {
  const principal = (request as any).principal as AuthPrincipal;
  const { accountId } = request.params;
  const parsedQuery = statementQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return reply.code(400).send({ error: parsedQuery.error.issues[0]?.message ?? "Invalid statement month" });
  }

  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    include: { balance: true, customer: true, product: true, bank: true }
  });

  if (!account || !canAccessAccount(principal, account)) {
    return reply.code(404).send({ error: "Account not found" });
  }

  const { start, end, label } = getMonthRange(parsedQuery.data.month);
  const whereForAccount = {
    OR: [
      { fromCustomerAccountId: accountId },
      { toCustomerAccountId: accountId }
    ]
  };

  const [transactions, afterMonthTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        ...whereForAccount,
        status: "POSTED",
        createdAt: { gte: start, lt: end }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.transaction.findMany({
      where: {
        ...whereForAccount,
        status: "POSTED",
        createdAt: { gte: end }
      }
    })
  ]);

  const totalCredit = transactions
    .filter((tx) => transactionDirection(tx, accountId) === "CREDIT")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalDebit = transactions
    .filter((tx) => transactionDirection(tx, accountId) === "DEBIT")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const netAfterMonth = afterMonthTransactions.reduce((sum, tx) => sum + signedTransactionAmount(tx, accountId), 0);
  const closingBalance = Number(account.balance?.ledgerBalance ?? 0) - netAfterMonth;
  const openingBalance = closingBalance - (totalCredit - totalDebit);
  let runningBalance = openingBalance;

  return {
    data: {
      month: parsedQuery.data.month,
      monthLabel: label,
      account: {
        id: account.id,
        bankName: account.bank.name,
        customerName: account.customer.fullName,
        accountNumber: account.accountNumber,
        publicHandle: account.publicHandle,
        product: account.product.name,
        status: account.accountStatus,
        currentBalance: Number(account.balance?.ledgerBalance ?? 0),
        availableBalance: Number(account.balance?.availableBalance ?? 0)
      },
      summary: {
        openingBalance,
        totalCredit,
        totalDebit,
        closingBalance
      },
      transactions: transactions.map((tx) => {
        const balanceImpact = signedTransactionAmount(tx, accountId);
        runningBalance += balanceImpact;
        return {
          id: tx.id,
          date: tx.createdAt.toISOString(),
          description: transactionDescription(tx, accountId),
          type: tx.type,
          status: tx.status,
          direction: transactionDirection(tx, accountId),
          amount: Number(tx.amount),
          balanceImpact,
          runningBalance,
          from: tx.fromCustomerAccountId,
          to: tx.toCustomerAccountId
        };
      })
    }
  };
});

app.post("/transactions/transfer", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal || !hasPermission(principal, "transactions:transfer")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const input = transferSchema.parse(request.body);

  const sourceAccount = await prisma.customerAccount.findUnique({
    where: { id: input.fromAccountId },
    include: { balance: true, customer: true, bank: { include: { policies: true } } }
  });

  if (!sourceAccount || sourceAccount.accountStatus !== "ACTIVE") {
    return reply.code(400).send({ error: "Source account is unavailable" });
  }

  if (!canAccessAccount(principal, sourceAccount)) {
    return reply.code(403).send({ error: "You cannot transfer from this account" });
  }

  const availableBalance = Number(sourceAccount.balance?.availableBalance ?? 0);
  if (availableBalance < input.amount) {
    return reply.code(400).send({ error: "Insufficient available balance" });
  }

  const kyc = await prisma.customerKyc.findFirst({
    where: { customerId: sourceAccount.customerId },
    orderBy: { submittedAt: "desc" }
  });

  if (sourceAccount.bank.policies?.kycRequiredForTransfers && kyc?.status !== "APPROVED") {
    return reply.code(403).send({ error: "KYC approval is required before transfers" });
  }

  const customerDailyUsed = await prisma.transaction.findMany({
    where: {
      fromCustomerAccountId: input.fromAccountId,
      status: "POSTED",
      type: { in: ["TRANSFER", "INTERBANK_TRANSFER"] },
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    }
  });
  const usedToday = customerDailyUsed.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const dailyLimit = Number(sourceAccount.customer.dailyLimit);
  if (usedToday + input.amount > dailyLimit) {
    return reply.code(422).send({ error: "Transfer exceeds daily limit" });
  }

  let destAccount = null;
  if (input.recipientType === "HANDLE") {
    destAccount = await prisma.customerAccount.findFirst({
      where: { bankId: sourceAccount.bankId, publicHandle: input.recipient.replace("@", "") }
    });
  } else if (input.recipientType === "ACCOUNT_NUMBER") {
    destAccount = await prisma.customerAccount.findFirst({
      where: { bankId: sourceAccount.bankId, accountNumber: input.recipient }
    });
  } else if (input.recipientType === "IFSC_ACCOUNT" && input.ifscCode) {
    const destBranch = await prisma.branch.findFirst({ where: { ifscCode: input.ifscCode } });
    if (destBranch) {
      destAccount = await prisma.customerAccount.findFirst({
        where: { bankId: destBranch.bankId, accountNumber: input.recipient }
      });
    }
  }

  if (!destAccount) {
    return reply.code(404).send({ error: "Recipient could not be resolved" });
  }

  if (destAccount.id === sourceAccount.id) {
    return reply.code(400).send({ error: "Source and recipient accounts must be different" });
  }

  const needsApproval = input.amount > (input.recipientType === "IFSC_ACCOUNT" ? 25000 : 50000);
  const newStatus = needsApproval ? "PENDING_APPROVAL" : "POSTED";

  const tx = await prisma.transaction.create({
    data: {
      bankId: sourceAccount.bankId,
      type: input.recipientType === "IFSC_ACCOUNT" ? "INTERBANK_TRANSFER" : "TRANSFER",
      status: newStatus,
      settlementStatus: input.recipientType === "IFSC_ACCOUNT" ? "PENDING" : "NOT_REQUIRED",
      amount: input.amount,
      fromCustomerAccountId: input.fromAccountId,
      toCustomerAccountId: destAccount.id,
      toPublicIdentifier: input.recipientType === "HANDLE" ? input.recipient : null,
      toIfscCode: input.ifscCode ?? null,
      toAccountNumber: input.recipientType !== "HANDLE" ? input.recipient : null,
      initiatedByUserId: principal.userId,
      actedOnBehalf: input.actedOnBehalf ?? false
    }
  });

  await prisma.transactionEvent.create({
    data: { transactionId: tx.id, status: newStatus, note: input.note ?? `Transfer to ${destAccount.publicHandle ?? destAccount.accountNumber}` }
  });

  if (needsApproval) {
    const managers = await prisma.userRole.findMany({
      where: { bankId: sourceAccount.bankId, role: { in: ["BankAdmin", "BranchManager"] } },
      include: { user: true }
    });
    for (const role of managers) {
      await createNotification({
        userId: role.userId,
        bankId: sourceAccount.bankId,
        type: "TRANSFER_PENDING_APPROVAL",
        title: "High-value transfer pending",
        message: `A transfer of ${formatCurrency(input.amount)} needs approval.`,
        metadata: { transactionId: tx.id }
      });
    }
  } else {
    await prisma.accountBalanceCache.upsert({
      where: { accountId: input.fromAccountId },
      update: {
        ledgerBalance: { decrement: input.amount },
        availableBalance: { decrement: input.amount }
      },
      create: {
        accountId: input.fromAccountId,
        ledgerBalance: -input.amount,
        availableBalance: -input.amount
      }
    });

    await prisma.accountBalanceCache.upsert({
      where: { accountId: destAccount.id },
      update: {
        ledgerBalance: { increment: input.amount },
        availableBalance: { increment: input.amount }
      },
      create: {
        accountId: destAccount.id,
        ledgerBalance: input.amount,
        availableBalance: input.amount
      }
    });

    await logAudit({
      bankId: sourceAccount.bankId,
      actorUserId: principal.userId,
      action: "TRANSFER_POSTED",
      resource: "transaction",
      resourceId: tx.id,
      metadata: { amount: input.amount, from: input.fromAccountId, to: destAccount.id }
    });
  }

  return reply.code(needsApproval ? 202 : 201).send({ data: tx, needsApproval });
});

app.post<{ Params: { id: string } }>("/transactions/approve/:id", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal || !hasPermission(principal, "transactions:approve")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const txId = request.params.id;

  const tx = await prisma.transaction.findUnique({
    where: { id: txId },
    include: { bank: true }
  });

  if (!tx) {
    return reply.code(404).send({ error: "Transaction not found" });
  }

  if (tx.status !== "PENDING_APPROVAL") {
    return reply.code(400).send({ error: "Transaction is not pending approval" });
  }

  await prisma.transaction.update({
    where: { id: txId },
    data: { status: "POSTED" }
  });

  await prisma.transactionEvent.create({
    data: { transactionId: txId, status: "POSTED", note: `Approved by ${principal.userId}` }
  });

  if (tx.fromCustomerAccountId) {
    const sourceBal = await prisma.accountBalanceCache.findUnique({ where: { accountId: tx.fromCustomerAccountId } });
    await prisma.accountBalanceCache.upsert({
      where: { accountId: tx.fromCustomerAccountId },
      update: { ledgerBalance: { decrement: tx.amount }, availableBalance: { decrement: tx.amount } },
      create: { accountId: tx.fromCustomerAccountId, ledgerBalance: -Number(tx.amount), availableBalance: -Number(tx.amount) }
    });
  }
  if (tx.toCustomerAccountId) {
    await prisma.accountBalanceCache.upsert({
      where: { accountId: tx.toCustomerAccountId },
      update: { ledgerBalance: { increment: tx.amount }, availableBalance: { increment: tx.amount } },
      create: { accountId: tx.toCustomerAccountId, ledgerBalance: Number(tx.amount), availableBalance: Number(tx.amount) }
    });
  }

  await logAudit({
    bankId: tx.bankId,
    actorUserId: principal.userId,
    action: "TRANSFER_APPROVED",
    resource: "transaction",
    resourceId: txId
  });

  return { success: true };
});

app.post("/transactions/cash", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal || !hasPermission(principal, "transactions:cash")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const body = request.body as { accountId?: string; amount?: number; operation?: "DEPOSIT" | "WITHDRAWAL"; actedOnBehalf?: boolean };
  
  if (!body.accountId || !body.amount || !body.operation) {
    return reply.code(400).send({ error: "accountId, amount, and operation are required" });
  }

  const account = await prisma.customerAccount.findUnique({
    where: { id: body.accountId },
    include: { balance: true, customer: true }
  });

  if (!account) {
    return reply.code(404).send({ error: "Account not found" });
  }

  if (!canAccessAccount(principal, account)) {
    return reply.code(403).send({ error: "You cannot operate on this account" });
  }

  const availableBalance = Number(account.balance?.availableBalance ?? 0);
  if (body.operation === "WITHDRAWAL" && availableBalance < body.amount) {
    return reply.code(400).send({ error: "Insufficient funds" });
  }

  const tx = await prisma.transaction.create({
    data: {
      bankId: account.bankId,
      type: body.operation,
      status: "POSTED",
      amount: body.amount,
      fromCustomerAccountId: body.operation === "WITHDRAWAL" ? body.accountId : null,
      toCustomerAccountId: body.operation === "DEPOSIT" ? body.accountId : null,
      initiatedByUserId: principal.userId,
      actedOnBehalf: body.actedOnBehalf ?? false
    }
  });

  await prisma.transactionEvent.create({
    data: { transactionId: tx.id, status: "POSTED", note: `${body.operation === "DEPOSIT" ? "Cash deposit" : "Cash withdrawal"} at branch` }
  });

  const balanceChange = body.operation === "DEPOSIT" ? body.amount : -body.amount;
  await prisma.accountBalanceCache.upsert({
    where: { accountId: body.accountId },
    update: {
      ledgerBalance: { increment: balanceChange },
      availableBalance: { increment: balanceChange }
    },
    create: {
      accountId: body.accountId,
      ledgerBalance: balanceChange,
      availableBalance: balanceChange
    }
  });

  await logAudit({
    bankId: account.bankId,
    actorUserId: principal.userId,
    action: `CASH_${body.operation}`,
    resource: "transaction",
    resourceId: tx.id,
    metadata: { accountId: body.accountId, amount: body.amount, actedOnBehalf: body.actedOnBehalf }
  });

  return reply.code(201).send({ data: tx });
});

app.get("/kyc/cases", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  if (!hasPermission(principal, "kyc:manage")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const kycCases = await prisma.customerKyc.findMany({
    where: { bankId: principal.bankId ?? demoBankId },
    include: { customer: true, documents: true }
  });
  return { data: kycCases.map((kyc) => ({
    id: kyc.id,
    customerId: kyc.customerId,
    customerName: kyc.customer.fullName,
    status: kyc.status,
    submittedAt: kyc.submittedAt.toISOString(),
    documentType: kyc.documents[0]?.documentType,
    documentNumberLast4: kyc.documents[0]?.documentNumberLast4,
    riskFlags: kyc.riskFlags
  })) };
});

app.post("/kyc/submit", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  if (!hasPermission(principal, "kyc:manage")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const input = kycSubmitSchema.parse(request.body);

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    include: { user: true }
  });

  if (!customer) {
    return reply.code(404).send({ error: "Customer not found" });
  }

  const kyc = await prisma.customerKyc.create({
    data: {
      bankId: principal.bankId ?? demoBankId,
      customerId: input.customerId,
      legalName: input.legalName,
      dateOfBirth: new Date(input.dateOfBirth),
      address: input.address,
      status: "SUBMITTED"
    }
  });

  await prisma.kycDocument.create({
    data: {
      bankId: principal.bankId ?? demoBankId,
      customerId: input.customerId,
      kycId: kyc.id,
      documentType: input.documentType,
      documentNumberLast4: input.documentNumberLast4,
      storageProvider: "local",
      storageBucket: "kyc",
      storageKey: `${kyc.id}/${input.documentType.toLowerCase()}.pdf`,
      contentType: "application/pdf",
      sizeBytes: 0,
      uploadedByUserId: principal.userId
    }
  });

  const managers = await prisma.userRole.findMany({
    where: { bankId: customer.bankId, role: { in: ["BankAdmin", "BranchManager"] } },
    include: { user: true }
  });

  for (const role of managers) {
    await createNotification({
      userId: role.userId,
      bankId: customer.bankId,
      type: "KYC_SUBMITTED",
      title: "KYC review required",
      message: `${input.legalName} submitted KYC documents for review.`,
      metadata: { kycId: kyc.id, customerId: input.customerId }
    });
  }

  await logAudit({
    bankId: customer.bankId,
    actorUserId: principal.userId,
    action: "KYC_SUBMITTED",
    resource: "customer_kyc",
    resourceId: kyc.id,
    metadata: { customerId: input.customerId }
  });

  return reply.code(201).send({ data: kyc });
});

const kycReviewSchema = z.object({
  notes: z.string().max(500).optional()
});

app.post<{ Params: { caseId: string; decision: string } }>("/kyc/cases/:caseId/:decision", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  if (!hasPermission(principal, "kyc:manage")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const { caseId, decision } = request.params;
  const body = kycReviewSchema.parse(request.body || {});
  const notes = body.notes;

  const kyc = await prisma.customerKyc.findUnique({
    where: { id: caseId },
    include: { customer: true }
  });

  if (!kyc) {
    return reply.code(404).send({ error: "KYC case not found" });
  }

  let newStatus: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
  if (decision === "approve") newStatus = "APPROVED";
  else if (decision === "reject") newStatus = "REJECTED";
  else newStatus = "NEEDS_MORE_INFO";

  await prisma.customerKyc.update({
    where: { id: caseId },
    data: {
      status: newStatus,
      lastReviewedByUserId: principal.userId,
      lastReviewedAt: new Date(),
      approvedAt: newStatus === "APPROVED" ? new Date() : null,
      rejectedAt: newStatus === "REJECTED" ? new Date() : null,
      ...(newStatus === "REJECTED" ? { rejectionReasonText: notes || null } : {})
    }
  });

  await prisma.kycReview.create({
    data: {
      bankId: kyc.bankId,
      customerId: kyc.customerId,
      kycId: caseId,
      reviewedByUserId: principal.userId,
      action: newStatus === "APPROVED" ? "APPROVE" : newStatus === "REJECTED" ? "REJECT" : "REQUEST_INFO",
      ...(notes ? { notes } : {})
    }
  });

  if (kyc.customer.userId) {
    await createNotification({
      userId: kyc.customer.userId,
      bankId: kyc.bankId,
      type: newStatus === "APPROVED" ? "KYC_APPROVED" : newStatus === "REJECTED" ? "KYC_REJECTED" : "KYC_NEEDS_MORE_INFO",
      title: newStatus === "APPROVED" ? "KYC approved" : newStatus === "REJECTED" ? "KYC rejected" : "KYC needs more information",
      message: newStatus === "APPROVED" 
        ? "Your KYC has been approved. You can now access all banking features."
        : newStatus === "REJECTED"
          ? notes ? `Your KYC has been rejected: ${notes}` : "Your KYC has been rejected. Please contact support for more information."
          : "Additional information is required for your KYC verification.",
      metadata: { kycId: caseId }
    });
  }

  await logAudit({
    bankId: kyc.bankId,
    actorUserId: principal.userId,
    action: `KYC_${newStatus}`,
    resource: "customer_kyc",
    resourceId: caseId,
    metadata: { customerId: kyc.customerId, notes }
  });

  return { data: { ...kyc, status: newStatus } };
});

app.get("/loans/products", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const products = await prisma.loanProduct.findMany({
    where: { bankId: principal.bankId ?? demoBankId, isActive: true }
  });
  return { data: products.map((p) => ({
    id: p.id,
    name: p.name,
    annualRate: Number(p.annualRate),
    minTermMonths: p.minTermMonths,
    maxTermMonths: p.maxTermMonths
  })) };
});

app.get("/loans/applications", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const canManage = hasPermission(principal, "loans:manage");
  const applications = await prisma.loanApplication.findMany({
    where: {
      bankId: principal.bankId ?? demoBankId,
      ...(!canManage && principal.customerId ? { customerId: principal.customerId } : {})
    },
    include: { customer: true, product: true }
  });
  return { data: applications.map((app) => ({
    id: app.id,
    customerId: app.customerId,
    customerName: app.customer.fullName,
    productName: app.product.name,
    amount: Number(app.requestedAmount),
    termMonths: app.termMonths,
    status: app.status,
    purpose: app.purpose,
    createdAt: app.createdAt.toISOString()
  })) };
});

app.post("/loans/applications", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const input = loanApplicationSchema.parse(request.body);

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    include: { user: true }
  });

  if (!customer) {
    return reply.code(404).send({ error: "Customer not found" });
  }

  const kyc = await prisma.customerKyc.findFirst({
    where: { customerId: input.customerId },
    orderBy: { submittedAt: "desc" }
  });

  if (kyc?.status !== "APPROVED") {
    return reply.code(403).send({ error: "KYC approval is required before loan applications" });
  }

  const product = await prisma.loanProduct.findUnique({ where: { id: input.productId } });
  if (!product) {
    return reply.code(404).send({ error: "Loan product not found" });
  }

  const application = await prisma.loanApplication.create({
    data: {
      bankId: principal.bankId ?? demoBankId,
      customerId: input.customerId,
      productId: input.productId,
      requestedAmount: input.amount,
      termMonths: input.termMonths,
      incomeMonthly: input.incomeMonthly,
      purpose: input.purpose,
      status: "SUBMITTED"
    }
  });

  const loanOfficers = await prisma.userRole.findMany({
    where: { bankId: customer.bankId, role: "LoanOfficer" },
    include: { user: true }
  });

  for (const role of loanOfficers) {
    await createNotification({
      userId: role.userId,
      bankId: customer.bankId,
      type: "LOAN_APPLICATION_SUBMITTED",
      title: "New loan application",
      message: `${customer.fullName} applied for ${formatCurrency(input.amount)}.`,
      metadata: { applicationId: application.id }
    });
  }

  await logAudit({
    bankId: customer.bankId,
    actorUserId: principal.userId,
    action: "LOAN_APPLICATION_SUBMITTED",
    resource: "loan_application",
    resourceId: application.id,
    metadata: { customerId: input.customerId, amount: input.amount }
  });

  return reply.code(201).send({ data: application });
});

app.post<{ Params: { applicationId: string; decision: string } }>("/loans/applications/:applicationId/:decision", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal || !hasPermission(principal, "loans:approve")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const { applicationId, decision } = request.params;

  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: { customer: true }
  });

  if (!application) {
    return reply.code(404).send({ error: "Loan application not found" });
  }

  if (application.status !== "SUBMITTED" && application.status !== "IN_REVIEW") {
    return reply.code(400).send({ error: "Application is not in a reviewable state" });
  }

  let newStatus: "APPROVED" | "REJECTED";
  if (decision === "approve") {
    newStatus = "APPROVED";
  } else if (decision === "reject") {
    newStatus = "REJECTED";
  } else {
    return reply.code(400).send({ error: "Invalid decision. Use 'approve' or 'reject'" });
  }

  await prisma.loanApplication.update({
    where: { id: applicationId },
    data: { status: newStatus }
  });

  if (application.customer.userId) {
    await createNotification({
      userId: application.customer.userId,
      bankId: application.bankId,
      type: newStatus === "APPROVED" ? "LOAN_APPROVED" : "LOAN_REJECTED",
      title: newStatus === "APPROVED" ? "Loan approved" : "Loan rejected",
      message: newStatus === "APPROVED"
        ? `Your ${formatCurrency(Number(application.requestedAmount))} loan application has been approved.`
        : `Your ${formatCurrency(Number(application.requestedAmount))} loan application has been rejected.`,
      metadata: { applicationId: application.id }
    });
  }

  await logAudit({
    bankId: application.bankId,
    actorUserId: principal.userId,
    action: newStatus === "APPROVED" ? "LOAN_APPROVED" : "LOAN_REJECTED",
    resource: "loan_application",
    resourceId: application.id,
    metadata: { customerId: application.customerId, amount: Number(application.requestedAmount) }
  });

  return { data: { ...application, status: newStatus } };
});

app.post("/limits/requests", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const input = limitChangeSchema.parse(request.body);

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    include: { user: true }
  });

  if (!customer) {
    return reply.code(404).send({ error: "Customer not found" });
  }

  const kyc = await prisma.customerKyc.findFirst({
    where: { customerId: input.customerId },
    orderBy: { submittedAt: "desc" }
  });

  if (kyc?.status !== "APPROVED") {
    return reply.code(403).send({ error: "KYC approval is required before limit requests" });
  }

  const requestRecord = await prisma.limitChangeRequest.create({
    data: {
      bankId: principal.bankId ?? demoBankId,
      branchId: customer.branchId,
      customerId: input.customerId,
      requestedDailyLimit: input.requestedDailyLimit,
      reason: input.reason,
      status: "PENDING"
    }
  });

  const managers = await prisma.userRole.findMany({
    where: { bankId: customer.bankId, role: { in: ["BankAdmin", "BranchManager"] } },
    include: { user: true }
  });

  for (const role of managers) {
    await createNotification({
      userId: role.userId,
      bankId: customer.bankId,
      type: "LIMIT_INCREASE_REQUEST",
      title: "Limit increase request",
      message: `${customer.fullName} requested limit increase to ${formatCurrency(input.requestedDailyLimit)}.`,
      metadata: { requestId: requestRecord.id }
    });
  }

  return reply.code(201).send({ data: requestRecord });
});

app.post<{ Params: { requestId: string; decision: string } }>("/limits/requests/:requestId/:decision", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal || !hasPermission(principal, "branches:manage")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const { requestId, decision } = request.params;

  const limitRequest = await prisma.limitChangeRequest.findUnique({
    where: { id: requestId },
    include: { customer: true }
  });

  if (!limitRequest) {
    return reply.code(404).send({ error: "Limit change request not found" });
  }

  if (limitRequest.status !== "PENDING") {
    return reply.code(400).send({ error: "Request is not in a reviewable state" });
  }

  let newStatus: "APPROVED" | "REJECTED";
  if (decision === "approve") {
    newStatus = "APPROVED";
  } else if (decision === "reject") {
    newStatus = "REJECTED";
  } else {
    return reply.code(400).send({ error: "Invalid decision. Use 'approve' or 'reject'" });
  }

  await prisma.limitChangeRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      reviewedByUserId: principal.userId,
      reviewedAt: new Date()
    }
  });

  if (newStatus === "APPROVED") {
    await prisma.customer.update({
      where: { id: limitRequest.customerId },
      data: { dailyLimit: limitRequest.requestedDailyLimit }
    });
  }

  if (limitRequest.customer.userId) {
    await createNotification({
      userId: limitRequest.customer.userId,
      bankId: limitRequest.bankId,
      type: newStatus === "APPROVED" ? "LIMIT_INCREASE_APPROVED" : "LIMIT_INCREASE_REJECTED",
      title: newStatus === "APPROVED" ? "Limit increase approved" : "Limit increase rejected",
      message: newStatus === "APPROVED"
        ? `Your daily transfer limit has been increased to ${formatCurrency(Number(limitRequest.requestedDailyLimit))}.`
        : `Your limit increase request has been rejected.`,
      metadata: { requestId: limitRequest.id }
    });
  }

  await logAudit({
    bankId: limitRequest.bankId,
    actorUserId: principal.userId,
    action: newStatus === "APPROVED" ? "LIMIT_INCREASE_APPROVED" : "LIMIT_INCREASE_REJECTED",
    resource: "limit_change_request",
    resourceId: limitRequest.id,
    metadata: { customerId: limitRequest.customerId, requestedLimit: Number(limitRequest.requestedDailyLimit) }
  });

  return { data: { ...limitRequest, status: newStatus } };
});

app.get("/notifications", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const notifications = await prisma.notification.findMany({
    where: { userId: principal.userId },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return { data: notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString()
  })) };
});

app.get("/notifications/unread-count", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const count = await prisma.notification.count({
    where: { userId: principal.userId, isRead: false }
  });
  return { count };
});

app.post<{ Params: { id: string } }>("/notifications/:id/read", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (request as any).principal = principal;
}}, async (request, reply) => {
  const principal = (request as any).principal;
  const notification = await prisma.notification.findUnique({
    where: { id: request.params.id }
  });
  
  if (!notification || notification.userId !== principal.userId) {
    return reply.code(404).send({ error: "Notification not found" });
  }

  await prisma.notification.update({
    where: { id: request.params.id },
    data: { isRead: true, readAt: new Date() }
  });

  return { success: true };
});

app.get("/audit", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal || !hasPermission(principal, "audit:read")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const bankId = principal.bankId ?? demoBankId;
  
  const logs = await prisma.auditLog.findMany({
    where: { bankId: principal.roles.includes("PlatformAdmin") ? undefined : bankId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  
  return { data: logs.map((log) => ({
    id: log.id,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    actor: log.actor?.email ?? "System",
    createdAt: log.createdAt.toISOString()
  })) };
});

app.get("/ledger", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal || !hasPermission(principal, "ledger:read")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const bankId = principal.bankId ?? demoBankId;

  const entries = await prisma.journalEntry.findMany({
    where: { bankId },
    include: { lines: { include: { ledgerAccount: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return { data: entries.map((entry) => ({
    id: entry.id,
    reference: entry.reference,
    type: entry.type,
    description: entry.description,
    lines: entry.lines.map((line) => ({
      account: line.ledgerAccount.name,
      debit: Number(line.debit),
      credit: Number(line.credit)
    })),
    createdAt: entry.createdAt.toISOString()
  })) };
});

app.get("/reports/summary", { preHandler: async (request, reply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const principal = await principalFromToken(auth.slice(7));
  if (!principal || !hasPermission(principal, "reports:read")) {
    return reply.code(403).send({ error: "Forbidden" });
  }
  (request as any).principal = principal;
}}, async (request) => {
  const principal = (request as any).principal;
  const bankId = principal.bankId ?? demoBankId;

  const [transactions, loanApplications, kycCases] = await Promise.all([
    prisma.transaction.findMany({
      where: { bankId, status: "POSTED" },
      select: { type: true, status: true, amount: true }
    }),
    prisma.loanApplication.findMany({
      where: { bankId },
      select: { status: true, requestedAmount: true }
    }),
    prisma.customerKyc.findMany({
      where: { bankId },
      select: { status: true }
    })
  ]);

  const dailyVolume = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const deposits = transactions.filter((tx) => tx.type === "DEPOSIT").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const withdrawals = transactions.filter((tx) => tx.type === "WITHDRAWAL").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const loanPipeline = loanApplications.filter((a) => a.status === "SUBMITTED" || a.status === "IN_REVIEW")
    .reduce((sum, a) => sum + Number(a.requestedAmount), 0);
  const exceptions = transactions.filter((tx) => tx.status !== "POSTED").length;

  return { data: { dailyVolume, deposits, withdrawals, loanPipeline, exceptions } };
});

app.register((await import("./routes/agent.js")).agentRoutes);

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
