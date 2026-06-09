import { z } from "zod";

export const roles = [
  "PlatformAdmin",
  "BankAdmin",
  "BranchManager",
  "Teller",
  "LoanOfficer",
  "Auditor",
  "Customer"
] as const;

export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  PlatformAdmin: "Platform Admin",
  BankAdmin: "Bank Admin",
  BranchManager: "Branch Manager",
  Teller: "Teller",
  LoanOfficer: "Loan Officer",
  Auditor: "Auditor",
  Customer: "Customer"
};

export const roleHierarchy: Record<Role, number> = {
  PlatformAdmin: 1,
  BankAdmin: 2,
  BranchManager: 3,
  Teller: 4,
  LoanOfficer: 5,
  Auditor: 6,
  Customer: 7
};

export const permissions = [
  "banks:manage",
  "staff:manage",
  "branches:manage",
  "customers:create",
  "accounts:create",
  "transactions:cash",
  "transactions:transfer",
  "transactions:approve",
  "loans:manage",
  "loans:approve",
  "ledger:read",
  "audit:read",
  "reports:read",
  "kyc:manage",
  "own:accounts",
  "act:on-behalf"
] as const;

export type Permission = (typeof permissions)[number];

export const rolePermissions: Record<Role, Permission[]> = {
  PlatformAdmin: [...permissions],
  BankAdmin: [
    "banks:manage",
    "staff:manage",
    "branches:manage",
    "customers:create",
    "accounts:create",
    "loans:manage",
    "loans:approve",
    "ledger:read",
    "audit:read",
    "reports:read",
    "kyc:manage",
    "act:on-behalf"
  ],
  BranchManager: [
    "branches:manage",
    "customers:create",
    "accounts:create",
    "transactions:cash",
    "transactions:transfer",
    "transactions:approve",
    "loans:manage",
    "loans:approve",
    "ledger:read",
    "audit:read",
    "reports:read",
    "kyc:manage",
    "act:on-behalf"
  ],
  Teller: [
    "customers:create",
    "accounts:create",
    "transactions:cash",
    "transactions:transfer",
    "act:on-behalf"
  ],
  LoanOfficer: ["loans:manage"],
  Auditor: ["ledger:read", "audit:read", "reports:read"],
  Customer: ["own:accounts", "transactions:transfer"]
};

export const publicHandleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9][a-z0-9.-]{1,28}[a-z0-9]$/)
  .transform((value) => value.toLowerCase());

export const reservedHandles = [
  "admin",
  "bank",
  "support",
  "help",
  "info",
  "root",
  "system",
  "security",
  "test",
  "demo",
  "noreply",
  "no-reply",
  "contact",
  "feedback",
  "pay",
  "payment",
  "transfer",
  "send",
  "receive"
] as const;

export const loginSchema = z.object({
  loginType: z.enum(["STAFF", "CUSTOMER"]),
  identifier: z.string().min(3),
  password: z.string().min(8)
});

export const customerSignupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(8).max(128)
});

export const transferSchema = z.object({
  fromAccountId: z.string().uuid(),
  recipientType: z.enum(["HANDLE", "ACCOUNT_NUMBER", "IFSC_ACCOUNT"]),
  recipient: z.string().min(3),
  ifscCode: z.string().optional(),
  amount: z.number().positive(),
  note: z.string().max(160).optional(),
  actedOnBehalf: z.boolean().optional()
});

export const kycSubmitSchema = z.object({
  customerId: z.string().uuid(),
  legalName: z.string().min(2),
  dateOfBirth: z.string(),
  address: z.string().min(8),
  documentType: z.enum(["PAN", "AADHAAR", "PASSPORT", "DRIVER_LICENSE"]),
  documentNumberLast4: z.string().length(4)
});

export const loanApplicationSchema = z.object({
  customerId: z.string().uuid(),
  productId: z.string().uuid(),
  amount: z.number().positive(),
  termMonths: z.number().int().min(3).max(360),
  incomeMonthly: z.number().positive(),
  purpose: z.string().min(3).max(120)
});

export const limitChangeSchema = z.object({
  customerId: z.string().uuid(),
  requestedDailyLimit: z.number().positive(),
  reason: z.string().min(10).max(300)
});

