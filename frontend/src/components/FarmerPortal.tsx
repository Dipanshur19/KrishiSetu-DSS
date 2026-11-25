"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileDown,
  Mic,
  RefreshCw,
  Scale,
  Upload,
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
import ClimateGaugeCard from "./ClimateGaugeCard";
import DecisionTreeModal from "./DecisionTreeModal";
import { api } from "@/lib/api";
import { t } from "@/i18n/translations";
import type {
  AuthSession,
  EligibilityEstimate,
  FarmerApplicationOutcome,
  Language,
  Merchant,
} from "@/types/dss";

const DISTRICTS = [
  "Kanpur Dehat",
  "Kanpur Nagar",
  "Unnao",
  "Jhansi",
  "Lucknow",
  "Barabanki",
  "Fatehpur",
];

const BANKS = [
  "State Bank of India",
  "Bank of India",
  "Punjab National Bank",
  "Bank of Baroda",
  "Axis Bank",
  "HDFC Bank",
];

const DEFAULTS = {
  full_name: "",
  phone: "",
  pmkisan_id: "",
  gender: "M",
  social_category: "OBC",
  district: DISTRICTS[0],
  village: "",
  survey_khasra_no: "",
  ownership_type: "owned",
  area_acres: "1.5",
  irrigation_source: "Drip",
  distance_to_mandi_km: "7",
  livestock_count: "2",
  movable_asset_k: "80000",
  immovable_asset_l: "300000",
  existing_debt: "0",
  overdue_days: "0",
  is_informal_debt_only: false,
  reported_npa: false,
  primary_crop: "Wheat",
  secondary_crop: "",
  marketing_tieup: "Cooperative",
  facility_type: "Crop KCC",
  bank_assigned: BANKS[0],
  requested_amount: "60000",
  pmfby_optin: true,
};

type FormDataState = typeof DEFAULTS;
type FieldKey = keyof FormDataState;

const HI_LABELS: Record<string, string> = {
  submitted: "बैंक के निर्णय की प्रतीक्षा",
  under_review: "अधिकारी की समीक्षा में",
  approved: "स्वीकृत",
  partial_approved: "आंशिक स्वीकृति",
  rejected: "अस्वीकृत",
  appealed: "अपील पर विचार",
  open: "लंबित",
  escalated: "सरकार को भेजा गया",
  resolved: "निस्तारित",
  owned: "स्वयं की भूमि",
  registered_lease: "पंजीकृत पट्टा",
  oral_lease: "मौखिक पट्टा",
  sharecropper: "बटाईदार",
  Well: "कुआँ",
  Drip: "टपक सिंचाई",
  Sprinkler: "फव्वारा सिंचाई",
  Canal: "नहर",
  Dry: "वर्षा आधारित",
  Wheat: "गेहूँ",
  Paddy: "धान",
  Potato: "आलू",
  Mustard: "सरसों",
  Sugarcane: "गन्ना",
  Gram: "चना",
  Maize: "मक्का",
  Cooperative: "सहकारी समिति",
  Direct: "सीधी मंडी बिक्री",
  None: "कोई नहीं",
  Corporate_Contract: "कंपनी अनुबंध",
  Government_Procurement: "सरकारी एमएसपी खरीद",
  Marginal: "सीमांत किसान",
  Small: "लघु किसान",
  Other: "अन्य",
  F: "महिला",
  M: "पुरुष",
  GEN: "सामान्य",
  Women: "महिला समूह",
  Minority: "अल्पसंख्यक",
  PWD: "दिव्यांग",
  "Crop KCC": "फसल किसान क्रेडिट कार्ड",
  "Allied KCC": "संबद्ध किसान क्रेडिट कार्ड",
  "Flexi KCC": "फ्लेक्सी किसान क्रेडिट कार्ड",
  "Agri Term Loan": "कृषि सावधि ऋण",
  "Kanpur Dehat": "कानपुर देहात",
  "Kanpur Nagar": "कानपुर नगर",
  Unnao: "उन्नाव",
  Jhansi: "झाँसी",
  Lucknow: "लखनऊ",
  Barabanki: "बाराबंकी",
  Fatehpur: "फतेहपुर",
  "Incorrect land area": "भूमि विवरण",
  "Unfair rejection": "निर्णय की समीक्षा",
  "Delayed disbursal >14 days": "वितरण में देरी",
  locked: "बंद",
  disbursed: "जारी",
  redeemed: "भुनाया गया",
  debt_to_asset_ratio: "संपत्ति के अनुपात में कर्ज",
  max_overdue_days: "बकाया दिन",
  micro_irrigation_score: "सिंचाई स्तर",
  pmfby_insured: "फसल बीमा",
  marketing_tieup: "विपणन व्यवस्था",
  livestock_count: "पशुधन",
  mandi_distance_km: "मंडी से दूरी",
  dscr_ratio: "पुनर्भुगतान क्षमता",
};

const EN_LABELS: Record<string, string> = {
  submitted: "Awaiting bank allocation",
  under_review: "Officer review required",
  approved: "Approved",
  partial_approved: "Partially approved",
  rejected: "Rejected",
  appealed: "Under appeal",
  M: "Male",
  F: "Female",
  GEN: "General",
};

const formatMoney = (value: number) =>
  "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

