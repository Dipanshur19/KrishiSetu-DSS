"use client";

import React, { useEffect, useState } from "react";
import { X, Cpu, Database, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

interface SystemInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SystemInfoModal({ isOpen, onClose }: SystemInfoModalProps) {
  const [stackInfo, setStackInfo] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getStackStatus().then(setStackInfo).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const val = stackInfo?.synthetic_validation as Record<string, unknown> | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141513]/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-black/[0.08] max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#fafaf6]">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-[#4d7c0f]" strokeWidth={1.5} />
            <h3 className="text-sm font-medium text-[#141513]">Data & Model Methodology</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#8a877d] hover:text-[#141513] p-1 rounded-full hover:bg-black/[0.05]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-[#5e5c55]">
          <p className="leading-relaxed">
            Synthetic borrower profiles and illustrative crop parameters power this classroom simulation. Risk scoring blends XGBoost with Logistic Regression, and Tree SHAP explains tree log-odds contributions.
          </p>

          {val && (
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bento-surface-soft p-3">
                <div className="text-[11px] text-[#8a877d]">Holdout Sample</div>
                <div className="font-mono font-medium text-[#141513] text-sm mt-0.5">
                  {String(val.holdout)}
                </div>
              </div>
              <div className="bento-surface-soft p-3">
                <div className="text-[11px] text-[#8a877d]">ROC AUC</div>
                <div className="font-mono font-medium text-[#4d7c0f] text-sm mt-0.5">
                  {String(val.auc)}
                </div>
              </div>
              <div className="bento-surface-soft p-3">
                <div className="text-[11px] text-[#8a877d]">Brier Score</div>
                <div className="font-mono font-medium text-[#141513] text-sm mt-0.5">
                  {String(val.brier)}
                </div>
              </div>
            </div>
          )}

          {stackInfo && (
            <div className="bento-surface-soft p-4 space-y-2.5 font-mono text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Database
                </span>
                <span className="text-[#141513]">{String(stackInfo.database_backend)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Evidence Store
                </span>
                <span className="text-[#141513]">{String(stackInfo.storage_backend)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d]">Risk Ensemble</span>
                <span className="text-[#141513] text-right">{String(stackInfo.ml_engine)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d]">Optimizer</span>
                <span className="text-[#141513]">scipy.optimize.milp</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d]">Weather Feed</span>
                <span className="text-[#141513]">Open-Meteo or district baseline</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-black/[0.06] bg-[#fafaf6] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[#141513] text-white rounded-full text-xs font-medium hover:bg-black/85"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
