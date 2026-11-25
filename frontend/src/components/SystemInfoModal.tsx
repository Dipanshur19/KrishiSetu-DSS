"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141513]/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-black/[0.08] max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#fafaf6]">
          <h3 className="text-sm font-medium text-[#141513]">Data and model evidence</h3>
          <button onClick={onClose} className="text-[#8a877d] hover:text-[#141513]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-xs text-[#5e5c55]">
          <p className="leading-relaxed">
            Synthetic borrowers and illustrative crop prices power this classroom simulation. Risk scores combine two models. SHAP factors describe the tree component.
          </p>
          {stackInfo?.synthetic_validation ? <p>Held-out synthetic profiles · {String((stackInfo.synthetic_validation as Record<string,number>).holdout)} · ROC AUC {String((stackInfo.synthetic_validation as Record<string,number>).auc)} · Brier score {String((stackInfo.synthetic_validation as Record<string,number>).brier)}</p> : null}
          {stackInfo && (
            <div className="bento-surface-soft p-4 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d]">Database:</span>
                <span className="text-[#141513]">{String(stackInfo.database_backend)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d]">Storage:</span>
                <span className="text-[#141513]">{String(stackInfo.storage_backend)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d]">Risk Model:</span>
                <span className="text-[#141513]">{String(stackInfo.ml_engine)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d]">Optimizer:</span>
                <span className="text-[#141513]">scipy.optimize.milp</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#8a877d]">Weather:</span>
                <span className="text-[#141513]">Open-Meteo or district baseline</span>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-black/[0.06] bg-[#fafaf6] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#141513] text-white rounded-full text-xs font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
