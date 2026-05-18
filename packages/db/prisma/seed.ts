import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@bank/auth";
import { demoBankId, demoBranchId, demoCustomerId, demoAccountId } from "@bank/shared";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword("Password123!");

  await prisma.bank.upsert({
    where: { id: demoBankId },
    update: {},
    create: {
      id: demoBankId,
      name: "Meridian Cooperative Bank",
      code: "MCB",
      policies: { create: {} },
      branches: {
        create: {
          id: demoBranchId,
          name: "Bengaluru Main",
          ifscCode: "MCB0001234",
          address: "12 Residency Road",
          city: "Bengaluru",
          state: "Karnataka"
        }
      },
      accountProducts: {
        create: [
          { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Prime Savings", type: "SAVINGS" },
          { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Current Account", type: "CURRENT" }
        ]
      },
      loanProducts: {
        create: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            name: "Home Flex Loan",
            annualRate: 8.75,
            minTermMonths: 12,
            maxTermMonths: 240
          },
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            name: "Business Growth Loan",
            annualRate: 11.25,
            minTermMonths: 6,
            maxTermMonths: 84
          }
        ]
      },
      ledgerAccounts: {
        create: [
          { code: "1000", name: "Cash on Hand", type: "ASSET" },
          { code: "1100", name: "Interbank Settlement Receivable", type: "ASSET" },
          { code: "2000", name: "Customer Deposit Liability", type: "LIABILITY" },
          { code: "2100", name: "Interbank Settlement Payable", type: "LIABILITY" },
          { code: "5000", name: "Promotional Expense", type: "EXPENSE" },
          { code: "1200", name: "Loan Principal Receivable", type: "ASSET" },
          { code: "4100", name: "Loan Interest Income", type: "INCOME" }
        ]
      }
    }
  });

  const users = [
    ["00000000-0000-4000-8000-000000000001", "platform@bancuip.test", "Platform Admin", "PlatformAdmin"],
    ["00000000-0000-4000-8000-000000000002", "admin@meridian.test", "Bank Admin", "BankAdmin"],
    ["00000000-0000-4000-8000-000000000003", "manager@meridian.test", "Branch Manager", "BranchManager"],
    ["00000000-0000-4000-8000-000000000004", "teller@meridian.test", "Teller", "Teller"],
    ["00000000-0000-4000-8000-000000000005", "loan@meridian.test", "Loan Officer", "LoanOfficer"],
    ["00000000-0000-4000-8000-000000000006", "auditor@meridian.test", "Auditor", "Auditor"],
    ["00000000-0000-4000-8000-000000000007", "customer@meridian.test", "Amanda Kayle", "Customer"]
  ] as const;

  for (const [id, email, displayName, role] of users) {
    await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email,
        displayName,
        passwordHash,
        roles: {
          create: {
            role,
            bankId: role === "PlatformAdmin" ? null : demoBankId,
            branchId: ["BranchManager", "Teller"].includes(role) ? demoBranchId : null,
            auditorScope: role === "Auditor" ? "BANK" : null
          }
        }
      }
    });
  }

  await prisma.customer.upsert({
    where: { id: demoCustomerId },
    update: {},
    create: {
      id: demoCustomerId,
      bankId: demoBankId,
      branchId: demoBranchId,
      userId: "00000000-0000-4000-8000-000000000007",
      fullName: "Amanda Kayle",
      email: "customer@meridian.test",
      phone: "+919876543210",
      accounts: {
        create: {
          id: demoAccountId,
          bankId: demoBankId,
          branchId: demoBranchId,
          productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          accountNumber: "019284672431",
          publicHandle: "amanda.mcb",
          balance: {
            create: {
              ledgerBalance: 102300,
              availableBalance: 98450
            }
          }
        }
      },
      kycCases: {
        create: {
          bankId: demoBankId,
          legalName: "Amanda Kayle",
          dateOfBirth: new Date("1994-08-22"),
          address: "12 Residency Road, Bengaluru",
          status: "APPROVED",
          approvedAt: new Date()
        }
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      bankId: demoBankId,
      actorUserId: "00000000-0000-4000-8000-000000000002",
      action: "SEED_COMPLETED",
      resource: "system",
      metadata: { version: "0.1.0" }
    }
  });

  const reservedHandles = [
    "admin", "bank", "support", "help", "info", "root", "system", "security",
    "test", "demo", "noreply", "no-reply", "contact", "feedback",
    "pay", "payment", "transfer", "send", "receive"
  ];
  for (const handle of reservedHandles) {
    await prisma.reservedHandle.upsert({
      where: { handle },
      update: {},
      create: { handle, reason: "System reserved" }
    });
  }

  await prisma.customer.upsert({
    where: { id: "66666666-6666-4666-8666-666666666666" },
    update: {},
    create: {
      id: "66666666-6666-4666-8666-666666666666",
      bankId: demoBankId,
      branchId: demoBranchId,
      fullName: "Lindsley Sudiro",
      email: "lindsley@example.com",
      phone: "+919000011111",
      dailyLimit: 50000,
      accounts: {
        create: {
          id: "77777777-7777-4777-8777-777777777777",
          bankId: demoBankId,
          branchId: demoBranchId,
          productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          accountNumber: "019284679911",
          publicHandle: "lindsley.mcb",
          balance: {
            create: {
              ledgerBalance: 45600,
              availableBalance: 45600
            }
          }
        }
      },
      kycCases: {
        create: {
          bankId: demoBankId,
          legalName: "Lindsley Sudiro",
          dateOfBirth: new Date("1991-03-15"),
          address: "45 MG Road, Bengaluru",
          status: "SUBMITTED",
          riskFlags: ["ADDRESS_MATCH_REQUIRED"]
        }
      }
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
