import React from 'react';
import { BookOpen, Database, Cpu, Layout, Scale, CheckCircle2, ShieldCheck, ArrowRight, Layers, Sprout } from 'lucide-react';

export default function CourseGuide() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Course Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-8 shadow-sm space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-mono font-medium">
          <span>DMS624 • IIT Kanpur • Course Project</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          KrishiSetu DSS: Computer Aided Decision System
        </h1>
        <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
          Resolving the structural conflict between <strong>Government welfare mandates</strong> (prioritizing high-risk Marginal Farmers under RBI Priority Sector Lending) and <strong>Bank risk aversion</strong> across India&apos;s ₹32.50 Lakh Crore agricultural credit ecosystem.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs">
          <div className="p-3 bg-slate-800/60 rounded-lg">
            <span className="text-slate-400 block font-semibold">1. Data Management</span>
            <span className="text-slate-200">Harmonizes Axis, SBI, & BOI into 8 normalized tables</span>
          </div>
          <div className="p-3 bg-slate-800/60 rounded-lg">
            <span className="text-slate-400 block font-semibold">2. Model Management</span>
            <span className="text-slate-200">Decision Tree, Forecast, Alternative Risk SHAP, & MILP</span>
          </div>
          <div className="p-3 bg-slate-800/60 rounded-lg">
            <span className="text-slate-400 block font-semibold">3. Dialog Subsystem</span>
            <span className="text-slate-200">3 Role-Based UIs (Farmer, Bank Officer, Govt Auditor)</span>
          </div>
        </div>
      </div>

      {/* The Central Decision Conflict */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Scale className="w-5 h-5 text-emerald-700" />
          <span>The Core Whiteboard Problem Statement & Decision Dilemma</span>
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Given a pool of agricultural funds (₹ X) and incoming farmer applications (Y farmers), how should the system evaluate risk, allocate loans equitably as per Government guidelines (specifically prioritizing Marginal Farmers holding &le; 1 hectare), verify intended agricultural usage, and allow the Government to monitor and correct imbalances?
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1.5">
            <span className="font-bold text-emerald-950 uppercase tracking-wider text-[10px]">
              Actor 1: Government
            </span>
            <div className="font-semibold text-emerald-900">Farmer Welfare & Equitable Inclusion</div>
            <p className="text-emerald-800 text-[11px]">
              Mandates 10% sub-target for Small & Marginal Farmers (55.6% of Agri PSL). Cannot rely on arbitrary cash handouts; requires verifiable usage.
            </p>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-1.5">
            <span className="font-bold text-blue-950 uppercase tracking-wider text-[10px]">
              Actor 2: Commercial Banks
            </span>
            <div className="font-semibold text-blue-900">Business Growth with Strict Risk Caps</div>
            <p className="text-blue-800 text-[11px]">
              Risk-averse; naturally tends to reject tenant/marginal farmers with no land title or thin credit history to stay below NPA ceilings.
            </p>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-1.5">
            <span className="font-bold text-amber-950 uppercase tracking-wider text-[10px]">
              Actor 3: Farmers
            </span>
            <div className="font-semibold text-amber-900">Timely Low-Cost Credit Access</div>
            <p className="text-amber-800 text-[11px]">
              Face high weather volatility, predatory informal moneylenders (36–60% interest), and opaque paperwork rejections across fragmented bank forms.
            </p>
          </div>
        </div>
      </div>

      {/* The Three Canonical DSS Subsystems */}
      <div className="space-y-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-slate-700" />
          <span>The Three Canonical DSS Subsystems (dms624.pdf)</span>
        </h2>

        {/* Subsystem 1: Data Management */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Database className="w-4 h-4 text-emerald-700" />
            <span>1. Data Management Subsystem (Harmonized Database)</span>
          </div>
          <p className="text-xs text-slate-600">
            Harmonizes the 3 disparate real-world Indian agricultural forms into 8 normalized relational tables:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <strong className="text-slate-800">Axis Bank (Kisan Power):</strong>
              <p className="text-slate-500 mt-0.5">
                Agronomic resilience signals: irrigation method (Drip/Sprinkler), farm-to-mandi distance, PMFBY insurance consent.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <strong className="text-slate-800">SBI (PM-KISAN KCC):</strong>
              <p className="text-slate-500 mt-0.5">
                Low-friction onboarding: PM-KISAN auto-fill, social security auto-debit (PMSBY/PMJJBY), allied dairy animals count.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <strong className="text-slate-800">Bank of India (Form AG-100):</strong>
              <p className="text-slate-500 mt-0.5">
                Social category (SC/ST/OBC/Women), Net Worth formula [(K + L) - M], and informal moneylender debt segregation.
              </p>
            </div>
          </div>
        </div>

        {/* Subsystem 2: Model Management */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Cpu className="w-4 h-4 text-blue-700" />
            <span>2. Model Management Subsystem (The Decision Brain)</span>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">
                A. Explainable Decision Tree (RBI & Policy Eligibility Engine)
              </div>
              <p className="text-slate-600">
                4-Step Rule Engine: 1. Land classification (acres &rarr; hectares; &le; 1 ha is Marginal) &bull; 2. Hard compliance (wilful defaulters blocked; informal debt routed to Weaker Section Debt-Swap) &bull; 3. Instrument routing (Flexi KCC ₹10k–₹50k for sharecroppers, Collateral-free up to ₹2L) &bull; 4. Scale of Finance calculation with 10% post-harvest, 20% farm upkeep, and allied dairy costs.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">
                B. Cash-Flow & Agronomic Forecast Model
              </div>
              <p className="text-slate-600">
                Predicts future repayment capacity from crop harvest rather than past collateral. Incorporates historical district yields, MSP price floors, rainfall anomalies, and irrigation multipliers. Computes Debt Service Coverage Ratio (DSCR) using MISS 4% prompt repayment rate vs 7% standard rate.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">
                C. Hybrid Credit Risk Model (Alternative Scoring + SHAP)
              </div>
              <p className="text-slate-600">
                Blends financial ratios (Debt-to-Asset M/(K+L)) with agronomic resilience (drip micro-irrigation, PMFBY insurance cuts Loss Given Default by up to 35%, dairy weekly cash flow buffer). Produces top 3 human-readable SHAP factor cards.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">
                D. Constrained Portfolio Optimizer (Solving the Govt vs. Bank Conflict)
              </div>
              <p className="text-slate-600">
                Mixed-Integer Linear Program (MILP) solved via SciPy. Maximizes equity score and return subject to: Total Fund Budget, RBI SMF Quota (&ge; 55.6%), Weaker Section Floor, Bank Portfolio NPA Ceiling, and Government First-Loss Default Guarantee (FLDG &gamma;) Budget.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">
                E. Purpose-Locked Voucher System (Fixing the Direct Pay Leakage)
              </div>
              <p className="text-slate-600">
                Tranche 1 (60%): Purpose-locked e-RUPI QR voucher redeemable solely for certified seeds and fertilizer at verified merchant POS &bull; Tranche 2 (30%): Farm operational cash transferred to UPI &bull; Tranche 3 (10%): Sowing proof verification and 3% MISS prompt repayment rebate trigger.
              </p>
            </div>
          </div>
        </div>

        {/* Subsystem 3: Dialog Subsystem */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Layout className="w-4 h-4 text-purple-700" />
            <span>3. Dialog Subsystem (3 Role-Based User Interfaces)</span>
          </div>
          <p className="text-xs text-slate-600">
            Engineered adhering to principles of progressive disclosure, low cognitive load, and clear system feedback:
          </p>
          <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
            <li><strong>Farmer UI:</strong> Mobile-first, bilingual English/Hindi, Web Speech API voice input, transparent XAI reason cards, e-RUPI voucher QR wallet, and 7-day SLA grievance tracking.</li>
            <li><strong>Bank UI:</strong> Scannable unified application dossier, visual decision tree inspector, crop revenue forecast chart, batch MILP optimizer with side-by-side comparison.</li>
            <li><strong>Government UI:</strong> Geospatial district monitoring, bank PSL compliance audit matrix, interactive policy correction sliders, and binding escalated grievance tribunal.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
