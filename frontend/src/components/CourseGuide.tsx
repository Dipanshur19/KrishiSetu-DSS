"use client";

import React, { useEffect, useState } from "react";
import { Database, Cpu, Layout, Scale, Layers } from "lucide-react";
import { api } from "@/lib/api";

export default function CourseGuide() {
  const [stackInfo, setStackInfo] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api.getStackStatus().then(setStackInfo).catch(console.error);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-slate-900 text-white rounded-2xl p-8 space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-mono font-medium">
          <span>DMS624 • IIT Kanpur • Full Production Tech Stack</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          KrishiSetu DSS: Computer Aided Decision System
        </h1>
        <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
          Resolving the structural conflict between <strong>Government welfare mandates</strong> (prioritizing high-risk Marginal Farmers under RBI Priority Sector Lending) and <strong>Bank risk aversion</strong> across India&apos;s ₹32.50 Lakh Crore agricultural credit ecosystem.
        </p>

        {stackInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-800 text-xs">
            <div className="p-3 bg-slate-800/60 rounded-lg">
              <span className="text-slate-400 block font-semibold">Frontend</span>
              <span className="text-emerald-400 font-mono">Next.js TS + Recharts + Leaflet</span>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-lg">
              <span className="text-slate-400 block font-semibold">ML & Optimization</span>
              <span className="text-emerald-400 font-mono">{String(stackInfo.ml_engine)}</span>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-lg">
              <span className="text-slate-400 block font-semibold">Database & Storage</span>
              <span className="text-emerald-400 font-mono">{String(stackInfo.database_backend)}</span>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-lg">
              <span className="text-slate-400 block font-semibold">External APIs</span>
              <span className="text-emerald-400 font-mono">Open-Meteo Live + ICRISAT JSON</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Scale className="w-5 h-5 text-emerald-700" strokeWidth={1.5} />
          <span>The Core Whiteboard Problem Statement & Decision Dilemma</span>
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Given a pool of agricultural funds (₹ X) and incoming farmer applications (Y farmers), how should the system evaluate risk, allocate loans equitably as per Government guidelines (specifically prioritizing Marginal Farmers holding &le; 1 hectare), verify intended agricultural usage, and allow the Government to monitor and correct imbalances?
        </p>
      </div>

      <div className="space-y-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
          <span>The Three Canonical DSS Subsystems (dms624.pdf)</span>
        </h2>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Database className="w-4 h-4 text-emerald-700" />
            <span>1. Data Management Subsystem (Supabase PostgreSQL + 8 Tables)</span>
          </div>
          <p className="text-xs text-slate-600">
            Harmonizes Axis Bank (agronomic resilience), SBI (PM-KISAN & allied dairy), and Bank of India (social category & Net Worth K+L-M) into 8 normalized relational tables with RBAC and storage buckets.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Cpu className="w-4 h-4 text-blue-700" />
            <span>2. Model Management Subsystem (FastAPI + XGBoost/SHAP + SciPy MILP)</span>
          </div>
          <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1.5">
            <li><strong>/evaluate/decision-tree:</strong> 4-step RBI land classification, informal debt-swap routing, collateral waiver (&le; ₹2L), and UP SLTC Scale-of-Finance limit calculation.</li>
            <li><strong>/evaluate/forecast:</strong> Open-Meteo 14-day live rainfall integration + ICRISAT district yields + CACP MSP prices &rarr; Expected Revenue, Drought Stress, and DSCR at 4% MISS rate.</li>
            <li><strong>/evaluate/risk-score:</strong> Trained XGBoost + Logistic Regression ensemble with exact <code>shap.TreeExplainer</code> feature attributions.</li>
            <li><strong>/optimize/allocate:</strong> Mixed-Integer Linear Program via <code>scipy.optimize.milp</code> maximizing equity & return under RBI SMF quota, NPA ceiling, and Govt FLDG budget.</li>
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Layout className="w-4 h-4 text-amber-700" />
            <span>3. Dialog Subsystem (Next.js TypeScript + Recharts + Leaflet)</span>
          </div>
          <p className="text-xs text-slate-600">
            3 Role-Based UIs (Farmer, Bank, Government) featuring bilingual Hindi/English i18n, Web Speech API voice input, Recharts analytical dashboards, and an interactive Leaflet district geospatial map.
          </p>
        </div>
      </div>
    </div>
  );
}
