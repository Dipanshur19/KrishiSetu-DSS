export type UserRole = "farmer" | "bank_officer" | "govt_auditor" | "admin";
export type Language = "en" | "hi";

export interface DemoUser {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  district: string;
  branch_or_dept?: string;
}

export interface AuthSession {
  email: string;
  access_token: string;
  auth_provider: string;
  user: {
    role: UserRole;
    username?: string;
    full_name: string;
    district: string;
    branch_or_dept?: string;
    application_id?: number;
  };
}

export interface DecisionStep {
  step: number;
  name: string;
  status: string;
  result: string;
  details: string;
  data?: Record<string, string | number | boolean>;
}

export interface ShapFactor {
  feature?: string;
  name: string;
  direction: "RISK_DECREASE" | "RISK_INCREASE";
  shap_logodds?: number;
  delta_pd_pct: number;
  text: string;
}

export interface Tranche {
  id: number;
  application_id: number;
  tranche_no: number;
  tranche_name: string;
  percentage: number;
  amount: number;
  status: "locked" | "disbursed" | "redeemed";
  voucher_code: string;
  qr_payload?: string;
  merchant_name?: string;
  redemption_timestamp?: string;
  geo_proof_photo?: string;
  geo_lat?: number;
  geo_long?: number;
}

export interface Grievance {
  id: number;
  application_id?: number;
  farmer_id: number;
  full_name?: string;
  district?: string;
  application_no?: string;
  bank_assigned?: string;
  category: string;
  grievance_text: string;
  supporting_doc?: string;
  bank_response?: string;
  resolution_status: "open" | "resolved" | "escalated";
  sla_deadline?: string;
  govt_directive?: string;
  created_at: string;
}

export interface WeatherDailyPoint {
  date: string;
  precip_mm: number;
  temp_max_c: number;
}

export interface WeatherProfile {
  source: string;
  district: string;
  latitude: number;
  longitude: number;
  forecast_14d_precip_mm: number;
  baseline_14d_precip_mm: number;
  avg_max_temp_c: number;
  rainfall_anomaly_pct: number;
  drought_risk: string;
  daily_series: WeatherDailyPoint[];
}

export interface FarmerApplicationOutcome {
  id: number;
  application_no: string;
  farmer_id: number;
  facility_type: string;
  requested_amount: number;
  primary_crop: string;
  secondary_crop?: string;
  marketing_tieup: string;
  pmfby_optin: boolean | number;
  status: string;
  bank_assigned: string;
  full_name: string;
  phone: string;
  farmer_uid: string;
  pmkisan_id: string;
  social_category: string;
  village: string;
  district: string;
  area_acres: number;
  area_hectares: number;
  ownership_type: string;
  irrigation_source: string;
  survey_khasra_no: string;
  distance_to_mandi_km: number;
  livestock_count: number;
  net_worth: number;
  farmer_classification: string;
  decision_tree_path: DecisionStep[];
  scale_of_finance_limit: number;
  sanctioned_amount: number;
  pd_score: number;
  lgd_score: number;
  dscr_ratio: number;
  expected_revenue: number;
  drought_stress_revenue: number;
  equity_priority_score: number;
  shap_reasons: ShapFactor[];
  tranches: Tranche[];
  grievances: Grievance[];
  weather_profile?: WeatherProfile;
}

export interface BankApplicationRow {
  id: number;
  application_no: string;
  facility_type: string;
  requested_amount: number;
  primary_crop: string;
  status: string;
  bank_assigned: string;
  farmer_id: number;
  full_name: string;
  farmer_uid: string;
  social_category: string;
  district: string;
  area_acres: number;
  irrigation_source: string;
  farmer_classification: string;
  sanctioned_amount: number;
  pd_score: number;
  dscr_ratio: number;
}

export interface OptimizerMetricsBucket {
  total_disbursed: number;
  smf_share_pct: number;
  weaker_share_pct: number;
  portfolio_npa_pct: number;
  govt_guarantee_utilized: number;
  smf_farmers_served: number;
  total_farmers_served: number;
  rbi_smf_quota_met: boolean;
  bank_npa_ceiling_met: boolean;
}

export interface OptimizerResult {
  status: string;
  dss_allocated_ids: number[];
  pure_profit_ids: number[];
  total_applicants: number;
  dss_approved_count: number;
  pure_profit_approved_count: number;
  metrics: {
    equitable_dss: OptimizerMetricsBucket;
    pure_profit: OptimizerMetricsBucket;
    welfare_delta: {
      additional_marginal_farmers_helped: number;
      smf_capital_increase_rupees: number;
      bank_risk_neutralized_by_fldg: number;
    };
  };
}

export interface DistrictHeatmapRow {
  district: string;
  lat: number;
  lon: number;
  agro_climatic_zone: string;
  total_applications: number;
  approved_applications: number;
  allocated_budget: number;
  sanctioned_amount: number;
  smf_sanctioned_amount: number;
  smf_share_pct: number;
  weather_source: string;
  forecast_14d_precip_mm: number;
  avg_max_temp_c: number;
  weather_rainfall_anomaly: number;
  drought_risk_classification: string;
  fldg_coverage_active: boolean;
}

export interface BankComplianceRow {
  bank_name: string;
  total_applications: number;
  approved_count: number;
  total_sanctioned: number;
  smf_sanctioned: number;
  smf_lending_share_pct: number;
  rbi_psl_status: string;
  marginal_rejection_rate_pct: number;
  large_rejection_rate_pct: number;
  rejection_disparity_ratio: number;
}

export interface PolicyConfig {
  id: number;
  smf_minimum_quota: number;
  govt_first_loss_guarantee: number;
  interest_subvention_pct: number;
  miss_base_rate: number;
  collateral_free_threshold: number;
  bank_max_npa_ceiling: number;
  updated_by: string;
  updated_at: string;
}

export interface Merchant {
  merchant_id: string;
  name: string;
  category: string;
  district: string;
}

export interface EligibilityEstimate {
  farmer_classification: string;
  recommended_instrument: string;
  scale_of_finance_limit: number;
  estimated_sanction_amount: number;
  collateral_required: boolean;
  interest_rate_effective: number;
  miss_prompt_rate: number;
  expected_crop_revenue: number;
  dscr_ratio: number;
  decision_steps: DecisionStep[];
}
