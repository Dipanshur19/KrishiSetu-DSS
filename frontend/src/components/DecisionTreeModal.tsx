"use client";

import React from "react";
import { X, ShieldCheck, Scale } from "lucide-react";
import { FarmerApplicationOutcome } from "@/types/dss";

interface DecisionTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  outcome: FarmerApplicationOutcome | null;
}

export default function DecisionTreeModal({ isOpen, onClose, outcome }: DecisionTreeModalProps) {
  if (!isOpen || !outcome) return null;

  const steps = outcome.decision_tree_path || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Scale className="w-5 h-5 text-emerald-700" strokeWidth={1.5} />
            <h3 className="text-base font-semibold text-slate-900">
              RBI & Policy Eligibility Engine: Decision Tree Execution Path
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-900">
                Classification: {outcome.farmer_classification} Farmer • Instrument: {outcome.facility_type}
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Evaluated against UP SLTC Scale-of-Finance JSON, RBI Priority Sector Lending (PSL) & MISS rules.
              </p>
            </div>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {steps.map((st, idx) => {
              const isPass = st.status === "PASS";
              return (
                <div key={idx} className="relative">
                  <div
                    className={`absolute -left-6 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                      isPass ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                    }`}
                  >
                    {st.step}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 ml-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 font-mono">
                        Step {st.step}: {st.name}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          isPass ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {st.result}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-800 mt-1.5">{st.details}</p>

                    {st.data && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex flex-wrap gap-2 text-xs text-slate-600">
                        {Object.entries(st.data).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 bg-white rounded border border-slate-200 font-mono">
                            {k}: <strong className="text-slate-900">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-100 rounded-lg border border-slate-200 text-center">
            <div>
              <span className="text-xs text-slate-500">Scale of Finance Limit</span>
              <div className="text-lg font-bold text-slate-900 font-mono">
                ₹{Number(outcome.scale_of_finance_limit || 0).toLocaleString("en-IN")}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Sanctioned Amount</span>
              <div className="text-lg font-bold text-emerald-700 font-mono">
                ₹{Number(outcome.sanctioned_amount || 0).toLocaleString("en-IN")}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Effective Interest (MISS)</span>
              <div className="text-lg font-bold text-blue-700 font-mono">4.0% p.a.</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
