"use client";

import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import FarmerPortal from "@/components/FarmerPortal";
import BankWorkbench from "@/components/BankWorkbench";
import GovtConsole from "@/components/GovtConsole";
import SystemInfoModal from "@/components/SystemInfoModal";
import { api } from "@/lib/api";
import type { AuthSession, Language } from "@/types/dss";

const accounts = [
  ["farmer@demo", "Farmer", "किसान"],
  ["bank@demo", "Bank officer", "बैंक अधिकारी"],
  ["govt@demo", "Government auditor", "सरकारी निरीक्षक"],
];

export default function HomePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [lang, setLang] = useState<Language>("en");
  const [demo, setDemo] = useState(false);
  const [demoBank, setDemoBank] = useState("State Bank of India");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const hi = lang === "hi";
  useEffect(() => {
    const saved = sessionStorage.getItem("krishi-session");
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch {
        sessionStorage.removeItem("krishi-session");
      }
    }
    setLang(localStorage.getItem("krishi-language") === "hi" ? "hi" : "en");
    api
      .getDemoAccounts()
      .then((rows) => setDemo(rows.length > 0))
      .catch(() => setError("Could not reach the API. Refresh to retry."));
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
  async function login(email: string, password?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api.loginDemo(email, password, demoBank);
      sessionStorage.setItem("krishi-session", JSON.stringify(result));
      setSession(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api.logout();
    } finally {
      sessionStorage.removeItem("krishi-session");
      setSession(null);
    }
  }
  return (
    <div className="min-h-screen">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 p-4">
          <span className="flex items-center gap-2 font-semibold">
            <Sprout className="text-lime-700" />
            KrishiSetu
          </span>
          <button
            className="ml-auto control"
            onClick={() => {
              const next = hi ? "en" : "hi";
              setLang(next);
              localStorage.setItem("krishi-language", next);
            }}
          >
            {hi ? "English" : "हिन्दी"}
          </button>
          <button
            className="control"
            aria-label="Methodology"
            onClick={() => setInfo(true)}
          >
            ⓘ
          </button>
          {session && (
            <button className="control" onClick={logout}>
              {hi ? "बाहर जाएँ" : "Sign out"}
            </button>
          )}
        </div>
      </header>
      {demo && (
        <nav
          aria-label="Demo workspaces"
          className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-4 py-3 text-sm"
        >
          <span>{hi ? "अभ्यास खाते" : "Demo accounts"}</span>
          {accounts.map(([email, en, hindi]) => (
            <button
              className="control"
              key={email}
              disabled={
                busy ||
                (email === session?.email &&
                  (email !== "bank@demo" || session?.user.bank === demoBank))
              }
              onClick={() => login(email)}
            >
              {hi ? hindi : en}
            </button>
          ))}
          <label className="text-xs">
            {hi ? "अभ्यास बैंक" : "Demo bank"}{" "}
            <select
              className="control max-w-full"
              value={demoBank}
              onChange={(e) => setDemoBank(e.target.value)}
            >
              {[
                "State Bank of India",
                "Bank of India",
                "Punjab National Bank",
                "Bank of Baroda",
                "Axis Bank",
                "HDFC Bank",
              ].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </nav>
      )}
      {error && (
        <p className="mx-auto max-w-5xl p-3 text-red-700" role="alert">
          {error}
        </p>
      )}
      {!session ? (
        <main className="mx-auto max-w-lg p-6">
          <h1 className="mt-12 text-3xl font-semibold">
            {hi ? "कृषि ऋण कार्यक्षेत्र" : "Agricultural credit workspace"}
          </h1>
          <p className="my-4">
            {demo
              ? hi
                ? "ऊपर अभ्यास खाता चुनें। केवल काल्पनिक विवरण भरें।"
                : "Choose a demo account above to apply, review a portfolio, or publish a policy. Use fictional details."
              : hi
                ? "अपने खाते से प्रवेश करें।"
                : "Sign in with your assigned account."}
          </p>
          {!demo && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                login(String(d.get("email")), String(d.get("password")));
              }}
              className="space-y-3"
            >
              <label>
                Email
                <input className="field" name="email" type="email" required />
              </label>
              <label>
                Password
                <input
                  className="field"
                  name="password"
                  type="password"
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                Sign in
              </button>
            </form>
          )}
        </main>
      ) : (
        <main key={session.email + session.user.bank}>
          {session.user.role === "farmer" && (
            <FarmerPortal lang={lang} session={session} />
          )}
          {session.user.role === "bank_officer" && (
            <BankWorkbench lang={lang} demoUser={null} />
          )}
          {session.user.role === "govt_auditor" && (
            <GovtConsole lang={lang} demoUser={null} />
          )}
        </main>
      )}
      <SystemInfoModal isOpen={info} onClose={() => setInfo(false)} />
    </div>
  );
}
