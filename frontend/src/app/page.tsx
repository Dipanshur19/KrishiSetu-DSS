"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import FarmerPortal from "@/components/FarmerPortal";
import BankWorkbench from "@/components/BankWorkbench";
import GovtConsole from "@/components/GovtConsole";
import SystemInfoModal from "@/components/SystemInfoModal";
import { api } from "@/lib/api";
import { AuthSession, DemoUser, Language } from "@/types/dss";

export default function HomePage() {
  const [activeRole, setActiveRole] = useState<"farmer" | "bank" | "govt">("farmer");
  const [lang, setLang] = useState<Language>("en");
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [selectedDemoUser, setSelectedDemoUser] = useState<DemoUser | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [systemInfoOpen, setSystemInfoOpen] = useState(false);

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
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleLoginDemo = async (email: string) => {
    const res = await api.loginDemo(email);
    setAuthSession(res);
    if (res.user.role === "farmer") setActiveRole("farmer");
    else if (res.user.role === "bank_officer") setActiveRole("bank");
    else if (res.user.role === "govt_auditor") setActiveRole("govt");
    showToast(`Signed in as ${res.user.full_name}`);
  };

  const handleLogout = () => {
    setAuthSession(null);
    showToast("Signed out");
  };

  const handleResetData = async () => {
    if (!window.confirm("Reset database to default 160 sample applications?")) return;
    setIsResetting(true);
    try {
      const res = await api.resetDatabase();
      showToast(res.message || "Sample data reset");
      const users = await api.getDemoAccounts();
      setDemoUsers(users);
    } catch (err: unknown) {
      alert("Reset failed: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5ee] flex flex-col text-[#141513]">
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
        onOpenSystemInfo={() => setSystemInfoOpen(true)}
      />

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#141513] text-white px-4 py-2.5 rounded-full shadow-lg text-xs flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#b8e354]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="flex-1 pb-12">
        {activeRole === "farmer" && <FarmerPortal demoUser={selectedDemoUser} lang={lang} />}
        {activeRole === "bank" && <BankWorkbench demoUser={selectedDemoUser} lang={lang} />}
        {activeRole === "govt" && <GovtConsole demoUser={selectedDemoUser} lang={lang} />}
      </main>

      <SystemInfoModal isOpen={systemInfoOpen} onClose={() => setSystemInfoOpen(false)} />
    </div>
  );
}
