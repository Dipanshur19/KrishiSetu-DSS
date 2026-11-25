"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Search,
  CheckCircle2,
  Sliders,
  Play,
  TrendingUp,
  Scale,
  Gauge,
  Activity,
  CloudRain,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import DecisionTreeModal from "./DecisionTreeModal";
import { api } from "@/lib/api";
import { t } from "@/i18n/translations";
import {
  BankApplicationRow,
  DemoUser,
  FarmerApplicationOutcome,
  Grievance,
  Language,
  OptimizerResult,
} from "@/types/dss";

interface BankWorkbenchProps {
  demoUser: DemoUser | null;
  lang: Language;
}

export default function BankWorkbench({ lang }: BankWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<"dossier" | "optimizer" | "grievances">("dossier");

  const [applications, setApplications] = useState<BankApplicationRow[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [selectedAppDetail, setSelectedAppDetail] = useState<FarmerApplicationOutcome | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [districtFilter, setDistrictFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [budgetSlider, setBudgetSlider] = useState(5000000);
  const [npaSlider, setNpaSlider] = useState(4.0);
  const [fldgSlider, setFldgSlider] = useState(35);
  const [smfQuotaSlider, setSmfQuotaSlider] = useState(55.6);
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<OptimizerResult | null>(null);
  const [disbursing, setDisbursing] = useState(false);
  const [disburseSuccess, setDisburseSuccess] = useState("");

  const [bankGrievances, setBankGrievances] = useState<Grievance[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isDecisionTreeOpen, setIsDecisionTreeOpen] = useState(false);

  const fetchApplications = () => {
    setLoadingApps(true);
    api.getBankApplications({
      district: districtFilter,
      category: categoryFilter,
      status: statusFilter,
      search: searchQuery,
    })
      .then((data) => {
        setApplications(data);
        if (data.length > 0 && !selectedAppDetail) {
          loadApplicationDetail(data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingApps(false));
  };

  const loadApplicationDetail = (appId: number) => {
    setLoadingDetail(true);
    api.getApplicationOutcome(appId)
      .then((d) => setSelectedAppDetail(d))
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  };

  const fetchGrievances = () => {
    api.getBankGrievances()
      .then((d) => setBankGrievances(d))
      .catch(console.error);
  };

  useEffect(() => {
    fetchApplications();
    fetchGrievances();
  }, [districtFilter, categoryFilter, statusFilter, searchQuery]);

  const handleRunOptimizer = async () => {
    setOptimizing(true);
    setDisburseSuccess("");
    try {
      const data = await api.runOptimizer({
        total_fund_budget: Number(budgetSlider),
        smf_quota_alpha: Number(smfQuotaSlider) / 100.0,
        bank_max_npa_ceiling: Number(npaSlider) / 100.0,
        govt_fldg_gamma: Number(fldgSlider) / 100.0,
        district_filter: districtFilter !== "All" ? districtFilter : null,
      });
      setOptResult(data);
    } catch (err: unknown) {
      alert("Optimization failed: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setOptimizing(false);
    }
  };

  const handleDisburseBatch = async () => {
    if (!optResult?.dss_allocated_ids?.length) return;
    setDisbursing(true);
    try {
      const data = await api.disburseBatch(
        optResult.dss_allocated_ids,
        `Batch sanctioned under RBI PSL optimization with ${fldgSlider}% Govt FLDG.`
      );
      setDisburseSuccess(data.message);
      fetchApplications();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setDisbursing(false);
    }
  };

  const handleResolveGrievance = async (id: number) => {
    if (!responseText) return;
    try {
      await api.resolveBankGrievance(id, responseText, "resolved");
      setRespondingId(null);
      setResponseText("");
      fetchGrievances();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  };

  // Recharts Dataset 1: Cash Flow & Drought Stress Forecast
  const forecastChartData = selectedAppDetail
    ? [
        {
          scenario: "Normal Harvest",
          amount: Math.round(selectedAppDetail.expected_revenue || 0),
          fill: "#047857",
        },
        {
          scenario: "Drought (-35%)",
          amount: Math.round(selectedAppDetail.drought_stress_revenue || 0),
          fill: "#d97706",
        },
        {
          scenario: "Debt Service (4%)",
          amount: Math.round((selectedAppDetail.sanctioned_amount || 0) * 1.04),
          fill: "#1e3a8a",
        },
      ]
    : [];

  // Recharts Dataset 2: SHAP Risk Contributions
  const shapChartData = (selectedAppDetail?.shap_reasons || []).map((item) => ({
    name: item.name,
    delta: item.delta_pd_pct,
  }));

  // Recharts Dataset 3: Pure Profit vs Equitable DSS Comparison
  const optimizerChartData = optResult
    ? [
        {
          metric: "SMF Share %",
          DSS: optResult.metrics.equitable_dss.smf_share_pct,
          PureProfit: optResult.metrics.pure_profit.smf_share_pct,
        },
        {
          metric: "Weaker Share %",
          DSS: optResult.metrics.equitable_dss.weaker_share_pct,
          PureProfit: optResult.metrics.pure_profit.weaker_share_pct,
        },
        {
          metric: "Net NPA % (x10)",
          DSS: Number((optResult.metrics.equitable_dss.portfolio_npa_pct * 10).toFixed(1)),
          PureProfit: Number((optResult.metrics.pure_profit.portfolio_npa_pct * 10).toFixed(1)),
        },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-blue-700" strokeWidth={1.5} />
            <span>{t(lang, "bank_title")}</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">{t(lang, "bank_sub")}</p>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab("dossier")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeTab === "dossier" ? "bg-white text-blue-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            1. Unified Application Dossier
          </button>
          <button
            onClick={() => setActiveTab("optimizer")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeTab === "optimizer" ? "bg-white text-blue-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            2. Constrained Portfolio Optimizer (MILP)
          </button>
          <button
            onClick={() => setActiveTab("grievances")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeTab === "grievances" ? "bg-white text-blue-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            3. Grievance Queue ({bankGrievances.length})
          </button>
        </div>
      </div>

      {/* TAB 1: UNIFIED DOSSIER & RECHARTS MODEL INSPECTOR */}
      {activeTab === "dossier" && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search farmer, KCC no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-md w-48 text-xs"
                />
              </div>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
              >
                <option value="All">All Districts</option>
                <option value="Kanpur Dehat">Kanpur Dehat</option>
                <option value="Kanpur Nagar">Kanpur Nagar</option>
                <option value="Unnao">Unnao</option>
                <option value="Jhansi">Jhansi</option>
                <option value="Lucknow">Lucknow</option>
                <option value="Barabanki">Barabanki</option>
                <option value="Fatehpur">Fatehpur</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
              >
                <option value="All">All Farmers</option>
                <option value="Marginal">Marginal (&le; 1 ha)</option>
                <option value="Small">Small (1–2 ha)</option>
                <option value="Other">Other (&gt; 2 ha)</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
              >
                <option value="All">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
              </select>
            </div>
            <div className="text-slate-500 font-mono">
              Showing <strong>{applications.length}</strong> Applications
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto max-h-[720px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5">Farmer & UID</th>
                      <th className="px-3 py-2.5">Land & Crop</th>
                      <th className="px-3 py-2.5">Requested</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5 text-center">XGBoost PD</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingApps ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Loading applications...
                        </td>
                      </tr>
                    ) : (
                      applications.map((app) => {
                        const isSelected = selectedAppDetail?.id === app.id;
                        const pdPct = ((app.pd_score || 0.08) * 100).toFixed(1);
                        return (
                          <tr
                            key={app.id}
                            onClick={() => loadApplicationDetail(app.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? "bg-blue-50/80 font-medium" : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-slate-900">{app.full_name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {app.district} • {app.social_category}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div>{app.primary_crop}</div>
                              <div className="text-[10px] text-slate-500">
                                {app.area_acres} ac ({app.irrigation_source})
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono">
                              ₹{Number(app.requested_amount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  app.farmer_classification === "Marginal"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {app.farmer_classification}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-semibold">
                              <span className={parseFloat(pdPct) > 15 ? "text-amber-700" : "text-emerald-700"}>
                                {pdPct}%
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                                  app.status === "approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {app.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Model Inspector Panel with Real Recharts */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              {loadingDetail ? (
                <div className="py-20 text-center text-slate-400">Loading model inspection...</div>
              ) : selectedAppDetail ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold">
                          {selectedAppDetail.application_no}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {selectedAppDetail.facility_type}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedAppDetail.full_name}</h3>
                      <p className="text-xs text-slate-500">
                        {selectedAppDetail.village}, {selectedAppDetail.district} • {selectedAppDetail.social_category}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsDecisionTreeOpen(true)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold text-slate-700 flex items-center space-x-1"
                    >
                      <Scale className="w-3.5 h-3.5 text-blue-700" />
                      <span>Decision Tree</span>
                    </button>
                  </div>

                  {/* Consolidated 3-Bank Signals */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Axis Resilience</span>
                      <strong className="text-slate-800">{selectedAppDetail.irrigation_source}</strong>
                      <span className="text-[10px] text-slate-500 block">
                        {selectedAppDetail.distance_to_mandi_km}km Mandi
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">SBI Allied Cash</span>
                      <strong className="text-slate-800">{selectedAppDetail.livestock_count} Dairy</strong>
                      <span className="text-[10px] text-emerald-700 block">+₹35k/head norm</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">BOI Net Worth</span>
                      <strong className="text-slate-800 font-mono">
                        ₹{Number(selectedAppDetail.net_worth || 0).toLocaleString("en-IN")}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">K+L-M Formula</span>
                    </div>
                  </div>

                  {/* Recharts Chart 1: Crop Revenue vs Drought Stress */}
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-700" />
                        <span>Revenue & Open-Meteo Stress Test</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-700 flex items-center space-x-1">
                        <Gauge className="w-3.5 h-3.5" />
                        <span>DSCR: {selectedAppDetail.dscr_ratio}x</span>
                      </span>
                    </div>

                    {selectedAppDetail.weather_profile && (
                      <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                        <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                        <span>
                          Live Open-Meteo 14d Precip:{" "}
                          <strong>{selectedAppDetail.weather_profile.forecast_14d_precip_mm} mm</strong> (Anomaly:{" "}
                          {selectedAppDetail.weather_profile.rainfall_anomaly_pct}%)
                        </span>
                      </div>
                    )}

                    <div className="h-44 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={forecastChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="scenario" tick={{ fontSize: 10, fill: "#475569" }} />
                          <YAxis
                            tick={{ fontSize: 10, fill: "#475569" }}
                            tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                            width={42}
                          />
                          <Tooltip
                            formatter={(val) => [`₹${Number(val).toLocaleString("en-IN")}`, "Amount"]}
                            contentStyle={{ fontSize: "11px", borderRadius: "8px" }}
                          />
                          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                            {forecastChartData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recharts Chart 2: Real SHAP TreeExplainer Attribution Chart */}
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-700" />
                        <span>XGBoost + SHAP Risk Breakdown</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-800">
                        PD: {(selectedAppDetail.pd_score * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={shapChartData}
                          layout="vertical"
                          margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fontSize: 10, fill: "#475569" }} unit="%" />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#334155" }} width={120} />
                          <ReferenceLine x={0} stroke="#64748b" />
                          <Tooltip
                            formatter={(val) => [`${Number(val) > 0 ? "+" : ""}${val}% PD Impact`, "SHAP"]}
                            contentStyle={{ fontSize: "11px", borderRadius: "8px" }}
                          />
                          <Bar dataKey="delta" radius={[3, 3, 3, 3]}>
                            {shapChartData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.delta < 0 ? "#047857" : "#d97706"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500">Scale of Finance Sanction</span>
                      <div className="text-lg font-bold text-emerald-800 font-mono">
                        ₹{Number(selectedAppDetail.sanctioned_amount || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                    {selectedAppDetail.status !== "approved" && (
                      <button
                        onClick={() => {
                          api.disburseBatch([selectedAppDetail.id]).then(() => {
                            fetchApplications();
                            loadApplicationDetail(selectedAppDetail.id);
                          });
                        }}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold"
                      >
                        Approve & Disburse Tranches
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONSTRAINED PORTFOLIO OPTIMIZER (SCIPY MILP) */}
      {activeTab === "optimizer" && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-3 text-xs text-blue-900">
            <Scale className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <strong className="text-sm">Constrained MILP Optimizer: Resolving the Govt vs. Bank Conflict</strong>
              <p>
                Solves Mixed-Integer Linear Programming via <code>scipy.optimize.milp</code> with Government First-Loss Default Guarantee (FLDG) to satisfy RBI PSL quotas while staying strictly under the Bank NPA ceiling.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-blue-700" />
                <span>What-If Sensitivity Parameters</span>
              </span>
              <button
                onClick={handleRunOptimizer}
                disabled={optimizing}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{optimizing ? "Solving MILP..." : "Run MILP Optimization"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Agri Credit Pool (X)</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{(budgetSlider / 100000).toFixed(1)} Lakh
                  </span>
                </div>
                <input
                  type="range"
                  min="1000000"
                  max="10000000"
                  step="500000"
                  value={budgetSlider}
                  onChange={(e) => setBudgetSlider(parseFloat(e.target.value))}
                  className="w-full accent-blue-700 cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Bank NPA Risk Ceiling</span>
                  <span className="font-mono font-bold text-slate-900">{npaSlider}%</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="6.0"
                  step="0.25"
                  value={npaSlider}
                  onChange={(e) => setNpaSlider(parseFloat(e.target.value))}
                  className="w-full accent-blue-700 cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Govt FLDG Guarantee (&gamma;)</span>
                  <span className="font-mono font-bold text-emerald-700">{fldgSlider}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={fldgSlider}
                  onChange={(e) => setFldgSlider(parseFloat(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">RBI SMF Quota (&alpha;)</span>
                  <span className="font-mono font-bold text-slate-900">{smfQuotaSlider}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="75"
                  step="2"
                  value={smfQuotaSlider}
                  onChange={(e) => setSmfQuotaSlider(parseFloat(e.target.value))}
                  className="w-full accent-blue-700 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {optResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recharts Comparison Chart */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800">
                    Equitable DSS vs Pure Profit (Recharts)
                  </h4>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={optimizerChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "#475569" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
                        <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
                        <Bar dataKey="DSS" name="Equitable DSS" fill="#047857" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="PureProfit" name="Pure Profit" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Equitable DSS Card */}
                <div className="bg-white rounded-xl border-2 border-emerald-500 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-emerald-800">Equitable DSS Allocation</span>
                    <span className="text-sm font-bold text-emerald-700 font-mono">
                      ₹{Number(optResult.metrics.equitable_dss.total_disbursed).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">SMF Share</span>
                      <div className="text-lg font-bold text-emerald-700 font-mono">
                        {optResult.metrics.equitable_dss.smf_share_pct}%
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Net NPA</span>
                      <div className="text-lg font-bold text-slate-900 font-mono">
                        {optResult.metrics.equitable_dss.portfolio_npa_pct}%
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">SMF Farmers</span>
                      <div className="text-lg font-bold text-slate-900 font-mono">
                        {optResult.metrics.equitable_dss.smf_farmers_served}
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">FLDG Cushion</span>
                      <div className="text-sm font-bold text-blue-700 font-mono">
                        ₹{Number(optResult.metrics.equitable_dss.govt_guarantee_utilized).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pure Profit Card */}
                <div className="bg-white rounded-xl border border-slate-300 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-700">Pure Profit (Unconstrained)</span>
                    <span className="text-sm font-bold text-slate-700 font-mono">
                      ₹{Number(optResult.metrics.pure_profit.total_disbursed).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">SMF Share</span>
                      <div className="text-lg font-bold text-amber-700 font-mono">
                        {optResult.metrics.pure_profit.smf_share_pct}%
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Portfolio NPA</span>
                      <div className="text-lg font-bold text-slate-800 font-mono">
                        {optResult.metrics.pure_profit.portfolio_npa_pct}%
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">SMF Farmers</span>
                      <div className="text-lg font-bold text-slate-800 font-mono">
                        {optResult.metrics.pure_profit.smf_farmers_served}
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Welfare Delta</span>
                      <div className="text-lg font-bold text-emerald-700 font-mono">
                        +{optResult.metrics.welfare_delta.additional_marginal_farmers_helped} SMF
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-emerald-900">
                    Ready to Disburse Optimized Batch ({optResult.dss_approved_count} Farmers)
                  </div>
                  <p className="text-xs text-emerald-800">
                    Generates 3 purpose-locked tranches (60% e-RUPI, 30% UPI ops, 10% sowing rebate) for all approved applicants.
                  </p>
                </div>
                <button
                  onClick={handleDisburseBatch}
                  disabled={disbursing}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shrink-0"
                >
                  {disbursing ? "Disbursing..." : "Disburse Batch with 1-Click Audit Log"}
                </button>
              </div>

              {disburseSuccess && (
                <div className="p-3 bg-white border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{disburseSuccess}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GRIEVANCE QUEUE */}
      {activeTab === "grievances" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Farmer Appeals & Grievance SLA Queue</h3>
              <p className="text-xs text-slate-500">7-day statutory SLA countdown</p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700">{bankGrievances.length} Active</span>
          </div>

          <div className="space-y-4">
            {bankGrievances.map((g) => (
              <div key={g.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900">{g.full_name}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      ({g.district} • App: {g.application_no || "N/A"})
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                      g.resolution_status === "resolved"
                        ? "bg-emerald-100 text-emerald-800"
                        : g.resolution_status === "escalated"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {g.resolution_status}
                  </span>
                </div>
                <div className="text-xs text-slate-800 font-semibold">Category: {g.category}</div>
                <p className="text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200">{g.grievance_text}</p>
                {g.bank_response ? (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                    <strong>Logged Response:</strong> {g.bank_response}
                  </div>
                ) : respondingId === g.id ? (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <textarea
                      rows={2}
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Mandatory written justification..."
                      className="w-full text-xs p-2 border border-slate-300 rounded-md"
                    />
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => setRespondingId(null)} className="px-3 py-1 bg-slate-200 rounded text-xs">
                        Cancel
                      </button>
                      <button
                        onClick={() => handleResolveGrievance(g.id)}
                        className="px-3 py-1 bg-blue-700 text-white rounded text-xs font-semibold"
                      >
                        Submit Justification
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRespondingId(g.id);
                      setResponseText("");
                    }}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium"
                  >
                    Respond & Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DecisionTreeModal
        isOpen={isDecisionTreeOpen}
        onClose={() => setIsDecisionTreeOpen(false)}
        outcome={selectedAppDetail}
      />
    </div>
  );
}
