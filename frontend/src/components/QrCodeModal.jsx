import React, { useState } from 'react';
import { X, QrCode, Store, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';

export default function QrCodeModal({ isOpen, onClose, voucher, onRedeemSuccess, merchants = [] }) {
  if (!isOpen || !voucher) return null;

  const [selectedMerchant, setSelectedMerchant] = useState(
    merchants[0]?.merchant_id || 'MERCH-IFFCO-01'
  );
  const [loading, setLoading] = useState(false);
  const [redeemedData, setRedeemedData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const isAlreadyRedeemed = voucher.status === 'redeemed';

  const handleRedeem = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/farmer/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucher_code: voucher.voucher_code,
          merchant_id: selectedMerchant
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'SUCCESS') {
        setRedeemedData(data);
        if (onRedeemSuccess) onRedeemSuccess(voucher.id, data);
      } else {
        setErrorMsg(data.message || data.detail || 'Redemption failed');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-semibold text-slate-900">
              Purpose-Locked e-RUPI Voucher
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            NPCI e-RUPI / Purpose-Locked Agri Voucher
          </div>

          {/* SVG QR Code Simulation */}
          <div className="mx-auto w-48 h-48 bg-slate-900 p-3 rounded-xl shadow-md flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
              {/* Corner markers */}
              <rect x="5" y="5" width="25" height="25" rx="3" fill="none" stroke="white" strokeWidth="4" />
              <rect x="11" y="11" width="13" height="13" fill="white" />
              <rect x="70" y="5" width="25" height="25" rx="3" fill="none" stroke="white" strokeWidth="4" />
              <rect x="76" y="11" width="13" height="13" fill="white" />
              <rect x="5" y="70" width="25" height="25" rx="3" fill="none" stroke="white" strokeWidth="4" />
              <rect x="11" y="76" width="13" height="13" fill="white" />

              {/* Data modules */}
              <rect x="36" y="8" width="6" height="6" />
              <rect x="46" y="8" width="6" height="6" />
              <rect x="56" y="8" width="6" height="6" />
              <rect x="36" y="18" width="6" height="6" />
              <rect x="50" y="24" width="6" height="6" />
              <rect x="8" y="36" width="6" height="6" />
              <rect x="18" y="44" width="6" height="6" />
              <rect x="28" y="36" width="6" height="6" />
              <rect x="38" y="38" width="24" height="24" rx="2" fill="#047857" />
              <text x="50" y="53" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">₹</text>
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
              ₹{Number(voucher.amount || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-xs font-mono text-slate-500 mt-0.5">
              Code: <strong className="text-slate-800">{voucher.voucher_code}</strong>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
              Locked for: Certified Seeds, Urea/Fertilizers, Pesticides & Soil Testing at Authorized Outlets.
            </p>
          </div>

          {/* Redemption simulation section */}
          {isAlreadyRedeemed || redeemedData ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-left">
              <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Voucher Redeemed Successfully</span>
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                Merchant: <strong>{voucher.merchant_name || redeemedData?.merchant_name}</strong>
              </p>
              <div className="text-[11px] text-emerald-600 mt-0.5 font-mono">
                Intended Agri Usage Confirmed & Verified.
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
                className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 text-slate-800 focus:ring-1 focus:ring-emerald-500"
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
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition-colors shadow-xs"
              >
                {loading ? 'Processing POS Scan...' : 'Scan & Redeem Voucher at Merchant POS'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
