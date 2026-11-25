"use client";

import React, { useState } from "react";
import {
  RefreshCw,
  Globe,
  BookOpen,
  Building2,
  Landmark,
  Sprout,
  KeyRound,
  LogOut,
  X,
} from "lucide-react";
import { AuthSession, DemoUser, Language } from "@/types/dss";
import { t } from "@/i18n/translations";

interface HeaderProps {
  activeRole: "farmer" | "bank" | "govt" | "guide";
  setActiveRole: (role: "farmer" | "bank" | "govt" | "guide") => void;
  selectedDemoUser: DemoUser | null;
  setSelectedDemoUser: (u: DemoUser) => void;
  demoUsers: DemoUser[];
  lang: Language;
  setLang: (l: Language) => void;
  onResetData: () => void;
  isResetting: boolean;
  authSession: AuthSession | null;
  onLoginDemo: (email: string) => Promise<void>;
  onLogout: () => void;
}

export default function Header({
  activeRole,
  setActiveRole,
  selectedDemoUser,
  setSelectedDemoUser,
  demoUsers,
  lang,
  setLang,
  onResetData,
  isResetting,
  authSession,
  onLoginDemo,
  onLogout,
}: HeaderProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("farmer@demo");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLogin = async (emailToUse: string) => {
    setLoginLoading(true);
    setLoginError("");
    try {
      await onLoginDemo(emailToUse);
      setLoginOpen(false);
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
        {/* Institutional Micro-Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between text-xs text-slate-400 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
              DMS624 • Next.js + FastAPI + XGBoost/SHAP + SciPy MILP
            </span>
            <span className="hidden md:inline text-slate-400">
              IIT Kanpur • RBI PSL & KCC Framework • Open-Meteo + Supabase Ready
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-slate-300 hidden sm:inline">
              {t(lang, "glc_target")}{" "}
              <strong className="text-emerald-400 font-mono">₹32.50 Lakh Cr</strong>
            </span>

            {/* Auth Session Badge or Demo Login Button */}
            {authSession ? (
              <div className="flex items-center space-x-2 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-slate-200 font-mono">{authSession.email}</span>
                <button
                  onClick={onLogout}
                  className="text-slate-400 hover:text-white"
                  title="Sign out"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 transition-colors"
              >
                <KeyRound className="w-3 h-3" />
                <span className="font-medium">{t(lang, "login_btn")}</span>
              </button>
            )}

            <button
              onClick={() => setLang(lang === "en" ? "hi" : "en")}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              title="Toggle Language (English / Hindi)"
            >
              <Globe className="w-3.5 h-3.5 text-slate-300" />
              <span className="font-medium">{lang === "en" ? "हिन्दी (Hindi)" : "English"}</span>
            </button>
          </div>
        </div>

        {/* Main Nav Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                <Sprout className="w-6 h-6 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold tracking-tight text-white">
                    {t(lang, "app_title")}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    v3.0 TS
                  </span>
                </div>
                <p className="text-xs text-slate-400">{t(lang, "app_subtitle")}</p>
              </div>
            </div>

            {/* Role Tabs */}
            <nav className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
              <button
                onClick={() => setActiveRole("farmer")}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeRole === "farmer"
                    ? "bg-emerald-700 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Sprout className="w-4 h-4" strokeWidth={1.5} />
                <span>{t(lang, "nav_farmer")}</span>
              </button>

              <button
                onClick={() => setActiveRole("bank")}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeRole === "bank"
                    ? "bg-blue-700 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Building2 className="w-4 h-4" strokeWidth={1.5} />
                <span>{t(lang, "nav_bank")}</span>
              </button>

              <button
                onClick={() => setActiveRole("govt")}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeRole === "govt"
                    ? "bg-amber-700 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Landmark className="w-4 h-4" strokeWidth={1.5} />
                <span>{t(lang, "nav_govt")}</span>
              </button>

              <button
                onClick={() => setActiveRole("guide")}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeRole === "guide"
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <BookOpen className="w-4 h-4" strokeWidth={1.5} />
                <span>{t(lang, "nav_guide")}</span>
              </button>
            </nav>

            {/* Persona Switcher & Reset */}
            <div className="flex items-center space-x-2">
              <select
                value={selectedDemoUser?.username || ""}
                onChange={(e) => {
                  const u = demoUsers.find((x) => x.username === e.target.value);
                  if (u) {
                    setSelectedDemoUser(u);
                    if (u.role === "farmer") setActiveRole("farmer");
                    else if (u.role === "bank_officer") setActiveRole("bank");
                    else if (u.role === "govt_auditor") setActiveRole("govt");
                  }
                }}
                className="text-xs bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[240px]"
                title="Switch Demo Persona"
              >
                <option value="" disabled>
                  Select Demo Persona...
                </option>
                {demoUsers.map((u) => (
                  <option key={u.username} value={u.username}>
                    [{u.role === "farmer" ? "Farmer" : u.role === "bank_officer" ? "Bank" : "Govt"}] {u.full_name}
                  </option>
                ))}
              </select>

              <button
                onClick={onResetData}
                disabled={isResetting}
                className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
                title="Reseed 160 farmer credit records"
              >
                <RefreshCw className={`w-4 h-4 ${isResetting ? "animate-spin text-emerald-400" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* RBAC Demo Login Modal (Week 4 accounts: farmer@demo, bank@demo, govt@demo) */}
      {loginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Role-Based Access Control (Supabase RBAC)
                </h3>
              </div>
              <button onClick={() => setLoginOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Sign in with any of the three DMS624 demo accounts or a Supabase user account:
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { email: "farmer@demo", label: "Farmer", sub: "farmer@demo" },
                  { email: "bank@demo", label: "Bank Officer", sub: "bank@demo" },
                  { email: "govt@demo", label: "Govt Auditor", sub: "govt@demo" },
                ].map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => handleLogin(acc.email)}
                    disabled={loginLoading}
                    className="p-2.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-left transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-900">{acc.label}</div>
                    <div className="text-[11px] font-mono text-slate-500">{acc.sub}</div>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Account Email</label>
                <div className="flex space-x-2">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                    placeholder="farmer@demo"
                  />
                  <button
                    onClick={() => handleLogin(loginEmail)}
                    disabled={loginLoading}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold"
                  >
                    {loginLoading ? "Signing in..." : "Sign In"}
                  </button>
                </div>
                {loginError && <p className="text-xs text-red-600">{loginError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
