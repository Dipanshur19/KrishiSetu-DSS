"use client";

import React, { useEffect, useRef, useState } from "react";
import { RefreshCw, Globe, User, X, Check, Info } from "lucide-react";
import { AuthSession, DemoUser, Language } from "@/types/dss";
import { t } from "@/i18n/translations";

interface HeaderProps {
  activeRole: "farmer" | "bank" | "govt";
  setActiveRole: (role: "farmer" | "bank" | "govt") => void;
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
  onOpenSystemInfo: () => void;
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
  onOpenSystemInfo,
}: HeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [accountMenuOpen]);

  const handleQuickLogin = async (email: string) => {
    setLoggingIn(true);
    try {
      await onLoginDemo(email);
      setAccountMenuOpen(false);
    } finally {
      setLoggingIn(false);
    }
  };

  const activeName = authSession?.user.full_name || selectedDemoUser?.full_name || "Ram Charan Yadav";
  const initials = activeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-[#f5f5ee]/90 backdrop-blur-md border-b border-black/[0.06]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Minimal Brand Mark (Dark circular badge + lime leaf geometry, matching reference) */}
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

        {/* Centered Navigation Tabs (Solid Obsidian active pill, quiet inactive text) */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {(["farmer", "bank", "govt"] as const).map((roleKey) => {
            const isActive = activeRole === roleKey;
            const label =
              roleKey === "farmer"
                ? t(lang, "nav_farmer")
                : roleKey === "bank"
                ? t(lang, "nav_bank")
                : t(lang, "nav_govt");
            return (
              <button
                key={roleKey}
                onClick={() => setActiveRole(roleKey)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-[#141513] text-white"
                    : "text-[#5e5c55] hover:text-[#141513] hover:bg-black/[0.04]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Right Icon Utility Cluster + Profile Switcher */}
        <div ref={menuRef} className="flex items-center space-x-2 shrink-0 relative">
          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="h-9 px-3 rounded-full bg-white border border-black/[0.08] text-xs font-medium text-[#141513] hover:bg-[#fafaf6] flex items-center space-x-1.5 transition-colors"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-[#5e5c55]" strokeWidth={1.5} />
            <span>{lang === "en" ? "EN" : "HI"}</span>
          </button>

          <button
            onClick={onResetData}
            disabled={isResetting}
            className="w-9 h-9 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-[#5e5c55] hover:text-[#141513] hover:bg-[#fafaf6] transition-colors"
            title="Reset sample data"
          >
            <RefreshCw className={`w-4 h-4 ${isResetting ? "animate-spin text-[#4d7c0f]" : ""}`} strokeWidth={1.5} />
          </button>

          <button
            onClick={onOpenSystemInfo}
            className="w-9 h-9 rounded-full bg-white border border-black/[0.08] hidden sm:flex items-center justify-center text-[#5e5c55] hover:text-[#141513] hover:bg-[#fafaf6] transition-colors"
            title="System info & methodology"
          >
            <Info className="w-4 h-4" strokeWidth={1.5} />
          </button>

          {/* Avatar / Persona Trigger */}
          <button
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
            className="h-9 pl-1.5 pr-3 rounded-full bg-white border border-black/[0.08] flex items-center space-x-2 hover:bg-[#fafaf6] transition-colors"
            title="Switch account or demo persona"
          >
            <div className="w-6 h-6 rounded-full bg-[#141513] text-[#d4f04c] text-[10px] font-medium flex items-center justify-center">
              {initials || <User className="w-3.5 h-3.5" />}
            </div>
            <span className="hidden md:inline text-xs font-medium text-[#141513] max-w-[120px] truncate">
              {activeName.split(" ")[0]}
            </span>
          </button>

          {/* Account & Persona Popover */}
          {accountMenuOpen && (
            <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl border border-black/[0.08] shadow-lg p-3 space-y-3 z-50">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-black/[0.06]">
                <span className="text-xs font-medium text-[#141513]">Account & Persona</span>
                <button onClick={() => setAccountMenuOpen(false)} className="text-[#8a877d] hover:text-[#141513]">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[#8a877d] px-1">Role access</div>
                {[
                  { email: "farmer@demo", label: "Farmer Portal", desc: "farmer@demo" },
                  { email: "bank@demo", label: "Bank Officer", desc: "bank@demo" },
                  { email: "govt@demo", label: "Policy Auditor", desc: "govt@demo" },
                ].map((acc) => {
                  const active = authSession?.email === acc.email;
                  return (
                    <button
                      key={acc.email}
                      disabled={loggingIn}
                      onClick={() => handleQuickLogin(acc.email)}
                      className={`w-full px-2.5 py-2 rounded-lg text-left text-xs flex items-center justify-between transition-colors ${
                        active ? "bg-[#f5f5ee] text-[#141513] font-medium" : "hover:bg-[#fafaf6] text-[#5e5c55]"
                      }`}
                    >
                      <div>
                        <div className="text-[#141513] font-medium">{acc.label}</div>
                        <div className="text-[11px] font-mono text-[#8a877d]">{acc.desc}</div>
                      </div>
                      {active && <Check className="w-3.5 h-3.5 text-[#4d7c0f]" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-1.5">
                <div className="text-[11px] text-[#8a877d] px-1">Sample applicant profile</div>
                <select
                  value={selectedDemoUser?.username || ""}
                  onChange={(e) => {
                    const u = demoUsers.find((x) => x.username === e.target.value);
                    if (u) {
                      setSelectedDemoUser(u);
                      if (u.role === "farmer") setActiveRole("farmer");
                      else if (u.role === "bank_officer") setActiveRole("bank");
                      else if (u.role === "govt_auditor") setActiveRole("govt");
                      setAccountMenuOpen(false);
                    }
                  }}
                  className="w-full text-xs bg-[#fafaf6] border border-black/[0.08] rounded-lg px-2.5 py-2 text-[#141513]"
                >
                  {demoUsers.map((u) => (
                    <option key={u.username} value={u.username}>
                      {u.full_name} ({u.district})
                    </option>
                  ))}
                </select>
              </div>

              {authSession && (
                <button
                  onClick={() => {
                    onLogout();
                    setAccountMenuOpen(false);
                  }}
                  className="w-full py-1.5 text-xs text-[#8a877d] hover:text-[#141513] border-t border-black/[0.06] pt-2"
                >
                  Sign out ({authSession.email})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
