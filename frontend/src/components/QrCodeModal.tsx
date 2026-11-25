"use client";

import React, { useState } from "react";
import { X, QrCode, Store, CheckCircle, ShieldCheck, AlertCircle } from "lucide-react";
import { Merchant, Tranche } from "@/types/dss";
import { api } from "@/lib/api";

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: Tranche | null;
  merchants: Merchant[];
  onRedeemSuccess: () => void;
}

export default function QrCodeModal({
  isOpen,
  onClose,
  voucher,
  merchants,
  onRedeemSuccess,
}: QrCodeModalProps) {
  const [selectedMerchant, setSelectedMerchant] = useState(
    merchants[0]?.merchant_id || "MERCH-IFFCO-01"
  );
  const [loading, setLoading] = useState(false);
  const [redeemedMerchant, setRedeemedMerchant] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !voucher) return null;

  const isAlreadyRedeemed = voucher.status === "redeemed";

  const handleRedeem = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await api.redeemVoucher(voucher.voucher_code, selectedMerchant);
      if (data.status === "SUCCESS") {
        setRedeemedMerchant(data.merchant_name);
        onRedeemSuccess();
      } else {
        setErrorMsg(data.message || data.detail || "Redemption failed");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-emerald-700" strokeWidth={1.5} />
            <h3 className="text-base font-semibold text-slate-900">
              Purpose-Locked e-RUPI Voucher
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            NPCI e-RUPI / Purpose-Locked Agri Voucher
          </div>

          <div className="mx-auto w-48 h-48 bg-slate-900 p-3 rounded-xl shadow-md flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
              <rect x="5" y="5" width="25" height="25" rx="3" fill="none" stroke="white" strokeWidth="4" />
              <rect x="11" y="11" width="13" height="13" fill="white" />
              <rect x="70" y="5" width="25" height="25" rx="3" fill="none" stroke="white" strokeWidth="4" />
              <rect x="76" y="11" width="13" height="13" fill="white" />
              <rect x="5" y="70" width="25" height="25" rx="3" fill="none" stroke="white" strokeWidth="4" />
              <rect x="11" y="76" width="13" height="13" fill="white" />
              <rect x="36" y="8" width="6" height="6" />
              <rect x="46" y="8" width="6" height="6" />
              <rect x="56" y="8" width="6" height="6" />
              <rect x="36" y="18" width="6" height="6" />
              <rect x="50" y="24" width="6" height="6" />
              <rect x="8" y="36" width="6" height="6" />
              <rect x="18" y="44" width="6" height="6" />
              <rect x="28" y="36" width="6" height="6" />
              <rect x="38" y="38" width="24" height="24" rx="2" fill="#047857" />
              <text x="50" y="53" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">
                ₹
              </text>
              <rect x="70" y="36" width="6" height="6" />
              <rect x="80" y="44" width="6" height="6" />
              <rect x="70" y="52" width="6" height="6" />
              <rect x="86" y="52" width="6" height="6" />
              <rect x="36" y="70" width="6" height="6" />
              <rect x="46" y="76" width="6" height="6" />
              <rect x="56" y="70" width="6" height="6" />
              <rect x="70" y="72" width="6" height="6" />
              <rect x="82" y="80" width="6" height="6" />
            </svg>
          </div>

          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              ₹{Number(voucher.amount || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-xs font-mono text-slate-500 mt-0.5">
              Code: <strong className="text-slate-800">{voucher.voucher_code}</strong>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
              Locked for certified seeds, fertilizers, pesticides & soil testing at authorized merchants.
            </p>
          </div>

          {isAlreadyRedeemed || redeemedMerchant ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-left">
              <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Voucher Redeemed Successfully</span>
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                Merchant: <strong>{voucher.merchant_name || redeemedMerchant}</strong>
              </p>
              <div className="text-[11px] text-emerald-600 mt-0.5 font-mono">
                Intended Agricultural Usage Confirmed.
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-left space-y-2.5">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800">
                <Store className="w-4 h-4 text-slate-600" />
                <span>Simulate Merchant QR Redemption</span>
              </div>
              <select
                value={selectedMerchant}
                onChange={(e) => setSelectedMerchant(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 text-slate-800"
              >
                {merchants.map((m) => (
                  <option key={m.merchant_id} value={m.merchant_id}>
                    {m.name} ({m.category})
                  </option>
                ))}
              </select>

              {errorMsg && (
                <div className="text-xs text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                onClick={handleRedeem}
                disabled={loading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition-colors"
              >
                {loading ? "Processing POS Scan..." : "Scan & Redeem Voucher at Merchant POS"}
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
