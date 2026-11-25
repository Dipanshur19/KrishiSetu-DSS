"use client";

import React from "react";
import { X, Scale } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141513]/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-black/[0.08] max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#fafaf6]">
          <div className="flex items-center space-x-2">
            <Scale className="w-4 h-4 text-[#4d7c0f]" strokeWidth={1.5} />
            <h3 className="text-sm font-medium text-[#141513]">
              Eligibility Decision Path — {outcome.application_no}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#8a877d] hover:text-[#141513] p-1 rounded-full hover:bg-black/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-black/10">
            {steps.map((st, idx) => {
              const isPass = st.status === "PASS";
              return (
                <div key={idx} className="relative">
                  <div
                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono font-medium ring-4 ring-white ${
                      isPass ? "bg-[#141513] text-[#d4f04c]" : "bg-[#d97706] text-white"
                    }`}
                  >
                    {st.step}
                  </div>

                  <div className="bento-surface-soft p-4 ml-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#5e5c55]">
                        Step {st.step} · {st.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          isPass ? "bg-[#eef7d6] text-[#365314]" : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {st.result}
                      </span>
                    </div>
                    <p className="text-xs text-[#141513] mt-1.5 leading-relaxed">{st.details}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-[#fafaf6] border border-black/[0.06] text-center">
            <div>
              <span className="text-[11px] text-[#8a877d]">Scale of Finance</span>
              <div className="text-base font-medium text-[#141513] font-mono mt-0.5">
                ₹{Number(outcome.scale_of_finance_limit || 0).toLocaleString("en-IN")}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-[#8a877d]">Sanctioned</span>
              <div className="text-base font-medium text-[#4d7c0f] font-mono mt-0.5">
                ₹{Number(outcome.sanctioned_amount || 0).toLocaleString("en-IN")}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-[#8a877d]">MISS Interest</span>
              <div className="text-base font-medium text-[#141513] font-mono mt-0.5">4.0% p.a.</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-black/[0.06] bg-[#fafaf6] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[#141513] text-white rounded-full text-xs font-medium hover:bg-black/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