export type TransferInput = z.infer<typeof transferSchema>;
export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
export type KycSubmitInput = z.infer<typeof kycSubmitSchema>;
export type LoanApplicationInput = z.infer<typeof loanApplicationSchema>;
export type LimitChangeInput = z.infer<typeof limitChangeSchema>;

export type AccountStatus = "ACTIVE" | "FROZEN" | "CLOSED";
export type KycStatus = "NOT_STARTED" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
export type TransactionStatus = "POSTED" | "PENDING_APPROVAL" | "REJECTED" | "REVERSED" | "FAILED";
export type LoanApplicationStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "DISBURSED";

export interface DemoBank {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "PAUSED";
  deposits: number;
  loansOutstanding: number;
  transactionVolume: number;
}

export interface DemoAccount {
  id: string;
  bankId: string;
  customerId: string;
  accountNumber: string;
  publicHandle: string;
  product: string;
  status: AccountStatus;
  balance: number;
  availableBalance: number;
}

export interface DemoTransaction {
  id: string;
  bankId: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "INTERBANK_TRANSFER" | "WELCOME_BONUS" | "LOAN_REPAYMENT";
  status: TransactionStatus;
  from?: string;
  to?: string;
  amount: number;
  createdAt: string;
  description: string;
  actedOnBehalf?: boolean;
}

export interface DemoCustomer {
  id: string;
  bankId: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: KycStatus;
  dailyLimit: number;
  usedToday: number;
}

export const demoBankId = "11111111-1111-4111-8111-111111111111";
export const demoBranchId = "22222222-2222-4222-8222-222222222222";
export const demoCustomerId = "33333333-3333-4333-8333-333333333333";
export const demoAccountId = "44444444-4444-4444-8444-444444444444";

export const demoBanks: DemoBank[] = [
  {
    id: demoBankId,
    name: "Meridian Cooperative Bank",
    code: "MCB",
    status: "ACTIVE",
    deposits: 841250000,
    loansOutstanding: 318400000,
    transactionVolume: 54200000
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Northstar Retail Bank",
    code: "NRB",
    status: "ACTIVE",
    deposits: 412980000,
    loansOutstanding: 149800000,
    transactionVolume: 22150000
  }
];

export const demoCustomers: DemoCustomer[] = [
  {
    id: demoCustomerId,
    bankId: demoBankId,
    name: "Amanda Kayle",
    email: "customer@meridian.test",
    phone: "+91 98765 43210",
    kycStatus: "APPROVED",
    dailyLimit: 250000,
    usedToday: 46000
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    bankId: demoBankId,
    name: "Lindsley Sudiro",
    email: "lindsley@example.com",
    phone: "+91 90000 11111",
    kycStatus: "SUBMITTED",
    dailyLimit: 50000,
    usedToday: 0
  }
];

export const demoAccounts: DemoAccount[] = [
  {
    id: demoAccountId,
    bankId: demoBankId,
    customerId: demoCustomerId,
    accountNumber: "019284672431",
    publicHandle: "amanda@meridian",
    product: "Prime Savings",
    status: "ACTIVE",
    balance: 102300,
    availableBalance: 98450
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    bankId: demoBankId,
    customerId: demoCustomerId,
    accountNumber: "019284679911",
    publicHandle: "amanda.business",
    product: "Current Account",
    status: "ACTIVE",
    balance: 264800,
    availableBalance: 264800
  }
];

export const demoTransactions: DemoTransaction[] = [
  {
    id: "88888888-8888-4888-8888-888888888888",
    bankId: demoBankId,
    type: "TRANSFER",
    status: "POSTED",
    from: demoAccountId,
    to: "66666666-6666-4666-8666-666666666666",
    amount: 12000,
    createdAt: "2026-05-11T09:40:00.000Z",
    description: "To Lindsley Sudiro"
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    bankId: demoBankId,
    type: "DEPOSIT",
    status: "POSTED",
    to: demoAccountId,
    amount: 45000,
    createdAt: "2026-05-11T07:20:00.000Z",
    description: "Cash deposit at Main branch",
    actedOnBehalf: true
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    bankId: demoBankId,
    type: "LOAN_REPAYMENT",
    status: "POSTED",
    from: demoAccountId,
    amount: 15400,
    createdAt: "2026-05-10T12:04:00.000Z",
    description: "Home loan installment"
  }
];

export const formatCurrency = (amount: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
