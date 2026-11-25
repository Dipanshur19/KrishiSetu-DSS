"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import type {
  AuthSession,
  EligibilityEstimate,
  FarmerApplicationOutcome,
  Language,
  Merchant,
} from "@/types/dss";

const districts = [
  "Kanpur Dehat",
  "Kanpur Nagar",
  "Unnao",
  "Jhansi",
  "Lucknow",
  "Barabanki",
  "Fatehpur",
];
const banks = [
  "State Bank of India",
  "Bank of India",
  "Punjab National Bank",
  "Bank of Baroda",
  "Axis Bank",
  "HDFC Bank",
];
const defaults = {
  full_name: "",
  phone: "",
  pmkisan_id: "",
  gender: "M",
  social_category: "OBC",
  district: districts[0],
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
  bank_assigned: banks[0],
  requested_amount: "60000",
  pmfby_optin: true,
};
type FormData = typeof defaults;
type Key = keyof FormData;
const words: Record<string, string> = {
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
  Drip: "टपक",
  Sprinkler: "फव्वारा",
  Canal: "नहर",
  Dry: "वर्षा आधारित",
  Wheat: "गेहूँ",
  Paddy: "धान",
  Potato: "आलू",
  Mustard: "सरसों",
  Sugarcane: "गन्ना",
  Gram: "चना",
  Maize: "मक्का",
  Cooperative: "सहकारी",
  Direct: "सीधी बिक्री",
  None: "कोई नहीं",
  Corporate_Contract: "कंपनी अनुबंध",
  Government_Procurement: "सरकारी खरीद",
  Marginal: "सीमांत",
  Small: "लघु",
  Other: "अन्य",
  F: "महिला",
  M: "पुरुष",
  GEN: "सामान्य",
  Women: "महिला समूह",
  Minority: "अल्पसंख्यक",
  PWD: "दिव्यांग",
  "Crop KCC": "फसल किसान क्रेडिट कार्ड",
  "Allied KCC": "संबद्ध गतिविधि किसान क्रेडिट कार्ड",
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
  micro_irrigation_score: "सिंचाई",
  pmfby_insured: "फसल बीमा",
  marketing_tieup: "विपणन व्यवस्था",
  livestock_count: "पशुधन",
  mandi_distance_km: "मंडी से दूरी",
  dscr_ratio: "पुनर्भुगतान क्षमता",
};
const plain: Record<string, string> = {
  submitted: "Awaiting bank allocation",
  under_review: "Officer review required",
  partial_approved: "Partially approved",
  M: "Male",
  F: "Female",
  GEN: "General",
};
const money = (value: number) =>
  "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

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
    hi ? (words[s] ?? s) : (plain[s] ?? s.replaceAll("_", " "));
  const [tab, setTab] = useState("apply");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    ...defaults,
    full_name: session.user.full_name,
  });
  const [estimate, setEstimate] = useState<EligibilityEstimate | null>(null);
  const [estimateError, setEstimateError] = useState(false);
  const [apps, setApps] = useState<
    { id: number; application_no: string; status: string }[]
  >([]);
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
  const submissionKey = useRef("");
  useEffect(() => {
    let valid = true;
    api
      .myApplications()
      .then((rows) => {
        if (valid) {
          setApps(rows);
          setId((prev) =>
            rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? 0),
          );
        }
      })
      .catch((e) => {
        if (valid) setError(e.message);
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
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let valid = true;
    setDetail(null);
    if (id)
      api
        .getApplicationOutcome(id)
        .then((d) => {
          if (valid) setDetail(d);
        })
        .catch((e) => {
          if (valid) setError(e.message);
        });
    return () => {
      valid = false;
    };
  }, [id, revision]);
  useEffect(() => {
    let valid = true;
    setEstimate(null);
    setEstimateError(false);
    const timer = setTimeout(
      () =>
        api
          .estimateEligibility(form)
          .then((d) => {
            if (valid) setEstimate(d);
          })
          .catch(() => {
            if (valid) setEstimateError(true);
          }),
      350,
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
  const change = (key: Key, value: string | boolean) => {
    submissionKey.current = "";
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const field = (
    key: Key,
    en: string,
    hindi: string,
    options?: string[],
    type = "text",
    optional = false,
  ) => {
    const name = tr(en, hindi),
      value = String(form[key]);
    return (
      <label key={key} className="text-sm">
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
            className="field"
            type={type}
            value={value}
            required={!optional}
            min={key === "area_acres" || key === "requested_amount" ? 0.01 : 0}
            step={
              key === "livestock_count" || key === "overdue_days" ? "1" : "any"
            }
            pattern={key === "phone" ? "[0-9]{10}" : undefined}
            onChange={(e) => change(key, e.target.value)}
          />
        )}
      </label>
    );
  };
  const flag = (key: Key, en: string, hindi: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean(form[key])}
        onChange={(e) => change(key, e.target.checked)}
      />
      {tr(en, hindi)}
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
          "Application received. Track the bank decision below.",
          "आवेदन प्राप्त हुआ। बैंक का निर्णय नीचे देखें।",
        ),
      );
    });
  }
  async function sow(trancheId: number, file: File) {
    await act(async () => {
      if (!navigator.geolocation)
        throw Error(tr("Device location unavailable.", "स्थान उपलब्ध नहीं है।"));
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
          "Photo and location recorded for this simulation.",
          "इस अभ्यास के लिए फोटो और स्थान दर्ज किए गए।",
        ),
      );
    });
  }
  const tabs = [
    ["apply", "Apply", "आवेदन"],
    ["decision", "Decision", "निर्णय"],
    ["wallet", "Wallet", "वॉलेट"],
    ["appeals", "Appeals", "अपील"],
  ];
  const stages = [
    tr("Applicant", "आवेदक"),
    tr("Farm", "खेत"),
    tr("Finances", "वित्तीय विवरण"),
    tr("Credit request", "ऋण अनुरोध"),
  ];
  return (
    <section className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <div>
        <p className="text-sm text-stone-600">
          {tr("Farmer workspace", "किसान कार्यक्षेत्र")}
        </p>
        <h1 className="text-3xl font-semibold">
          {tr("Agricultural credit", "कृषि ऋण")}
        </h1>
      </div>
      <nav className="flex flex-wrap gap-2">
        {tabs.map(([key, en, hindi]) => (
          <button
            className={key === tab ? "primary" : "control"}
            key={key}
            onClick={() => {
              setTab(key);
              setError("");
              setMessage("");
            }}
          >
            {tr(en, hindi)}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-lime-100 p-3">
          {message}
        </p>
      )}
      {tab === "apply" ? (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <form
            className="bento-card space-y-5 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h2 className="text-xl font-medium">
              {step + 1}/4 · {stages[step]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {step === 0 && (
                <>
                  {field("full_name", "Full name", "पूरा नाम")}
                  {field(
                    "phone",
                    "Mobile number (10 digits)",
                    "मोबाइल नंबर (10 अंक)",
                    undefined,
                    "tel",
                  )}
                  {field(
                    "pmkisan_id",
                    "PM-KISAN ID (optional)",
                    "पीएम-किसान पहचान (वैकल्पिक)",
                    undefined,
                    "text",
                    true,
                  )}
                  {field("gender", "Gender", "लिंग", ["M", "F", "Other"])}
                  {field("social_category", "Category", "श्रेणी", [
                    "GEN",
                    "OBC",
                    "SC",
                    "ST",
                    "Women",
                    "Minority",
                    "PWD",
                  ])}
                  {field("district", "District", "जिला", districts)}
                  {field("village", "Village", "गाँव")}
                  <VoiceName
                    lang={lang}
                    onName={(v) => change("full_name", v)}
                    onError={setError}
                  />
                </>
              )}
              {step === 1 && (
                <>
                  {field(
                    "survey_khasra_no",
                    "Plot / khasra number",
                    "खसरा संख्या",
                  )}
                  {field(
                    "area_acres",
                    "Cultivated area (acres)",
                    "खेती का क्षेत्रफल (एकड़)",
                    undefined,
                    "number",
                  )}
                  {field("ownership_type", "Tenure", "भूमि अधिकार", [
                    "owned",
                    "registered_lease",
                    "oral_lease",
                    "sharecropper",
                  ])}
                  {field("irrigation_source", "Irrigation", "सिंचाई", [
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
                  {field(
                    "secondary_crop",
                    "Secondary crop (optional)",
                    "दूसरी फसल (वैकल्पिक)",
                    undefined,
                    "text",
                    true,
                  )}
                  {field(
                    "distance_to_mandi_km",
                    "Distance to market (km)",
                    "मंडी की दूरी (किमी)",
                    undefined,
                    "number",
                  )}
                  {field(
                    "livestock_count",
                    "Dairy animals",
                    "दुधारू पशु",
                    undefined,
                    "number",
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  {field(
                    "movable_asset_k",
                    "Movable assets (₹)",
                    "चल संपत्ति (₹)",
                    undefined,
                    "number",
                  )}
                  {field(
                    "immovable_asset_l",
                    "Immovable assets (₹)",
                    "अचल संपत्ति (₹)",
                    undefined,
                    "number",
                  )}
                  {field(
                    "existing_debt",
                    "Outstanding debt (₹)",
                    "शेष कर्ज (₹)",
                    undefined,
                    "number",
                  )}
                  {field(
                    "overdue_days",
                    "Days overdue",
                    "अतिदेय दिन",
                    undefined,
                    "number",
                  )}
                  {flag(
                    "reported_npa",
                    "Existing lender has classified debt as NPA",
                    "ऋणदाता ने कर्ज को एनपीए घोषित किया है",
                  )}
                  {flag(
                    "is_informal_debt_only",
                    "Debt is only from informal lenders",
                    "कर्ज केवल अनौपचारिक ऋणदाताओं से है",
                  )}
                  <p>
                    {tr("Net worth", "निवल संपत्ति")} ·{" "}
                    {money(
                      +form.movable_asset_k +
                        +form.immovable_asset_l -
                        +form.existing_debt,
                    )}
                  </p>
                </>
              )}
              {step === 3 && (
                <>
                  {field(
                    "requested_amount",
                    "Requested amount (₹)",
                    "माँगी गई राशि (₹)",
                    undefined,
                    "number",
                  )}
                  {field("facility_type", "Facility", "ऋण प्रकार", [
                    "Crop KCC",
                    "Flexi KCC",
                    "Allied KCC",
                    "Agri Term Loan",
                  ])}
                  {field("bank_assigned", "Lending bank", "ऋणदाता बैंक", banks)}
                  {field(
                    "marketing_tieup",
                    "Marketing arrangement",
                    "विपणन व्यवस्था",
                    [
                      "Cooperative",
                      "Government_Procurement",
                      "Corporate_Contract",
                      "Direct",
                      "None",
                    ],
                  )}
                  {flag(
                    "pmfby_optin",
                    "Include crop insurance",
                    "फसल बीमा शामिल करें",
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  className="control"
                  onClick={() => setStep(step - 1)}
                >
                  {tr("Back", "पीछे")}
                </button>
              )}
              <button className="primary" disabled={busy}>
                {step < 3
                  ? tr("Continue", "आगे बढ़ें")
                  : tr("Submit for bank review", "बैंक समीक्षा के लिए भेजें")}
              </button>
            </div>
          </form>
          <aside className="bento-card h-fit space-y-3 p-5">
            <h2 className="font-semibold">
              {tr("Eligibility estimate", "पात्रता अनुमान")}
            </h2>
            {estimate ? (
              <>
                <strong className="text-2xl">
                  {money(estimate.estimated_sanction_amount)}
                </strong>
                <p>
                  {label(estimate.farmer_classification)} ·{" "}
                  {estimate.interest_rate_effective}%
                </p>
                <p>
                  {tr("Repayment coverage", "भुगतान क्षमता")} ·{" "}
                  {estimate.dscr_ratio}×
                </p>
                <p className="text-sm">
                  {tr(
                    "The bank reviews your application before issuing credit.",
                    "ऋण जारी करने से पहले बैंक आपके आवेदन की समीक्षा करेगा।",
                  )}
                </p>
              </>
            ) : (
              <p>
                {estimateError
                  ? tr("Check the amount and land area.", "राशि और क्षेत्रफल जाँचें।")
                  : tr("Calculating…", "गणना जारी है…")}
              </p>
            )}
          </aside>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label>
              {tr("Your application", "आपका आवेदन")}{" "}
              <select
                className="control"
                value={id}
                onChange={(e) => setId(+e.target.value)}
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.application_no}
                  </option>
                ))}
              </select>
            </label>
            <button className="control" onClick={refresh}>
              {tr("Refresh", "ताज़ा करें")}
            </button>
          </div>
          {!detail ? (
            <p>
              {id
                ? tr("Loading…", "लोड हो रहा है…")
                : tr(
                    "Your submitted applications will appear here.",
                    "आपके जमा आवेदन यहाँ दिखाई देंगे।",
                  )}
            </p>
          ) : (
            <>
              {tab === "decision" && (
                <article className="bento-card space-y-3 p-5">
                  <h2 className="text-xl font-semibold">
                    {label(detail.status)}
                  </h2>
                  <p>{detail.bank_assigned}</p>
                  <p>
                    {tr(
                      "Requested / recommended / sanctioned",
                      "अनुरोधित / अनुशंसित / स्वीकृत",
                    )}{" "}
                    ·{" "}
                    {[
                      detail.requested_amount,
                      detail.recommended_amount,
                      detail.sanctioned_amount,
                    ]
                      .map(money)
                      .join(" / ")}
                  </p>
                  {detail.review_reason && (
                    <p>
                      {tr(
                        detail.review_reason,
                        detail.review_reason.includes("plot")
                          ? "खसरा संख्या दूसरे आवेदन से मेल खाती है। अधिकारी भूमि विवरण जाँचेंगे।"
                          : detail.review_reason.includes("default")
                            ? "ऋणदाता द्वारा दर्ज चूक के कारण समीक्षा आवश्यक है।"
                            : "अनुमानित आय भुगतान के लिए अपर्याप्त है।",
                      )}
                    </p>
                  )}
                  {detail.decision_note && (
                    <p>
                      {tr("Officer’s reason", "अधिकारी का कारण")} ·{" "}
                      {detail.decision_note}
                    </p>
                  )}
                  <p>
                    {tr("Normal / drought revenue", "सामान्य / सूखे में आय")} ·{" "}
                    {money(detail.expected_revenue)} /{" "}
                    {money(detail.drought_stress_revenue)}
                  </p>
                  <p>
                    {tr("Debt service coverage", "ऋण भुगतान क्षमता")} ·{" "}
                    {detail.dscr_ratio}×
                  </p>
                  <p>
                    {tr("Weather", "मौसम")} ·{" "}
                    {detail.weather_profile?.source === "open-meteo-live"
                      ? tr("Live forecast", "वर्तमान पूर्वानुमान")
                      : tr("Offline district baseline", "जिला आधार अनुमान")}
                  </p>
                  <h3 className="font-semibold">
                    {tr("Model risk drivers", "जोखिम के प्रमुख कारक")}
                  </h3>
                  {detail.shap_reasons.map((r) => (
                    <p key={r.feature}>
                      {hi ? label(r.feature ?? r.name) : r.name} ·{" "}
                      {r.direction === "RISK_DECREASE"
                        ? tr("lowers model risk", "जोखिम घटाता है")
                        : tr("raises model risk", "जोखिम बढ़ाता है")}
                    </p>
                  ))}
                  <details>
                    <summary>{tr("Eligibility rules", "पात्रता नियम")}</summary>
                    {detail.decision_tree_path.map((r, i) => (
                      <p key={r.step} className="mt-2 text-sm">
                        {hi
                          ? ["भूमि वर्ग", "ऋण इतिहास", "ऋण प्रकार", "वित्त सीमा"][i]
                          : r.name}{" "}
                        ·{" "}
                        {hi
                          ? [
                              "भूमि का वर्ग: " +
                                label(detail.farmer_classification),
                              detail.review_reason
                                ? "समीक्षा आवश्यक"
                                : "नियम जाँचा गया",
                              detail.facility_type,
                              money(detail.scale_of_finance_limit),
                            ][i]
                          : r.details}
                      </p>
                    ))}
                  </details>
                </article>
              )}
              {tab === "wallet" && (
                <div className="grid gap-4 md:grid-cols-3">
                  {!detail.tranches.length && (
                    <p>
                      {tr(
                        "Vouchers appear after bank approval.",
                        "बैंक की मंजूरी के बाद वाउचर दिखाई देंगे।",
                      )}
                    </p>
                  )}
                  {detail.tranches.map((t) => (
                    <section key={t.id} className="bento-card space-y-3 p-5">
                      <h2 className="font-semibold">
                        {
                          [
                            tr("Input voucher", "कृषि सामग्री वाउचर"),
                            tr("Operations credit", "कृषि संचालन ऋण"),
                            tr("Sowing reserve", "बुवाई आरक्षित राशि"),
                          ][t.tranche_no - 1]
                        }
                      </h2>
                      <p>
                        {money(t.amount)} · {label(t.status)}
                      </p>
                      {t.tranche_no === 1 &&
                        (t.status === "redeemed" ? (
                          <p>{t.merchant_name}</p>
                        ) : (
                          <>
                            <QRCodeSVG
                              value={
                                "krishisetu:demo-voucher:" + t.voucher_code
                              }
                              size={116}
                            />
                            <small>
                              {tr("Demo voucher", "अभ्यास वाउचर")} ·{" "}
                              {t.voucher_code}
                            </small>
                            <select
                              aria-label={tr("Merchant", "विक्रेता")}
                              className="field"
                              value={merchant}
                              onChange={(e) => setMerchant(e.target.value)}
                            >
                              {merchants.map((m) => (
                                <option
                                  key={m.merchant_id}
                                  value={m.merchant_id}
                                >
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={busy || !merchant}
                              className="primary"
                              onClick={() =>
                                act(async () => {
                                  await api.redeemVoucher(
                                    t.voucher_code,
                                    merchant,
                                  );
                                  refresh();
                                })
                              }
                            >
                              {tr("Simulate redemption", "वाउचर भुनाने का अभ्यास")}
                            </button>
                          </>
                        ))}
                      {t.tranche_no === 3 && t.status === "locked" && (
                        <label className="text-sm">
                          {tr(
                            "Record sowing photo and device location (demo)",
                            "बुवाई की फोटो और स्थान दर्ज करें (अभ्यास)",
                          )}
                          <input
                            className="field"
                            type="file"
                            accept="image/jpeg,image/png"
                            disabled={busy}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void sow(t.id, f);
                            }}
                          />
                        </label>
                      )}
                    </section>
                  ))}
                </div>
              )}
              {tab === "appeals" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <form
                    className="bento-card space-y-3 p-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(async () => {
                        const doc = attachment
                          ? (await api.uploadFile(attachment)).url
                          : null;
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
                        setMessage(tr("Appeal filed.", "अपील दर्ज हो गई।"));
                      });
                    }}
                  >
                    <h2 className="font-semibold">
                      {tr("File an appeal", "अपील दर्ज करें")}
                    </h2>
                    <label>
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
                    <label>
                      {tr("Details", "विवरण")}
                      <textarea
                        className="field"
                        required
                        value={appeal}
                        onChange={(e) => setAppeal(e.target.value)}
                      />
                    </label>
                    <label>
                      {tr(
                        "Evidence (optional, PDF or photo, 5 MB)",
                        "प्रमाण (वैकल्पिक, पीडीएफ या फोटो, 5 एमबी)",
                      )}
                      <input
                        type="file"
                        className="field"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={(e) =>
                          setAttachment(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                    <button disabled={busy} className="primary">
                      {tr("Submit appeal", "अपील भेजें")}
                    </button>
                  </form>
                  <div className="bento-card space-y-3 p-5">
                    <h2 className="font-semibold">
                      {tr("Appeal history", "अपील का इतिहास")}
                    </h2>
                    {detail.grievances.map((g) => (
                      <div key={g.id}>
                        <strong>
                          #{g.id} · {label(g.resolution_status)}
                        </strong>
                        <p>{g.grievance_text}</p>
                        <p>
                          {g.bank_response} {g.govt_directive}
                        </p>
                        <small>
                          {tr("Deadline", "समय सीमा")} ·{" "}
                          {g.sla_deadline?.slice(0, 10)}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
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
        : "Voice unavailable. Type your name instead.";
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
    <button type="button" className="control self-end" onClick={listen}>
      {lang === "hi" ? "नाम बोलें" : "Dictate name"}
    </button>
  );
}
