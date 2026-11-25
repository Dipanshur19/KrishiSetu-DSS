"use client";

import React, { useState } from "react";
import { X, QrCode, Store, CheckCircle, AlertCircle } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141513]/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-black/[0.08] max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#fafaf6]">
          <div className="flex items-center space-x-2">
            <QrCode className="w-4 h-4 text-[#4d7c0f]" strokeWidth={1.5} />
            <h3 className="text-sm font-medium text-[#141513]">Input Voucher (e-RUPI)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#8a877d] hover:text-[#141513] p-1 rounded-full hover:bg-black/[0.05]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div className="mx-auto w-44 h-44 bg-[#141513] p-3 rounded-2xl flex items-center justify-center">
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
              <rect x="38" y="38" width="24" height="24" rx="4" fill="#b8e354" />
              <text x="50" y="54" textAnchor="middle" fill="#141513" fontSize="10" fontWeight="bold">
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
            <div className="text-2xl font-medium text-[#141513] font-mono">
              ₹{Number(voucher.amount || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-xs font-mono text-[#8a877d] mt-0.5">{voucher.voucher_code}</div>
            <p className="text-xs text-[#5e5c55] mt-1">
              Valid for certified seeds, fertilizers & agricultural inputs.
            </p>
          </div>

          {isAlreadyRedeemed || redeemedMerchant ? (
            <div className="p-3.5 bg-[#eef7d6] border border-[#b8e354]/60 rounded-xl text-left">
              <div className="flex items-center space-x-2 text-[#365314] font-medium text-xs">
                <CheckCircle className="w-4 h-4" />
                <span>Redeemed at {voucher.merchant_name || redeemedMerchant}</span>
              </div>
            </div>
          ) : (
            <div className="bento-surface-soft p-3.5 text-left space-y-2.5">
              <div className="flex items-center space-x-1.5 text-xs font-medium text-[#141513]">
                <Store className="w-3.5 h-3.5 text-[#5e5c55]" strokeWidth={1.5} />
                <span>Verify Merchant POS Scan</span>
              </div>
              <select
                value={selectedMerchant}
                onChange={(e) => setSelectedMerchant(e.target.value)}
                className="w-full text-xs bg-white border border-black/10 rounded-lg p-2 text-[#141513]"
              >
                {merchants.map((m) => (
                  <option key={m.merchant_id} value={m.merchant_id}>
                    {m.name}
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
                className="w-full py-2 bg-[#141513] hover:bg-black/85 text-white rounded-full text-xs font-medium transition-colors"
              >
                {loading ? "Verifying..." : "Scan & Redeem"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
