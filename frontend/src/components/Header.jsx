import React from 'react';
import { ShieldCheck, UserCheck, RefreshCw, Globe, BookOpen, Building2, Landmark, Sprout } from 'lucide-react';

export default function Header({
  activeRole,
  setActiveRole,
  selectedDemoUser,
  setSelectedDemoUser,
  demoUsers,
  lang,
  setLang,
  onResetData,
  isResetting
}) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50">
      {/* Top micro-bar: Institutional identity & course metadata */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between text-xs text-slate-400 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
            DMS624 • Computer Aided Decision System
          </span>
          <span className="hidden sm:inline text-slate-400">
            IIT Kanpur • IME624 Project • RBI PSL & KCC Framework
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-slate-300">
            {lang === 'hi' ? 'वार्षिक कृषि ऋण लक्ष्य:' : 'Ground Level Credit Target:'} <strong className="text-emerald-400">₹32.50 Lakh Cr</strong>
          </span>
          <button
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-300" />
            <span className="font-medium">{lang === 'en' ? 'हिन्दी (Hindi)' : 'English'}</span>
          </button>
        </div>
      </div>

      {/* Main navigation bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Product Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center shadow-inner">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white">KrishiSetu DSS</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  v2.6
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'hi'
                  ? 'त्रि-पक्षीय कृषि ऋण निर्णय प्रणाली (किसान • बैंक • सरकार)'
                  : 'Three-Sided Agricultural Credit Decision System (Farmer • Bank • Govt)'}
              </p>
            </div>
          </div>

          {/* Primary Role Tabs */}
          <nav className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveRole('farmer')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeRole === 'farmer'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Sprout className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'hi' ? 'किसान पोर्टल' : 'Farmer Portal'}</span>
            </button>

            <button
              onClick={() => setActiveRole('bank')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeRole === 'bank'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>{lang === 'hi' ? 'बैंक वर्कबेंच' : 'Bank Workbench'}</span>
            </button>

            <button
              onClick={() => setActiveRole('govt')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeRole === 'govt'
                  ? 'bg-amber-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Landmark className="w-4 h-4 text-amber-400" />
              <span>{lang === 'hi' ? 'सरकारी नीति कंसोल' : 'Govt Policy Console'}</span>
            </button>

            <button
              onClick={() => setActiveRole('guide')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeRole === 'guide'
                  ? 'bg-purple-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span>{lang === 'hi' ? 'DMS624 गाइड' : 'DMS624 Guide'}</span>
            </button>
          </nav>

          {/* Quick Demo Switcher & Reset Button */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <select
                value={selectedDemoUser?.username || ''}
                onChange={(e) => {
                  const u = demoUsers.find((x) => x.username === e.target.value);
                  if (u) {
                    setSelectedDemoUser(u);
                    if (u.role === 'farmer') setActiveRole('farmer');
                    else if (u.role === 'bank_officer') setActiveRole('bank');
                    else if (u.role === 'govt_auditor') setActiveRole('govt');
                  }
                }}
                className="text-xs bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-7 appearance-none cursor-pointer"
                title="Switch Demo Persona"
              >
                <option value="" disabled>
                  {lang === 'hi' ? 'डेमो प्रोफाइल चुनें...' : 'Select Demo Persona...'}
                </option>
                {demoUsers.map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.role === 'farmer' ? '🌾' : u.role === 'bank_officer' ? '🏦' : '🏛️'} {u.full_name} ({u.district})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onResetData}
              disabled={isResetting}
              className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
              title="Reseed 160 realistic applicants"
            >
              <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