function statusBadgeClass(status: string) {
  if (status === "approved" || status === "partial_approved" || status === "resolved" || status === "redeemed") {
    return "bg-[#eef7d6] text-[#365314]";
  }
  if (status === "under_review" || status === "escalated" || status === "locked") {
    return "bg-amber-100 text-amber-900";
  }
  if (status === "rejected") {
    return "bg-red-50 text-red-700";
  }
  if (status === "disbursed") {
    return "bg-[#e0eef5] text-[#1e4963]";
  }
  return "bg-[#f5f5ee] text-[#5e5c55]";
}

export default function FarmerPortal({
  lang,
  session,
}: {
  lang: Language;
  session: AuthSession;
}) {
  const hi = lang === "hi";
  const tr = (en: string, hindi: string) => (hi ? hindi : en);
  const label = (s: string) =>
    hi ? (HI_LABELS[s] ?? s) : (EN_LABELS[s] ?? s.replaceAll("_", " "));

  const [tab, setTab] = useState<"apply" | "decision" | "wallet" | "appeals">("apply");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormDataState>({
    ...DEFAULTS,
    full_name: session.user.full_name,
  });
  const [estimate, setEstimate] = useState<EligibilityEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(false);

  const [apps, setApps] = useState<{ id: number; application_no: string; status: string }[]>([]);
  const [id, setId] = useState(0);
  const [detail, setDetail] = useState<FarmerApplicationOutcome | null>(null);

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Unfair rejection");
  const [appeal, setAppeal] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [decisionTreeOpen, setDecisionTreeOpen] = useState(false);
  const submissionKey = useRef("");

  useEffect(() => {
    let valid = true;
    api
      .myApplications()
      .then((rows) => {
        if (valid) {
          setApps(rows);
          setId((prev) => (rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? 0)));
        }
      })
      .catch((e) => {
        if (valid) setError(e instanceof Error ? e.message : "Failed to load applications");
      });
    return () => {
      valid = false;
    };
  }, [revision]);

  useEffect(() => {
    api
      .getScaleOfFinance()
      .then((data) => {
        setMerchants(data.merchants);
        setMerchant(data.merchants[0]?.merchant_id ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load merchants"));
  }, []);

  useEffect(() => {
    let valid = true;
    setDetail(null);
    if (id) {
      api
        .getApplicationOutcome(id)
        .then((d) => {
          if (valid) setDetail(d);
        })
        .catch((e) => {
          if (valid) setError(e instanceof Error ? e.message : "Failed to load decision");
        });
    }
    return () => {
      valid = false;
    };
  }, [id, revision]);

  useEffect(() => {
    let valid = true;
    setEstimateError(false);
    setEstimateLoading(true);
    const timer = setTimeout(
      () =>
        api
          .estimateEligibility(form)
          .then((d) => {
            if (valid) setEstimate(d);
          })
          .catch(() => {
            if (valid) {
              setEstimate(null);
              setEstimateError(true);
            }
          })
          .finally(() => {
            if (valid) setEstimateLoading(false);
          }),
      300,
    );
    return () => {
      valid = false;
      clearTimeout(timer);
    };
  }, [form]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e
            ? String((e as { message: unknown }).message)
            : "";
      setError(msg || tr("Try again.", "पुनः प्रयास करें।"));
    } finally {
      setBusy(false);
    }
  };

  const change = (key: FieldKey, value: string | boolean) => {
    submissionKey.current = "";
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "existing_debt" && (!value || Number(value) <= 0)) {
        next.overdue_days = "0";
        next.reported_npa = false;
        next.is_informal_debt_only = false;
      }
      return next;
    });
  };

  const field = (
    key: FieldKey,
    en: string,
    hindi: string,
    options?: string[],
    type = "text",
    optional = false,
  ) => {
    const name = tr(en, hindi);
    const value = String(form[key]);
    return (
      <label key={key} className="block text-xs text-[#5e5c55] min-w-0">
        {name}
        {options ? (
          <select
            className="field"
            value={value}
            onChange={(e) => change(key, e.target.value)}
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={`field ${type === "number" || type === "tel" ? "font-mono" : ""}`}
            type={type}
            value={value}
            required={!optional}
            min={key === "area_acres" || key === "requested_amount" ? 0.01 : 0}
            step={key === "livestock_count" || key === "overdue_days" ? "1" : "any"}
            pattern={key === "phone" ? "[0-9]{10}" : undefined}
            onChange={(e) => change(key, e.target.value)}
          />
        )}
      </label>
    );
  };

  const flag = (key: FieldKey, en: string, hindi: string, disabled = false) => (
    <label className={`flex items-center gap-2.5 text-xs ${disabled ? "text-[#8a877d]" : "text-[#141513] cursor-pointer"}`}>
      <input
        type="checkbox"
        className="rounded accent-[#141513]"
        checked={Boolean(form[key])}
        disabled={disabled}
        onChange={(e) => change(key, e.target.checked)}
      />
      <span>{tr(en, hindi)}</span>
    </label>
  );

  const refresh = () => setRevision((v) => v + 1);

  async function submit() {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    await act(async () => {
      submissionKey.current ||= crypto.randomUUID();
      const response = await api.submitApplication({
        ...form,
        request_id: submissionKey.current,
      });
      setId(response.application_id);
      setTab("decision");
      refresh();
      setStep(0);
      submissionKey.current = "";
      setMessage(
        tr(
          "Application submitted. Track the bank review and allocation decision below.",
          "आवेदन जमा हो गया है। बैंक समीक्षा और निर्णय नीचे देखें।",
        ),
      );
    });
  }

  async function sow(trancheId: number, file: File) {
    await act(async () => {
      if (!navigator.geolocation) {
        throw Error(tr("Device location unavailable.", "डिवाइस स्थान उपलब्ध नहीं है।"));
      }
      const position = await new Promise<GeolocationPosition>((ok, fail) =>
        navigator.geolocation.getCurrentPosition(ok, fail, { timeout: 12000 }),
      );
      const uploaded = await api.uploadFile(file);
      await api.verifySowing(trancheId, {
        geo_lat: position.coords.latitude,
        geo_long: position.coords.longitude,
        geo_proof_photo: uploaded.url,
      });
      refresh();
      setMessage(
        tr(
          "Photo and device coordinates recorded for this simulation.",
          "इस अभ्यास के लिए फोटो और स्थान दर्ज किए गए।",
        ),
      );
    });
  }

  const tabs: { key: "apply" | "decision" | "wallet" | "appeals"; labelKey: "tab_apply" | "tab_outcome" | "tab_wallet" | "tab_grievances" }[] = [
    { key: "apply", labelKey: "tab_apply" },
    { key: "decision", labelKey: "tab_outcome" },
    { key: "wallet", labelKey: "tab_wallet" },
    { key: "appeals", labelKey: "tab_grievances" },
  ];

  const stages = [
    tr("Applicant", "आवेदक"),
    tr("Farm & Crop", "खेत एवं फसल"),
    tr("Finances", "वित्तीय विवरण"),
    tr("Credit Request", "ऋण अनुरोध"),
  ];

  const harvestCurveData = detail
    ? [
        { stage: tr("Sowing", "बुवाई"), expected: 0, stress: 0 },
        { stage: tr("Vegetative", "वृद्धि"), expected: Math.round(detail.expected_revenue * 0.2), stress: Math.round(detail.drought_stress_revenue * 0.15) },
        { stage: tr("Flowering", "फूल"), expected: Math.round(detail.expected_revenue * 0.52), stress: Math.round(detail.drought_stress_revenue * 0.45) },
        { stage: tr("Maturity", "परिपक्वता"), expected: Math.round(detail.expected_revenue * 0.85), stress: Math.round(detail.drought_stress_revenue * 0.78) },
        { stage: tr("Harvest", "कटाई"), expected: Math.round(detail.expected_revenue), stress: Math.round(detail.drought_stress_revenue) },
      ]
    : [];

  const computedNetWorth =
    (+form.movable_asset_k || 0) + (+form.immovable_asset_l || 0) - (+form.existing_debt || 0);
  const hasDebt = Number(form.existing_debt) > 0;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Editorial Title & Section Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#8a877d]">{t(lang, "farmer_eyebrow")}</p>
          <h1 className="text-3xl font-medium tracking-tight text-[#141513] mt-0.5">
            {t(lang, "farmer_title")}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setTab(item.key);
                setError("");
                setMessage("");
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === item.key
                  ? "bg-[#141513] text-white"
                  : "bg-white border border-black/[0.08] text-[#5e5c55] hover:text-[#141513]"
              }`}
            >
              {t(lang, item.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="bento-card p-3.5 bg-red-50 border-red-200 text-xs text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="bento-card p-3.5 bg-[#eef7d6] border-[#b8e354]/60 text-xs text-[#365314] flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* TAB 1: APPLICATION WIZARD + LIVE ESTIMATOR */}
      {tab === "apply" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            className="lg:col-span-8 bento-card p-5 sm:p-6 flex flex-col justify-between min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-black/[0.06]">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-[#8a877d]">
                    {step + 1}/4 · {stages[step]}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {[0, 1, 2, 3].map((idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setStep(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx <= step ? "w-7 bg-[#a3d929]" : "w-4 bg-[#e5e5dc]"
                        }`}
                        aria-label={stages[idx]}
                      />
                    ))}
                  </div>
                </div>

                {step === 0 && (
                  <VoiceName
                    lang={lang}
                    onName={(v) => change("full_name", v)}
                    onError={setError}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {step === 0 && (
                  <>
                    {field("full_name", "Full name", "पूरा नाम")}
                    {field("phone", "Mobile number (10 digits)", "मोबाइल नंबर (10 अंक)", undefined, "tel")}
                    {field("pmkisan_id", "PM-KISAN ID (optional)", "पीएम-किसान पहचान (वैकल्पिक)", undefined, "text", true)}
                    {field("gender", "Gender", "लिंग", ["M", "F", "Other"])}
                    {field("social_category", "Social category", "श्रेणी", [
                      "GEN",
                      "OBC",
                      "SC",
                      "ST",
                      "Women",
                      "Minority",
                      "PWD",
                    ])}
                    {field("district", "District", "जिला", DISTRICTS)}
                    {field("village", "Village", "गाँव")}
                  </>
                )}

                {step === 1 && (
                  <>
                    {field("survey_khasra_no", "Plot / khasra number", "खसरा संख्या")}
                    {field("area_acres", "Cultivated area (acres)", "खेती का क्षेत्रफल (एकड़)", undefined, "number")}
                    {field("ownership_type", "Land tenure", "भूमि अधिकार", [
                      "owned",
                      "registered_lease",
                      "oral_lease",
                      "sharecropper",
                    ])}
                    {field("irrigation_source", "Irrigation source", "सिंचाई साधन", [
                      "Drip",
                      "Sprinkler",
                      "Canal",
                      "Well",
                      "Dry",
                    ])}
                    {field("primary_crop", "Primary crop", "मुख्य फसल", [
                      "Wheat",
                      "Paddy",
                      "Potato",
                      "Mustard",
                      "Sugarcane",
                      "Gram",
                      "Maize",
                    ])}
                    {field("secondary_crop", "Secondary crop (optional)", "दूसरी फसल (वैकल्पिक)", undefined, "text", true)}
                    {field("distance_to_mandi_km", "Distance to mandi (km)", "मंडी की दूरी (किमी)", undefined, "number")}
                    {field("livestock_count", "Dairy animals", "दुधारू पशु", undefined, "number")}
                  </>
                )}

                {step === 2 && (
                  <>
                    {field("movable_asset_k", "Movable assets (₹)", "चल संपत्ति (₹)", undefined, "number")}
                    {field("immovable_asset_l", "Immovable assets (₹)", "अचल संपत्ति (₹)", undefined, "number")}
                    {field("existing_debt", "Outstanding debt (₹)", "शेष कर्ज (₹)", undefined, "number")}
                    {hasDebt ? (
                      field("overdue_days", "Days overdue", "अतिदेय दिन", undefined, "number")
                    ) : (
                      <div className="bento-surface-soft px-3.5 py-2.5 flex items-center text-xs text-[#8a877d]">
                        {tr("Enter outstanding debt to report overdue days or NPA status.", "अतिदेय दिन या एनपीए स्थिति दर्ज करने के लिए शेष कर्ज लिखें।")}
                      </div>
                    )}

                    <div className="sm:col-span-2 space-y-2.5 pt-1">
                      {flag(
                        "reported_npa",
                        "Existing lender has classified debt as NPA",
                        "ऋणदाता ने कर्ज को एनपीए घोषित किया है",
                        !hasDebt,
                      )}
                      {flag(
                        "is_informal_debt_only",
                        "Debt is only from informal lenders",
                        "कर्ज केवल अनौपचारिक ऋणदाताओं से है",
                        !hasDebt,
                      )}
                    </div>

                    <div className="sm:col-span-2 bento-surface-soft p-3.5 flex items-center justify-between text-xs">
                      <span className="text-[#5e5c55]">{tr("Calculated net worth", "निवल संपत्ति (संपत्ति − कर्ज)")}</span>
                      <span className={`font-mono font-medium text-sm ${computedNetWorth >= 0 ? "text-[#141513]" : "text-red-700"}`}>
                        {formatMoney(computedNetWorth)}
                      </span>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    {field("requested_amount", "Requested amount (₹)", "माँगी गई राशि (₹)", undefined, "number")}
                    {field("facility_type", "Credit facility", "ऋण प्रकार", [
                      "Crop KCC",
                      "Flexi KCC",
                      "Allied KCC",
                      "Agri Term Loan",
                    ])}
                    {field("bank_assigned", "Lending bank", "ऋणदाता बैंक", BANKS)}
                    {field("marketing_tieup", "Marketing arrangement", "विपणन व्यवस्था", [
                      "Cooperative",
                      "Government_Procurement",
                      "Corporate_Contract",
                      "Direct",
                      "None",
                    ])}
                    <div className="sm:col-span-2 pt-1">
                      {flag("pmfby_optin", "Include crop insurance (PMFBY)", "फसल बीमा शामिल करें (PMFBY)")}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-black/[0.06] flex items-center justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="control"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{tr("Back", "पीछे")}</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex items-center space-x-1.5 px-5 py-2 bg-[#141513] text-[#d4f04c] rounded-full text-xs font-medium hover:bg-black/85 disabled:opacity-50"
              >
                {step < 3 ? (
                  <>
                    <span>{tr("Continue", "आगे बढ़ें")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{busy ? tr("Submitting…", "भेजा जा रहा है…") : tr("Submit for bank review", "बैंक समीक्षा के लिए भेजें")}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Right Live Intelligence Bento Column */}
          <div className="lg:col-span-4 space-y-5 min-w-0">
            <div className="bento-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-medium text-[#141513]">
                  {tr("Eligibility Estimate", "पात्रता अनुमान")}
                </h2>
                {estimateLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8a877d]" />}
              </div>

              {estimate ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-[#8a877d]">
                      {tr("Recommended Limit", "अनुशंसित सीमा")}
                    </span>
                    <div className="text-3xl font-medium text-[#141513] font-mono mt-0.5">
                      {formatMoney(estimate.estimated_sanction_amount)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/[0.06] text-xs">
                    <div>
                      <span className="text-[#8a877d]">{tr("Classification", "वर्ग")}</span>
                      <div className="font-medium text-[#141513] mt-0.5">
                        {label(estimate.farmer_classification)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[#8a877d]">{tr("Interest Rate", "ब्याज दर")}</span>
                      <div className="font-medium text-[#4d7c0f] font-mono mt-0.5">
                        {estimate.interest_rate_effective}% p.a.
                      </div>
                    </div>
                    <div>
                      <span className="text-[#8a877d]">{tr("Scale of Finance", "वित्त मान")}</span>
                      <div className="font-mono text-[#141513] mt-0.5">
                        {formatMoney(estimate.scale_of_finance_limit)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[#8a877d]">{tr("Collateral", "जमानत")}</span>
                      <div className="font-medium text-[#141513] mt-0.5">
                        {estimate.collateral_required ? tr("Required", "आवश्यक") : tr("Waived", "मुक्त")}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#5e5c55] bento-surface-soft p-3 leading-relaxed">
                    {tr(
                      "Bank underwriting reviews cash flow, plot overlap, and budget availability before final sanction.",
                      "ऋण स्वीकृति से पहले बैंक अधिकारी नकदी प्रवाह, खसरा विवरण और बजट की समीक्षा करेंगे।",
                    )}
                  </p>
                </div>
              ) : (
                <p className="py-6 text-xs text-[#8a877d]">
                  {estimateError
                    ? tr("Check land area and requested amount.", "क्षेत्रफल और माँगी गई राशि जाँचें।")
                    : tr("Estimating…", "गणना जारी है…")}
                </p>
              )}
            </div>

            {estimate && (
              <ClimateGaugeCard
                title={tr("Repayment Capacity", "भुगतान क्षमता")}
                subtitle={`${label(form.district)} · ${label(form.primary_crop)}`}
                primaryValue={`${estimate.dscr_ratio}x`}
                progressRatio={Math.min(1, estimate.dscr_ratio / 2.5)}
                metric1Label={tr("Rate", "ब्याज")}
                metric1Val={`${estimate.interest_rate_effective}%`}
                metric2Label={tr("Facility", "प्रकार")}
                metric2Val={estimate.recommended_instrument.includes("Flexi") ? "Flexi KCC" : "KCC"}
                metric3Label={tr("Net Crop", "अनुमानित आय")}
                metric3Val={`₹${Math.round((estimate.expected_crop_revenue || 0) / 1000)}k`}
              />
            )}
          </div>
        </div>
      ) : (
        /* TAB 2, 3, 4: APPLICATION SELECTOR + STRUCTURED BENTO VIEWS */
        <div className="space-y-5">
          <div className="bento-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-[#8a877d]">{tr("Application", "आपका आवेदन")}</span>
              <select
                aria-label={tr("Application", "आपका आवेदन")}
                className="px-3.5 py-1.5 rounded-full bg-[#fafaf6] border border-black/[0.08] text-xs font-mono font-medium text-[#141513]"
                value={id}
                onChange={(e) => setId(+e.target.value)}
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.application_no} ({label(a.status)})
                  </option>
                ))}
              </select>
              {detail && (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClass(detail.status)}`}>
                  {label(detail.status)}
                </span>
              )}
            </div>

            <button
              onClick={refresh}
              className="control"
              title={tr("Refresh", "ताज़ा करें")}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{tr("Refresh", "ताज़ा करें")}</span>
            </button>
          </div>

          {!detail ? (
            <div className="bento-card p-10 text-center text-xs text-[#8a877d]">
              {id
                ? tr("Loading application details…", "आवेदन विवरण लोड हो रहा है…")
                : tr("Your submitted applications will appear here.", "आपके जमा आवेदन यहाँ दिखाई देंगे।")}
            </div>
          ) : (
            <>
              {/* TAB 2: DECISION, HARVEST CURVE & RISK EXPLAINABILITY */}
              {tab === "decision" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-8 space-y-5 min-w-0">
                    <div className="bento-card p-6 space-y-5 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-[#8a877d]">
                            {detail.application_no} · {detail.bank_assigned} · {label(detail.district)}
                          </div>
                          <h2 className="text-xl font-medium text-[#141513] mt-0.5">
                            {label(detail.status)}
                          </h2>
                        </div>

                        <button
                          onClick={() => setDecisionTreeOpen(true)}
                          className="control"
                        >
                          <Scale className="w-3.5 h-3.5 text-[#4d7c0f]" />
                          <span>{tr("Eligibility Rules", "पात्रता नियम")}</span>
                        </button>
                      </div>

                      {/* 3-Column Amount Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bento-surface-soft p-3.5">
                          <span className="text-[11px] text-[#8a877d]">{tr("Requested Amount", "अनुरोधित राशि")}</span>
                          <div className="text-lg font-medium font-mono text-[#141513] mt-0.5">
                            {formatMoney(detail.requested_amount)}
                          </div>
                        </div>
                        <div className="bento-surface-soft p-3.5">
                          <span className="text-[11px] text-[#8a877d]">{tr("DSS Recommended", "अनुशंसित राशि")}</span>
                          <div className="text-lg font-medium font-mono text-[#141513] mt-0.5">
                            {formatMoney(detail.recommended_amount)}
                          </div>
                        </div>
                        <div className="bento-surface-soft p-3.5">
                          <span className="text-[11px] text-[#8a877d]">{tr("Bank Sanctioned", "स्वीकृत राशि")}</span>
                          <div className={`text-lg font-medium font-mono mt-0.5 ${detail.sanctioned_amount > 0 ? "text-[#4d7c0f]" : "text-[#8a877d]"}`}>
                            {formatMoney(detail.sanctioned_amount)}
                          </div>
                        </div>
                      </div>

                      {detail.review_reason && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                          <strong className="font-medium">{tr("Review flag:", "समीक्षा कारण:")}</strong>{" "}
                          {tr(
                            detail.review_reason,
                            detail.review_reason.includes("plot")
                              ? "खसरा संख्या दूसरे आवेदन से मेल खाती है। अधिकारी भूमि विवरण जाँचेंगे।"
                              : detail.review_reason.includes("default")
                                ? "ऋणदाता द्वारा दर्ज चूक के कारण समीक्षा आवश्यक है।"
                                : "अनुमानित नकदी प्रवाह भुगतान के लिए अपर्याप्त है।",
                          )}
                        </div>
                      )}

                      {detail.decision_note && (
                        <div className="p-3.5 rounded-xl bg-[#f5f5ee] border border-black/[0.08] text-xs text-[#141513]">
                          <strong className="font-medium">{tr("Officer's reason:", "अधिकारी का कारण:")}</strong>{" "}
                          {detail.decision_note}
                        </div>
                      )}

                      {/* Smooth Recharts Cash-Flow AreaChart */}
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-[#141513]">
                            {tr("Seasonal Revenue & Drought Stress", "फसल आय एवं सूखा तनाव पूर्वानुमान")}
                          </span>
                          <span className="font-mono text-[#5e5c55]">
                            {formatMoney(detail.expected_revenue)} / {formatMoney(detail.drought_stress_revenue)}
                          </span>
                        </div>
                        <div className="h-52 w-full min-w-0">
                          <ResponsiveContainer width="100%" height={208} minWidth={0}>
                            <AreaChart data={harvestCurveData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="farmerExpectedGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#b8e354" stopOpacity={0.55} />
                                  <stop offset="95%" stopColor="#b8e354" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="farmerStressGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#9cc0d1" stopOpacity={0.45} />
                                  <stop offset="95%" stopColor="#9cc0d1" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,21,19,0.06)" vertical={false} />
                              <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#8a877d" }} axisLine={false} tickLine={false} />
                              <YAxis
                                tick={{ fontSize: 11, fill: "#8a877d" }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                                width={46}
                              />
                              <Tooltip
                                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, ""]}
                                contentStyle={{ fontSize: "12px", borderRadius: "12px", border: "1px solid rgba(20,21,19,0.08)" }}
                              />
                              <Area
                                type="monotone"
                                dataKey="expected"
                                name={tr("Normal Revenue", "सामान्य आय")}
                                stroke="#84cc16"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#farmerExpectedGrad)"
                              />
                              <Area
                                type="monotone"
                                dataKey="stress"
                                name={tr("Drought Stress", "सूखा आय")}
                                stroke="#7aa2b8"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#farmerStressGrad)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Climate Gauge + Top SHAP Risk Drivers */}
                  <div className="lg:col-span-4 space-y-5 min-w-0">
                    <ClimateGaugeCard
                      title={tr("DSCR & Weather", "क्षमता एवं मौसम")}
                      subtitle={`${label(detail.district)} · ${
                        detail.weather_profile?.source === "open-meteo-live"
                          ? tr("Live Open-Meteo", "वर्तमान पूर्वानुमान")
                          : tr("District baseline", "जिला आधार अनुमान")
                      }`}
                      primaryValue={`${detail.dscr_ratio}x`}
                      progressRatio={Math.min(1, detail.dscr_ratio / 2.2)}
                      metric1Label={tr("Temp", "तापमान")}
                      metric1Val={`${detail.weather_profile?.avg_max_temp_c ?? 26.5}°C`}
                      metric2Label={tr("14d Rain", "14-दिन वर्षा")}
                      metric2Val={`${detail.weather_profile?.forecast_14d_precip_mm ?? 0} mm`}
                      metric3Label={tr("Net Worth", "निवल संपत्ति")}
                      metric3Val={`₹${Math.round((detail.net_worth || 0) / 1000)}k`}
                      onExpand={() => setDecisionTreeOpen(true)}
                    />

                    <div className="bento-card p-5 space-y-3">
                      <h3 className="text-[15px] font-medium text-[#141513]">
                        {tr("Model Risk Drivers", "जोखिम के प्रमुख कारक")}
                      </h3>
                      <div className="space-y-2">
                        {detail.shap_reasons.map((r, idx) => {
                          const decreases = r.direction === "RISK_DECREASE";
                          return (
                            <div key={r.feature ?? idx} className="bento-surface-soft p-3 flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-[#141513]">
                                  {hi ? label(r.feature ?? r.name) : r.name}
                                </div>
                                {!hi && <p className="text-[11px] text-[#5e5c55] mt-0.5 leading-snug">{r.text}</p>}
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                                  decreases ? "bg-[#eef7d6] text-[#365314]" : "bg-amber-100 text-amber-900"
                                }`}
                              >
                                {decreases ? tr("Lowers risk", "कम जोखिम") : tr("Raises risk", "अधिक जोखिम")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PURPOSE-LOCKED TRANCHES & WALLET */}
              {tab === "wallet" && (
                !detail.tranches.length ? (
                  <div className="bento-card p-10 text-center space-y-3">
                    <div className="text-sm font-medium text-[#141513]">
                      {tr("Wallet Pending Bank Sanction", "वॉलेट बैंक स्वीकृति की प्रतीक्षा में है")}
                    </div>
                    <p className="text-xs text-[#5e5c55] max-w-md mx-auto">
                      {tr(
                        "Vouchers are issued once your bank reviews this application and commits it inside an approved portfolio batch.",
                        "बैंक अधिकारी द्वारा आवेदन समीक्षा और बैच स्वीकृति के बाद आपके ई-रूपी वाउचर यहाँ दिखाई देंगे।",
                      )}
                    </p>
                    <button onClick={() => setTab("decision")} className="control">
                      {tr("View Application Decision", "आवेदन निर्णय देखें")}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {detail.tranches.map((trItem) => {
                      const titleText = [
                        tr("Tranche 1 · Input Voucher (60%)", "किस्त 1 · सामग्री वाउचर (60%)"),
                        tr("Tranche 2 · Operations Credit (30%)", "किस्त 2 · संचालन ऋण (30%)"),
                        tr("Tranche 3 · Sowing Reserve (10%)", "किस्त 3 · बुवाई आरक्षित (10%)"),
                      ][trItem.tranche_no - 1] ?? trItem.tranche_name;

                      return (
                        <div key={trItem.id} className="bento-card p-6 flex flex-col justify-between space-y-5">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-mono text-[#8a877d]">
                                {tr(`Tranche ${trItem.tranche_no}`, `किस्त ${trItem.tranche_no}`)}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${statusBadgeClass(trItem.status)}`}>
                                {label(trItem.status)}
                              </span>
                            </div>

                            <div className="text-3xl font-medium font-mono text-[#141513]">
                              {formatMoney(trItem.amount)}
                            </div>
                            <div className="text-sm font-medium text-[#141513]">{titleText}</div>

                            {trItem.tranche_no === 1 && (
                              trItem.status === "redeemed" ? (
                                <div className="bento-surface-soft p-3.5 text-xs text-[#365314] space-y-1">
                                  <div className="font-medium">{tr("Voucher Redeemed", "वाउचर भुनाया गया")}</div>
                                  <div className="text-[#5e5c55]">{trItem.merchant_name}</div>
                                </div>
                              ) : (
                                <div className="space-y-3 pt-1">
                                  <div className="inline-flex p-3 bg-[#fafaf6] border border-black/[0.08] rounded-xl">
                                    <QRCodeSVG value={`krishisetu:demo-voucher:${trItem.voucher_code}`} size={116} />
                                  </div>
                                  <div className="bento-surface-soft px-3 py-1.5 text-[11px] font-mono text-[#5e5c55]">
                                    {tr("Demo voucher", "अभ्यास वाउचर")} · {trItem.voucher_code}
                                  </div>
                                </div>
                              )
                            )}

                            {trItem.tranche_no === 2 && (
                              <div className="bento-surface-soft p-3.5 space-y-2 text-xs text-[#5e5c55]">
                                <div className="flex justify-between gap-2">
                                  <span>{tr("Credit mode", "माध्यम")}</span>
                                  <span className="text-[#141513] font-medium">Bank / UPI Direct</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span>{tr("Usage", "उपयोग")}</span>
                                  <span className="text-[#141513]">{tr("Labor, diesel & irrigation", "श्रम, डीजल एवं सिंचाई")}</span>
                                </div>
                                {trItem.merchant_name && (
                                  <div className="flex justify-between gap-2 pt-1.5 border-t border-black/[0.06]">
                                    <span>{tr("Destination", "खाता")}</span>
                                    <span className="text-[#4d7c0f] font-medium">{trItem.merchant_name}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {trItem.tranche_no === 3 && (
                              <div className="bento-surface-soft p-3.5 space-y-2 text-xs text-[#5e5c55]">
                                <p className="leading-relaxed">
                                  {tr(
                                    "Unlocks upon geo-tagged sowing photograph and device location check; confirms 3% prompt-repayment rebate eligibility.",
                                    "बुवाई की फोटो और स्थान प्रमाण दर्ज करने पर आरक्षित राशि जारी होती है।",
                                  )}
                                </p>
                                {trItem.status === "disbursed" && trItem.geo_lat != null && (
                                  <div className="font-mono text-[11px] text-[#365314] pt-1 border-t border-black/[0.06]">
                                    GPS {Number(trItem.geo_lat).toFixed(4)}, {Number(trItem.geo_long).toFixed(4)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-black/[0.06]">
                            {trItem.tranche_no === 1 && trItem.status !== "redeemed" && (
                              <div className="space-y-2.5">
                                <select
                                  aria-label={tr("Authorized Merchant", "अधिकृत विक्रेता")}
                                  className="field mt-0"
                                  value={merchant}
                                  onChange={(e) => setMerchant(e.target.value)}
                                >
                                  {merchants.map((m) => (
                                    <option key={m.merchant_id} value={m.merchant_id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  disabled={busy || !merchant}
                                  className="primary w-full py-2.5"
                                  onClick={() =>
                                    void act(async () => {
                                      await api.redeemVoucher(trItem.voucher_code, merchant);
                                      refresh();
                                      setMessage(tr("Demo voucher redeemed at merchant.", "वाउचर विक्रेता केंद्र पर भुनाया गया।"));
                                    })
                                  }
                                >
                                  {tr("Simulate Redemption", "वाउचर भुनाने का अभ्यास")}
                                </button>
                              </div>
                            )}

                            {trItem.tranche_no === 2 && (
                              <div className="text-center text-xs text-[#4d7c0f] font-medium py-1.5">
                                {tr("Available in linked savings account", "खाते में उपलब्ध")}
                              </div>
                            )}

                            {trItem.tranche_no === 3 && (
                              trItem.status === "locked" ? (
                                <label className="primary w-full py-2.5 cursor-pointer">
                                  <Upload className="w-3.5 h-3.5 text-[#d4f04c]" />
                                  <span>
                                    {busy
                                      ? tr("Uploading…", "अपलोड हो रहा है…")
                                      : tr("Upload Sowing Photo + GPS", "बुवाई फोटो एवं स्थान दर्ज करें")}
                                  </span>
                                  <input
                                    className="hidden"
                                    type="file"
                                    accept="image/jpeg,image/png"
                                    disabled={busy}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) void sow(trItem.id, f);
                                    }}
                                  />
                                </label>
                              ) : (
                                <div className="text-center text-xs text-[#4d7c0f] font-medium py-1.5">
                                  {tr("Sowing proof recorded", "बुवाई प्रमाण दर्ज")}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* TAB 4: APPEALS & EVIDENCE */}
              {tab === "appeals" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <form
                    className="lg:col-span-5 bento-card p-6 space-y-4 h-fit"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(async () => {
                        const doc = attachment ? (await api.uploadFile(attachment)).url : null;
                        await api.fileGrievance({
                          application_id: id,
                          farmer_id: detail.farmer_id,
                          category,
                          grievance_text: appeal,
                          supporting_doc: doc,
                        });
                        setAppeal("");
                        setAttachment(null);
                        refresh();
                        setMessage(tr("Appeal filed. Bank response SLA is 7 days.", "अपील दर्ज हो गई।"));
                      });
                    }}
                  >
                    <h2 className="text-[15px] font-medium text-[#141513]">
                      {tr("File an Appeal (7-Day SLA)", "अपील दर्ज करें (7 दिन समय-सीमा)")}
                    </h2>

                    <label className="block text-xs text-[#5e5c55]">
                      {tr("Reason", "कारण")}
                      <select
                        className="field"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {[
                          "Unfair rejection",
                          "Incorrect land area",
                          "Delayed disbursal >14 days",
                          "Other",
                        ].map((c) => (
                          <option key={c} value={c}>
                            {label(c)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs text-[#5e5c55]">
                      {tr("Details", "विवरण")}
                      <textarea
                        rows={4}
                        className="field"
                        required
                        placeholder={tr("Explain why this decision needs review", "समीक्षा का कारण लिखें")}
                        value={appeal}
                        onChange={(e) => setAppeal(e.target.value)}
                      />
                    </label>

                    <div className="space-y-1.5">
                      <span className="block text-xs text-[#5e5c55]">
                        {tr("Supporting Evidence (optional, PDF/JPEG/PNG up to 5 MB)", "प्रमाण (वैकल्पिक, PDF या फोटो 5 MB तक)")}
                      </span>
                      <label className="control w-full justify-between px-4 py-2.5">
                        <span className="truncate text-xs text-[#5e5c55]">
                          {attachment ? attachment.name : tr("Choose PDF or image", "PDF या फोटो चुनें")}
                        </span>
                        <Upload className="w-3.5 h-3.5 text-[#4d7c0f] shrink-0" />
                        <input
                          type="file"
                          className="hidden"
                          accept="application/pdf,image/png,image/jpeg"
                          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>

                    <button disabled={busy} className="primary w-full py-2.5">
                      {busy ? tr("Submitting…", "भेजा जा रहा है…") : tr("Submit Appeal", "अपील भेजें")}
                    </button>
                  </form>

                  <div className="lg:col-span-7 bento-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[15px] font-medium text-[#141513]">
                        {tr("Appeal History", "अपील का इतिहास")}
                      </h2>
                      <span className="text-xs font-mono text-[#8a877d]">{detail.grievances.length}</span>
                    </div>

                    {detail.grievances.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[#8a877d]">
                        {tr("No appeals filed for this application.", "इस आवेदन के लिए कोई अपील नहीं है।")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detail.grievances.map((g) => (
                          <div key={g.id} className="bento-surface-soft p-4 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-[#141513]">
                                #{g.id} · {label(g.category)}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClass(g.resolution_status)}`}>
                                {label(g.resolution_status)}
                              </span>
                            </div>

                            <p className="text-xs text-[#5e5c55]">{g.grievance_text}</p>

                            {g.bank_response && (
                              <div className="p-2.5 rounded-lg bg-[#eef7d6] text-xs text-[#365314]">
                                {tr("Bank:", "बैंक:")} {g.bank_response}
                              </div>
                            )}

                            {g.govt_directive && (
                              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                                {tr("Government Directive:", "सरकारी निर्देश:")} {g.govt_directive}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#8a877d] font-mono">
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {tr("SLA", "अंतिम तिथि")}: {g.sla_deadline?.slice(0, 10) || "—"}
                                </span>
                              </span>
                              {g.supporting_doc && /^[a-f0-9]{32}$/.test(g.supporting_doc) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void api.downloadEvidence(g.supporting_doc!).catch((err) => setError(err.message))
                                  }
                                  className="control py-1 px-3 text-[11px]"
                                >
                                  <FileDown className="w-3 h-3" />
                                  <span>{tr("Download Evidence", "प्रमाण डाउनलोड")}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <DecisionTreeModal
        isOpen={decisionTreeOpen}
        onClose={() => setDecisionTreeOpen(false)}
        outcome={detail}
      />
    </div>
  );
}

type SpeechEngine = {
  lang: string;
  start: () => void;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  onerror: (() => void) | null;
};

function VoiceName({
  lang,
  onName,
  onError,
}: {
  lang: Language;
  onName: (value: string) => void;
  onError: (value: string) => void;
}) {
  function listen() {
    const device = window as Window & {
      SpeechRecognition?: new () => SpeechEngine;
      webkitSpeechRecognition?: new () => SpeechEngine;
    };
    const Engine = device.SpeechRecognition ?? device.webkitSpeechRecognition;
    const unavailable =
      lang === "hi"
        ? "आवाज़ उपलब्ध नहीं है। नाम टाइप करें।"
        : "Voice input unavailable in this browser. Type your name instead.";
    if (!Engine) {
      onError(unavailable);
      return;
    }
    const recognition = new Engine();
    recognition.lang = lang === "hi" ? "hi-IN" : "en-IN";
    recognition.onresult = (e) => onName(e.results[0][0].transcript);
    recognition.onerror = () => onError(unavailable);
    try {
      recognition.start();
    } catch {
      onError(unavailable);
    }
  }

  return (
    <button
      type="button"
      onClick={listen}
      className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f5f5ee] text-[#141513] hover:bg-[#ebebdf] text-xs font-medium transition-colors"
    >
      <Mic className="w-3.5 h-3.5 text-[#4d7c0f]" />
      <span>{lang === "hi" ? "नाम बोलें" : "Dictate name"}</span>
    </button>
  );
}
