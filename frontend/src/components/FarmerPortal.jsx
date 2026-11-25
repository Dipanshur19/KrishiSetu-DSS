import React, { useState, useEffect } from 'react';
import {
  Sprout, CheckCircle2, AlertTriangle, ShieldCheck, QrCode, FileText,
  Mic, MicOff, ArrowRight, ArrowLeft, RefreshCw, Upload, Check,
  Clock, MapPin, DollarSign, HelpCircle, AlertCircle, Info, Landmark
} from 'lucide-react';
import DecisionTreeModal from './DecisionTreeModal';
import QrCodeModal from './QrCodeModal';

export default function FarmerPortal({ demoUser, lang = 'en', onSelectApplication }) {
  const [activeTab, setActiveTab] = useState('apply'); // apply | outcome | wallet | grievances
  const [wizardStep, setWizardStep] = useState(1);
  const [isListening, setIsListening] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    full_name: 'Ram Charan Yadav',
    phone: '9876543210',
    pmkisan_id: 'UP102938475',
    gender: 'M',
    social_category: 'OBC',
    district: 'Kanpur Dehat',
    village: 'Akbarpur',
    survey_khasra_no: '342/2',
    ownership_type: 'owned', // owned, registered_lease, oral_lease, sharecropper
    area_acres: 1.5,
    irrigation_source: 'Drip', // Drip, Sprinkler, Canal, Well, Dry
    distance_to_mandi_km: 7.0,
    livestock_count: 2,
    movable_asset_k: 80000,
    immovable_asset_l: 300000,
    existing_debt: 0,
    is_informal_debt_only: false,
    facility_type: 'Crop KCC',
    requested_amount: 60000,
    primary_crop: 'Wheat',
    secondary_crop: 'Mustard',
    marketing_tieup: 'Cooperative',
    pmfby_optin: true,
    bank_assigned: 'State Bank of India'
  });

  // Live estimate state
  const [estimate, setEstimate] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);

  // Outcome state
  const [outcomeAppId, setOutcomeAppId] = useState(1);
  const [outcome, setOutcome] = useState(null);
  const [loadingOutcome, setLoadingOutcome] = useState(false);

  // Modals
  const [isDecisionTreeOpen, setIsDecisionTreeOpen] = useState(false);
  const [activeVoucherModal, setActiveVoucherModal] = useState(null);
  const [merchantsList, setMerchantsList] = useState([]);

  // Grievance form
  const [grievanceCategory, setGrievanceCategory] = useState('Collateral demanded under 2L');
  const [grievanceText, setGrievanceText] = useState('');
  const [grievancesList, setGrievancesList] = useState([]);
  const [grievanceSuccess, setGrievanceSuccess] = useState('');

  // Sowing proof verification state
  const [sowingUploading, setSowingUploading] = useState(false);
  const [sowingSuccess, setSowingSuccess] = useState('');

  // Fetch scale of finance and merchants
  useEffect(() => {
    fetch('/api/system/scale-of-finance')
      .then((r) => r.json())
      .then((d) => {
        if (d.merchants) setMerchantsList(d.merchants);
      })
      .catch(console.error);
  }, []);

  // Fetch initial outcome
  useEffect(() => {
    loadOutcome(outcomeAppId);
  }, [outcomeAppId]);

  const loadOutcome = (id) => {
    setLoadingOutcome(true);
    fetch(`/api/farmer/applications/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setOutcome(data);
        if (data.grievances) setGrievancesList(data.grievances);
      })
      .catch(console.error)
      .finally(() => setLoadingOutcome(false));
  };

  // Live Eligibility Estimator
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEstimating(true);
      fetch('/api/farmer/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_acres: parseFloat(formData.area_acres) || 1.0,
          primary_crop: formData.primary_crop,
          ownership_type: formData.ownership_type,
          livestock_count: parseInt(formData.livestock_count) || 0,
          marketing_tieup: formData.marketing_tieup,
          district: formData.district,
          requested_amount: parseFloat(formData.requested_amount) || 50000
        })
      })
        .then((r) => r.json())
        .then((data) => setEstimate(data))
        .catch(console.error)
        .finally(() => setIsEstimating(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [
    formData.area_acres,
    formData.primary_crop,
    formData.ownership_type,
    formData.livestock_count,
    formData.marketing_tieup,
    formData.district,
    formData.requested_amount
  ]);

  // Voice input handling using Web Speech API
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (wizardStep === 1) {
        setFormData((prev) => ({ ...prev, full_name: transcript }));
      } else if (wizardStep === 2) {
        // Simple numeric extraction
        const num = parseFloat(transcript.replace(/[^0-9.]/g, ''));
        if (num) setFormData((prev) => ({ ...prev, area_acres: num }));
      }
    };
    recognition.start();
  };

  const handleApplicationSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/farmer/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        setOutcomeAppId(data.application_id);
        loadOutcome(data.application_id);
        setActiveTab('outcome');
      }
    } catch (err) {
      alert('Application failed: ' + err.message);
    }
  };

  const handleSowingProof = async (trancheId) => {
    setSowingUploading(true);
    setSowingSuccess('');
    try {
      const res = await fetch('/api/farmer/tranches/verify-sowing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tranche_id: trancheId,
          geo_lat: 26.4499,
          geo_long: 80.3319,
          geo_proof_photo: 'crop_sowing_khasra_proof.jpg'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSowingSuccess(data.message);
        loadOutcome(outcomeAppId);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSowingUploading(false);
    }
  };

  const handleGrievanceSubmit = async (e) => {
    e.preventDefault();
    if (!grievanceText) return;
    try {
      const res = await fetch('/api/farmer/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: outcomeAppId,
          farmer_id: outcome?.farmer_id || 1,
          category: grievanceCategory,
          grievance_text: grievanceText,
          supporting_doc: 'khasra_map_proof.pdf'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setGrievanceSuccess(data.message);
        setGrievanceText('');
        loadOutcome(outcomeAppId);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Sub-header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Sprout className="w-6 h-6 text-emerald-600" />
            <span>{lang === 'hi' ? 'किसान क्रेडिट एवं कल्याण पोर्टल' : 'Kisan Credit & Welfare Portal'}</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {lang === 'hi'
              ? 'सरल 4-चरणीय आवेदन, वास्तविक-समय निर्णय एवं डिजिटल खाद-बीज वाउचर'
              : 'Low-friction 4-step progressive credit access, instant decision explanation & digital vouchers'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('apply')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'apply'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'hi' ? '१. नया आवेदन' : '1. New Application'}
          </button>
          <button
            onClick={() => setActiveTab('outcome')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'outcome'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'hi' ? '२. परिणाम व कारण' : '2. Decision Outcome'}
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'wallet'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'hi' ? '३. वाउचर वॉलेट (e-RUPI)' : '3. e-RUPI Vouchers'}
          </button>
          <button
            onClick={() => setActiveTab('grievances')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'grievances'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'hi' ? '४. शिकायत व अपील' : '4. Appeals & Grievances'}
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: 4-STEP LOW-FRICTION APPLICATION WIZARD
      ========================================================================= */}
      {activeTab === 'apply' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Wizard Form (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            {/* Step Progress Indicator */}
            <div className="mb-6 pb-4 border-b border-slate-200">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span>Step {wizardStep} of 4</span>
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    isListening
                      ? 'bg-red-100 text-red-700 animate-pulse'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Speak to enter data"
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5 text-red-600" /> : <Mic className="w-3.5 h-3.5 text-slate-600" />}
                  <span>{isListening ? (lang === 'hi' ? 'सुन रहा हूँ...' : 'Listening...') : (lang === 'hi' ? 'बोलकर भरें (Voice)' : 'Voice Input')}</span>
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 transition-all duration-300"
                  style={{ width: `${(wizardStep / 4) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 mt-2 text-[11px] text-slate-500 text-center font-medium">
                <span className={wizardStep === 1 ? 'text-emerald-700 font-bold' : ''}>1. PM-KISAN KYC</span>
                <span className={wizardStep === 2 ? 'text-emerald-700 font-bold' : ''}>2. Land & Crops</span>
                <span className={wizardStep === 3 ? 'text-emerald-700 font-bold' : ''}>3. Net Worth</span>
                <span className={wizardStep === 4 ? 'text-emerald-700 font-bold' : ''}>4. Review & Apply</span>
              </div>
            </div>

            <form onSubmit={handleApplicationSubmit}>
              {/* STEP 1: Basic & PM-KISAN auto-fill */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start space-x-2">
                    <Info className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                    <span>
                      {lang === 'hi'
                        ? 'PM-KISAN लाभार्थी आईडी दर्ज करें; आधार ई-केवाईसी और पता स्वतः प्राप्त हो जाएगा (SBI 1-पृष्ठ मॉडल)।'
                        : 'Enter PM-KISAN ID to pre-fetch verified Aadhaar eKYC and demographics (SBI lean 1-page form).'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        PM-KISAN / AgriStack ID
                      </label>
                      <input
                        type="text"
                        value={formData.pmkisan_id}
                        onChange={(e) => setFormData({ ...formData, pmkisan_id: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono"
                        placeholder="e.g. UP102938475"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Farmer Full Name
                      </label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mobile Phone Number
                      </label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Social Category (PSL Weaker Section)
                      </label>
                      <select
                        value={formData.social_category}
                        onChange={(e) => setFormData({ ...formData, social_category: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="OBC">OBC (Other Backward Class)</option>
                        <option value="SC">SC (Scheduled Caste)</option>
                        <option value="ST">ST (Scheduled Tribe)</option>
                        <option value="Women">Women SHG Member</option>
                        <option value="Minority">Minority</option>
                        <option value="PWD">PWD (Person with Disability)</option>
                        <option value="GEN">General</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        District
                      </label>
                      <select
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="Kanpur Dehat">Kanpur Dehat</option>
                        <option value="Kanpur Nagar">Kanpur Nagar</option>
                        <option value="Unnao">Unnao</option>
                        <option value="Jhansi">Jhansi (Bundelkhand Zone)</option>
                        <option value="Lucknow">Lucknow</option>
                        <option value="Barabanki">Barabanki</option>
                        <option value="Fatehpur">Fatehpur</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Village / Panchayat
                      </label>
                      <input
                        type="text"
                        value={formData.village}
                        onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Land details & Cropping pattern */}
              {wizardStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Survey / Khasra Plot No.
                      </label>
                      <input
                        type="text"
                        value={formData.survey_khasra_no}
                        onChange={(e) => setFormData({ ...formData, survey_khasra_no: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono"
                        placeholder="e.g. 342/2"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Total Operational Area (Acres)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        value={formData.area_acres}
                        onChange={(e) => setFormData({ ...formData, area_acres: parseFloat(e.target.value) || 0.1 })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono"
                        required
                      />
                      <span className="text-[11px] text-slate-500">
                        = {(formData.area_acres / 2.471).toFixed(2)} Hectares (
                        {formData.area_acres / 2.471 <= 1.0
                          ? 'Marginal Farmer ≤ 1 ha'
                          : formData.area_acres / 2.471 <= 2.0
                          ? 'Small Farmer ≤ 2 ha'
                          : 'Medium/Large Farmer'}
                        )
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Land Ownership Type
                      </label>
                      <select
                        value={formData.ownership_type}
                        onChange={(e) => setFormData({ ...formData, ownership_type: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="owned">Owned Land (Title Holder)</option>
                        <option value="registered_lease">Registered Lease Agreement</option>
                        <option value="oral_lease">Oral Lessee (Panchayat Certificate)</option>
                        <option value="sharecropper">Sharecropper (Bataidar with Affidavit)</option>
                      </select>
                      {['oral_lease', 'sharecropper'].includes(formData.ownership_type) && (
                        <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                          ✓ Eligible for Flexi KCC (₹10k–₹50k) without land mortgage under RBI 2026 norms.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Irrigation Method
                      </label>
                      <select
                        value={formData.irrigation_source}
                        onChange={(e) => setFormData({ ...formData, irrigation_source: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="Drip">Drip Irrigation (1.25x Yield & Drought Resilient)</option>
                        <option value="Sprinkler">Sprinkler Irrigation (1.15x Yield)</option>
                        <option value="Canal">Canal / Government Gravity Flow</option>
                        <option value="Well">Tubewell / Private Borewell</option>
                        <option value="Dry">Dry / Rainfed (Monsoon Dependent)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Crop (Current Season)
                      </label>
                      <select
                        value={formData.primary_crop}
                        onChange={(e) => setFormData({ ...formData, primary_crop: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="Wheat">Wheat (Rabi - SoF ₹24,000/acre)</option>
                        <option value="Paddy">Paddy / Rice (Kharif - SoF ₹26,000/acre)</option>
                        <option value="Potato">Potato (Cash Crop - SoF ₹42,000/acre)</option>
                        <option value="Mustard">Mustard (Oilseed - SoF ₹18,000/acre)</option>
                        <option value="Sugarcane">Sugarcane (Annual - SoF ₹48,000/acre)</option>
                        <option value="Gram">Gram / Chana (Pulse - SoF ₹20,000/acre)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Allied Milch Animals (Cows / Buffaloes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={formData.livestock_count}
                        onChange={(e) => setFormData({ ...formData, livestock_count: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                      <span className="text-[11px] text-slate-500">
                        +₹35,000 RBI Allied KCC limit per milch animal
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Net Worth (K + L - M formula from BOI AG-100) */}
              {wizardStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                    <strong>Bank of India (AG-100) Net Worth Formula:</strong> Net Worth = [Movable Assets (K) + Immovable Land (L)] - Existing Liabilities (M).
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Movable Assets Value (K) — Livestock, Equipment (₹)
                      </label>
                      <input
                        type="number"
                        step="5000"
                        value={formData.movable_asset_k}
                        onChange={(e) => setFormData({ ...formData, movable_asset_k: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Immovable Land / House Value (L) (₹)
                      </label>
                      <input
                        type="number"
                        step="25000"
                        value={formData.immovable_asset_l}
                        onChange={(e) => setFormData({ ...formData, immovable_asset_l: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Existing Debt Outstanding (M) (₹)
                      </label>
                      <input
                        type="number"
                        step="5000"
                        value={formData.existing_debt}
                        onChange={(e) => setFormData({ ...formData, existing_debt: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_informal_debt_only}
                          onChange={(e) => setFormData({ ...formData, is_informal_debt_only: e.target.checked })}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Is this debt purely to informal moneylenders/sahukars?</span>
                      </label>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-slate-600">Calculated Net Worth [(K + L) - M]:</span>
                    <strong className="text-slate-900 font-mono text-sm">
                      ₹{(formData.movable_asset_k + formData.immovable_asset_l - formData.existing_debt).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              )}

              {/* STEP 4: Facility, Insurance, Marketing Tie-up */}
              {wizardStep === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Loan Facility Requested
                      </label>
                      <select
                        value={formData.facility_type}
                        onChange={(e) => setFormData({ ...formData, facility_type: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="Crop KCC">Crop KCC (Short-term production credit)</option>
                        <option value="Flexi KCC">Flexi KCC (₹10,000–₹50,000 for tenant/marginal)</option>
                        <option value="Allied KCC">Allied KCC (Dairy & Fisheries)</option>
                        <option value="Agri Term Loan">Agri Term Loan (Machinery/Equipment)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Loan Amount Requested (₹)
                      </label>
                      <input
                        type="number"
                        step="5000"
                        value={formData.requested_amount}
                        onChange={(e) => setFormData({ ...formData, requested_amount: parseFloat(e.target.value) || 10000 })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-emerald-800"
                        required
                      />
                      <span className="text-[11px] text-slate-500">
                        {formData.requested_amount <= 200000
                          ? '✓ Within RBI ₹2.00 Lakh Collateral-Free limit'
                          : 'Requires Land Hypothecation / Collateral'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Marketing Offtake Tie-Up (Axis Bank resilience signal)
                      </label>
                      <select
                        value={formData.marketing_tieup}
                        onChange={(e) => setFormData({ ...formData, marketing_tieup: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="Cooperative">Dairy/Sugar Cooperative (e.g. Parag/IFFCO)</option>
                        <option value="Government_Procurement">Government MSP Procurement Portal</option>
                        <option value="Corporate_Contract">Corporate Offtake Contract (FPO/ITC)</option>
                        <option value="Direct">Direct Sale at Mandi</option>
                        <option value="None">No Formal Tie-Up</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Assigned Commercial Bank Branch
                      </label>
                      <select
                        value={formData.bank_assigned}
                        onChange={(e) => setFormData({ ...formData, bank_assigned: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="State Bank of India">State Bank of India (Lead Bank)</option>
                        <option value="Bank of India">Bank of India</option>
                        <option value="Punjab National Bank">Punjab National Bank</option>
                        <option value="Bank of Baroda">Bank of Baroda</option>
                        <option value="Axis Bank">Axis Bank</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                    <label className="flex items-center space-x-2 text-xs text-emerald-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.pmfby_optin}
                        onChange={(e) => setFormData({ ...formData, pmfby_optin: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold">
                        Enroll in PMFBY Crop Insurance (Modified Interest Subvention Scheme requirement)
                      </span>
                    </label>
                    <p className="text-[11px] text-emerald-800 ml-6">
                      Cuts loan default risk by up to 35% and protects against drought / unseasonal rains.
                    </p>
                  </div>
                </div>
              )}

              {/* Wizard Navigation Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="flex items-center space-x-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                ) : <div />}

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <span>Next: {wizardStep === 1 ? 'Land Details' : wizardStep === 2 ? 'Net Worth' : 'Loan Review'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit & Run Decision Engine</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right Sidebar: Real-Time Scale-of-Finance Estimator */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1">
                <Landmark className="w-3.5 h-3.5 text-emerald-700" />
                <span>Live Scale-of-Finance Estimator</span>
              </span>
              {isEstimating && <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
            </div>

            {estimate ? (
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500">RBI Farmer Classification</span>
                  <div className="text-base font-bold text-slate-900">
                    {estimate.farmer_classification} Farmer
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Priority Sector Lending (PSL) 10% Sub-Target
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500">Eligible Scale-of-Finance Credit Limit</span>
                  <div className="text-xl font-bold text-emerald-700 font-mono">
                    ₹{Number(estimate.scale_of_finance_limit || 0).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Includes Base Crop + 10% Post-Harvest + 20% Farm Maintenance + Dairy
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500">Recommended Facility</span>
                  <div className="text-sm font-bold text-slate-800">
                    {estimate.recommended_instrument}
                  </div>
                  <span className="text-[11px] text-slate-600">
                    Collateral Required: <strong>{estimate.collateral_required ? 'Yes' : 'No (Waived)'}</strong>
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="flex justify-between">
                    <span>MISS Base Interest:</span>
                    <span className="font-mono line-through text-slate-400">7.0% p.a.</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>Prompt Repayment Incentive (3%):</span>
                    <span className="font-mono text-emerald-700">-3.0%</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-emerald-200 text-sm">
                    <span>Effective Farmer Rate:</span>
                    <span className="font-mono text-emerald-900">4.0% p.a.</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-100 p-2.5 rounded border border-slate-200">
                  Forecasted Debt Service Coverage Ratio (DSCR):{' '}
                  <strong className="text-slate-900 font-mono">{estimate.dscr_ratio}x</strong>
                  <br />
                  Expected Crop Revenue: ₹{Number(estimate.expected_crop_revenue || 0).toLocaleString('en-IN')}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Calculating eligibility parameters...
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DECISION OUTCOME DOSSIER & EXPLAINABLE AI
      ========================================================================= */}
      {activeTab === 'outcome' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick select application banner */}
          <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Viewing Application:</span>
              <span className="font-mono font-bold text-emerald-800">{outcome?.application_no || 'Loading...'}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                {outcome?.farmer_classification} Farmer
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-500">Demo Apps:</span>
              <button
                onClick={() => setOutcomeAppId(1)}
                className="px-2 py-1 bg-white hover:bg-slate-200 border rounded text-xs"
              >
                Ram Charan (Wheat)
              </button>
              <button
                onClick={() => setOutcomeAppId(2)}
                className="px-2 py-1 bg-white hover:bg-slate-200 border rounded text-xs"
              >
                Sunita Devi (Flexi)
              </button>
              <button
                onClick={() => setOutcomeAppId(3)}
                className="px-2 py-1 bg-white hover:bg-slate-200 border rounded text-xs"
              >
                Kallu Ram (Debt-Swap)
              </button>
            </div>
          </div>

          {loadingOutcome ? (
            <div className="p-12 text-center text-slate-500">Loading evaluation dossier...</div>
          ) : outcome ? (
            <div className="space-y-6">
              {/* Status Header Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      SANCTION APPROVED
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Ref: {outcome.application_no}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Sanctioned: ₹{Number(outcome.sanctioned_amount || 0).toLocaleString('en-IN')}
                  </h2>
                  <p className="text-xs text-slate-600">
                    Facility: <strong>{outcome.facility_type}</strong> • Bank: <strong>{outcome.bank_assigned}</strong> • Effective Rate: <strong className="text-emerald-700">4.0% p.a. (MISS)</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setIsDecisionTreeOpen(true)}
                    className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Inspect Decision Tree Path</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('wallet')}
                    className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View e-RUPI Vouchers ({outcome.tranches?.length || 0})</span>
                  </button>
                </div>
              </div>

              {/* Explainable AI (XAI) Reason Cards */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Explainable AI (XAI) Evaluation Breakdown & Credit Rationale</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {outcome.shap_reasons?.map((item, idx) => {
                    const isPositive = item.direction === 'RISK_DECREASE';
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          isPositive
                            ? 'bg-emerald-50/60 border-emerald-200'
                            : 'bg-amber-50/60 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className={isPositive ? 'text-emerald-900' : 'text-amber-900'}>
                            {item.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                              isPositive ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                            }`}
                          >
                            {isPositive ? '' : '+'}{item.delta_pd_pct}% Risk
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1">{item.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actionable Advice Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3 text-xs text-slate-700">
                <Info className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <span className="font-semibold text-slate-900">
                    Actionable Guidance to Further Boost Eligibility Score:
                  </span>
                  <p>
                    {outcome.farmer_classification === 'Marginal'
                      ? 'Adding 1-2 milch animals (dairy cows/buffaloes) or registering a micro-irrigation drip certificate can increase your seasonal repayment buffer by +22%, reducing your risk spread.'
                      : 'Timely repayment of this KCC cycle within 12 months guarantees a 10% credit limit step-up for the next season under RBI KCC Directions 2026.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* =========================================================================
          TAB 3: PURPOSE-LOCKED DIGITAL VOUCHER WALLET (e-RUPI)
      ========================================================================= */}
      {activeTab === 'wallet' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-emerald-900 text-white rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                <QrCode className="w-4 h-4" />
                <span>e-RUPI & Purpose-Locked Disbursal Wallet</span>
              </div>
              <h2 className="text-xl font-bold mt-1">
                3-Tranche Capital Protection Framework
              </h2>
              <p className="text-xs text-emerald-200 mt-0.5 max-w-xl">
                Solves the &ldquo;Direct Pay&rdquo; problem. Ensures funds are utilized strictly for certified agricultural inputs, farm operations, and confirmed crop sowing.
              </p>
            </div>

            <div className="bg-emerald-950/70 p-3 rounded-lg border border-emerald-800 text-right">
              <span className="text-[11px] text-emerald-300">Sanction Total</span>
              <div className="text-lg font-bold text-white font-mono">
                ₹{Number(outcome?.sanctioned_amount || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Tranches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {outcome?.tranches?.map((tranche) => {
              const isLocked = tranche.status === 'locked';
              const isRedeemed = tranche.status === 'redeemed';
              const isDisbursed = tranche.status === 'disbursed';

              return (
                <div
                  key={tranche.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 font-mono">
                        TRANCHE {tranche.tranche_no} ({tranche.percentage}%)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          isRedeemed
                            ? 'bg-emerald-100 text-emerald-800'
                            : isDisbursed
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {tranche.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{tranche.tranche_name}</h4>
                      <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                        ₹{Number(tranche.amount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600">
                      {tranche.tranche_no === 1
                        ? 'Purpose-locked digital voucher redeemable solely for certified seeds & fertilizer at verified merchant POS.'
                        : tranche.tranche_no === 2
                        ? 'Liquid cash credit transferred directly to farmer savings/UPI for labor wages and irrigation pumping.'
                        : '10% incentive reserve. Unlocked upon submitting geo-tagged crop sowing photograph or Digital Crop Survey confirmation.'}
                    </p>

                    {tranche.voucher_code && (
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-xs font-mono text-slate-700">
                        Code: <strong>{tranche.voucher_code}</strong>
                      </div>
                    )}

                    {tranche.merchant_name && (
                      <div className="text-xs text-emerald-700 font-medium">
                        Redeemed at: <strong>{tranche.merchant_name}</strong>
                      </div>
                    )}
                  </div>

                  {/* Action Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200">
                    {tranche.tranche_no === 1 && (
                      <button
                        onClick={() => setActiveVoucherModal(tranche)}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{isRedeemed ? 'View Redemption Proof' : 'Open e-RUPI QR Code'}</span>
                      </button>
                    )}

                    {tranche.tranche_no === 2 && (
                      <div className="text-center text-xs text-slate-500 font-medium py-1">
                        ✓ Disbursed via UPI / Direct Account Credit
                      </div>
                    )}

                    {tranche.tranche_no === 3 && (
                      <div>
                        {isDisbursed ? (
                          <div className="text-center text-xs text-emerald-700 font-semibold py-1">
                            ✓ Sowing Verified • 3% Rebate Active
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSowingProof(tranche.id)}
                            disabled={sowingUploading}
                            className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{sowingUploading ? 'Verifying Proof...' : 'Upload Geo-Tagged Sowing Proof'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {sowingSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{sowingSuccess}</span>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: GRIEVANCES & STATUTORY 7-DAY SLA PORTAL
      ========================================================================= */}
      {activeTab === 'grievances' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* File New Grievance (1 Col) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>File Grievance / Appeal</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory 7-day bank SLA. Auto-escalates to Government Tribunal if unanswered.
              </p>
            </div>

            <form onSubmit={handleGrievanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Grievance Category
                </label>
                <select
                  value={grievanceCategory}
                  onChange={(e) => setGrievanceCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="Collateral demanded under 2L">Collateral Demanded Under ₹2 Lakh</option>
                  <option value="Delayed disbursal >14 days">Delayed Disbursal Past 14 Days</option>
                  <option value="Incorrect land area">Incorrect Land Holding / Khasra Error</option>
                  <option value="Unfair rejection">Unfair Rejection of Flexi KCC / Sharecropper</option>
                  <option value="Other">Other Operational Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description of Issue
                </label>
                <textarea
                  rows="4"
                  value={grievanceText}
                  onChange={(e) => setGrievanceText(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500"
                  placeholder="Detail the branch conduct or documentation discrepancy..."
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Attachment: <strong>khasra_extract_proof.pdf</strong> (Auto-attached)</span>
              </div>

              {grievanceSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                  {grievanceSuccess}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              >
                Submit Grievance to Bank & Govt Auditor
              </button>
            </form>
          </div>

          {/* Grievances List & SLA Tracker (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Active Grievances & Live SLA Timers
                </h3>
                <p className="text-xs text-slate-500">
                  Direct audit line connecting Farmer, Bank Branch, and Government Directorate
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-slate-100 rounded text-slate-700 font-mono">
                {grievancesList.length} Registered
              </span>
            </div>

            {grievancesList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No active grievances registered for this farmer.
              </div>
            ) : (
              <div className="space-y-4">
                {grievancesList.map((g) => {
                  const isEscalated = g.resolution_status === 'escalated';
                  const isResolved = g.resolution_status === 'resolved';

                  return (
                    <div
                      key={g.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900">{g.category}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                              isResolved
                                ? 'bg-emerald-100 text-emerald-800'
                                : isEscalated
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {g.resolution_status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-slate-500 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Filed: {new Date(g.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700">{g.grievance_text}</p>

                      {g.bank_response && (
                        <div className="p-3 bg-white border border-slate-200 rounded text-xs space-y-1">
                          <strong className="text-slate-800">Bank Response:</strong>
                          <p className="text-slate-600">{g.bank_response}</p>
                        </div>
                      )}

                      {g.govt_directive && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-900 font-medium">
                          <strong>Binding Government Directive:</strong> {g.govt_directive}
                        </div>
                      )}

                      {!isResolved && (
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 pt-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>
                            {isEscalated
                              ? 'Exceeded 7-day SLA: Escalated to State Government Tribunal for binding order.'
                              : 'Under 7-day bank resolution SLA countdown.'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decision Tree Modal */}
      <DecisionTreeModal
        isOpen={isDecisionTreeOpen}
        onClose={() => setIsDecisionTreeOpen(false)}
        outcome={outcome}
      />

      {/* QR Code Modal */}
      <QrCodeModal
        isOpen={!!activeVoucherModal}
        onClose={() => setActiveVoucherModal(null)}
        voucher={activeVoucherModal}
        merchants={merchantsList}
        onRedeemSuccess={() => loadOutcome(outcomeAppId)}
      />
    </div>
  );
}
