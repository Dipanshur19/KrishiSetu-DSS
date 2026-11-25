/**
 * KrishiSetu DSS - Frontend API Client
 * Connects to FastAPI backend
 */

const BASE_URL = '/api';

export const api = {
  // System & Demo
  getDemoAccounts: () => fetch(`${BASE_URL}/system/demo-accounts`).then(r => r.json()),
  getScaleOfFinance: () => fetch(`${BASE_URL}/system/scale-of-finance`).then(r => r.json()),
  resetDatabase: () => fetch(`${BASE_URL}/system/reset`, { method: 'POST' }).then(r => r.json()),

  // Farmer Portal
  estimateEligibility: (data) => fetch(`${BASE_URL}/farmer/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  submitApplication: (data) => fetch(`${BASE_URL}/farmer/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  getApplicationOutcome: (appId) => fetch(`${BASE_URL}/farmer/applications/${appId}`).then(r => r.json()),

  redeemVoucher: (voucherCode, merchantId) => fetch(`${BASE_URL}/farmer/vouchers/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voucher_code: voucherCode, merchant_id: merchantId })
  }).then(r => r.json()),

  verifySowing: (trancheId, data) => fetch(`${BASE_URL}/farmer/tranches/verify-sowing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tranche_id: trancheId, ...data })
  }).then(r => r.json()),

  fileGrievance: (data) => fetch(`${BASE_URL}/farmer/grievances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  getFarmerGrievances: (farmerId) => fetch(`${BASE_URL}/farmer/grievances/by-farmer/${farmerId}`).then(r => r.json()),

  // Bank Officer Workbench
  getBankApplications: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.district) params.append('district', filters.district);
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    return fetch(`${BASE_URL}/bank/applications?${params.toString()}`).then(r => r.json());
  },

  runOptimizer: (data) => fetch(`${BASE_URL}/bank/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  disburseBatch: (appIds, notes) => fetch(`${BASE_URL}/bank/disburse-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ application_ids: appIds, notes })
  }).then(r => r.json()),

  getBankGrievances: () => fetch(`${BASE_URL}/bank/grievances`).then(r => r.json()),

  resolveBankGrievance: (id, responseText, status = 'resolved') => fetch(`${BASE_URL}/bank/grievances/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bank_response: responseText, resolution_status: status })
  }).then(r => r.json()),

  // Government Console
  getGovtMacroKpi: () => fetch(`${BASE_URL}/govt/macro-kpi`).then(r => r.json()),
  getDistrictHeatmap: () => fetch(`${BASE_URL}/govt/district-heatmap`).then(r => r.json()),
  getBankCompliance: () => fetch(`${BASE_URL}/govt/bank-compliance`).then(r => r.json()),
  getPolicyConfig: () => fetch(`${BASE_URL}/govt/policy-config`).then(r => r.json()),

  updatePolicyConfig: (data) => fetch(`${BASE_URL}/govt/policy-config/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  getEscalatedTribunal: () => fetch(`${BASE_URL}/govt/escalated-tribunal`).then(r => r.json()),

  issueTribunalDirective: (id, directive) => fetch(`${BASE_URL}/govt/escalated-tribunal/${id}/directive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directive })
  }).then(r => r.json())
};
