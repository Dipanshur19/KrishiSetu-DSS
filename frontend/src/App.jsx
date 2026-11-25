import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import FarmerPortal from './components/FarmerPortal';
import BankWorkbench from './components/BankWorkbench';
import GovtConsole from './components/GovtConsole';
import CourseGuide from './components/CourseGuide';
import { api } from './api';

export default function App() {
  const [activeRole, setActiveRole] = useState('farmer'); // farmer | bank | govt | guide
  const [lang, setLang] = useState('en'); // en | hi
  const [demoUsers, setDemoUsers] = useState([]);
  const [selectedDemoUser, setSelectedDemoUser] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Fetch demo accounts on load
  useEffect(() => {
    api.getDemoAccounts()
      .then((users) => {
        setDemoUsers(users);
        if (users.length > 0) {
          setSelectedDemoUser(users[0]);
        }
      })
      .catch(console.error);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleResetData = async () => {
    if (!window.confirm('Reseed database with 160 realistic Indian farmer credit records?')) return;
    setIsResetting(true);
    try {
      const res = await api.resetDatabase();
      showToast(res.message || 'Database reset successfully!');
      // reload demo users
      const users = await api.getDemoAccounts();
      setDemoUsers(users);
    } catch (err) {
      alert('Reset failed: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Institutional Global Header */}
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
      />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-slate-700 text-xs flex items-center space-x-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 pb-12">
        {activeRole === 'farmer' && (
          <FarmerPortal
            demoUser={selectedDemoUser}
            lang={lang}
          />
        )}

        {activeRole === 'bank' && (
          <BankWorkbench
            demoUser={selectedDemoUser}
            lang={lang}
          />
        )}

        {activeRole === 'govt' && (
          <GovtConsole
            demoUser={selectedDemoUser}
            lang={lang}
          />
        )}

        {activeRole === 'guide' && (
          <CourseGuide />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="font-semibold text-slate-300">KrishiSetu DSS</span> • Computer Aided Decision System
            <div className="text-[11px] text-slate-500 mt-0.5">
              Course Project DMS624 / IME624 • IIT Kanpur • In accordance with RBI Priority Sector Lending Guidelines
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            FastAPI + Scipy MILP + SQLite + React &bull; 100% Policy Grounded
          </div>
        </div>
      </footer>
    </div>
  );
}
