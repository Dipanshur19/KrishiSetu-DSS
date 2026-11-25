"use client";

import React, { useState, useEffect } from "react";
import {
  Landmark,
  CheckCircle2,
  Sliders,
  MapPin,
  Gavel,
  Building2,
  CloudRain,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";
import DistrictLeafletMap from "./DistrictLeafletMap";
import { api } from "@/lib/api";
import { t } from "@/i18n/translations";
import {
  BankComplianceRow,
  DemoUser,
  DistrictHeatmapRow,
  Grievance,
  Language,
} from "@/types/dss";

interface GovtConsoleProps {
  demoUser: DemoUser | null;
  lang: Language;
}

export default function GovtConsole({ lang }: GovtConsoleProps) {
  const [activeTab, setActiveTab] = useState<"macro" | "compliance" | "policy" | "tribunal">("macro");

  const [macroKpi, setMacroKpi] = useState<{
    ground_level_credit_target: string;
    total_applications: number;
    approved_applications: number;
    total_sanctioned_amount: number;
    smf_share_pct: number;
    rbi_smf_mandate_benchmark_pct: number;
    voucher_utilization_pct: number;
    escalated_grievances: number;
  } | null>(null);
  const [districtData, setDistrictData] = useState<DistrictHeatmapRow[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [bankCompliance, setBankCompliance] = useState<BankComplianceRow[]>([]);
  const [tribunalCases, setTribunalCases] = useState<Grievance[]>([]);

  const [smfQuota, setSmfQuota] = useState(55.6);
  const [fldgRate, setFldgRate] = useState(35);
  const [subventionRate, setSubventionRate] = useState(3.0);
  const [collateralLimit, setCollateralLimit] = useState(200000);
  const [npaCeiling, setNpaCeiling] = useState(4.5);
  const [updatingPolicy, setUpdatingPolicy] = useState(false);
  const [policySuccess, setPolicySuccess] = useState("");

  const [activeDirectiveCase, setActiveDirectiveCase] = useState<number | null>(null);
  const [directiveText, setDirectiveText] = useState("");
  const [issuingDirective, setIssuingDirective] = useState(false);

  const fetchAllData = () => {
    Promise.all([
      api.getGovtMacroKpi(),
      api.getDistrictHeatmap(),
      api.getBankCompliance(),
      api.getPolicyConfig(),
      api.getEscalatedTribunal(),
    ])
      .then(([kpi, districts, compliance, policy, tribunal]) => {
        setMacroKpi(kpi);
        setDistrictData(districts);
        setBankCompliance(compliance);
        setTribunalCases(tribunal);

        if (policy) {
          setSmfQuota(Number((policy.smf_minimum_quota * 100).toFixed(1)));
          setFldgRate(Math.round(policy.govt_first_loss_guarantee * 100));
          setSubventionRate(policy.interest_subvention_pct);
          setCollateralLimit(policy.collateral_free_threshold);
          setNpaCeiling(Number((policy.bank_max_npa_ceiling * 100).toFixed(2)));
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handlePublishPolicy = async () => {
    setUpdatingPolicy(true);
    setPolicySuccess("");
    try {
      const data = await api.updatePolicyConfig({
        smf_minimum_quota: Number(smfQuota) / 100.0,
        govt_first_loss_guarantee: Number(fldgRate) / 100.0,
        interest_subvention_pct: Number(subventionRate),
        collateral_free_threshold: Number(collateralLimit),
        bank_max_npa_ceiling: Number(npaCeiling) / 100.0,
        updated_by: "Ministry of Agriculture & RBI Joint Directorate",
      });
      setPolicySuccess(data.message);
      fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setUpdatingPolicy(false);
    }
  };

  const handleIssueDirective = async (caseId: number) => {
    if (!directiveText) return;
    setIssuingDirective(true);
    try {
      await api.issueTribunalDirective(caseId, directiveText);
      setActiveDirectiveCase(null);
      setDirectiveText("");
      fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setIssuingDirective(false);
    }
  };

  const bankChartData = bankCompliance.map((b) => ({
    name: b.bank_name.replace("State Bank of India", "SBI").replace("Punjab National Bank", "PNB").replace("Bank of Baroda", "BOB").replace("Bank of India", "BOI"),
    smfShare: b.smf_lending_share_pct,
    disparity: b.rejection_disparity_ratio,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Landmark className="w-6 h-6 text-amber-700" strokeWidth={1.5} />
            <span>{t(lang, "govt_title")}</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">{t(lang, "govt_sub")}</p>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab("macro")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeTab === "macro" ? "bg-white text-amber-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            1. Geospatial Map & Macro Monitor
          </button>
          <button
            onClick={() => setActiveTab("compliance")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeTab === "compliance" ? "bg-white text-amber-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            2. Bank PSL Compliance Audit
          </button>
          <button
            onClick={() => setActiveTab("policy")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeTab === "policy" ? "bg-white text-amber-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            3. Policy Levers (Monitor & Correct)
          </button>
          <button
            onClick={() => setActiveTab("tribunal")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeTab === "tribunal" ? "bg-white text-amber-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            4. Escalated Tribunal ({tribunalCases.length})
          </button>
        </div>
      </div>

      {/* TAB 1: MACRO KPI + REAL LEAFLET MAP + OPEN-METEO DISTRICT TABLE */}
      {activeTab === "macro" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500">Ground Level Credit Target</span>
              <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                {macroKpi?.ground_level_credit_target || "₹32.50 Lakh Cr"}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">FY 2025–26 National Target</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500">Small & Marginal (SMF) Share</span>
              <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
                {macroKpi?.smf_share_pct || 0}%
              </div>
              <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
                Benchmark &ge; {macroKpi?.rbi_smf_mandate_benchmark_pct || 55.6}% (RBI PSL)
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500">Total Credit Sanctioned</span>
              <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                ₹{((macroKpi?.total_sanctioned_amount || 0) / 100000).toFixed(2)} Lakh
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {macroKpi?.approved_applications || 0} / {macroKpi?.total_applications || 0} Applications
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500">e-RUPI Voucher Utilization</span>
              <div className="text-xl font-bold text-blue-700 font-mono mt-1">
                {macroKpi?.voucher_utilization_pct || 0}%
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Intended-usage verified at dealers
              </span>
            </div>
          </div>

          {/* Interactive Leaflet Geospatial Map */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                  <MapPin className="w-4 h-4 text-amber-700" strokeWidth={1.5} />
                  <span>Interactive District Geospatial Monitor (Leaflet + Open-Meteo Live Weather)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Click any district marker to inspect live 14-day rainfall forecast, SMF share, and climate FLDG coverage
                </p>
              </div>
              {selectedDistrict && (
                <button
                  onClick={() => setSelectedDistrict(null)}
                  className="text-xs px-2.5 py-1 bg-slate-100 rounded text-slate-700 hover:bg-slate-200"
                >
                  Selected: <strong>{selectedDistrict}</strong> (Clear)
                </button>
              )}
            </div>

            <DistrictLeafletMap
              districts={districtData}
              selectedDistrict={selectedDistrict}
              onSelectDistrict={(d) => setSelectedDistrict(d)}
            />

            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3.5 py-2.5">District & Zone</th>
                    <th className="px-3.5 py-2.5">Applications</th>
                    <th className="px-3.5 py-2.5">Sanctioned</th>
                    <th className="px-3.5 py-2.5">SMF Share %</th>
                    <th className="px-3.5 py-2.5">Open-Meteo 14d Rain</th>
                    <th className="px-3.5 py-2.5">Climate FLDG Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {districtData.map((d) => (
                    <tr
                      key={d.district}
                      onClick={() => setSelectedDistrict(d.district)}
                      className={`cursor-pointer transition-colors ${
                        selectedDistrict === d.district ? "bg-amber-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-slate-900">{d.district}</div>
                        <div className="text-[10px] text-slate-500">{d.agro_climatic_zone}</div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        {d.approved_applications} / {d.total_applications}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-medium">
                        ₹{Number(d.sanctioned_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-bold">
                        <span className={d.smf_share_pct >= 55.6 ? "text-emerald-700" : "text-amber-700"}>
                          {d.smf_share_pct}%
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono">
                        <div className="flex items-center space-x-1">
                          <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                          <span>{d.forecast_14d_precip_mm} mm ({d.weather_rainfall_anomaly}%)</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{d.weather_source}</div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        {d.fldg_coverage_active ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Bundelkhand FLDG Active
                          </span>
                        ) : (
                          <span className="text-slate-400">Standard Norms</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BANK COMPLIANCE AUDIT + RECHARTS CHART */}
      {activeTab === "compliance" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-blue-700" strokeWidth={1.5} />
                  <span>Bank Priority Sector Lending (PSL) Compliance Benchmark</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Visualizes each bank&apos;s Small & Marginal Farmer lending share against the mandatory 55.6% RBI benchmark
                </p>
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bankChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#334155" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#475569" }} domain={[0, 100]} unit="%" />
                  <Tooltip
                    formatter={(val) => [`${val}%`, "SMF Lending Share"]}
                    contentStyle={{ fontSize: "11px", borderRadius: "8px" }}
                  />
                  <ReferenceLine y={55.6} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "RBI 55.6%", fontSize: 10, fill: "#dc2626" }} />
                  <Bar dataKey="smfShare" radius={[4, 4, 0, 0]}>
                    {bankChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.smfShare >= 55.6 ? "#047857" : "#d97706"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2.5">Bank Entity</th>
                    <th className="px-3 py-2.5">Applications</th>
                    <th className="px-3 py-2.5">Total Sanctioned</th>
                    <th className="px-3 py-2.5">SMF Share</th>
                    <th className="px-3 py-2.5">RBI PSL Status</th>
                    <th className="px-3 py-2.5">Marginal Rej %</th>
                    <th className="px-3 py-2.5">Large Rej %</th>
                    <th className="px-3 py-2.5">Disparity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bankCompliance.map((b) => {
                    const isPass = b.rbi_psl_status === "PASS";
                    return (
                      <tr key={b.bank_name} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-bold text-slate-900">{b.bank_name}</td>
                        <td className="px-3 py-2.5">
                          {b.approved_count} / {b.total_applications}
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          ₹{Number(b.total_sanctioned).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold">
                          <span className={isPass ? "text-emerald-700" : "text-amber-700"}>
                            {b.smf_lending_share_pct}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPass ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {b.rbi_psl_status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono">{b.marginal_rejection_rate_pct}%</td>
                        <td className="px-3 py-2.5 font-mono">{b.large_rejection_rate_pct}%</td>
                        <td className="px-3 py-2.5 font-mono font-bold">
                          <span className={b.rejection_disparity_ratio > 2.0 ? "text-red-700" : "text-slate-800"}>
                            {b.rejection_disparity_ratio}x
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: POLICY LEVERS */}
      {activeTab === "policy" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-amber-700" />
                <span>Government Policy Levers: &ldquo;Monitor &amp; Correct&rdquo; Console</span>
              </h3>
              <p className="text-xs text-slate-500">
                Updating these parameters recalculates MILP optimization constraints across all banks in real time.
              </p>
            </div>
            <button
              onClick={handlePublishPolicy}
              disabled={updatingPolicy}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold"
            >
              {updatingPolicy ? "Publishing..." : "Publish Policy Update"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-800">SMF Mandatory Lending Quota (&alpha;)</span>
                <span className="font-bold text-emerald-800 font-mono text-sm">{smfQuota}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="75"
                step="1"
                value={smfQuota}
                onChange={(e) => setSmfQuota(parseFloat(e.target.value))}
                className="w-full accent-emerald-700 cursor-pointer"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-800">Govt First-Loss Default Guarantee (&gamma;)</span>
                <span className="font-bold text-amber-800 font-mono text-sm">{fldgRate}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={fldgRate}
                onChange={(e) => setFldgRate(parseFloat(e.target.value))}
                className="w-full accent-amber-700 cursor-pointer"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-800">MISS Prompt Repayment Subvention</span>
                <span className="font-bold text-blue-800 font-mono text-sm">{subventionRate}%</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="4.0"
                step="0.5"
                value={subventionRate}
                onChange={(e) => setSubventionRate(parseFloat(e.target.value))}
                className="w-full accent-blue-700 cursor-pointer"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-800">Collateral-Free Agricultural Loan Limit</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  ₹{Number(collateralLimit).toLocaleString("en-IN")}
                </span>
              </div>
              <input
                type="range"
                min="160000"
                max="300000"
                step="20000"
                value={collateralLimit}
                onChange={(e) => setCollateralLimit(parseFloat(e.target.value))}
                className="w-full accent-slate-800 cursor-pointer"
              />
            </div>
          </div>

          {policySuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{policySuccess}</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ESCALATED TRIBUNAL */}
      {activeTab === "tribunal" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <Gavel className="w-4 h-4 text-amber-700" />
                <span>Statutory Escalated Grievance Tribunal</span>
              </h3>
              <p className="text-xs text-slate-500">
                Appeals unresolved by banks past the 7-day statutory deadline.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded">
              {tribunalCases.length} Escalated Past SLA
            </span>
          </div>

          {tribunalCases.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No escalated cases pending.</div>
          ) : (
            <div className="space-y-4">
              {tribunalCases.map((c) => (
                <div key={c.id} className="p-4 rounded-xl border border-red-200 bg-red-50/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900">{c.full_name}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        ({c.district} • Bank: <strong>{c.bank_assigned}</strong>)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                      SLA Breached
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800">Category: {c.category}</div>
                  <p className="text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200">{c.grievance_text}</p>

                  {c.govt_directive ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                      <strong>Binding Directive Issued:</strong> {c.govt_directive}
                    </div>
                  ) : activeDirectiveCase === c.id ? (
                    <div className="space-y-2 pt-2 border-t border-red-200">
                      <textarea
                        rows={2}
                        value={directiveText}
                        onChange={(e) => setDirectiveText(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-md"
                      />
                      <div className="flex justify-end space-x-2">
                        <button onClick={() => setActiveDirectiveCase(null)} className="px-3 py-1 bg-slate-200 rounded text-xs">
                          Cancel
                        </button>
                        <button
                          onClick={() => handleIssueDirective(c.id)}
                          disabled={issuingDirective}
                          className="px-3 py-1 bg-red-700 text-white rounded text-xs font-semibold"
                        >
                          {issuingDirective ? "Issuing..." : "Issue Binding Directive"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveDirectiveCase(c.id);
                        setDirectiveText(
                          "DIRECTIVE: Waive collateral requirement under RBI Jan 2025 norm and disburse Tranche 1 within 24 hours."
                        );
                      }}
                      className="px-3 py-1.5 bg-red-700 text-white rounded text-xs font-medium"
                    >
                      Issue Binding Tribunal Directive
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
