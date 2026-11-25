"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, FileDown } from "lucide-react";
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
import ClimateGaugeCard from "./ClimateGaugeCard";
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
  const [policyError, setPolicyError] = useState("");

  const [activeDirectiveCase, setActiveDirectiveCase] = useState<number | null>(null);
  const [directiveText, setDirectiveText] = useState("");
  const [issuingDirective, setIssuingDirective] = useState(false);
  const [tribunalError, setTribunalError] = useState("");

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
        if (districts.length > 0 && !selectedDistrict) setSelectedDistrict(districts[0].district);
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
    setPolicyError("");
    try {
      const data = await api.updatePolicyConfig({
        smf_minimum_quota: Number(smfQuota) / 100.0,
        govt_first_loss_guarantee: Number(fldgRate) / 100.0,
        interest_subvention_pct: Number(subventionRate),
        collateral_free_threshold: Number(collateralLimit),
        bank_max_npa_ceiling: Number(npaCeiling) / 100.0,
        updated_by: "Directorate of Institutional Finance",
      });
      setPolicySuccess(data.message);
      fetchAllData();
    } catch (err: unknown) {
      setPolicyError(err instanceof Error ? err.message : "Failed to publish policy");
    } finally {
      setUpdatingPolicy(false);
    }
  };

  const handleIssueDirective = async (caseId: number) => {
    if (!directiveText.trim()) return;
    setIssuingDirective(true);
    setTribunalError("");
    try {
      await api.issueTribunalDirective(caseId, directiveText);
      setActiveDirectiveCase(null);
      setDirectiveText("");
      fetchAllData();
    } catch (err: unknown) {
      setTribunalError(err instanceof Error ? err.message : "Failed to issue directive");
    } finally {
      setIssuingDirective(false);
    }
  };

  const activeDistrictObj =
    districtData.find((d) => d.district === selectedDistrict) || districtData[0] || null;

  const bankChartData = bankCompliance.map((b) => ({
    name: b.bank_name.replace("State Bank of India", "SBI").replace("Punjab National Bank", "PNB").replace("Bank of Baroda", "BOB").replace("Bank of India", "BOI"),
    smfShare: b.smf_lending_share_pct,
  }));

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#8a877d]">{t(lang, "govt_eyebrow")}</p>
          <h1 className="text-3xl font-medium tracking-tight text-[#141513] mt-0.5">
            {t(lang, "govt_title")}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "macro", label: "District Map" },
            { key: "compliance", label: "Bank allocation audit" },
            { key: "policy", label: "Policy Levers" },
            { key: "tribunal", label: `Tribunal (${tribunalCases.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "macro" | "compliance" | "policy" | "tribunal")}
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

      {/* TAB 1: MACRO KPI ROW + LEAFLET MAP + CLIMATE GAUGE */}
      {activeTab === "macro" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bento-card p-5">
              <span className="text-xs text-[#8a877d]">Sanctioned Pool</span>
              <div className="text-2xl sm:text-3xl font-medium text-[#141513] font-mono mt-1">
                ₹{((macroKpi?.total_sanctioned_amount || 0) / 100000).toFixed(1)}L
              </div>
              <span className="text-xs text-[#5e5c55] mt-1 block">
                {macroKpi?.approved_applications || 0} of {macroKpi?.total_applications || 0} loans
              </span>
            </div>

            <div className="bento-card p-5">
              <span className="text-xs text-[#8a877d]">SMF Lending Share</span>
              <div className="text-2xl sm:text-3xl font-medium text-[#4d7c0f] font-mono mt-1">
                {macroKpi?.smf_share_pct || 0}%
              </div>
              <span className="text-xs text-[#5e5c55] mt-1 block">
                vs {macroKpi?.rbi_smf_mandate_benchmark_pct ?? 55.6}% batch target
              </span>
            </div>

            <div className="bento-card p-5">
              <span className="text-xs text-[#8a877d]">e-RUPI Utilization</span>
              <div className="text-2xl sm:text-3xl font-medium text-[#141513] font-mono mt-1">
                {macroKpi?.voucher_utilization_pct || 0}%
              </div>
              <span className="text-xs text-[#5e5c55] mt-1 block">Verified at agri dealers</span>
            </div>

            <div className="bento-card p-5">
              <span className="text-xs text-[#8a877d]">Escalated Appeals</span>
              <div className="text-2xl sm:text-3xl font-medium text-[#141513] font-mono mt-1">
                {macroKpi?.escalated_grievances || 0}
              </div>
              <span className="text-xs text-[#5e5c55] mt-1 block">Past 7-day bank SLA</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8">
              <DistrictLeafletMap
                districts={districtData}
                selectedDistrict={selectedDistrict}
                onSelectDistrict={(d) => setSelectedDistrict(d)}
              />
            </div>

            <div className="lg:col-span-4 space-y-5">
              {activeDistrictObj && (
                <ClimateGaugeCard
                  title={`${activeDistrictObj.district} Telemetry`}
                  subtitle={activeDistrictObj.agro_climatic_zone}
                  primaryValue={String(activeDistrictObj.avg_max_temp_c)}
                  unit="°C"
                  progressRatio={Math.min(1, activeDistrictObj.smf_share_pct / 100)}
                  metric1Label="SMF Share"
                  metric1Val={`${activeDistrictObj.smf_share_pct}%`}
                  metric2Label="Anomaly"
                  metric2Val={`${activeDistrictObj.weather_rainfall_anomaly}%`}
                  metric3Label="14d Rain"
                  metric3Val={`${activeDistrictObj.forecast_14d_precip_mm} mm`}
                />
              )}
            </div>
          </div>

          <div className="bento-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fafaf6] border-b border-black/[0.06] text-[#8a877d]">
                  <tr>
                    <th className="px-4 py-3 font-medium">District</th>
                    <th className="px-4 py-3 font-medium">Applications</th>
                    <th className="px-4 py-3 font-medium text-right">Sanctioned</th>
                    <th className="px-4 py-3 font-medium text-right">SMF Share</th>
                    <th className="px-4 py-3 font-medium text-right">14d Rain</th>
                    <th className="px-4 py-3 font-medium text-right">Climate Cover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {districtData.map((d) => (
                    <tr
                      key={d.district}
                      onClick={() => setSelectedDistrict(d.district)}
                      className={`cursor-pointer ${
                        selectedDistrict === d.district ? "bg-[#f3f6ea]" : "hover:bg-[#fafaf6]"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[#141513]">{d.district}</td>
                      <td className="px-4 py-3 text-[#5e5c55]">
                        {d.approved_applications} / {d.total_applications}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#141513]">
                        ₹{Number(d.sanctioned_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-[#4d7c0f]">
                        {d.smf_share_pct}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#5e5c55]">
                        {d.forecast_14d_precip_mm} mm
                      </td>
                      <td className="px-4 py-3 text-right text-[#5e5c55]">
                        {d.fldg_coverage_active ? "Guarantee enabled" : "Guarantee off"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BANK COMPLIANCE */}
      {activeTab === "compliance" && (
        <div className="space-y-5">
          <div className="bento-card p-6 space-y-4 min-w-0">
            <h3 className="text-[15px] font-medium text-[#141513]">SMF Share by Bank · published target {macroKpi?.rbi_smf_mandate_benchmark_pct}%</h3>
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height={224} minWidth={0}>
                <BarChart data={bankChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,21,19,0.06)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5e5c55" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#8a877d" }} domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "12px" }} />
                  <ReferenceLine y={macroKpi?.rbi_smf_mandate_benchmark_pct} stroke="#dc2626" strokeDasharray="4 4" />
                  <Bar dataKey="smfShare" radius={[6, 6, 0, 0]}>
                    {bankChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.smfShare >= (macroKpi?.rbi_smf_mandate_benchmark_pct ?? 55.6) ? "#84cc16" : "#d97706"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bento-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fafaf6] border-b border-black/[0.06] text-[#8a877d]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Bank</th>
                    <th className="px-4 py-3 font-medium">Approved</th>
                    <th className="px-4 py-3 font-medium text-right">Sanctioned</th>
                    <th className="px-4 py-3 font-medium text-right">SMF Share</th>
                    <th className="px-4 py-3 font-medium text-right">PSL Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {bankCompliance.map((b) => (
                    <tr key={b.bank_name} className="hover:bg-[#fafaf6]">
                      <td className="px-4 py-3 font-medium text-[#141513]">{b.bank_name}</td>
                      <td className="px-4 py-3 text-[#5e5c55]">
                        {b.approved_count} / {b.total_applications}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ₹{Number(b.total_sanctioned).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {b.smf_lending_share_pct}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] ${
                            b.rbi_psl_status === "PASS"
                              ? "bg-[#eef7d6] text-[#365314]"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {b.rbi_psl_status === "PASS" ? "Compliant" : "Deficit"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: POLICY LEVERS */}
      {activeTab === "policy" && (
        <div className="bento-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <h3 className="text-[15px] font-medium text-[#141513]">Policy Parameters</h3>
            <button
              onClick={handlePublishPolicy}
              disabled={updatingPolicy}
              className="px-5 py-2 bg-[#141513] text-[#d4f04c] rounded-full text-xs font-medium hover:bg-black/85"
            >
              {updatingPolicy ? "Publishing..." : "Publish Update"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bento-surface-soft p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#5e5c55]">SMF Lending Quota</span>
                <span className="font-mono font-medium text-[#141513]">{smfQuota}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="75"
                step="0.5"
                value={smfQuota}
                onChange={(e) => setSmfQuota(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="bento-surface-soft p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#5e5c55]">First-Loss Default Guarantee</span>
                <span className="font-mono font-medium text-[#4d7c0f]">{fldgRate}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={fldgRate}
                onChange={(e) => setFldgRate(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="bento-surface-soft p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#5e5c55]">Interest Subvention (MISS)</span>
                <span className="font-mono font-medium text-[#141513]">{subventionRate}%</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="4.0"
                step="0.5"
                value={subventionRate}
                onChange={(e) => setSubventionRate(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="bento-surface-soft p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#5e5c55]">Collateral-Free Limit</span>
                <span className="font-mono font-medium text-[#141513]">
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
                className="w-full cursor-pointer"
              />
            </div>
          </div>

          {policySuccess && (
            <div className="p-3.5 bg-[#eef7d6] rounded-xl text-xs text-[#365314] flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{policySuccess}</span>
            </div>
          )}
          {policyError && (
            <div className="p-3.5 bg-red-50 rounded-xl text-xs text-red-700">{policyError}</div>
          )}
        </div>
      )}

      {/* TAB 4: TRIBUNAL */}
      {activeTab === "tribunal" && (
        <div className="bento-card p-6 space-y-4">
          <h3 className="text-[15px] font-medium text-[#141513]">Escalated Tribunal</h3>
          {tribunalError && (
            <div className="p-3 bg-red-50 rounded-xl text-xs text-red-700">{tribunalError}</div>
          )}
          {tribunalCases.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8a877d]">No overdue escalations</div>
          ) : (
            <div className="space-y-3">
              {tribunalCases.map((c) => (
                <div key={c.id} className="bento-surface-soft p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-[#141513]">{c.full_name}</span>
                      <span className="text-[#8a877d] ml-2">
                        {c.district} · {c.bank_assigned}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-900">
                      SLA Breached
                    </span>
                  </div>
                  <p className="text-xs text-[#5e5c55]">{c.grievance_text}</p>
                  {c.supporting_doc && /^[a-f0-9]{32}$/.test(c.supporting_doc) && (
                    <button
                      className="control"
                      onClick={() =>
                        api.downloadEvidence(c.supporting_doc!).catch((e) => setTribunalError(e.message))
                      }
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Download evidence</span>
                    </button>
                  )}
                  {c.govt_directive ? (
                    <div className="text-xs text-[#365314] bg-[#eef7d6] p-2.5 rounded-lg">
                      Directive: {c.govt_directive}
                    </div>
                  ) : activeDirectiveCase === c.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={directiveText}
                        onChange={(e) => setDirectiveText(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-black/10 rounded-xl"
                      />
                      <div className="flex justify-end space-x-2">
                        <button onClick={() => setActiveDirectiveCase(null)} className="px-3 py-1 text-xs text-[#5e5c55]">
                          Cancel
                        </button>
                        <button
                          onClick={() => handleIssueDirective(c.id)}
                          disabled={issuingDirective}
                          className="px-4 py-1 bg-[#141513] text-white rounded-full text-xs font-medium"
                        >
                          {issuingDirective ? "Issuing..." : "Issue Directive"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveDirectiveCase(c.id);
                        setDirectiveText(
                          "Please re-evaluate the application and record your findings."
                        );
                      }}
                      className="px-3.5 py-1.5 bg-[#141513] text-white rounded-full text-xs font-medium"
                    >
                      Issue Directive
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
