import { API_URL } from "@bank/shared";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface AccountSummary {
  id: string;
  bankId: string;
  customerId: string;
  customerName: string;
  accountNumber: string;
  publicHandle?: string;
  product: string;
  status: "ACTIVE" | "FROZEN" | "CLOSED";
  balance: number;
  availableBalance: number;
}

export interface TransactionSummary {
  id: string;
  type: string;
  status: string;
  amount: number;
  from?: string | null;
  to?: string | null;
  createdAt: string;
  description?: string;
}

export interface BankStatement {
  month: string;
  monthLabel: string;
  account: {
    id: string;
    bankName: string;
    customerName: string;
    accountNumber: string;
    publicHandle?: string | null;
    product: string;
    status: string;
    currentBalance: number;
    availableBalance: number;
  };
  summary: {
    openingBalance: number;
    totalCredit: number;
    totalDebit: number;
    closingBalance: number;
  };
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    type: string;
    status: string;
    direction: "CREDIT" | "DEBIT";
    amount: number;
    balanceImpact: number;
    runningBalance: number;
    from?: string | null;
    to?: string | null;
  }>;
}

export interface CustomerSummary {
  id: string;
  bankId: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: string;
  dailyLimit: number;
}

interface AuthUser {
  id: string;
  displayName: string;
  role: string;
  roleLabel: string;
  bankId: string;
  bankName: string;
  customerId?: string;
}

function getAuthHeader(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("auth_token");
  return token ? `Bearer ${token}` : null;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {})
  };
  
  const auth = getAuthHeader();
  if (auth) headers["Authorization"] = auth;

  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      if (typeof window !== "undefined") window.location.href = "/auth/signin";
      return { error: "Unauthorized" };
    }

    const json = await res.json();
    
    if (!res.ok) {
      return { error: json.error || "Request failed" };
    }

    return { data: json };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}

function unwrapData<T>(response: ApiResponse<{ data: T }>): ApiResponse<T> {
  if (response.error) return { error: response.error };
  return { data: response.data?.data ?? ([] as T) };
}

export async function login(identifier: string, password: string, loginType: "STAFF" | "CUSTOMER") {
  const res = await apiFetch<{ accessToken: string; user: AuthUser }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ identifier, password, loginType })
    }
  );

  if (res.data?.accessToken) {
    localStorage.setItem("auth_token", res.data.accessToken);
    localStorage.setItem("auth_user", JSON.stringify(res.data.user));
  }

  return res;
}

export async function signupCustomer(data: { fullName: string; email: string; phone: string; password: string }) {
  const res = await apiFetch<{ accessToken: string; user: AuthUser }>(
    "/auth/signup/customer",
    {
      method: "POST",
      body: JSON.stringify(data)
    }
  );

  if (res.data?.accessToken) {
    localStorage.setItem("auth_token", res.data.accessToken);
    localStorage.setItem("auth_user", JSON.stringify(res.data.user));
  }

  return res;
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("auth_user");
  return stored ? JSON.parse(stored) : null;
}

export function logout() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

export const api = {
  login,
  signupCustomer,
  logout,
  getStoredUser,
  
  getDashboard: () => apiFetch<any>("/dashboard"),
  getBanks: async () => unwrapData<any[]>(await apiFetch<{ data: any[] }>("/banks")),
  getCustomers: async () => unwrapData<CustomerSummary[]>(await apiFetch<{ data: CustomerSummary[] }>("/customers")),
  getAccounts: async () => unwrapData<AccountSummary[]>(await apiFetch<{ data: AccountSummary[] }>("/accounts")),
  getAccountTransactions: async (accountId: string) => unwrapData<TransactionSummary[]>(await apiFetch<{ data: TransactionSummary[] }>(`/accounts/${accountId}/transactions`)),
  getStatement: async (accountId: string, month: string) =>
    unwrapData<BankStatement>(await apiFetch<{ data: BankStatement }>(`/accounts/${accountId}/statement?month=${encodeURIComponent(month)}`)),
  
  transfer: (data: { fromAccountId: string; recipientType: string; recipient: string; ifscCode?: string | undefined; amount: number; note?: string | undefined; actedOnBehalf?: boolean }) => 
    apiFetch<any>("/transactions/transfer", { method: "POST", body: JSON.stringify(data) }),
  
  cashTransaction: (data: { accountId: string; amount: number; operation: "DEPOSIT" | "WITHDRAWAL"; actedOnBehalf?: boolean }) =>
    apiFetch<any>("/transactions/cash", { method: "POST", body: JSON.stringify(data) }),
  
  approveTransaction: (id: string) => apiFetch<any>(`/transactions/approve/${id}`, { method: "POST" }),
  
  getKycCases: async () => unwrapData<any[]>(await apiFetch<{ data: any[] }>("/kyc/cases")),
  submitKyc: (data: any) => apiFetch<any>("/kyc/submit", { method: "POST", body: JSON.stringify(data) }),
  reviewKyc: (caseId: string, decision: "approve" | "reject" | "request-info", notes?: string) => 
    apiFetch<any>(`/kyc/cases/${caseId}/${decision}`, { method: "POST", body: JSON.stringify({ notes }) }),
  
  getLoanProducts: async () => unwrapData<any[]>(await apiFetch<{ data: any[] }>("/loans/products")),
  getLoanApplications: async () => unwrapData<any[]>(await apiFetch<{ data: any[] }>("/loans/applications")),
  submitLoanApplication: (data: any) => apiFetch<any>("/loans/applications", { method: "POST", body: JSON.stringify(data) }),
  
  submitLimitRequest: (data: any) => apiFetch<any>("/limits/requests", { method: "POST", body: JSON.stringify(data) }),
  
  getNotifications: async () => unwrapData<any[]>(await apiFetch<{ data: any[] }>("/notifications")),
  getUnreadCount: () => apiFetch<any>("/notifications/unread-count"),
  markNotificationRead: (id: string) => apiFetch<any>(`/notifications/${id}/read`, { method: "POST" }),
  
  getAuditLogs: () => apiFetch<any>("/audit"),
  getLedger: () => apiFetch<any>("/ledger"),
  getReportsSummary: () => apiFetch<any>("/reports/summary")
};
