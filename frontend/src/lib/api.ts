import type {
  AuthSession,
  BankApplicationRow,
  BankComplianceRow,
  DemoUser,
  DistrictHeatmapRow,
  EligibilityEstimate,
  FarmerApplicationOutcome,
  Grievance,
  OptimizerResult,
  PolicyConfig,
  WeatherProfile,
} from "@/types/dss";

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.port === "3000") {
    return "http://127.0.0.1:8000";
  }
  return "";
}

function authHeaders(): Record<string, string> {
  const saved = sessionStorage.getItem("krishi-session");
  return saved
    ? { Authorization: "Bearer " + JSON.parse(saved).access_token }
    : {};
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    if (res.status === 401 && path !== "/api/auth/login") {
      sessionStorage.removeItem("krishi-session");
      window.dispatchEvent(new Event("krishi-expired"));
    }
    const data = await res.json().catch(() => ({}));
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((e: { msg: string }) => e.msg).join(", ")
          : "";
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  downloadEvidence: async (ref: string) => {
    const res = await fetch(
      getApiBaseUrl() + "/api/evidence/" + encodeURIComponent(ref),
      { headers: authHeaders() },
    );
    if (!res.ok) throw Error("Attachment unavailable.");
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "evidence-" + ref;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },
  logout: () => fetchJson("/api/auth/logout", { method: "POST" }),
  myApplications: () =>
    fetchJson<{ id: number; application_no: string; status: string }[]>(
      "/api/farmer/my-applications",
    ),
  review: (id: number, action: string, reason: string) =>
    fetchJson("/api/bank/applications/" + id + "/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    }),

  getStackStatus: () =>
    fetchJson<Record<string, unknown>>("/api/system/stack-status"),
  getDemoAccounts: () => fetchJson<DemoUser[]>("/api/system/demo-accounts"),
  getScaleOfFinance: () =>
    fetchJson<{
      merchants: {
        merchant_id: string;
        name: string;
        category: string;
        district: string;
      }[];
    }>("/api/system/scale-of-finance"),
  resetDatabase: () =>
    fetchJson<{ status: string; message: string }>("/api/system/reset", {
      method: "POST",
    }),

  loginDemo: (email: string, password = "demo123", demoBank?: string) =>
    fetchJson<AuthSession>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, demo_bank: demoBank }),
    }),

  uploadFile: async (file: File) => {
    const base = getApiBaseUrl();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${base}/api/upload/file`, {
      method: "POST",
      body: form,
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{
      status: string;
      storage: string;
      filename: string;
      url: string;
    }>;
  },

  getLiveWeather: (district: string) =>
    fetchJson<WeatherProfile>(
      `/api/weather/live/${encodeURIComponent(district)}`,
    ),

  estimateEligibility: (data: Record<string, unknown>) =>
    fetchJson<EligibilityEstimate>("/evaluate/decision-tree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  submitApplication: (data: Record<string, unknown>) =>
    fetchJson<{
      application_id: number;
      application_no: string;
      status: string;
    }>("/api/farmer/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  getApplicationOutcome: (appId: number) =>
    fetchJson<FarmerApplicationOutcome>(`/api/farmer/applications/${appId}`),

  redeemVoucher: (voucherCode: string, merchantId: string) =>
    fetchJson<{
      status: string;
      merchant_name: string;
      category: string;
      message: string;
      detail?: string;
    }>("/api/farmer/vouchers/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voucher_code: voucherCode,
        merchant_id: merchantId,
      }),
    }),

  verifySowing: (
    trancheId: number,
    data: { geo_lat: number; geo_long: number; geo_proof_photo: string },
  ) =>
    fetchJson<{ status: string; message: string }>(
      "/api/farmer/tranches/verify-sowing",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tranche_id: trancheId, ...data }),
      },
    ),

  fileGrievance: (data: Record<string, unknown>) =>
    fetchJson<{ status: string; message: string }>("/api/farmer/grievances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  getBankApplications: (
    filters: {
      district?: string;
      category?: string;
      status?: string;
      search?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (filters.district && filters.district !== "All")
      params.append("district", filters.district);
    if (filters.category && filters.category !== "All")
      params.append("category", filters.category);
    if (filters.status && filters.status !== "All")
      params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);
    return fetchJson<BankApplicationRow[]>(
      `/api/bank/applications?${params.toString()}`,
    );
  },

  runOptimizer: (data: Record<string, unknown>) =>
    fetchJson<OptimizerResult>("/optimize/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  disburseBatch: (appIds: number[], runId: number) =>
    fetchJson<{ status: string; message: string }>("/api/bank/disburse-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_ids: appIds, run_id: runId }),
    }),

  getBankGrievances: () => fetchJson<Grievance[]>("/api/bank/grievances"),

  resolveBankGrievance: (
    id: number,
    responseText: string,
    status = "resolved",
  ) =>
    fetchJson<{ status: string }>(`/api/bank/grievances/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bank_response: responseText,
        resolution_status: status,
      }),
    }),

  getGovtMacroKpi: () =>
    fetchJson<{
      ground_level_credit_target: string;
      total_applications: number;
      approved_applications: number;
      total_sanctioned_amount: number;
      smf_share_pct: number;
      rbi_smf_mandate_benchmark_pct: number;
      voucher_utilization_pct: number;
      escalated_grievances: number;
    }>("/api/govt/macro-kpi"),

  getDistrictHeatmap: () =>
    fetchJson<DistrictHeatmapRow[]>("/api/govt/district-heatmap"),
  getBankCompliance: () =>
    fetchJson<BankComplianceRow[]>("/api/govt/bank-compliance"),
  getPolicyConfig: () => fetchJson<PolicyConfig>("/api/govt/policy-config"),

  updatePolicyConfig: (data: Record<string, unknown>) =>
    fetchJson<{ status: string; message: string }>(
      "/api/govt/policy-config/update",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),

  getEscalatedTribunal: () =>
    fetchJson<Grievance[]>("/api/govt/escalated-tribunal"),

  issueTribunalDirective: (id: number, directive: string) =>
    fetchJson<{ status: string; message: string }>(
      `/api/govt/escalated-tribunal/${id}/directive`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive }),
      },
    ),
};
