"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import FarmerPortal from "@/components/FarmerPortal";
import BankWorkbench from "@/components/BankWorkbench";
import GovtConsole from "@/components/GovtConsole";
import CourseGuide from "@/components/CourseGuide";
import { api } from "@/lib/api";
import { AuthSession, DemoUser, Language } from "@/types/dss";

export default function HomePage() {
  const [activeRole, setActiveRole] = useState<"farmer" | "bank" | "govt" | "guide">("farmer");
  const [lang, setLang] = useState<Language>("en");
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [selectedDemoUser, setSelectedDemoUser] = useState<DemoUser | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    api.getDemoAccounts()
      .then((users) => {
        setDemoUsers(users);
        if (users.length > 0) setSelectedDemoUser(users[0]);
      })
      .catch(console.error);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleLoginDemo = async (email: string) => {
    const res = await api.loginDemo(email);
    setAuthSession(res);
    if (res.user.role === "farmer") setActiveRole("farmer");
    else if (res.user.role === "bank_officer") setActiveRole("bank");
    else if (res.user.role === "govt_auditor") setActiveRole("govt");
    showToast(`Signed in as ${res.user.full_name} (${res.email})`);
  };

  const handleLogout = () => {
    setAuthSession(null);
    showToast("Signed out of demo session");
  };

  const handleResetData = async () => {
    if (!window.confirm("Reseed database with 160 realistic Indian farmer credit records?")) return;
    setIsResetting(true);
    try {
      const res = await api.resetDatabase();
      showToast(res.message || "Database reset successfully.");
      const users = await api.getDemoAccounts();
      setDemoUsers(users);
    } catch (err: unknown) {
      alert("Reset failed: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        selectedDemoUser={selectedDemoUser}
        setSelectedDemoUser={setSelectedDemoUser}
        demoUsers={demoUsers}
        lang={lang}
        setLang={setLang}
        onResetData={handleResetData}
        isResetting={isResetting}
        authSession={authSession}
        onLoginDemo={handleLoginDemo}
        onLogout={handleLogout}
      />

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-slate-700 text-xs flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="flex-1 pb-12">
        {activeRole === "farmer" && <FarmerPortal demoUser={selectedDemoUser} lang={lang} />}
        {activeRole === "bank" && <BankWorkbench demoUser={selectedDemoUser} lang={lang} />}
        {activeRole === "govt" && <GovtConsole demoUser={selectedDemoUser} lang={lang} />}
        {activeRole === "guide" && <CourseGuide />}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-semibold text-slate-300">KrishiSetu DSS</span> • Computer Aided Decision System (DMS624)
            <div className="text-[11px] text-slate-500 mt-0.5">
              IIT Kanpur • RBI Priority Sector Lending & KCC Framework
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Next.js TS + Recharts + Leaflet • FastAPI + XGBoost/SHAP + SciPy MILP • Open-Meteo + Supabase
          </div>
        </div>
      </footer>
    </div>
  );
}
