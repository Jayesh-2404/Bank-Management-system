import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  demoBankId,
  formatCurrency,
  kycSubmitSchema,
  limitChangeSchema,
  loanApplicationSchema,
  loginSchema,
  roleLabels,
  roles,
  transferSchema,
  type Role
} from "@bank/shared";
import { hasPermission, signAccessToken, verifyAccessToken, verifyPassword, type AuthPrincipal } from "@bank/auth";
import { PrismaClient } from "@bank/db";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const prisma = new PrismaClient();

const app = Fastify({
  logger: true,
  genReqId: () => crypto.randomUUID()
});

const accessSecret = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
const refreshSecret = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
const demoAuthEnabled = process.env.DEMO_AUTH_ENABLED === "true";
const demoAuthPassword = process.env.DEMO_AUTH_PASSWORD ?? "Password123!";

const demoLoginIdentities = {
  PlatformAdmin: { email: "platform@bancuip.test", loginType: "STAFF" },
  BankAdmin: { email: "admin@meridian.test", loginType: "STAFF" },
  BranchManager: { email: "manager@meridian.test", loginType: "STAFF" },
  Teller: { email: "teller@meridian.test", loginType: "STAFF" },
  LoanOfficer: { email: "loan@meridian.test", loginType: "STAFF" },
  Auditor: { email: "auditor@meridian.test", loginType: "STAFF" },
  Customer: { email: "customer@meridian.test", loginType: "CUSTOMER" }
} satisfies Record<Role, { email: string; loginType: "STAFF" | "CUSTOMER" }>;

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

async function getUserFromDb(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      customers: true,
      roles: {
        include: { bank: true, branch: true }
      }
    }
  });
}

async function buildPrincipal(user: Awaited<ReturnType<typeof getUserFromDb>>): Promise<AuthPrincipal | null> {
  if (!user) return null;
  const primaryRole = user.roles[0];
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

await app.register(cors, { origin: corsOrigin, credentials: true });
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

app.get("/health", async () => ({
  status: "ok",
  service: "bank-api",
  timestamp: new Date().toISOString()
}));

app.post("/auth/login", async (request, reply) => {
  const body = loginSchema.parse(request.body);
  const identifier = body.identifier.trim().toLowerCase();
  const demoIdentity = Object.values(demoLoginIdentities).find((identity) => identity.email === identifier);
  const isValidDemoLogin =
    demoAuthEnabled &&
    demoIdentity?.loginType === body.loginType &&
    body.password === demoAuthPassword;
  if (demoAuthEnabled && !isValidDemoLogin) {
    return reply.code(401).send({ error: "Invalid credentials" });
  }

  const loginIdentifier = demoAuthEnabled ? demoIdentity?.email : identifier;
  if (!loginIdentifier) {
    return reply.code(401).send({ error: "Invalid credentials" });
  }

  const user = await getUserFromDb(loginIdentifier);
  
  if (!user) {
    return reply.code(401).send({ error: "Invalid credentials" });
  }

  const isPasswordValid = isValidDemoLogin || await verifyPassword(user.passwordHash, body.password);
  if (!isPasswordValid) {
    return reply.code(401).send({ error: "Invalid credentials" });
  }

  const principal = await buildPrincipal(user);
  if (!principal) {
    return reply.code(401).send({ error: "Invalid credentials" });
  }

  const accessToken = await signAccessToken(principal, accessSecret);
  const primaryRole = user.roles[0];
  if (!primaryRole) {
    return reply.code(401).send({ error: "Invalid credentials" });
  }

  return {
    accessToken,
    user: {
      id: user.id,
      displayName: user.displayName,
      role: primaryRole.role,
      roleLabel: roleLabels[primaryRole.role as Role],
      bankId: primaryRole.bankId,
      bankName: primaryRole.bank?.name
    }
  };
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
    include: { roles: { include: { bank: true } } }
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
    bankName: primaryRole.bank?.name
  };
});

app.get("/session/demo-roles", async () => ({
  roles: roles.map((role) => ({
    role,
    label: roleLabels[role],
    demoEmail: demoLoginIdentities[role].email,
    loginType: demoLoginIdentities[role].loginType
  }))
}));

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

  const [accounts, transactions, kycCases, loanApplications, bank] = await Promise.all([
    prisma.customerAccount.findMany({
      where: { bankId },
      include: { balance: true, customer: true, product: true }
    }),
    prisma.transaction.findMany({
      where: { bankId },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.customerKyc.findMany({
      where: { bankId, status: { in: ["SUBMITTED", "IN_REVIEW", "NEEDS_MORE_INFO"] } },
      include: { customer: true }
    }),
    prisma.loanApplication.findMany({
      where: { bankId, status: { in: ["SUBMITTED", "IN_REVIEW"] } },
      include: { customer: true, product: true }
    }),
    prisma.bank.findUnique({ where: { id: bankId } })
  ]);

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

app.post<{ Params: { caseId: string; decision: string } }>("/kyc/cases/:caseId/:decision", { preHandler: async (request, reply) => {
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
  const { caseId, decision } = request.params;

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
      rejectedAt: newStatus === "REJECTED" ? new Date() : null
    }
  });

  await prisma.kycReview.create({
    data: {
      bankId: kyc.bankId,
      customerId: kyc.customerId,
      kycId: caseId,
      reviewedByUserId: principal.userId,
      action: newStatus === "APPROVED" ? "APPROVE" : newStatus === "REJECTED" ? "REJECT" : "REQUEST_INFO"
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
          ? "Your KYC has been rejected. Please contact support for more information."
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
    metadata: { customerId: kyc.customerId }
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
  const applications = await prisma.loanApplication.findMany({
    where: { bankId: principal.bankId ?? demoBankId },
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

const port = Number(process.env.API_PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
