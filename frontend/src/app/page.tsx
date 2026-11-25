"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Info, LogOut, ArrowRight, ShieldCheck } from "lucide-react";
import FarmerPortal from "@/components/FarmerPortal";
import BankWorkbench from "@/components/BankWorkbench";
import GovtConsole from "@/components/GovtConsole";
import SystemInfoModal from "@/components/SystemInfoModal";
import { api } from "@/lib/api";
import { t } from "@/i18n/translations";
import type { AuthSession, Language, UserRole } from "@/types/dss";

const DEMO_ROLES: {
  role: UserRole;
  email: string;
  navKey: "nav_farmer" | "nav_bank" | "nav_govt";
  enDesc: string;
  hiDesc: string;
}[] = [
  {
    role: "farmer",
    email: "farmer@demo",
    navKey: "nav_farmer",
    enDesc: "Apply for credit, inspect DSCR forecast, redeem input vouchers, and track appeals.",
    hiDesc: "ऋण आवेदन करें, पूर्वानुमान देखें, ई-रूपी वाउचर भुनाएँ और अपील दर्ज करें।",
  },
  {
    role: "bank_officer",
    email: "bank@demo",
    navKey: "nav_bank",
    enDesc: "Review underwriting dossiers, run MILP policy allocation, and commit lending batches.",
    hiDesc: "ऋण आवेदनों की समीक्षा करें, पोर्टफोलियो आवंटन चलाएँ और वितरण स्वीकृत करें।",
  },
  {
    role: "govt_auditor",
    email: "govt@demo",
    navKey: "nav_govt",
    enDesc: "Monitor district inclusion metrics, audit bank shares, publish policy norms, and hear appeals.",
    hiDesc: "जिला मानचित्र, बैंक हिस्सेदारी, नीति मानक और अपीलों की निगरानी करें।",
  },
];

const DEMO_BANKS = [
  "State Bank of India",
  "Bank of India",
  "Punjab National Bank",
  "Bank of Baroda",
  "Axis Bank",
  "HDFC Bank",
];

