"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, Play, ArrowUpRight, CheckCircle2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import ClimateGaugeCard from "./ClimateGaugeCard";
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

  const [districtFilter, setDistrictFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [budgetSlider, setBudgetSlider] = useState(5000000);
  const [npaSlider, setNpaSlider] = useState(4.0);
  const [fldgSlider, setFldgSlider] = useState(35);
  const [smfQuotaSlider, setSmfQuotaSlider] = useState(55.6);
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<OptimizerResult | null>(null);
  const [disbursing, setDisbursing] = useState(false);
  const [approvingSingle, setApprovingSingle] = useState(false);
  const [disburseSuccess, setDisburseSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  const [bankGrievances, setBankGrievances] = useState<Grievance[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [resolvingGrievance, setResolvingGrievance] = useState(false);
  const [isDecisionTreeOpen, setIsDecisionTreeOpen] = useState(false);

  const selectedIdRef = useRef<number | null>(null);
  selectedIdRef.current = selectedAppDetail?.id ?? null;

  const loadApplicationDetail = useCallback((appId: number) => {
    api.getApplicationOutcome(appId).then(setSelectedAppDetail).catch(console.error);
  }, []);

  const fetchApplications = useCallback(() => {
    setLoadingApps(true);
    api.getBankApplications({
      district: districtFilter,
      category: categoryFilter,
      search: searchQuery,
    })
      .then((data) => {
        setApplications(data);
        if (data.length === 0) {
          setSelectedAppDetail(null);
        } else if (!selectedIdRef.current || !data.some((a) => a.id === selectedIdRef.current)) {
          loadApplicationDetail(data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingApps(false));
  }, [districtFilter, categoryFilter, searchQuery, loadApplicationDetail]);

  const fetchGrievances = useCallback(() => {
    api.getBankGrievances().then(setBankGrievances).catch(console.error);
  }, []);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchApplications();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchApplications]);

  const handleRunOptimizer = async () => {
    setOptimizing(true);
    setDisburseSuccess("");
    setActionError("");
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
      setActionError(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setOptimizing(false);
    }
  };

  const handleDisburseBatch = async () => {
    if (!optResult?.dss_allocated_ids?.length) return;
    setDisbursing(true);
    setActionError("");
    try {
      const data = await api.disburseBatch(optResult.dss_allocated_ids);
      setDisburseSuccess(data.message);
      fetchApplications();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Batch disbursement failed");
    } finally {
      setDisbursing(false);
    }
  };

  const handleApproveSingle = async (appId: number) => {
    setApprovingSingle(true);
    setActionError("");
    try {
      await api.disburseBatch([appId]);
      fetchApplications();
      loadApplicationDetail(appId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApprovingSingle(false);
    }
  };

  const handleResolveGrievance = async (id: number) => {
    if (!responseText.trim()) return;
    setResolvingGrievance(true);
    setActionError("");
    try {
      await api.resolveBankGrievance(id, responseText, "resolved");
      setRespondingId(null);
      setResponseText("");
      fetchGrievances();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to submit resolution");
    } finally {
      setResolvingGrievance(false);
    }
  };

  // Smooth Cash-Flow AreaChart for Bank Inspector
  const cashflowCurveData = selectedAppDetail
    ? [
        { phase: "Q1", harvest: Math.round(selectedAppDetail.expected_revenue * 0.15), stress: Math.round(selectedAppDetail.drought_stress_revenue * 0.1) },
        { phase: "Q2", harvest: Math.round(selectedAppDetail.expected_revenue * 0.42), stress: Math.round(selectedAppDetail.drought_stress_revenue * 0.35) },
        { phase: "Q3", harvest: Math.round(selectedAppDetail.expected_revenue * 0.78), stress: Math.round(selectedAppDetail.drought_stress_revenue * 0.65) },
        { phase: "Harvest", harvest: Math.round(selectedAppDetail.expected_revenue), stress: Math.round(selectedAppDetail.drought_stress_revenue) },
      ]
    : [];

  const shapChartData = (selectedAppDetail?.shap_reasons || []).map((item) => ({
    name: item.name,
    delta: item.delta_pd_pct,
  }));

  const optimizerChartData = optResult
    ? [
        { metric: "SMF %", DSS: optResult.metrics.equitable_dss.smf_share_pct, PureProfit: optResult.metrics.pure_profit.smf_share_pct },
        { metric: "Weaker %", DSS: optResult.metrics.equitable_dss.weaker_share_pct, PureProfit: optResult.metrics.pure_profit.weaker_share_pct },
        { metric: "NPA (x10)", DSS: Number((optResult.metrics.equitable_dss.portfolio_npa_pct * 10).toFixed(1)), PureProfit: Number((optResult.metrics.pure_profit.portfolio_npa_pct * 10).toFixed(1)) },
      ]
    : [];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#8a877d]">{t(lang, "bank_eyebrow")}</p>
          <h1 className="text-3xl font-medium tracking-tight text-[#141513] mt-0.5">
            {t(lang, "bank_title")}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "dossier", label: "Dossier" },
            { key: "optimizer", label: "Portfolio Optimizer" },
            { key: "grievances", label: `Appeals (${bankGrievances.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "dossier" | "optimizer" | "grievances")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-[#141513] text-white"
                  : "bg-white border border-black/[0.08] text-[#5e5c55] hover:text-[#141513]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: DOSSIER & BENTO INSPECTOR */}
      {activeTab === "dossier" && (
        <div className="space-y-5">
          {/* Quiet Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-2 bg-white border border-black/[0.08] rounded-full px-3.5 py-1.5">
                <Search className="w-3.5 h-3.5 text-[#8a877d]" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs bg-transparent focus:outline-none w-36 text-[#141513]"
                />
              </div>

              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="px-3.5 py-1.5 bg-white border border-black/[0.08] rounded-full text-xs text-[#141513]"
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
                className="px-3.5 py-1.5 bg-white border border-black/[0.08] rounded-full text-xs text-[#141513]"
              >
                <option value="All">All Farmers</option>
                <option value="Marginal">Marginal</option>
                <option value="Small">Small</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <span className="text-xs font-mono text-[#8a877d]">{applications.length} applications</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Applicant Ledger (6 cols) */}
            <div className="lg:col-span-6 bento-card overflow-hidden">
              <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fafaf6] border-b border-black/[0.06] text-[#8a877d] font-medium sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 font-medium">Applicant</th>
                      <th className="px-3 py-3 font-medium">Crop</th>
                      <th className="px-3 py-3 font-medium text-right">Amount</th>
                      <th className="px-3 py-3 font-medium text-right">PD</th>
                      <th className="px-4 py-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {loadingApps ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-[#8a877d]">Loading...</td>
                      </tr>
                    ) : applications.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-[#8a877d]">No matching applications</td>
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
                              isSelected ? "bg-[#f3f6ea]" : "hover:bg-[#fafaf6]"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-[#141513]">{app.full_name}</div>
                              <div className="text-[11px] text-[#8a877d]">
                                {app.district} · {app.farmer_classification}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-[#5e5c55]">
                              {app.primary_crop} · {app.area_acres} ac
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-[#141513]">
                              ₹{Number(app.requested_amount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-[#5e5c55]">{pdPct}%</td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] capitalize ${
                                  app.status === "approved"
                                    ? "bg-[#eef7d6] text-[#365314]"
                                    : "bg-[#f5f5ee] text-[#5e5c55]"
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

            {/* Right Model Inspector Bento Stack (6 cols) */}
            <div className="lg:col-span-6 space-y-5 min-w-0">
              {actionError && (
                <div className="bento-card p-3.5 bg-red-50 text-xs text-red-700">{actionError}</div>
              )}
              {selectedAppDetail && (
                <>
                  {/* Card 1: Cash-Flow AreaChart */}
                  <div className="bento-card p-5 space-y-4 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-[#8a877d]">
                          {selectedAppDetail.application_no} · {selectedAppDetail.district}
                        </div>
                        <h3 className="text-lg font-medium text-[#141513] mt-0.5">
                          {selectedAppDetail.full_name}
                        </h3>
                      </div>

                      <div className="flex items-center space-x-2">
                        {selectedAppDetail.status !== "approved" && (
                          <button
                            disabled={approvingSingle}
                            onClick={() => handleApproveSingle(selectedAppDetail.id)}
                            className="px-3.5 py-1.5 rounded-full bg-[#141513] text-[#d4f04c] text-xs font-medium hover:bg-black/85 disabled:opacity-60"
                          >
                            {approvingSingle
                              ? "Approving..."
                              : `Approve ₹${Number(selectedAppDetail.sanctioned_amount).toLocaleString("en-IN")}`}
                          </button>
                        )}
                        <button
                          onClick={() => setIsDecisionTreeOpen(true)}
                          className="w-8 h-8 rounded-full border border-black/[0.08] flex items-center justify-center text-[#5e5c55] hover:text-[#141513]"
                          title="Inspect Decision Tree"
                        >
                          <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>

                    <div className="h-44 w-full min-w-0">
                      <ResponsiveContainer width="100%" height={176} minWidth={0}>
                        <AreaChart data={cashflowCurveData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="bankHarvestGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#b8e354" stopOpacity={0.55} />
                              <stop offset="95%" stopColor="#b8e354" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="bankStressGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#9cc0d1" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#9cc0d1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,21,19,0.06)" vertical={false} />
                          <XAxis dataKey="phase" tick={{ fontSize: 11, fill: "#8a877d" }} axisLine={false} tickLine={false} />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#8a877d" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                            width={42}
                          />
                          <Tooltip
                            formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, ""]}
                            contentStyle={{ fontSize: "12px", borderRadius: "12px" }}
                          />
                          <Area type="monotone" dataKey="harvest" name="Expected Revenue" stroke="#84cc16" strokeWidth={2} fill="url(#bankHarvestGrad)" />
                          <Area type="monotone" dataKey="stress" name="Drought Stress" stroke="#7aa2b8" strokeWidth={2} fill="url(#bankStressGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Card 2: Split Gauge + SHAP Attribution */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <ClimateGaugeCard
                      title="DSCR & Climate"
                      subtitle={selectedAppDetail.irrigation_source}
                      primaryValue={`${selectedAppDetail.dscr_ratio}x`}
                      progressRatio={Math.min(1, selectedAppDetail.dscr_ratio / 2.5)}
                      metric1Label="Sanction"
                      metric1Val={`₹${Math.round(selectedAppDetail.sanctioned_amount / 1000)}k`}
                      metric2Label="Net Worth"
                      metric2Val={`₹${Math.round(selectedAppDetail.net_worth / 1000)}k`}
                      metric3Label="14d Rain"
                      metric3Val={`${selectedAppDetail.weather_profile?.forecast_14d_precip_mm ?? 0} mm`}
                    />

                    <div className="bento-card p-5 space-y-2 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[15px] font-medium text-[#141513]">SHAP Risk Drivers</h3>
                        <span className="text-xs font-mono text-[#5e5c55]">
                          {(selectedAppDetail.pd_score * 100).toFixed(1)}% PD
                        </span>
                      </div>
                      <div className="h-44 w-full min-w-0">
                        <ResponsiveContainer width="100%" height={176} minWidth={0}>
                          <BarChart data={shapChartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                            <XAxis type="number" tick={{ fontSize: 10, fill: "#8a877d" }} unit="%" axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#5e5c55" }} width={118} axisLine={false} tickLine={false} />
                            <ReferenceLine x={0} stroke="rgba(20,21,19,0.2)" />
                            <Tooltip
                              formatter={(val) => [`${Number(val) > 0 ? "+" : ""}${val}%`, "SHAP"]}
                              contentStyle={{ fontSize: "11px", borderRadius: "10px" }}
                            />
                            <Bar dataKey="delta" radius={[4, 4, 4, 4]}>
                              {shapChartData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.delta < 0 ? "#84cc16" : "#d97706"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PORTFOLIO OPTIMIZER */}
      {activeTab === "optimizer" && (
        <div className="space-y-5">
          <div className="bento-card p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[15px] font-medium text-[#141513]">Allocation Parameters (MILP)</h3>
              <button
                onClick={handleRunOptimizer}
                disabled={optimizing}
                className="flex items-center space-x-1.5 px-5 py-2 bg-[#141513] hover:bg-black/85 text-white rounded-full text-xs font-medium"
              >
                <Play className="w-3.5 h-3.5 text-[#d4f04c] fill-current" />
                <span>{optimizing ? "Optimizing..." : "Run Optimizer"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#5e5c55]">Credit Pool</span>
                  <span className="font-mono font-medium text-[#141513]">₹{(budgetSlider / 100000).toFixed(1)}L</span>
                </div>
                <input
                  type="range"
                  min="1000000"
                  max="10000000"
                  step="500000"
                  value={budgetSlider}
                  onChange={(e) => setBudgetSlider(parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#5e5c55]">Max NPA Cap</span>
                  <span className="font-mono font-medium text-[#141513]">{npaSlider}%</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="6.0"
                  step="0.25"
                  value={npaSlider}
                  onChange={(e) => setNpaSlider(parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#5e5c55]">Govt Guarantee (FLDG)</span>
                  <span className="font-mono font-medium text-[#4d7c0f]">{fldgSlider}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={fldgSlider}
                  onChange={(e) => setFldgSlider(parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#5e5c55]">RBI SMF Quota</span>
                  <span className="font-mono font-medium text-[#141513]">{smfQuotaSlider}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="75"
                  step="2"
                  value={smfQuotaSlider}
                  onChange={(e) => setSmfQuotaSlider(parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          {optResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bento-card p-5 space-y-3 min-w-0">
                  <h4 className="text-sm font-medium text-[#141513]">DSS vs Pure Profit</h4>
                  <div className="h-52 w-full min-w-0">
                    <ResponsiveContainer width="100%" height={208} minWidth={0}>
                      <BarChart data={optimizerChartData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,21,19,0.06)" vertical={false} />
                        <XAxis dataKey="metric" tick={{ fontSize: 11, fill: "#8a877d" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#8a877d" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />
                        <Bar dataKey="DSS" name="Equitable DSS" fill="#84cc16" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="PureProfit" name="Pure Profit" fill="#d1d5db" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bento-card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                    <span className="text-sm font-medium text-[#141513]">Equitable DSS</span>
                    <span className="text-sm font-mono font-medium text-[#4d7c0f]">
                      ₹{Number(optResult.metrics.equitable_dss.total_disbursed).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bento-surface-soft p-3">
                      <span className="text-[#8a877d]">SMF Share</span>
                      <div className="text-xl font-medium text-[#4d7c0f] font-mono mt-0.5">
                        {optResult.metrics.equitable_dss.smf_share_pct}%
                      </div>
                    </div>
                    <div className="bento-surface-soft p-3">
                      <span className="text-[#8a877d]">Net NPA</span>
                      <div className="text-xl font-medium text-[#141513] font-mono mt-0.5">
                        {optResult.metrics.equitable_dss.portfolio_npa_pct}%
                      </div>
                    </div>
                    <div className="bento-surface-soft p-3">
                      <span className="text-[#8a877d]">SMF Served</span>
                      <div className="text-lg font-medium text-[#141513] font-mono mt-0.5">
                        {optResult.metrics.equitable_dss.smf_farmers_served}
                      </div>
                    </div>
                    <div className="bento-surface-soft p-3">
                      <span className="text-[#8a877d]">FLDG Used</span>
                      <div className="text-sm font-medium text-[#141513] font-mono mt-1">
                        ₹{Number(optResult.metrics.equitable_dss.govt_guarantee_utilized).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bento-card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                    <span className="text-sm font-medium text-[#5e5c55]">Pure Profit</span>
                    <span className="text-sm font-mono text-[#5e5c55]">
                      ₹{Number(optResult.metrics.pure_profit.total_disbursed).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bento-surface-soft p-3">
                      <span className="text-[#8a877d]">SMF Share</span>
                      <div className="text-xl font-medium text-[#d97706] font-mono mt-0.5">
                        {optResult.metrics.pure_profit.smf_share_pct}%
                      </div>
                    </div>
                    <div className="bento-surface-soft p-3">
                      <span className="text-[#8a877d]">Portfolio NPA</span>
                      <div className="text-xl font-medium text-[#5e5c55] font-mono mt-0.5">
                        {optResult.metrics.pure_profit.portfolio_npa_pct}%
                      </div>
                    </div>
                    <div className="bento-surface-soft p-3">
                      <span className="text-[#8a877d]">SMF Served</span>
                      <div className="text-lg font-medium text-[#5e5c55] font-mono mt-0.5">
                        {optResult.metrics.pure_profit.smf_farmers_served}
                      </div>
                    </div>
                    <div className="bento-surface-soft p-3">
                      <span className="text-[#8a877d]">Additional SMF</span>
                      <div className="text-lg font-medium text-[#4d7c0f] font-mono mt-0.5">
                        +{optResult.metrics.welfare_delta.additional_marginal_farmers_helped}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bento-card p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-[#5e5c55]">
                  Approve batch of <strong className="text-[#141513]">{optResult.dss_approved_count}</strong> applicants and issue purpose-locked tranches
                </div>
                <button
                  onClick={handleDisburseBatch}
                  disabled={disbursing}
                  className="px-5 py-2.5 bg-[#141513] text-[#d4f04c] rounded-full text-xs font-medium hover:bg-black/85"
                >
                  {disbursing ? "Disbursing..." : "Approve & Disburse Batch"}
                </button>
              </div>

              {actionError && (
                <div className="bento-card p-4 text-xs text-red-700 bg-red-50">{actionError}</div>
              )}
              {disburseSuccess && (
                <div className="bento-card p-4 text-xs text-[#365314] bg-[#eef7d6] flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{disburseSuccess}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: APPEALS QUEUE */}
      {activeTab === "grievances" && (
        <div className="bento-card p-6 space-y-4">
          <h3 className="text-[15px] font-medium text-[#141513]">Open Appeals</h3>
          {actionError && (
            <div className="p-3 bg-red-50 rounded-xl text-xs text-red-700">{actionError}</div>
          )}
          <div className="space-y-3">
            {bankGrievances.map((g) => (
              <div key={g.id} className="bento-surface-soft p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-[#141513]">{g.full_name}</span>
                    <span className="text-[#8a877d] ml-2">
                      {g.district} · {g.category}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] capitalize bg-white border border-black/[0.08] text-[#5e5c55]">
                    {g.resolution_status}
                  </span>
                </div>
                <p className="text-xs text-[#5e5c55]">{g.grievance_text}</p>
                {g.bank_response ? (
                  <div className="text-xs text-[#365314] bg-[#eef7d6] p-2.5 rounded-lg">
                    Response: {g.bank_response}
                  </div>
                ) : respondingId === g.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Written justification"
                      className="w-full text-xs p-2.5 bg-white border border-black/10 rounded-xl"
                    />
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => setRespondingId(null)} className="px-3 py-1 text-xs text-[#5e5c55]">
                        Cancel
                      </button>
                      <button
                        disabled={resolvingGrievance}
                        onClick={() => handleResolveGrievance(g.id)}
                        className="px-4 py-1 bg-[#141513] text-white rounded-full text-xs font-medium disabled:opacity-60"
                      >
                        {resolvingGrievance ? "Saving..." : "Resolve"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRespondingId(g.id);
                      setResponseText("");
                    }}
                    className="px-3.5 py-1.5 bg-[#141513] text-white rounded-full text-xs font-medium"
                  >
                    Respond
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
