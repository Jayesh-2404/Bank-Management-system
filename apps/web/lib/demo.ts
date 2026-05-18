import {
  demoAccounts,
  demoBanks,
  demoCustomers,
  demoTransactions,
  formatCurrency,
  roleLabels,
  type Role
} from "@bank/shared";

export const activeRole: Role = "BankAdmin";

export const demoUser = {
  name: "Amanda Kayle",
  email: "customer@meridian.test",
  role: activeRole,
  roleLabel: roleLabels[activeRole],
  bank: demoBanks[0]!
};

export const accounts = demoAccounts;
export const customers = demoCustomers;
export const transactions = demoTransactions;

export const dashboardKpis = [
  { label: "Total deposits", value: formatCurrency(841250000), trend: "+8.2%", tone: "teal" },
  { label: "Daily volume", value: formatCurrency(54200000), trend: "+12.4%", tone: "blue" },
  { label: "Loan pipeline", value: formatCurrency(318400000), trend: "14 reviews", tone: "amber" },
  { label: "Risk exceptions", value: "18", trend: "5 urgent", tone: "red" }
];

export const volumeSeries = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  deposits: [42, 58, 63, 71, 92, 88, 110],
  withdrawals: [28, 31, 36, 42, 39, 45, 51]
};

export const approvals = [
  { id: "APR-1042", type: "KYC", customer: "Lindsley Sudiro", amount: "-", status: "Submitted", owner: "Branch Manager" },
  { id: "APR-1043", type: "Transfer", customer: "Amanda Kayle", amount: formatCurrency(78000), status: "Pending approval", owner: "Bank Admin" },
  { id: "APR-1044", type: "Loan", customer: "Rohit Malhotra", amount: formatCurrency(750000), status: "In review", owner: "Loan Officer" }
];

export const auditLogs = [
  { id: "AUD-721", action: "TRANSFER_CREATED", actor: "customer@meridian.test", resource: "transaction", time: "11 May 2026, 15:10" },
  { id: "AUD-722", action: "KYC_APPROVED", actor: "manager@meridian.test", resource: "customer_kyc", time: "10 May 2026, 16:50" },
  { id: "AUD-723", action: "TELLER_ACT_ON_BEHALF", actor: "teller@meridian.test", resource: "transaction", time: "11 May 2026, 12:50" }
];

export const loanApplications = [
  { id: "LN-9031", customer: "Amanda Kayle", product: "Home Flex Loan", amount: formatCurrency(750000), status: "In review", ltv: "62%" },
  { id: "LN-9032", customer: "Nisha Rao", product: "Business Growth Loan", amount: formatCurrency(420000), status: "Submitted", ltv: "n/a" },
  { id: "LN-9033", customer: "Farhan Ali", product: "Vehicle Loan", amount: formatCurrency(360000), status: "Approved", ltv: "48%" }
];

export const branches = [
  { id: "BR-001", name: "Bengaluru Main", ifsc: "MCB0001234", manager: "Anika Shah", volume: formatCurrency(18400000) },
  { id: "BR-002", name: "Indiranagar", ifsc: "MCB0001235", manager: "Rahul Menon", volume: formatCurrency(12100000) },
  { id: "BR-003", name: "Whitefield", ifsc: "MCB0001236", manager: "Priya Bose", volume: formatCurrency(9400000) }
];
