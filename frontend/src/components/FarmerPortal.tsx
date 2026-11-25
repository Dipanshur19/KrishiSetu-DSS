"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  QrCode,
  Mic,
  MicOff,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Upload,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import DecisionTreeModal from "./DecisionTreeModal";
import QrCodeModal from "./QrCodeModal";
import ClimateGaugeCard from "./ClimateGaugeCard";
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
  const [grievanceDocName, setGrievanceDocName] = useState("khasra_extract.pdf");
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
      alert("Speech recognition requires Chrome or Edge.");
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
      alert("Submission failed: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const handleGrievanceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await api.uploadFile(file);
      setGrievanceDocName(uploaded.filename);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSowingProof = async (trancheId: number, file?: File) => {
    setSowingUploading(true);
    setSowingSuccess("");
    try {
      let photoRef = "crop_sowing_gps_proof.jpg";
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

  // Smooth Seasonal Projection Chart Data for Farmer Outcome
  const harvestCurveData = outcome
    ? [
        { stage: "Sowing", expected: 0, stress: 0 },
        { stage: "Vegetative", expected: Math.round(outcome.expected_revenue * 0.2), stress: Math.round(outcome.drought_stress_revenue * 0.15) },
        { stage: "Flowering", expected: Math.round(outcome.expected_revenue * 0.52), stress: Math.round(outcome.drought_stress_revenue * 0.45) },
        { stage: "Maturity", expected: Math.round(outcome.expected_revenue * 0.85), stress: Math.round(outcome.drought_stress_revenue * 0.78) },
        { stage: "Harvest", expected: Math.round(outcome.expected_revenue), stress: Math.round(outcome.drought_stress_revenue) },
      ]
    : [];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Editorial Title & Action Pills */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#8a877d]">{t(lang, "farmer_eyebrow")}</p>
          <h1 className="text-3xl font-medium tracking-tight text-[#141513] mt-0.5">
            {t(lang, "farmer_title")}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(["apply", "outcome", "wallet", "grievances"] as const).map((tabKey) => {
            const labelMap = {
              apply: t(lang, "tab_apply"),
              outcome: t(lang, "tab_outcome"),
              wallet: t(lang, "tab_wallet"),
              grievances: t(lang, "tab_grievances"),
            };
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[#141513] text-white"
                    : "bg-white border border-black/[0.08] text-[#5e5c55] hover:text-[#141513]"
                }`}
              >
                {labelMap[tabKey]}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: CLEAN 4-STEP CREDIT WIZARD + LIVE ESTIMATOR BENTO */}
      {activeTab === "apply" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Wizard Form (8 cols) */}
          <div className="lg:col-span-8 bento-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-black/[0.06]">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-[#8a877d]">Step {wizardStep}/4</span>
                  <div className="flex items-center space-x-1.5">
                    {[1, 2, 3, 4].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setWizardStep(s)}
                        className={`h-1.5 rounded-full transition-all ${
                          s <= wizardStep ? "w-8 bg-[#a3d929]" : "w-5 bg-[#e5e5dc]"
                        }`}
                        title={`Step ${s}`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isListening
                      ? "bg-red-100 text-red-700"
                      : "bg-[#f5f5ee] text-[#141513] hover:bg-[#ebebdf]"
                  }`}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-[#4d7c0f]" />}
                  <span>{isListening ? t(lang, "listening") : t(lang, "voice_input")}</span>
                </button>
              </div>

              <form id="farmer-wizard-form" onSubmit={handleApplicationSubmit}>
                {wizardStep === 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">PM-KISAN ID</label>
                      <input
                        type="text"
                        value={formData.pmkisan_id}
                        onChange={(e) => setFormData({ ...formData, pmkisan_id: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl font-mono focus:outline-none focus:border-[#141513]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl focus:outline-none focus:border-[#141513]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Phone Number</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl font-mono focus:outline-none focus:border-[#141513]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Category</label>
                      <select
                        value={formData.social_category}
                        onChange={(e) => setFormData({ ...formData, social_category: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl focus:outline-none focus:border-[#141513]"
                      >
                        <option value="OBC">OBC</option>
                        <option value="SC">SC</option>
                        <option value="ST">ST</option>
                        <option value="Women">Women SHG</option>
                        <option value="Minority">Minority</option>
                        <option value="PWD">PWD</option>
                        <option value="GEN">General</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">District</label>
                      <select
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl focus:outline-none focus:border-[#141513]"
                      >
                        <option value="Kanpur Dehat">Kanpur Dehat</option>
                        <option value="Kanpur Nagar">Kanpur Nagar</option>
                        <option value="Unnao">Unnao</option>
                        <option value="Jhansi">Jhansi</option>
                        <option value="Lucknow">Lucknow</option>
                        <option value="Barabanki">Barabanki</option>
                        <option value="Fatehpur">Fatehpur</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Village</label>
                      <input
                        type="text"
                        value={formData.village}
                        onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl focus:outline-none focus:border-[#141513]"
                        required
                      />
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Khasra / Survey No.</label>
                      <input
                        type="text"
                        value={formData.survey_khasra_no}
                        onChange={(e) => setFormData({ ...formData, survey_khasra_no: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Operational Area (Acres)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        value={formData.area_acres}
                        onChange={(e) =>
                          setFormData({ ...formData, area_acres: parseFloat(e.target.value) || 0.1 })
                        }
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl font-mono"
                        required
                      />
                      <span className="text-[11px] text-[#8a877d] mt-1 block font-mono">
                        {(formData.area_acres / 2.471).toFixed(2)} ha
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Land Ownership</label>
                      <select
                        value={formData.ownership_type}
                        onChange={(e) => setFormData({ ...formData, ownership_type: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl"
                      >
                        <option value="owned">Owned Title</option>
                        <option value="registered_lease">Registered Lease</option>
                        <option value="oral_lease">Oral Lease (Panchayat Cert)</option>
                        <option value="sharecropper">Sharecropper (Affidavit)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Irrigation Source</label>
                      <select
                        value={formData.irrigation_source}
                        onChange={(e) => setFormData({ ...formData, irrigation_source: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl"
                      >
                        <option value="Drip">Drip Irrigation</option>
                        <option value="Sprinkler">Sprinkler Irrigation</option>
                        <option value="Canal">Canal</option>
                        <option value="Well">Borewell</option>
                        <option value="Dry">Rainfed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Primary Crop</label>
                      <select
                        value={formData.primary_crop}
                        onChange={(e) => setFormData({ ...formData, primary_crop: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl"
                      >
                        <option value="Wheat">Wheat</option>
                        <option value="Paddy">Paddy</option>
                        <option value="Potato">Potato</option>
                        <option value="Mustard">Mustard</option>
                        <option value="Sugarcane">Sugarcane</option>
                        <option value="Gram">Gram</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Milch Animals</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={formData.livestock_count}
                        onChange={(e) =>
                          setFormData({ ...formData, livestock_count: parseInt(e.target.value) || 0 })
                        }
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl font-mono"
                      />
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Movable Assets (₹)</label>
                      <input
                        type="number"
                        step="5000"
                        value={formData.movable_asset_k}
                        onChange={(e) =>
                          setFormData({ ...formData, movable_asset_k: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Immovable Assets (₹)</label>
                      <input
                        type="number"
                        step="25000"
                        value={formData.immovable_asset_l}
                        onChange={(e) =>
                          setFormData({ ...formData, immovable_asset_l: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#5e5c55] mb-1.5">Existing Debt (₹)</label>
                      <input
                        type="number"
                        step="5000"
                        value={formData.existing_debt}
                        onChange={(e) =>
                          setFormData({ ...formData, existing_debt: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl font-mono"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center space-x-2 text-xs text-[#5e5c55] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_informal_debt_only}
                          onChange={(e) =>
                            setFormData({ ...formData, is_informal_debt_only: e.target.checked })
                          }
                          className="rounded"
                        />
                        <span>Informal moneylender debt only</span>
                      </label>
                    </div>
                  </div>
                )}

                {wizardStep === 4 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#5e5c55] mb-1.5">Credit Facility</label>
                        <select
                          value={formData.facility_type}
                          onChange={(e) => setFormData({ ...formData, facility_type: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl"
                        >
                          <option value="Crop KCC">Crop KCC</option>
                          <option value="Flexi KCC">Flexi KCC</option>
                          <option value="Allied KCC">Allied KCC</option>
                          <option value="Agri Term Loan">Agri Term Loan</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#5e5c55] mb-1.5">Requested Amount (₹)</label>
                        <input
                          type="number"
                          step="5000"
                          value={formData.requested_amount}
                          onChange={(e) =>
                            setFormData({ ...formData, requested_amount: parseFloat(e.target.value) || 10000 })
                          }
                          className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl font-mono font-medium"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#5e5c55] mb-1.5">Marketing Tie-Up</label>
                        <select
                          value={formData.marketing_tieup}
                          onChange={(e) => setFormData({ ...formData, marketing_tieup: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl"
                        >
                          <option value="Cooperative">Cooperative</option>
                          <option value="Government_Procurement">Govt MSP Procurement</option>
                          <option value="Corporate_Contract">Corporate Contract</option>
                          <option value="Direct">Mandi Direct</option>
                          <option value="None">None</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#5e5c55] mb-1.5">Preferred Bank</label>
                        <select
                          value={formData.bank_assigned}
                          onChange={(e) => setFormData({ ...formData, bank_assigned: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl"
                        >
                          <option value="State Bank of India">State Bank of India</option>
                          <option value="Bank of India">Bank of India</option>
                          <option value="Punjab National Bank">Punjab National Bank</option>
                          <option value="Bank of Baroda">Bank of Baroda</option>
                          <option value="Axis Bank">Axis Bank</option>
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center space-x-2 text-xs text-[#141513] cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={formData.pmfby_optin}
                        onChange={(e) => setFormData({ ...formData, pmfby_optin: e.target.checked })}
                        className="rounded"
                      />
                      <span>Include PMFBY Crop Insurance</span>
                    </label>
                  </div>
                )}
              </form>
            </div>

            <div className="mt-8 pt-4 border-t border-black/[0.06] flex items-center justify-between">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-full border border-black/10 text-xs font-medium text-[#141513] hover:bg-[#fafaf6]"
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
                  className="flex items-center space-x-1.5 px-5 py-2 bg-[#141513] text-white rounded-full text-xs font-medium hover:bg-black/85"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  form="farmer-wizard-form"
                  className="flex items-center space-x-1.5 px-5 py-2 bg-[#141513] text-[#d4f04c] rounded-full text-xs font-medium hover:bg-black/85"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t(lang, "submit_apply")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Live Intelligence Bento Column (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bento-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-medium text-[#141513]">Eligibility Estimate</h3>
                {isEstimating && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8a877d]" />}
              </div>

              {estimate ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-[#8a877d]">Scale-of-Finance Limit</span>
                    <div className="text-3xl font-medium text-[#141513] font-mono mt-0.5">
                      ₹{Number(estimate.scale_of_finance_limit || 0).toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/[0.06] text-xs">
                    <div>
                      <span className="text-[#8a877d]">Classification</span>
                      <div className="font-medium text-[#141513] mt-0.5">{estimate.farmer_classification}</div>
                    </div>
                    <div>
                      <span className="text-[#8a877d]">Collateral</span>
                      <div className="font-medium text-[#4d7c0f] mt-0.5">
                        {estimate.collateral_required ? "Required" : "Waived"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-xs text-[#8a877d]">Estimating limit...</div>
              )}
            </div>

            {estimate && (
              <ClimateGaugeCard
                title="Repayment Capacity"
                subtitle={`${formData.district} · ${formData.primary_crop}`}
                primaryValue={`${estimate.dscr_ratio}x`}
                progressRatio={Math.min(1, estimate.dscr_ratio / 2.5)}
                metric1Label="MISS Rate"
                metric1Val="4.0%"
                metric2Label="Facility"
                metric2Val={estimate.recommended_instrument.includes("Flexi") ? "Flexi KCC" : "KCC"}
                metric3Label="Revenue"
                metric3Val={`₹${Math.round((estimate.expected_crop_revenue || 0) / 1000)}k`}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TRANSPARENT DECISION OUTCOME & HARVEST CURVE */}
      {activeTab === "outcome" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs text-[#5e5c55]">
              <span>Application</span>
              <span className="font-mono font-medium text-[#141513]">{outcome?.application_no || "..."}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              {[
                { id: 1, label: "Ram Charan" },
                { id: 2, label: "Sunita Devi" },
                { id: 3, label: "Kallu Ram" },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setOutcomeAppId(d.id)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${
                    outcomeAppId === d.id
                      ? "bg-[#141513] text-white"
                      : "bg-white border border-black/[0.08] text-[#5e5c55] hover:text-[#141513]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {loadingOutcome ? (
            <div className="bento-card p-12 text-center text-xs text-[#8a877d]">Loading outcome...</div>
          ) : outcome ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Main Smooth Harvest AreaChart Bento Card */}
              <div className="lg:col-span-8 bento-card p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-[#65a30d]" />
                      <span className="text-xs font-medium text-[#4d7c0f]">Sanction Approved</span>
                    </div>
                    <div className="text-3xl font-medium text-[#141513] font-mono mt-1">
                      ₹{sanctionedAmt.toLocaleString("en-IN")}
                    </div>
                    <p className="text-xs text-[#8a877d] mt-0.5">
                      {outcome.facility_type} · {outcome.bank_assigned} · Saves ₹{missSavings.toLocaleString("en-IN")}/yr under 4% MISS
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsDecisionTreeOpen(true)}
                      className="px-3.5 py-1.5 rounded-full bg-[#fafaf6] border border-black/[0.08] text-xs font-medium text-[#141513] hover:bg-[#f0f0e8] flex items-center space-x-1"
                    >
                      <span>Decision Path</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveTab("wallet")}
                      className="px-3.5 py-1.5 rounded-full bg-[#141513] text-white text-xs font-medium hover:bg-black/85"
                    >
                      Vouchers ({outcome.tranches?.length || 0})
                    </button>
                  </div>
                </div>

                {/* Smooth Recharts AreaChart matching Soil Intelligence */}
                <div className="h-56 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={harvestCurveData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="farmerExpectedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#b8e354" stopOpacity={0.55} />
                          <stop offset="95%" stopColor="#b8e354" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="farmerStressGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#9cc0d1" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#9cc0d1" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,21,19,0.06)" vertical={false} />
                      <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#8a877d" }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#8a877d" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                        width={44}
                      />
                      <Tooltip
                        formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, ""]}
                        contentStyle={{ fontSize: "12px", borderRadius: "12px", border: "1px solid rgba(20,21,19,0.08)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="expected"
                        name="Expected Inflow"
                        stroke="#84cc16"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#farmerExpectedGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="stress"
                        name="Drought Stress"
                        stroke="#7aa2b8"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#farmerStressGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right Column: Climate Gauge + Top 3 SHAP Reasons */}
              <div className="lg:col-span-4 space-y-5">
                <ClimateGaugeCard
                  title="District Climate"
                  subtitle={`${outcome.district} · Open-Meteo Live`}
                  primaryValue={String(outcome.weather_profile?.avg_max_temp_c ?? 26.5)}
                  unit="°C"
                  progressRatio={Math.min(1, outcome.dscr_ratio / 2.2)}
                  metric1Label="DSCR"
                  metric1Val={`${outcome.dscr_ratio}x`}
                  metric2Label="14d Rain"
                  metric2Val={`${outcome.weather_profile?.forecast_14d_precip_mm ?? 0} mm`}
                  metric3Label="Default PD"
                  metric3Val={`${(outcome.pd_score * 100).toFixed(1)}%`}
                  onExpand={() => setIsDecisionTreeOpen(true)}
                />

                <div className="bento-card p-5 space-y-3">
                  <h3 className="text-sm font-medium text-[#141513]">Key Risk Factors (SHAP)</h3>
                  <div className="space-y-2">
                    {outcome.shap_reasons?.map((item, idx) => {
                      const positive = item.direction === "RISK_DECREASE";
                      return (
                        <div key={idx} className="bento-surface-soft p-3 flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium text-[#141513]">{item.name}</div>
                            <div className="text-[11px] text-[#5e5c55] mt-0.5">{item.text}</div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-mono shrink-0 ${
                              positive ? "bg-[#eef7d6] text-[#365314]" : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {item.delta_pd_pct > 0 ? `+${item.delta_pd_pct}` : item.delta_pd_pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: PURPOSE-LOCKED TRANCHES & E-RUPI WALLET */}
      {activeTab === "wallet" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {outcome?.tranches?.map((tranche) => {
              const isRedeemed = tranche.status === "redeemed";
              const isDisbursed = tranche.status === "disbursed";
              return (
                <div key={tranche.id} className="bento-card p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#8a877d]">
                        Tranche {tranche.tranche_no} · {tranche.percentage}%
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          isRedeemed
                            ? "bg-[#eef7d6] text-[#365314]"
                            : isDisbursed
                            ? "bg-[#e0eef5] text-[#1e4963]"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {tranche.status}
                      </span>
                    </div>

                    <div className="text-3xl font-medium text-[#141513] font-mono">
                      ₹{Number(tranche.amount || 0).toLocaleString("en-IN")}
                    </div>
                    <div className="text-sm font-medium text-[#141513]">{tranche.tranche_name}</div>

                    {tranche.voucher_code && (
                      <div className="bento-surface-soft px-3 py-2 text-xs font-mono text-[#5e5c55]">
                        {tranche.voucher_code}
                      </div>
                    )}
                    {tranche.merchant_name && (
                      <div className="text-xs text-[#4d7c0f]">Redeemed: {tranche.merchant_name}</div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-black/[0.06]">
                    {tranche.tranche_no === 1 && (
                      <button
                        onClick={() => setActiveVoucherModal(tranche)}
                        className="w-full py-2.5 px-4 bg-[#141513] hover:bg-black/85 text-white rounded-full text-xs font-medium flex items-center justify-center space-x-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#d4f04c]" />
                        <span>{isRedeemed ? "View Receipt" : "Open e-RUPI QR"}</span>
                      </button>
                    )}
                    {tranche.tranche_no === 2 && (
                      <div className="text-center text-xs text-[#5e5c55] py-2">UPI Direct Credit</div>
                    )}
                    {tranche.tranche_no === 3 && (
                      <div className="space-y-2">
                        {isDisbursed ? (
                          <div className="text-center text-xs text-[#4d7c0f] font-medium py-2">
                            Sowing Verified · 3% Rebate Active
                          </div>
                        ) : (
                          <>
                            <label className="w-full py-2.5 px-4 bg-[#141513] hover:bg-black/85 text-white rounded-full text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer">
                              <Upload className="w-3.5 h-3.5 text-[#d4f04c]" />
                              <span>{sowingUploading ? "Uploading..." : "Upload Sowing Photo"}</span>
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
                              className="w-full text-[11px] text-[#5e5c55] hover:text-[#141513]"
                            >
                              Verify via GPS Survey
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
            <div className="bento-card p-4 text-xs text-[#365314] bg-[#eef7d6]">{sowingSuccess}</div>
          )}
        </div>
      )}

      {/* TAB 4: APPEALS & SLA */}
      {activeTab === "grievances" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bento-card p-6 space-y-4">
            <h3 className="text-[15px] font-medium text-[#141513]">File Appeal (7-Day SLA)</h3>
            <form onSubmit={handleGrievanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-[#5e5c55] mb-1.5">Category</label>
                <select
                  value={grievanceCategory}
                  onChange={(e) => setGrievanceCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl"
                >
                  <option value="Collateral demanded under 2L">Collateral Demanded Under ₹2 Lakh</option>
                  <option value="Delayed disbursal >14 days">Delayed Disbursal Past 14 Days</option>
                  <option value="Incorrect land area">Incorrect Land Area</option>
                  <option value="Unfair rejection">Unfair Rejection</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#5e5c55] mb-1.5">Details</label>
                <textarea
                  rows={4}
                  value={grievanceText}
                  onChange={(e) => setGrievanceText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#fafaf6] border border-black/[0.08] rounded-xl"
                  placeholder="Describe the issue"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#5e5c55] mb-1.5">Supporting Document</label>
                <input
                  type="file"
                  onChange={handleGrievanceFileUpload}
                  className="w-full text-xs text-[#5e5c55] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border file:border-black/10 file:text-xs file:bg-white"
                />
                <span className="text-[11px] text-[#8a877d] font-mono mt-1 block">{grievanceDocName}</span>
              </div>
              {grievanceSuccess && (
                <div className="p-3 bg-[#eef7d6] rounded-xl text-xs text-[#365314]">{grievanceSuccess}</div>
              )}
              <button
                type="submit"
                className="w-full py-2.5 bg-[#141513] hover:bg-black/85 text-white rounded-full text-xs font-medium"
              >
                Submit Appeal
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bento-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-[#141513]">Registered Appeals</h3>
              <span className="text-xs font-mono text-[#8a877d]">{grievancesList.length}</span>
            </div>
            {grievancesList.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8a877d]">No active appeals</div>
            ) : (
              <div className="space-y-3">
                {grievancesList.map((g) => (
                  <div key={g.id} className="bento-surface-soft p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#141513]">{g.category}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium capitalize bg-white border border-black/[0.08] text-[#5e5c55]">
                        {g.resolution_status}
                      </span>
                    </div>
                    <p className="text-xs text-[#5e5c55]">{g.grievance_text}</p>
                    {g.govt_directive && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                        Directive: {g.govt_directive}
                      </div>
                    )}
                    <div className="flex items-center space-x-1 text-[11px] text-[#8a877d] font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(g.created_at).toLocaleDateString()}</span>
                    </div>
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