export default function HomePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [lang, setLang] = useState<Language>("en");
  const [demo, setDemo] = useState<boolean | null>(null);
  const [demoBank, setDemoBank] = useState("State Bank of India");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const manualSignOut = useRef(false);
  const hi = lang === "hi";

  async function login(email: string, password?: string, bankOverride?: string) {
    setBusy(true);
    setError("");
    const chosenBank = bankOverride ?? demoBank;
    try {
      const result = await api.loginDemo(email, password, chosenBank);
      manualSignOut.current = false;
      sessionStorage.setItem("krishi-session", JSON.stringify(result));
      setSession(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setLang(localStorage.getItem("krishi-language") === "hi" ? "hi" : "en");
    const saved = sessionStorage.getItem("krishi-session");
    let restored: AuthSession | null = null;
    if (saved) {
      try {
        restored = JSON.parse(saved);
        setSession(restored);
        if (restored?.user.bank) setDemoBank(restored.user.bank);
      } catch {
        sessionStorage.removeItem("krishi-session");
      }
    }

    api
      .getDemoAccounts()
      .then((rows) => {
        const isDemo = rows.length > 0;
        setDemo(isDemo);
        if (isDemo && !restored && !manualSignOut.current) {
          void login("farmer@demo");
        }
      })
      .catch(() => {
        setDemo(false);
        setError("Could not reach the API. Refresh to retry.");
      });

    const expired = () => {
      setSession(null);
      setError("Session expired. Please sign in again.");
    };
    window.addEventListener("krishi-expired", expired);
    return () => window.removeEventListener("krishi-expired", expired);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  async function logout() {
    manualSignOut.current = true;
    try {
      await api.logout();
    } finally {
      sessionStorage.removeItem("krishi-session");
      setSession(null);
    }
  }

  const activeName = session?.user.full_name || "KrishiSetu";
  const initials = activeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f5ee] flex flex-col text-[#141513]">
      {/* Unified Minimal Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#f5f5ee]/90 backdrop-blur-md border-b border-black/[0.06]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#141513] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <path
                  d="M12 4C8.5 4 6 6.8 6 10.5C6 14.5 9.5 18 12 20C14.5 18 18 14.5 18 10.5C18 6.8 15.5 4 12 4Z"
                  fill="#b8e354"
                />
                <path d="M12 8V17M12 12L15 9.5" stroke="#141513" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-base font-medium tracking-tight text-[#141513]">
              {t(lang, "brand")}
            </span>
          </div>

          {/* Centered Role Workspace Tabs (when demo enabled or authenticated) */}
          {demo && (
            <nav
              aria-label="Workspaces"
              className="flex flex-wrap items-center gap-1 sm:gap-1.5"
            >
              {DEMO_ROLES.map((item) => {
                const isActive = session?.user.role === item.role;
                return (
                  <button
                    key={item.email}
                    disabled={busy}
                    onClick={() => void login(item.email)}
                    className={`px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-[#141513] text-white"
                        : "text-[#5e5c55] hover:text-[#141513] hover:bg-black/[0.04]"
                    }`}
                  >
                    {t(lang, item.navKey)}
                  </button>
                );
              })}

              {session?.user.role === "bank_officer" && (
                <select
                  aria-label={hi ? "बैंक चुनें" : "Demo bank"}
                  value={demoBank}
                  disabled={busy}
                  onChange={(e) => {
                    const nextBank = e.target.value;
                    setDemoBank(nextBank);
                    void login("bank@demo", undefined, nextBank);
                  }}
                  className="ml-1 px-3 py-1.5 rounded-full bg-white border border-black/[0.08] text-xs font-medium text-[#141513] max-w-[175px]"
                >
                  {DEMO_BANKS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </nav>
          )}

          {/* Right Utility Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => {
                const next = hi ? "en" : "hi";
                setLang(next);
                localStorage.setItem("krishi-language", next);
              }}
              className="h-9 px-3 rounded-full bg-white border border-black/[0.08] text-xs font-medium text-[#141513] hover:bg-[#fafaf6] flex items-center space-x-1.5 transition-colors"
              title="Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-[#5e5c55]" strokeWidth={1.5} />
              <span>{hi ? "EN" : "हिन्दी"}</span>
            </button>

            <button
              onClick={() => setInfo(true)}
              className="w-9 h-9 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-[#5e5c55] hover:text-[#141513] hover:bg-[#fafaf6] transition-colors"
              aria-label="Data and model methodology"
              title="Data and model methodology"
            >
              <Info className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {session && (
              <div className="flex items-center space-x-1.5 pl-1 pr-1.5 h-9 rounded-full bg-white border border-black/[0.08]">
                <span className="w-6 h-6 rounded-full bg-[#141513] text-[#d4f04c] text-[10px] font-medium flex items-center justify-center">
                  {initials}
                </span>
                <span className="hidden md:inline text-xs font-medium text-[#141513] max-w-[110px] truncate px-1">
                  {activeName.split(" ")[0]}
                </span>
                <button
                  onClick={logout}
                  className="p-1 rounded-full text-[#8a877d] hover:text-[#141513] hover:bg-black/[0.05] transition-colors"
                  title={hi ? "बाहर जाएँ" : "Sign out"}
                  aria-label={hi ? "बाहर जाएँ" : "Sign out"}
                >
                  <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-800" role="alert">
            {error}
          </p>
        </div>
      )}

      {!session ? (
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          {demo === null && !error ? (
            <div className="bento-card px-8 py-6 text-xs text-[#8a877d]">
              {hi ? "कार्यक्षेत्र खुल रहा है…" : "Loading workspace…"}
            </div>
          ) : demo ? (
            <div className="max-w-4xl w-full space-y-6">
              <div className="text-center space-y-2">
                <p className="text-xs text-[#8a877d]">
                  {hi ? "कृषि ऋण निर्णय सहायता प्रणाली" : "Agricultural Credit Decision Support"}
                </p>
                <h1 className="text-3xl font-medium tracking-tight text-[#141513]">
                  {hi ? "कृषि ऋण कार्यक्षेत्र चुनें" : "Choose a Workspace"}
                </h1>
                <p className="text-xs text-[#5e5c55] max-w-lg mx-auto">
                  {hi
                    ? "तीनों भूमिकाओं के बीच स्विच करके ऋण आवेदन, पोर्टफोलियो आवंटन और क्षेत्रीय नीति का अभ्यास करें।"
                    : "Select any stakeholder role below to run credit evaluation, constrained bank portfolio allocation, or regional oversight."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {DEMO_ROLES.map((item) => (
                  <button
                    key={item.email}
                    disabled={busy}
                    onClick={() => void login(item.email)}
                    className="bento-card p-6 text-left hover:border-[#141513]/30 transition-all flex flex-col justify-between space-y-5 group"
                  >
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-[#8a877d]">{item.email}</div>
                      <h2 className="text-lg font-medium text-[#141513]">{t(lang, item.navKey)}</h2>
                      <p className="text-xs text-[#5e5c55] leading-relaxed">
                        {hi ? item.hiDesc : item.enDesc}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-black/[0.06] text-xs font-medium text-[#141513]">
                      <span>{hi ? "प्रवेश करें" : "Open workspace"}</span>
                      <ArrowRight className="w-4 h-4 text-[#4d7c0f] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bento-card max-w-md w-full p-6 sm:p-8 space-y-5">
              <div className="flex items-center space-x-2 text-xs text-[#4d7c0f] font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>{hi ? "प्रमाणीकरण आवश्यक" : "Workspace Sign In"}</span>
              </div>
              <div>
                <h1 className="text-2xl font-medium tracking-tight text-[#141513]">
                  {hi ? "कृषि ऋण कार्यक्षेत्र" : "Agricultural Credit Workspace"}
                </h1>
                <p className="text-xs text-[#5e5c55] mt-1">
                  {hi ? "अपने निर्दिष्ट खाते से प्रवेश करें।" : "Sign in with your assigned Supabase account."}
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  void login(String(d.get("email")), String(d.get("password")));
                }}
                className="space-y-4"
              >
                <label className="block text-xs text-[#5e5c55]">
                  {hi ? "ईमेल" : "Email"}
                  <input className="field" name="email" type="email" required />
                </label>
                <label className="block text-xs text-[#5e5c55]">
                  {hi ? "पासवर्ड" : "Password"}
                  <input className="field" name="password" type="password" required />
                </label>
                <button className="primary w-full py-2.5" disabled={busy}>
                  {busy ? (hi ? "प्रवेश जारी है…" : "Signing in…") : hi ? "प्रवेश करें" : "Sign in"}
                </button>
              </form>
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 pb-12" key={session.email + (session.user.bank ?? "")}>
          {session.user.role === "farmer" && <FarmerPortal lang={lang} session={session} />}
          {session.user.role === "bank_officer" && <BankWorkbench lang={lang} demoUser={null} />}
          {session.user.role === "govt_auditor" && <GovtConsole lang={lang} demoUser={null} />}
        </main>
      )}

      <SystemInfoModal isOpen={info} onClose={() => setInfo(false)} />
    </div>
  );
}
