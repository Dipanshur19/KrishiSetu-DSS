import React, { useState, useEffect } from 'react';
import {
  Landmark, ShieldAlert, CheckCircle2, AlertTriangle, Sliders,
  MapPin, CloudRain, Scale, ArrowUpRight, BarChart2, FileCheck,
  Send, RefreshCw, Gavel, AlertCircle, Info, Building2
} from 'lucide-react';

export default function GovtConsole({ demoUser, lang = 'en' }) {
  const [activeTab, setActiveTab] = useState('macro'); // macro | compliance | policy | tribunal

  const [macroKpi, setMacroKpi] = useState(null);
  const [districtData, setDistrictData] = useState([]);
  const [bankCompliance, setBankCompliance] = useState([]);
  const [policyConfig, setPolicyConfig] = useState(null);
  const [tribunalCases, setTribunalCases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Policy Form Sliders
  const [smfQuota, setSmfQuota] = useState(55.6);
  const [fldgRate, setFldgRate] = useState(35);
  const [subventionRate, setSubventionRate] = useState(3.0);
  const [collateralLimit, setCollateralLimit] = useState(200000);
  const [npaCeiling, setNpaCeiling] = useState(4.5);
  const [updatingPolicy, setUpdatingPolicy] = useState(false);
  const [policySuccess, setPolicySuccess] = useState('');

  // Tribunal Directive State
  const [activeDirectiveCase, setActiveDirectiveCase] = useState(null);
  const [directiveText, setDirectiveText] = useState('');
  const [issuingDirective, setIssuingDirective] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/govt/macro-kpi').then((r) => r.json()),
      fetch('/api/govt/district-heatmap').then((r) => r.json()),
      fetch('/api/govt/bank-compliance').then((r) => r.json()),
      fetch('/api/govt/policy-config').then((r) => r.json()),
      fetch('/api/govt/escalated-tribunal').then((r) => r.json())
    ])
      .then(([kpi, districts, compliance, policy, tribunal]) => {
        setMacroKpi(kpi);
        setDistrictData(districts);
        setBankCompliance(compliance);
        setPolicyConfig(policy);
        setTribunalCases(tribunal);

        if (policy) {
          setSmfQuota(policy.smf_minimum_quota * 100);
          setFldgRate(policy.govt_first_loss_guarantee * 100);
          setSubventionRate(policy.interest_subvention_pct);
          setCollateralLimit(policy.collateral_free_threshold);
          setNpaCeiling(policy.bank_max_npa_ceiling * 100);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handlePublishPolicy = async () => {
    setUpdatingPolicy(true);
    setPolicySuccess('');
    try {
      const res = await fetch('/api/govt/policy-config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smf_minimum_quota: parseFloat(smfQuota) / 100.0,
          govt_first_loss_guarantee: parseFloat(fldgRate) / 100.0,
          interest_subvention_pct: parseFloat(subventionRate),
          collateral_free_threshold: parseFloat(collateralLimit),
          bank_max_npa_ceiling: parseFloat(npaCeiling) / 100.0,
          updated_by: 'Ministry of Agriculture & RBI Joint Directorate'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPolicySuccess(data.message);
        fetchAllData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingPolicy(false);
    }
  };

  const handleIssueDirective = async (caseId) => {
    if (!directiveText) return;
    setIssuingDirective(true);
    try {
      const res = await fetch(`/api/govt/escalated-tribunal/${caseId}/directive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directive: directiveText })
      });
      if (res.ok) {
        setActiveDirectiveCase(null);
        setDirectiveText('');
        fetchAllData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIssuingDirective(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Landmark className="w-6 h-6 text-amber-700" />
            <span>Government Policy, Geospatial Audit & Tribunal Console</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Macro Ground-Level Credit Tracking (₹32.50 Lakh Cr Target), Bank PSL Enforcement, & Binding Tribunal
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('macro')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'macro'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Macro & District Monitor
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'compliance'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Bank PSL Compliance Audit
          </button>
          <button
            onClick={() => setActiveTab('policy')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'policy'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Policy Levers (Monitor & Correct)
          </button>
          <button
            onClick={() => setActiveTab('tribunal')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'tribunal'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            4. Escalated Tribunal ({tribunalCases.length})
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: MACRO & GEOSPATIAL DISTRICT MONITOR
      ========================================================================= */}
      {activeTab === 'macro' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Macro KPI Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Ground Level Credit Target
              </span>
              <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                {macroKpi?.ground_level_credit_target || '₹32.50 Lakh Cr'}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                FY 2025–26 National Annual Target
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Small & Marginal (SMF) Share
              </span>
              <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
                {macroKpi?.smf_share_pct || 0}%
              </div>
              <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
                Target &ge; {macroKpi?.rbi_smf_mandate_benchmark_pct || 55.6}% (RBI PSL Compliant)
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Credit Sanctioned (Pool)
              </span>
              <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                ₹{((macroKpi?.total_sanctioned_amount || 0) / 100000).toFixed(2)} Lakh
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {macroKpi?.approved_applications || 0} / {macroKpi?.total_applications || 0} Applications Sanctioned
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                e-RUPI Voucher Usage Rate
              </span>
              <div className="text-xl font-bold text-blue-700 font-mono mt-1">
                {macroKpi?.voucher_utilization_pct || 0}%
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Intended-usage verified at certified merchants
              </span>
            </div>
          </div>

          {/* District Breakdown Table & Heatmap Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                  <MapPin className="w-4 h-4 text-amber-700" />
                  <span>District-Wise Credit Deployment & Climatic Vulnerability</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Tracking agricultural fund distribution across central Uttar Pradesh districts
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3.5 py-2.5">District</th>
                    <th className="px-3.5 py-2.5">Applications</th>
                    <th className="px-3.5 py-2.5">Sanctioned</th>
                    <th className="px-3.5 py-2.5">SMF Share %</th>
                    <th className="px-3.5 py-2.5">Monsoon Rainfall Anomaly</th>
                    <th className="px-3.5 py-2.5">Climate FLDG Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {districtData.map((d) => (
                    <tr key={d.district} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900">
                        {d.district}
                      </td>
                      <td className="px-3.5 py-2.5">
                        {d.approved_applications} / {d.total_applications} approved
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-medium">
                        ₹{Number(d.sanctioned_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-bold">
                        <span
                          className={
                            d.smf_share_pct >= 55.6 ? 'text-emerald-700' : 'text-amber-700'
                          }
                        >
                          {d.smf_share_pct}%
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono">
                        <span
                          className={
                            d.weather_rainfall_anomaly < -15
                              ? 'text-red-700 font-bold'
                              : d.weather_rainfall_anomaly < 0
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }
                        >
                          {d.weather_rainfall_anomaly > 0 ? '+' : ''}
                          {d.weather_rainfall_anomaly}% ({d.drought_risk_classification})
                        </span>
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

      {/* =========================================================================
          TAB 2: BANK COMPLIANCE AUDIT MATRIX
      ========================================================================= */}
      {activeTab === 'compliance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4 animate-fadeIn">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-blue-700" />
                <span>Commercial Bank Priority Sector Lending (PSL) Audit Ledger</span>
              </h3>
              <p className="text-xs text-slate-500">
                Audits bank adherence to the 10% Small & Marginal Farmer sub-target and flags rejection disparities.
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 bg-slate-100 rounded text-slate-700">
              Benchmark: 55.6% Agri Credit to SMFs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2.5">Bank Entity</th>
                  <th className="px-3 py-2.5">Total Applications</th>
                  <th className="px-3 py-2.5">Total Sanctioned</th>
                  <th className="px-3 py-2.5">SMF Lending Share</th>
                  <th className="px-3 py-2.5">RBI PSL Status</th>
                  <th className="px-3 py-2.5">Marginal Rejection %</th>
                  <th className="px-3 py-2.5">Large Rejection %</th>
                  <th className="px-3 py-2.5">Disparity Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bankCompliance.map((b) => {
                  const isPass = b.rbi_psl_status === 'PASS';
                  return (
                    <tr key={b.bank_name} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        {b.bank_name}
                      </td>
                      <td className="px-3 py-2.5">
                        {b.approved_count} / {b.total_applications} approved
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        ₹{Number(b.total_sanctioned).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold">
                        <span className={isPass ? 'text-emerald-700' : 'text-amber-700'}>
                          {b.smf_lending_share_pct}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPass
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {b.rbi_psl_status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono">{b.marginal_rejection_rate_pct}%</td>
                      <td className="px-3 py-2.5 font-mono">{b.large_rejection_rate_pct}%</td>
                      <td className="px-3 py-2.5 font-mono font-bold">
                        <span className={b.rejection_disparity_ratio > 2.0 ? 'text-red-700' : 'text-slate-800'}>
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
      )}

      {/* =========================================================================
          TAB 3: POLICY LEVERS (MONITOR & CORRECT)
      ========================================================================= */}
      {activeTab === 'policy' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-amber-700" />
                <span>Government Policy Levers: &ldquo;Monitor &amp; Correct&rdquo; Console</span>
              </h3>
              <p className="text-xs text-slate-500">
                Updating these parameters dynamically recalculates mathematical optimization constraints across all commercial banks in real time!
              </p>
            </div>
            <button
              onClick={handlePublishPolicy}
              disabled={updatingPolicy}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              {updatingPolicy ? 'Publishing Policy...' : 'Publish Policy Update'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lever 1: SMF Quota */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  SMF Mandatory Lending Sub-Target Quota (&alpha;)
                </span>
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
              <p className="text-[11px] text-slate-500">
                Minimum mandatory share of bank agriculture credit pool reserved exclusively for Small & Marginal Farmers.
              </p>
            </div>

            {/* Lever 2: FLDG Guarantee */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  Govt First-Loss Default Guarantee (&gamma;)
                </span>
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
              <p className="text-[11px] text-slate-500">
                State guarantee covering initial defaults on tenant and marginal farmers, lowering bank Loss Given Default (LGD).
              </p>
            </div>

            {/* Lever 3: Interest Subvention */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  Modified Interest Subvention Scheme (MISS) Incentive
                </span>
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
              <p className="text-[11px] text-slate-500">
                Prompt repayment incentive discount applied against base 7.0% rate, bringing effective interest to (7 - {subventionRate})%.
              </p>
            </div>

            {/* Lever 4: Collateral-Free Limit */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  RBI Collateral-Free Agricultural Loan Limit
                </span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  ₹{Number(collateralLimit).toLocaleString('en-IN')}
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
              <p className="text-[11px] text-slate-500">
                Statutory threshold below which banks are legally prohibited from demanding land hypothecation or mortgage.
              </p>
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

      {/* =========================================================================
          TAB 4: ESCALATED TRIBUNAL
      ========================================================================= */}
      {activeTab === 'tribunal' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4 animate-fadeIn">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <Gavel className="w-4 h-4 text-amber-700" />
                <span>Statutory Escalated Grievance Tribunal</span>
              </h3>
              <p className="text-xs text-slate-500">
                Appeals unresolved by banks past the 7-day statutory deadline. Government auditors issue binding re-evaluation directives.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded">
              {tribunalCases.length} Escalated Past SLA
            </span>
          </div>

          {tribunalCases.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No escalated tribunal cases pending. All bank SLAs compliant.
            </div>
          ) : (
            <div className="space-y-4">
              {tribunalCases.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-red-200 bg-red-50/30 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900">{c.full_name}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        ({c.district} • Bank: <strong>{c.bank_assigned}</strong>)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 uppercase tracking-wider">
                      SLA BREACHED
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-800">
                    Category: {c.category}
                  </div>
                  <p className="text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200">
                    {c.grievance_text}
                  </p>

                  {c.govt_directive ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                      <strong>Binding Government Directive Issued:</strong> {c.govt_directive}
                    </div>
                  ) : (
                    <div>
                      {activeDirectiveCase === c.id ? (
                        <div className="space-y-2 pt-2 border-t border-red-200">
                          <textarea
                            rows="2"
                            value={directiveText}
                            onChange={(e) => setDirectiveText(e.target.value)}
                            placeholder="Draft binding directive to Lead Bank (e.g. Sanction under ₹2L collateral waiver within 24 hours under penalty of PSL fine)..."
                            className="w-full text-xs p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-amber-500"
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => setActiveDirectiveCase(null)}
                              className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleIssueDirective(c.id)}
                              disabled={issuingDirective}
                              className="px-3 py-1 bg-red-700 text-white rounded text-xs font-semibold"
                            >
                              {issuingDirective ? 'Issuing...' : 'Issue Binding Directive'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveDirectiveCase(c.id);
                            setDirectiveText('DIRECTIVE: Branch manager must immediately waive collateral requirement for application under RBI Jan 2025 norm and disburse Tranche 1 within 24 hours.');
                          }}
                          className="px-3 py-1.5 bg-red-700 text-white rounded text-xs font-medium hover:bg-red-800"
                        >
                          Issue Binding Tribunal Directive
                        </button>
                      )}
                    </div>
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
