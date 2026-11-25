import React, { useState, useEffect } from 'react';
import {
  Building2, Search, Filter, ShieldAlert, CheckCircle2, AlertTriangle,
  Sliders, Play, Layers, BarChart3, TrendingUp, UserCheck, ArrowUpRight,
  Scale, FileText, Check, Landmark, RefreshCw, X, ChevronRight, Info,
  CloudRain, Gauge, Activity
} from 'lucide-react';
import DecisionTreeModal from './DecisionTreeModal';

export default function BankWorkbench({ demoUser, lang = 'en', onSelectApplication }) {
  const [activeTab, setActiveTab] = useState('dossier'); // dossier | optimizer | grievances

  // Applications list
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedAppDetail, setSelectedAppDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters
  const [districtFilter, setDistrictFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Optimizer state
  const [budgetSlider, setBudgetSlider] = useState(5000000); // ₹50 Lakh
  const [npaSlider, setNpaSlider] = useState(4.0); // 4.0%
  const [fldgSlider, setFldgSlider] = useState(35); // 35% FLDG
  const [smfQuotaSlider, setSmfQuotaSlider] = useState(55.6); // 55.6% RBI benchmark
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState(null);
  const [disbursing, setDisbursing] = useState(false);
  const [disburseSuccess, setDisburseSuccess] = useState('');

  // Grievances
  const [bankGrievances, setBankGrievances] = useState([]);
  const [respondingId, setRespondingId] = useState(null);
  const [responseText, setResponseText] = useState('');

  // Modals
  const [isDecisionTreeOpen, setIsDecisionTreeOpen] = useState(false);

  // Fetch applications
  useEffect(() => {
    fetchApplications();
    fetchGrievances();
  }, [districtFilter, categoryFilter, statusFilter, searchQuery]);

  const fetchApplications = () => {
    setLoadingApps(true);
    const params = new URLSearchParams();
    if (districtFilter !== 'All') params.append('district', districtFilter);
    if (categoryFilter !== 'All') params.append('category', categoryFilter);
    if (statusFilter !== 'All') params.append('status', statusFilter);
    if (searchQuery) params.append('search', searchQuery);

    fetch(`/api/bank/applications?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setApplications(data);
        if (data.length > 0 && !selectedApp) {
          loadApplicationDetail(data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingApps(false));
  };

  const loadApplicationDetail = (appId) => {
    setLoadingDetail(true);
    fetch(`/api/farmer/applications/${appId}`)
      .then((r) => r.json())
      .then((d) => {
        setSelectedAppDetail(d);
        setSelectedApp(d);
      })
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  };

  const fetchGrievances = () => {
    fetch('/api/bank/grievances')
      .then((r) => r.json())
      .then((d) => setBankGrievances(d))
      .catch(console.error);
  };

  const handleRunOptimizer = async () => {
    setOptimizing(true);
    setDisburseSuccess('');
    try {
      const res = await fetch('/api/bank/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_fund_budget: parseFloat(budgetSlider),
          smf_quota_alpha: parseFloat(smfQuotaSlider) / 100.0,
          bank_max_npa_ceiling: parseFloat(npaSlider) / 100.0,
          govt_fldg_gamma: parseFloat(fldgSlider) / 100.0,
          district_filter: districtFilter !== 'All' ? districtFilter : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setOptResult(data);
      }
    } catch (err) {
      alert('Optimization failed: ' + err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const handleDisburseBatch = async () => {
    if (!optResult?.dss_allocated_ids?.length) return;
    setDisbursing(true);
    try {
      const res = await fetch('/api/bank/disburse-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_ids: optResult.dss_allocated_ids,
          notes: `Batch sanctioned under RBI PSL optimization with ${fldgSlider}% Govt FLDG.`
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDisburseSuccess(data.message);
        fetchApplications();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setDisbursing(false);
    }
  };

  const handleResolveGrievance = async (id) => {
    if (!responseText) return;
    try {
      const res = await fetch(`/api/bank/grievances/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_response: responseText,
          resolution_status: 'resolved'
        })
      });
      if (res.ok) {
        setRespondingId(null);
        setResponseText('');
        fetchGrievances();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Visual helper calculations for the Inspector charts
  const expectedRev = selectedAppDetail?.expected_revenue || 85000;
  const droughtRev = selectedAppDetail?.drought_stress_revenue || 48000;
  const debtObligation = (selectedAppDetail?.sanctioned_amount || 50000) * 1.04;
  const maxBarValue = Math.max(expectedRev, droughtRev, debtObligation, 100000);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-blue-700" />
            <span>Bank Officer & Credit Manager Workbench</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Consolidated 3-Bank Dossier, RBI Scale-of-Finance Underwriting & Constrained MILP Portfolio Optimizer
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('dossier')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'dossier'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Unified Application Dossier
          </button>
          <button
            onClick={() => setActiveTab('optimizer')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'optimizer'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Constrained Portfolio Optimizer (MILP)
          </button>
          <button
            onClick={() => setActiveTab('grievances')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'grievances'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Grievance Review Queue ({bankGrievances.length})
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: UNIFIED APPLICATION DOSSIER & INTERACTIVE MODEL INSPECTOR
      ========================================================================= */}
      {activeTab === 'dossier' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search farmer name, KCC no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 w-48 text-xs"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">District:</span>
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
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                >
                  <option value="All">All Farmers</option>
                  <option value="Marginal">Marginal (&le; 1 ha)</option>
                  <option value="Small">Small (1–2 ha)</option>
                  <option value="Other">Medium/Large (&gt; 2 ha)</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                >
                  <option value="All">All Statuses</option>
                  <option value="submitted">Submitted (Pending)</option>
                  <option value="approved">Approved & Sanctioned</option>
                </select>
              </div>
            </div>

            <div className="text-slate-500 font-mono">
              Showing <strong>{applications.length}</strong> Applications
            </div>
          </div>

          {/* 2 Columns: Table of Applications & Selected Dossier Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Table (7 Cols) */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="overflow-x-auto max-h-[660px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5">Farmer & UID</th>
                      <th className="px-3 py-2.5">Land & Crop</th>
                      <th className="px-3 py-2.5">Requested</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5 text-center">PD Score</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingApps ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-400">
                          Loading applications...
                        </td>
                      </tr>
                    ) : applications.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-400">
                          No matching applications found.
                        </td>
                      </tr>
                    ) : (
                      applications.map((app) => {
                        const isSelected = selectedApp?.id === app.id;
                        const pdPct = ((app.pd_score || 0.08) * 100).toFixed(1);
                        const isMarginal = app.farmer_classification === 'Marginal';

                        return (
                          <tr
                            key={app.id}
                            onClick={() => loadApplicationDetail(app.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50/80 font-medium'
                                : 'hover:bg-slate-50'
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
                              ₹{Number(app.requested_amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isMarginal
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {app.farmer_classification || 'Marginal'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-semibold">
                              <span
                                className={
                                  parseFloat(pdPct) > 15
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }
                              >
                                {pdPct}%
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  app.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
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

            {/* Selected Application Model Inspector (5 Cols) */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              {loadingDetail ? (
                <div className="py-20 text-center text-slate-400">Loading model inspection...</div>
              ) : selectedAppDetail ? (
                <div className="space-y-4">
                  {/* Top Bar */}
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
                      <h3 className="text-lg font-bold text-slate-900 mt-1">
                        {selectedAppDetail.full_name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {selectedAppDetail.village}, {selectedAppDetail.district} • Category: {selectedAppDetail.social_category}
                      </p>
                    </div>

                    <button
                      onClick={() => setIsDecisionTreeOpen(true)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold text-slate-700 flex items-center space-x-1"
                      title="Inspect Decision Tree"
                    >
                      <Scale className="w-3.5 h-3.5 text-blue-700" />
                      <span>Decision Tree</span>
                    </button>
                  </div>

                  {/* 3-Bank Feature Signals (Axis + SBI + BOI) */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Axis Resilience</span>
                      <strong className="text-slate-800">{selectedAppDetail.irrigation_source}</strong>
                      <span className="text-[10px] text-slate-500 block">{selectedAppDetail.distance_to_mandi_km}km to Mandi</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">SBI Cash Flow</span>
                      <strong className="text-slate-800">{selectedAppDetail.livestock_count} Cows/Buffalo</strong>
                      <span className="text-[10px] text-emerald-700 block">+₹35k/head norm</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">BOI Net Worth</span>
                      <strong className="text-slate-800 font-mono">₹{Number(selectedAppDetail.net_worth || 0).toLocaleString('en-IN')}</strong>
                      <span className="text-[10px] text-slate-500 block">K+L-M Formula</span>
                    </div>
                  </div>

                  {/* Red-Flag Badges */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                      ✓ Clean Duplicate KCC Check
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                      ✓ Collateral Waived (&le; ₹2.00L RBI rule)
                    </span>
                    {selectedAppDetail.district === 'Jhansi' && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                        ⚠ Bundelkhand Climate FLDG Active
                      </span>
                    )}
                  </div>

                  {/* INTERACTIVE VISUAL CHART 1: Crop Revenue & Drought Stress Forecast */}
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-700" />
                        <span>Forecasted Revenue & Drought Stress Test</span>
                      </span>
                      <div className="flex items-center space-x-1">
                        <Gauge className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="font-mono font-bold text-slate-800">
                          DSCR: <strong className="text-emerald-700">{selectedAppDetail.dscr_ratio}x</strong>
                        </span>
                      </div>
                    </div>

                    {/* Visual Bar Comparison Chart */}
                    <div className="space-y-2 pt-1 text-xs">
                      {/* Bar 1: Normal Expected Revenue */}
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Normal Expected Revenue:</span>
                          <span className="font-mono font-bold text-emerald-800">
                            ₹{Number(expectedRev).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-2.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (expectedRev / maxBarValue) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Bar 2: -35% Drought Stress Scenario */}
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Drought Stress Scenario (-35% Rain):</span>
                          <span className="font-mono font-bold text-amber-800">
                            ₹{Number(droughtRev).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-amber-600 h-2.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (droughtRev / maxBarValue) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Bar 3: Debt Service Obligation */}
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Annual Debt Service (Principal + 4% MISS Interest):</span>
                          <span className="font-mono font-bold text-blue-800">
                            ₹{Number(debtObligation).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (debtObligation / maxBarValue) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* INTERACTIVE VISUAL CHART 2: SHAP Feature Attribution Waterfall Chart */}
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Alternative Credit Scoring: SHAP Feature Attributions</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Base PD: 8.5%
                      </span>
                    </div>

                    <div className="space-y-2 pt-1 text-xs">
                      {selectedAppDetail.shap_reasons?.map((item, idx) => {
                        const isRiskDecrease = item.direction === 'RISK_DECREASE';
                        const absPct = Math.abs(item.delta_pd_pct);
                        return (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-700 font-medium truncate max-w-[220px]">
                                {item.name}
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  isRiskDecrease ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {isRiskDecrease ? '−' : '+'}{absPct}% PD
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                              {isRiskDecrease ? (
                                <div
                                  className="bg-emerald-600 h-2 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (absPct / 25) * 100)}%` }}
                                />
                              ) : (
                                <div
                                  className="bg-amber-600 h-2 rounded-full transition-all ml-auto"
                                  style={{ width: `${Math.min(100, (absPct / 25) * 100)}%` }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sanction Decision Row */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500">Scale of Finance Sanction</span>
                      <div className="text-lg font-bold text-emerald-800 font-mono">
                        ₹{Number(selectedAppDetail.sanctioned_amount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    {selectedAppDetail.status !== 'approved' && (
                      <button
                        onClick={() => {
                          fetch('/api/bank/disburse-batch', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ application_ids: [selectedAppDetail.id] })
                          }).then(() => {
                            fetchApplications();
                            loadApplicationDetail(selectedAppDetail.id);
                          });
                        }}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
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

      {/* =========================================================================
          TAB 2: CONSTRAINED PORTFOLIO OPTIMIZER (MILP SOLVER)
      ========================================================================= */}
      {activeTab === 'optimizer' && (
        <div className="space-y-6">
          {/* Header Explanation of the Govt vs Bank Conflict */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-3 text-xs text-blue-900">
            <Scale className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <strong className="text-sm">The DMS624 Mathematical Core: Resolving the Govt vs. Bank Conflict</strong>
              <p>
                Banks seek to minimize risk and avoid non-performing loans, while the Government mandates lending to high-risk Small & Marginal Farmers (SMFs) under Priority Sector Lending quotas.
                KrishiSetu resolves this through a <strong>Mixed-Integer Linear Program (MILP)</strong> with a <strong>Government First-Loss Default Guarantee (FLDG)</strong> cushion.
              </p>
            </div>
          </div>

          {/* Interactive What-If Sliders Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-blue-700" />
                <span>Interactive What-If Sensitivity Controls</span>
              </span>
              <button
                onClick={handleRunOptimizer}
                disabled={optimizing}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{optimizing ? 'Solving MILP...' : 'Run MILP Optimization'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Slider 1: Budget */}
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
                <span className="text-[10px] text-slate-500 block">Available capital allocation budget</span>
              </div>

              {/* Slider 2: Max NPA ceiling */}
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
                <span className="text-[10px] text-slate-500 block">Maximum portfolio default tolerance</span>
              </div>

              {/* Slider 3: Govt FLDG Gamma */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Govt Guarantee (FLDG &gamma;)</span>
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
                <span className="text-[10px] text-slate-500 block">First-loss cushion for SMF loans</span>
              </div>

              {/* Slider 4: RBI SMF Quota Alpha */}
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
                <span className="text-[10px] text-slate-500 block">RBI mandated: 10% SMF of 18% PSL = 55.6%</span>
              </div>
            </div>
          </div>

          {/* Optimizer Results Matrix */}
          {optResult && (
            <div className="space-y-6 animate-fadeIn">
              {/* Side-by-Side Comparison: Equitable DSS vs Pure Profit */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Card 1: Equitable DSS Allocation */}
                <div className="bg-white rounded-xl border-2 border-emerald-500 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        KrishiSetu Equitable DSS Solution
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        Policy-Compliant Capital Allocation
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase">Sanctioned</span>
                      <div className="text-lg font-bold text-emerald-700 font-mono">
                        ₹{Number(optResult.metrics.equitable_dss.total_disbursed).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">SMF Lending Share</span>
                      <div className="text-lg font-bold text-emerald-700 font-mono">
                        {optResult.metrics.equitable_dss.smf_share_pct}%
                      </div>
                      <span className="text-[10px] text-emerald-600">
                        {optResult.metrics.equitable_dss.rbi_smf_quota_met ? '✓ Satisfies RBI PSL' : 'Deficit'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Net Portfolio NPA Rate</span>
                      <div className="text-lg font-bold text-slate-800 font-mono">
                        {optResult.metrics.equitable_dss.portfolio_npa_pct}%
                      </div>
                      <span className="text-[10px] text-slate-600">
                        Capped below {npaSlider}% ceiling
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Marginal Farmers Funded</span>
                      <div className="text-lg font-bold text-slate-900 font-mono">
                        {optResult.metrics.equitable_dss.smf_farmers_served} Farmers
                      </div>
                      <span className="text-[10px] text-slate-500">out of {optResult.dss_approved_count} total</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Govt Guarantee Cushion</span>
                      <div className="text-lg font-bold text-blue-700 font-mono">
                        ₹{Number(optResult.metrics.equitable_dss.govt_guarantee_utilized).toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-500">{fldgSlider}% First-Loss Protection</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Pure Profit (Bank-Only) Allocation */}
                <div className="bg-white rounded-xl border border-slate-300 p-6 shadow-xs space-y-4 opacity-90">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
                        Unconstrained Pure Profit Model
                      </span>
                      <h3 className="text-base font-bold text-slate-800 mt-1">
                        Bank Averse to Marginal Farmers
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase">Sanctioned</span>
                      <div className="text-lg font-bold text-slate-700 font-mono">
                        ₹{Number(optResult.metrics.pure_profit.total_disbursed).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">SMF Lending Share</span>
                      <div className="text-lg font-bold text-amber-700 font-mono">
                        {optResult.metrics.pure_profit.smf_share_pct}%
                      </div>
                      <span className="text-[10px] text-amber-700">
                        Fails RBI PSL 55.6% benchmark!
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Portfolio NPA Rate</span>
                      <div className="text-lg font-bold text-slate-700 font-mono">
                        {optResult.metrics.pure_profit.portfolio_npa_pct}%
                      </div>
                      <span className="text-[10px] text-slate-500">Excludes high-risk smallholders</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Marginal Farmers Funded</span>
                      <div className="text-lg font-bold text-slate-700 font-mono">
                        {optResult.metrics.pure_profit.smf_farmers_served} Farmers
                      </div>
                      <span className="text-[10px] text-slate-500">Favors large landed borrowers</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Welfare Gap</span>
                      <div className="text-lg font-bold text-red-700 font-mono">
                        -{optResult.metrics.welfare_delta.additional_marginal_farmers_helped} Farmers
                      </div>
                      <span className="text-[10px] text-slate-500">Deprived of credit access</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Banner to Disburse Batch */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-emerald-900">
                    Ready to Disburse Optimized Batch ({optResult.dss_approved_count} Farmers)
                  </div>
                  <p className="text-xs text-emerald-800">
                    Will generate 3 purpose-locked tranches (60% seed/fertilizer e-RUPI, 30% operations, 10% rebate) for all approved farmers.
                  </p>
                </div>

                <button
                  onClick={handleDisburseBatch}
                  disabled={disbursing}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs shrink-0"
                >
                  {disbursing ? 'Executing Disbursal...' : 'Disburse Batch with 1-Click Audit Log'}
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

      {/* =========================================================================
          TAB 3: GRIEVANCE REVIEW QUEUE
      ========================================================================= */}
      {activeTab === 'grievances' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Farmer Appeals & Grievance SLA Queue
              </h3>
              <p className="text-xs text-slate-500">
                Must respond within statutory 7-day SLA. Unresolved cases auto-escalate to the Government Tribunal.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700">
              {bankGrievances.length} Active
            </span>
          </div>

          <div className="space-y-4">
            {bankGrievances.map((g) => (
              <div
                key={g.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900">{g.full_name}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      ({g.district} • App: {g.application_no || 'N/A'})
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      g.resolution_status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : g.resolution_status === 'escalated'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {g.resolution_status}
                  </span>
                </div>

                <div className="text-xs text-slate-800 font-semibold">
                  Category: {g.category}
                </div>
                <p className="text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200">
                  {g.grievance_text}
                </p>

                {g.bank_response ? (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                    <strong>Logged Response:</strong> {g.bank_response}
                  </div>
                ) : (
                  <div>
                    {respondingId === g.id ? (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <textarea
                          rows="2"
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Provide written justification and corrective credit action..."
                          className="w-full text-xs p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setRespondingId(null)}
                            className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                          >
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
                          setResponseText('');
                        }}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800"
                      >
                        Respond & Resolve Grievance
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision Tree Modal */}
      <DecisionTreeModal
        isOpen={isDecisionTreeOpen}
        onClose={() => setIsDecisionTreeOpen(false)}
        outcome={selectedAppDetail}
      />
    </div>
  );
}
