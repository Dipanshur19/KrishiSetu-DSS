"use client";

import React, { useState, useEffect } from "react";
import {
  Sprout,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  FileText,
  Mic,
  MicOff,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Upload,
  Clock,
  AlertCircle,
  Info,
  Landmark,
  CloudRain,
} from "lucide-react";
import DecisionTreeModal from "./DecisionTreeModal";
import QrCodeModal from "./QrCodeModal";
import { api } from "@/lib/api";
import { t } from "@/i18n/translations";
import {
  DemoUser,
  EligibilityEstimate,
  FarmerApplicationOutcome,
  Grievance,
  Language,
  Merchant,
  Tranche,
} from "@/types/dss";

interface FarmerPortalProps {
  demoUser: DemoUser | null;
  lang: Language;
}

export default function FarmerPortal({ demoUser, lang }: FarmerPortalProps) {
  const [activeTab, setActiveTab] = useState<"apply" | "outcome" | "wallet" | "grievances">("apply");
  const [wizardStep, setWizardStep] = useState(1);
  const [isListening, setIsListening] = useState(false);

  const [formData, setFormData] = useState({
    full_name: demoUser?.full_name || "Ram Charan Yadav",
    phone: demoUser?.phone || "9876543210",
    pmkisan_id: "UP102938475",
    gender: "M",
    social_category: "OBC",
    district: demoUser?.district || "Kanpur Dehat",
    village: "Akbarpur",
    survey_khasra_no: "342/2",
    ownership_type: "owned",
    area_acres: 1.5,
    irrigation_source: "Drip",
    distance_to_mandi_km: 7.0,
    livestock_count: 2,
    movable_asset_k: 80000,
    immovable_asset_l: 300000,
    existing_debt: 0,
    is_informal_debt_only: false,
    facility_type: "Crop KCC",
    requested_amount: 60000,
    primary_crop: "Wheat",
    secondary_crop: "Mustard",
    marketing_tieup: "Cooperative",
    pmfby_optin: true,
    bank_assigned: "State Bank of India",
  });

  const [estimate, setEstimate] = useState<EligibilityEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const [outcomeAppId, setOutcomeAppId] = useState(1);
  const [outcome, setOutcome] = useState<FarmerApplicationOutcome | null>(null);
  const [loadingOutcome, setLoadingOutcome] = useState(false);

  const [isDecisionTreeOpen, setIsDecisionTreeOpen] = useState(false);
  const [activeVoucherModal, setActiveVoucherModal] = useState<Tranche | null>(null);
  const [merchantsList, setMerchantsList] = useState<Merchant[]>([]);

  const [grievanceCategory, setGrievanceCategory] = useState("Collateral demanded under 2L");
  const [grievanceText, setGrievanceText] = useState("");
  const [grievanceDocName, setGrievanceDocName] = useState("khasra_extract_proof.pdf");
  const [grievancesList, setGrievancesList] = useState<Grievance[]>([]);
  const [grievanceSuccess, setGrievanceSuccess] = useState("");

  const [sowingUploading, setSowingUploading] = useState(false);
  const [sowingSuccess, setSowingSuccess] = useState("");

  useEffect(() => {
    api.getScaleOfFinance()
      .then((d) => {
        if (d.merchants) setMerchantsList(d.merchants);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (demoUser && demoUser.role === "farmer") {
      setFormData((prev) => ({
        ...prev,
        full_name: demoUser.full_name,
        phone: demoUser.phone || prev.phone,
        district: demoUser.district || prev.district,
      }));
      const targetId =
        demoUser.username === "farmer_sunita" ? 2 : demoUser.username === "farmer_kallu" ? 3 : 1;
      setOutcomeAppId(targetId);
    }
  }, [demoUser]);

  const loadOutcome = (id: number) => {
    setLoadingOutcome(true);
    api.getApplicationOutcome(id)
      .then((data) => {
        setOutcome(data);
        if (data.grievances) setGrievancesList(data.grievances);
      })
      .catch(console.error)
      .finally(() => setLoadingOutcome(false));
  };

  useEffect(() => {
    loadOutcome(outcomeAppId);
  }, [outcomeAppId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEstimating(true);
      api.estimateEligibility({
        area_acres: Number(formData.area_acres) || 1.0,
        primary_crop: formData.primary_crop,
        ownership_type: formData.ownership_type,
        livestock_count: Number(formData.livestock_count) || 0,
        marketing_tieup: formData.marketing_tieup,
        district: formData.district,
        requested_amount: Number(formData.requested_amount) || 50000,
      })
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
    formData.requested_amount,
  ]);

  const toggleSpeechRecognition = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (e: { results: { transcript: string }[][] }) => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (e: { results: { transcript: string }[][] }) => void;
        start: () => void;
      };
    };

    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Web Speech API is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = lang === "hi" ? "hi-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (wizardStep === 1) {
        setFormData((prev) => ({ ...prev, full_name: transcript }));
      } else if (wizardStep === 2) {
        const num = parseFloat(transcript.replace(/[^0-9.]/g, ""));
        if (num) setFormData((prev) => ({ ...prev, area_acres: num }));
      }
    };
    recognition.start();
  };

  const handleApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api.submitApplication(formData);
      setOutcomeAppId(data.application_id);
      loadOutcome(data.application_id);
      setActiveTab("outcome");
    } catch (err: unknown) {
      alert("Application failed: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const handleGrievanceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await api.uploadFile(file);
      setGrievanceDocName(`${uploaded.filename} (${uploaded.storage})`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSowingProof = async (trancheId: number, file?: File) => {
    setSowingUploading(true);
    setSowingSuccess("");
    try {
      let photoRef = "crop_sowing_khasra_proof.jpg";
      if (file) {
        const uploaded = await api.uploadFile(file);
        photoRef = uploaded.url;
      }
      const data = await api.verifySowing(trancheId, {
        geo_lat: 26.4499,
        geo_long: 80.3319,
        geo_proof_photo: photoRef,
      });
      setSowingSuccess(data.message);
      loadOutcome(outcomeAppId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSowingUploading(false);
    }
  };

  const handleGrievanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grievanceText) return;
    try {
      const data = await api.fileGrievance({
        application_id: outcomeAppId,
        farmer_id: outcome?.farmer_id || 1,
        category: grievanceCategory,
        grievance_text: grievanceText,
        supporting_doc: grievanceDocName,
      });
      setGrievanceSuccess(data.message);
      setGrievanceText("");
      loadOutcome(outcomeAppId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to submit");
    }
  };

  const sanctionedAmt = Number(outcome?.sanctioned_amount || 0);
  const missSavings = Math.round(sanctionedAmt * 0.03);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Sprout className="w-6 h-6 text-emerald-600" strokeWidth={1.5} />
            <span>{t(lang, "farmer_portal_title")}</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">{t(lang, "farmer_portal_sub")}</p>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto">
          {(["apply", "outcome", "wallet", "grievances"] as const).map((tabKey) => {
            const labelMap = {
              apply: t(lang, "tab_apply"),
              outcome: t(lang, "tab_outcome"),
              wallet: t(lang, "tab_wallet"),
              grievances: t(lang, "tab_grievances"),
            };
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tabKey
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {labelMap[tabKey]}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: 4-STEP LOW-FRICTION APPLICATION WIZARD */}
      {activeTab === "apply" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <div className="mb-6 pb-4 border-b border-slate-200">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span>Step {wizardStep} of 4</span>
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    isListening
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-3.5 h-3.5 text-red-600" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  <span>{isListening ? t(lang, "listening") : t(lang, "voice_input")}</span>
                </button>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 transition-all duration-300"
                  style={{ width: `${(wizardStep / 4) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 mt-2 text-[11px] text-slate-500 text-center font-medium">
                <span className={wizardStep === 1 ? "text-emerald-700 font-bold" : ""}>1. PM-KISAN KYC</span>
                <span className={wizardStep === 2 ? "text-emerald-700 font-bold" : ""}>2. Land & Crops</span>
                <span className={wizardStep === 3 ? "text-emerald-700 font-bold" : ""}>3. Net Worth</span>
                <span className={wizardStep === 4 ? "text-emerald-700 font-bold" : ""}>4. Review & Apply</span>
              </div>
            </div>

            <form onSubmit={handleApplicationSubmit}>
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start space-x-2">
                    <Info className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                    <span>
                      {lang === "hi"
                        ? "PM-KISAN लाभार्थी आईडी दर्ज करें; आधार ई-केवाईसी और पता स्वतः प्राप्त हो जाएगा (SBI 1-पृष्ठ मॉडल)।"
                        : "Enter PM-KISAN ID to pre-fetch verified Aadhaar eKYC and demographics (SBI lean 1-page form)."}
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
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
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
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
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
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
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
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="OBC">OBC (Other Backward Class)</option>
                        <option value="SC">SC (Scheduled Caste)</option>
                        <option value="ST">ST (Scheduled Tribe)</option>
                        <option value="Women">Women SHG Member</option>
                        <option value="Minority">Minority</option>
                        <option value="PWD">PWD</option>
                        <option value="GEN">General</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
                      <select
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
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
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Survey / Khasra Plot No.
                      </label>
                      <input
                        type="text"
                        value={formData.survey_khasra_no}
                        onChange={(e) => setFormData({ ...formData, survey_khasra_no: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
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
                        onChange={(e) =>
                          setFormData({ ...formData, area_acres: parseFloat(e.target.value) || 0.1 })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                        required
                      />
                      <span className="text-[11px] text-slate-500">
                        = {(formData.area_acres / 2.471).toFixed(2)} Hectares (
                        {formData.area_acres / 2.471 <= 1.0
                          ? "Marginal Farmer <= 1 ha"
                          : formData.area_acres / 2.471 <= 2.0
                          ? "Small Farmer <= 2 ha"
                          : "Other"}
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
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="owned">Owned Land (Title Holder)</option>
                        <option value="registered_lease">Registered Lease Agreement</option>
                        <option value="oral_lease">Oral Lessee (Panchayat Certificate)</option>
                        <option value="sharecropper">Sharecropper (Bataidar with Affidavit)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Irrigation Method
                      </label>
                      <select
                        value={formData.irrigation_source}
                        onChange={(e) => setFormData({ ...formData, irrigation_source: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="Drip">Drip Irrigation (1.25x Yield Resilience)</option>
                        <option value="Sprinkler">Sprinkler Irrigation (1.15x Yield)</option>
                        <option value="Canal">Canal / Gravity Flow</option>
                        <option value="Well">Tubewell / Borewell</option>
                        <option value="Dry">Dry / Rainfed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Crop (Current Season)
                      </label>
                      <select
                        value={formData.primary_crop}
                        onChange={(e) => setFormData({ ...formData, primary_crop: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="Wheat">Wheat (Rabi - SoF ₹24,000/acre)</option>
                        <option value="Paddy">Paddy (Kharif - SoF ₹26,000/acre)</option>
                        <option value="Potato">Potato (SoF ₹42,000/acre)</option>
                        <option value="Mustard">Mustard (SoF ₹18,000/acre)</option>
                        <option value="Sugarcane">Sugarcane (SoF ₹48,000/acre)</option>
                        <option value="Gram">Gram / Chana (SoF ₹20,000/acre)</option>
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
                        onChange={(e) =>
                          setFormData({ ...formData, livestock_count: parseInt(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                    <strong>Bank of India (AG-100) Net Worth Formula:</strong> Net Worth = [Movable Assets (K) + Immovable Land (L)] − Existing Liabilities (M).
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Movable Assets (K) (₹)
                      </label>
                      <input
                        type="number"
                        step="5000"
                        value={formData.movable_asset_k}
                        onChange={(e) =>
                          setFormData({ ...formData, movable_asset_k: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Immovable Assets (L) (₹)
                      </label>
                      <input
                        type="number"
                        step="25000"
                        value={formData.immovable_asset_l}
                        onChange={(e) =>
                          setFormData({ ...formData, immovable_asset_l: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Existing Liabilities (M) (₹)
                      </label>
                      <input
                        type="number"
                        step="5000"
                        value={formData.existing_debt}
                        onChange={(e) =>
                          setFormData({ ...formData, existing_debt: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_informal_debt_only}
                          onChange={(e) =>
                            setFormData({ ...formData, is_informal_debt_only: e.target.checked })
                          }
                          className="rounded text-emerald-600"
                        />
                        <span>Purely informal moneylender debt (Route to Debt-Swap)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Loan Facility Requested
                      </label>
                      <select
                        value={formData.facility_type}
                        onChange={(e) => setFormData({ ...formData, facility_type: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="Crop KCC">Crop KCC</option>
                        <option value="Flexi KCC">Flexi KCC (₹10k–₹50k Tenant/Marginal)</option>
                        <option value="Allied KCC">Allied KCC (Dairy & Fisheries)</option>
                        <option value="Agri Term Loan">Agri Term Loan</option>
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
                        onChange={(e) =>
                          setFormData({ ...formData, requested_amount: parseFloat(e.target.value) || 10000 })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono font-bold text-emerald-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Marketing Offtake Tie-Up
                      </label>
                      <select
                        value={formData.marketing_tieup}
                        onChange={(e) => setFormData({ ...formData, marketing_tieup: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="Cooperative">Dairy/Sugar Cooperative</option>
                        <option value="Government_Procurement">Government MSP Procurement</option>
                        <option value="Corporate_Contract">Corporate Offtake Contract</option>
                        <option value="Direct">Direct Sale at Mandi</option>
                        <option value="None">No Formal Tie-Up</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Assigned Bank Branch
                      </label>
                      <select
                        value={formData.bank_assigned}
                        onChange={(e) => setFormData({ ...formData, bank_assigned: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="State Bank of India">State Bank of India</option>
                        <option value="Bank of India">Bank of India</option>
                        <option value="Punjab National Bank">Punjab National Bank</option>
                        <option value="Bank of Baroda">Bank of Baroda</option>
                        <option value="Axis Bank">Axis Bank</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <label className="flex items-center space-x-2 text-xs text-emerald-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.pmfby_optin}
                        onChange={(e) => setFormData({ ...formData, pmfby_optin: e.target.checked })}
                        className="rounded text-emerald-600"
                      />
                      <span className="font-semibold">
                        Enroll in PMFBY Crop Insurance (lowers Loss Given Default & unlocks MISS interest rebate)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="flex items-center space-x-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div />
                )}

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t(lang, "submit_apply")}</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Real-time Scale of Finance Estimator */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-600 flex items-center space-x-1.5">
                <Landmark className="w-4 h-4 text-emerald-700" strokeWidth={1.5} />
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
                    PSL 10% Marginal/Small Sub-Target
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500">Eligible Scale-of-Finance Limit</span>
                  <div className="text-xl font-bold text-emerald-700 font-mono">
                    ₹{Number(estimate.scale_of_finance_limit || 0).toLocaleString("en-IN")}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500">Recommended Facility</span>
                  <div className="text-sm font-bold text-slate-800">{estimate.recommended_instrument}</div>
                  <span className="text-[11px] text-slate-600">
                    Collateral Required: <strong>{estimate.collateral_required ? "Yes" : "No (Waived)"}</strong>
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="flex justify-between">
                    <span>MISS Base Rate:</span>
                    <span className="font-mono line-through text-slate-400">7.0% p.a.</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>Prompt Repayment Incentive:</span>
                    <span className="font-mono text-emerald-700">-3.0%</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-emerald-200 text-sm">
                    <span>Effective Farmer Rate:</span>
                    <span className="font-mono text-emerald-900">4.0% p.a.</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                  Forecasted Harvest DSCR:{" "}
                  <strong className="text-slate-900 font-mono">{estimate.dscr_ratio}x</strong>
                  <br />
                  Expected Net Revenue: ₹{Number(estimate.expected_crop_revenue || 0).toLocaleString("en-IN")}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">Calculating eligibility...</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TRANSPARENT DECISION OUTCOME & XAI CARDS */}
      {activeTab === "outcome" && (
        <div className="space-y-6">
          <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Viewing Application:</span>
              <span className="font-mono font-bold text-emerald-800">
                {outcome?.application_no || "Loading..."}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                {outcome?.farmer_classification} Farmer
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-500">Demo Apps:</span>
              <button onClick={() => setOutcomeAppId(1)} className="px-2 py-1 bg-white hover:bg-slate-200 border rounded text-xs">
                App #1 (Wheat)
              </button>
              <button onClick={() => setOutcomeAppId(2)} className="px-2 py-1 bg-white hover:bg-slate-200 border rounded text-xs">
                App #2 (Marginal)
              </button>
              <button onClick={() => setOutcomeAppId(3)} className="px-2 py-1 bg-white hover:bg-slate-200 border rounded text-xs">
                App #3 (Bundelkhand)
              </button>
            </div>
          </div>

          {loadingOutcome ? (
            <div className="p-12 text-center text-slate-500">Loading evaluation dossier...</div>
          ) : outcome ? (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Sanction Approved
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Ref: {outcome.application_no}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 font-mono">
                    Sanctioned: ₹{sanctionedAmt.toLocaleString("en-IN")}
                  </h2>
                  <p className="text-xs text-slate-600">
                    Facility: <strong>{outcome.facility_type}</strong> • Bank: <strong>{outcome.bank_assigned}</strong> • Effective Rate: <strong className="text-emerald-700">4.0% p.a. (Saves ₹{missSavings.toLocaleString("en-IN")}/yr via MISS)</strong>
                  </p>
                  {outcome.weather_profile && (
                    <p className="text-[11px] text-slate-500 flex items-center space-x-1 pt-0.5">
                      <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        Open-Meteo 14d Forecast ({outcome.district}): {outcome.weather_profile.forecast_14d_precip_mm} mm precip, avg max {outcome.weather_profile.avg_max_temp_c}°C ({outcome.weather_profile.source})
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setIsDecisionTreeOpen(true)}
                    className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Inspect Decision Tree Path</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("wallet")}
                    className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View e-RUPI Vouchers ({outcome.tranches?.length || 0})</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-600 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" strokeWidth={1.5} />
                  <span>XGBoost + SHAP Explainability Factors</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {outcome.shap_reasons?.map((item, idx) => {
                    const isPositive = item.direction === "RISK_DECREASE";
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border ${
                          isPositive ? "bg-emerald-50/60 border-emerald-200" : "bg-amber-50/60 border-amber-200"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className={isPositive ? "text-emerald-900" : "text-amber-900"}>{item.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                              isPositive ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900"
                            }`}
                          >
                            {item.delta_pd_pct > 0 ? `+${item.delta_pd_pct}` : item.delta_pd_pct}% PD
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1">{item.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: PURPOSE-LOCKED DIGITAL VOUCHER WALLET */}
      {activeTab === "wallet" && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                <QrCode className="w-4 h-4" strokeWidth={1.5} />
                <span>e-RUPI & Purpose-Locked Disbursal Wallet</span>
              </div>
              <h2 className="text-xl font-bold mt-1">3-Tranche Intended-Usage Enforcement</h2>
              <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                Ensures agricultural credit reaches certified seeds, fertilizers, and verified crop sowing without diversion.
              </p>
            </div>
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-right">
              <span className="text-[11px] text-slate-400">Sanction Total</span>
              <div className="text-lg font-bold text-white font-mono">
                ₹{sanctionedAmt.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {outcome?.tranches?.map((tranche) => {
              const isRedeemed = tranche.status === "redeemed";
              const isDisbursed = tranche.status === "disbursed";
              return (
                <div
                  key={tranche.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 font-mono">
                        Tranche {tranche.tranche_no} ({tranche.percentage}%)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize ${
                          isRedeemed
                            ? "bg-emerald-100 text-emerald-800"
                            : isDisbursed
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {tranche.status}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{tranche.tranche_name}</h4>
                      <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                        ₹{Number(tranche.amount || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
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

                  <div className="p-4 bg-slate-50 border-t border-slate-200">
                    {tranche.tranche_no === 1 && (
                      <button
                        onClick={() => setActiveVoucherModal(tranche)}
                        className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{isRedeemed ? "View Redemption Proof" : "Open e-RUPI QR Code"}</span>
                      </button>
                    )}
                    {tranche.tranche_no === 2 && (
                      <div className="text-center text-xs text-slate-600 font-medium py-1">
                        Disbursed via UPI / Direct Account Credit
                      </div>
                    )}
                    {tranche.tranche_no === 3 && (
                      <div className="space-y-2">
                        {isDisbursed ? (
                          <div className="text-center text-xs text-emerald-700 font-semibold py-1">
                            Sowing Verified • 3% MISS Rebate Active
                          </div>
                        ) : (
                          <>
                            <label className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer">
                              <Upload className="w-3.5 h-3.5" />
                              <span>{sowingUploading ? "Uploading..." : "Upload Geo-Tagged Sowing Photo"}</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleSowingProof(tranche.id, e.target.files?.[0])}
                              />
                            </label>
                            <button
                              onClick={() => handleSowingProof(tranche.id)}
                              disabled={sowingUploading}
                              className="w-full py-1.5 text-[11px] text-blue-700 hover:underline font-medium"
                            >
                              Or simulate Digital Crop Survey GPS match
                            </button>
                          </>
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

      {/* TAB 4: GRIEVANCES & 7-DAY SLA TRACKER */}
      {activeTab === "grievances" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Grievance Category</label>
                <select
                  value={grievanceCategory}
                  onChange={(e) => setGrievanceCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="Collateral demanded under 2L">Collateral Demanded Under ₹2 Lakh</option>
                  <option value="Delayed disbursal >14 days">Delayed Disbursal Past 14 Days</option>
                  <option value="Incorrect land area">Incorrect Land Holding / Khasra Error</option>
                  <option value="Unfair rejection">Unfair Rejection of Flexi KCC / Sharecropper</option>
                  <option value="Other">Other Operational Issue</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={4}
                  value={grievanceText}
                  onChange={(e) => setGrievanceText(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                  placeholder="Describe the discrepancy or SLA violation..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supporting Document (Supabase Storage / Local Vault)
                </label>
                <input
                  type="file"
                  onChange={handleGrievanceFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50"
                />
                <span className="text-[11px] text-slate-500 font-mono block mt-1">
                  Attached: {grievanceDocName}
                </span>
              </div>

              {grievanceSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                  {grievanceSuccess}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                Submit Grievance to Bank & Govt Auditor
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Grievances & Live SLA Timers</h3>
                <p className="text-xs text-slate-500">Direct audit line across Farmer, Bank, and Govt</p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-slate-100 rounded text-slate-700 font-mono">
                {grievancesList.length} Registered
              </span>
            </div>

            {grievancesList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No active grievances registered for this application.
              </div>
            ) : (
              <div className="space-y-4">
                {grievancesList.map((g) => (
                  <div key={g.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900">{g.category}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize ${
                            g.resolution_status === "resolved"
                              ? "bg-emerald-100 text-emerald-800"
                              : g.resolution_status === "escalated"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {g.resolution_status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-slate-500 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(g.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700">{g.grievance_text}</p>
                    {g.bank_response && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded text-xs">
                        <strong>Bank Response:</strong> {g.bank_response}
                      </div>
                    )}
                    {g.govt_directive && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-900 font-medium">
                        <strong>Binding Government Directive:</strong> {g.govt_directive}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <DecisionTreeModal
        isOpen={isDecisionTreeOpen}
        onClose={() => setIsDecisionTreeOpen(false)}
        outcome={outcome}
      />

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
