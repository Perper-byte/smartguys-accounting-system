// src/renderer/src/App.tsx
import { DashboardView } from './components/DashboardView';
import { BIRReportsView } from './components/BIRReportsView';
import { DatabaseBackupView } from './components/DatabaseBackupView';
import { FinancialStatementsView } from './components/FinancialStatementsView';
import { GeneralLedgerView } from './components/GeneralLedgerView';
import { CashDisbursementForm } from './components/CashDisbursementForm';
import { JournalEntryForm } from './components/JournalEntryForm';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { LoginScreen } from "./components/LoginScreen";
import { POSBillingView } from './components/POSBillingView';

import UserManagementView from './components/UserManagementView';

// DEFINE THE STRICT ROLE-BASED TABS 
const ALL_TABS = [
  { id: 'billing', label: 'Patient Billing', icon: '💳', allowedRoles: ['CASHIER'] },
  { id: 'dashboard', label: 'Analytics Dashboard', icon: '📊', allowedRoles: ['ACCOUNTANT', 'MANAGER'] },
  { id: 'journal', label: 'Journal Entry', icon: '📝', allowedRoles: ['CASHIER', 'ACCOUNTANT'] },
  { id: 'adjusting', label: 'Adjusting Entries', icon: '🔧', allowedRoles: ['ACCOUNTANT'] },
  { id: 'disbursement', label: 'Disbursements', icon: '💸', allowedRoles: ['CASHIER'] },
  { id: 'ledger', label: 'General Ledger', icon: '📖', allowedRoles: ['ACCOUNTANT'] },
  { id: 'statements', label: 'Financial Statements', icon: '📄', allowedRoles: ['ACCOUNTANT', 'MANAGER'] },
  { id: 'bir', label: 'BIR Tax Reports', icon: '🏛️', allowedRoles: ['MANAGER'] },
  { id: 'backup', label: 'Database Backup', icon: '💾', allowedRoles: ['IT_PERSONNEL'] },
  // ---> ADDED THE NEW USER MANAGEMENT TAB HERE:
  { id: 'users', label: 'User Management', icon: '👥', allowedRoles: ['IT_PERSONNEL'] },
];

function App(): React.ReactElement {
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');

  // FILTER TABS DYNAMICALLY
  // When a user logs in, filter the tabs they are allowed to see
  const permittedTabs = currentUser
    ? ALL_TABS.filter(tab => tab.allowedRoles.includes(currentUser.role))
    : [];

  // Automatically set the first permitted tab as the active tab upon login
  useEffect(() => {
    if (currentUser && permittedTabs.length > 0 && !permittedTabs.find(t => t.id === activeTab)) {
      setActiveTab(permittedTabs[0].id);
    }
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('');
  };

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />
  }

  return (
    <div className="flex h-screen bg-[#121214] text-[#e1e1e6] overflow-hidden">

      {/* PERSISTENT LEFT SIDEBAR */}
      <aside className="w-64 bg-[#202024] border-r border-[#29292e] flex flex-col justify-between">
        <div>
          {/* Logo & Title branding */}
          <div className="p-6 border-b border-[#29292e]">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-[#4f46e5] flex items-center justify-center font-bold text-white">S</div>
              <span className="font-bold tracking-wide text-white">SmartGuys Clinic</span>
            </div>
            <p className="text-[10px] text-[#7c7c8a] mt-1 font-medium tracking-wider uppercase">Accounting System</p>
          </div>

          {/* Navigation Links (FILTERED BY ROLE) */}
          <nav className="p-4 space-y-1">
            {permittedTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === tab.id
                  ? 'bg-[#4f46e5] text-white shadow-md'
                  : 'text-[#8d8d99] hover:bg-[#29292e] hover:text-white'
                  }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* User profile footer */}
        <div className="p-4 border-t border-[#29292e] bg-[#121214]/50 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{currentUser.username}</p>
            {/* Added proper rendering of the role */}
            <p className="text-[10px] text-[#8d8d99] uppercase font-bold tracking-wide">{currentUser.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out of system"
            className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded transition"
          >
            🚪
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOP STATUS BAR */}
        <header className="h-16 bg-[#202024] border-b border-[#29292e] flex items-center justify-between px-8">
          <h2 className="text-lg font-bold text-white tracking-wide capitalize">
            {permittedTabs.find(t => t.id === activeTab)?.label || 'Workspace'}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs text-[#8d8d99] font-medium">Local Connection: Online</span>
          </div>
        </header>

        {/* WORKSPACE CONTENT PANELS */}
        <main className="flex-1 p-8 overflow-y-auto bg-[#121214]">

          {/* Security Fallback: If user hacks UI state to force a tab they don't own */}
          {!permittedTabs.find(t => t.id === activeTab) ? (
            <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
              <h3 className="text-red-500 font-bold">⚠️ Access Denied</h3>
              <p className="text-sm text-red-400 mt-1">
                Your role ({currentUser.role}) does not have permission to view this module.
              </p>
            </div>
          ) : (
            <>
              { /* RENDER THE ACTIVE SCREEN */}
              {activeTab === 'dashboard' && (
                <DashboardView />
              )}

              {activeTab === 'journal' && (
                <JournalEntryForm userId={currentUser.id} />
              )}
              {activeTab === 'adjusting' && (
                <JournalEntryForm userId={currentUser.id} isAdjusting={true} />
              )}

              {activeTab === 'disbursement' && (
                <CashDisbursementForm userId={currentUser.id} />
              )}

              {activeTab === 'ledger' && (
                <GeneralLedgerView />
              )}

              {activeTab === 'statements' && (
                <FinancialStatementsView />
              )}

              {activeTab === 'bir' && (
                <BIRReportsView />
              )}

              {activeTab === 'backup' && (
                <DatabaseBackupView />
              )}

               {activeTab === 'billing' && (
                <POSBillingView userId={currentUser.id} />
              )}

              {/* ---> ADDED THE RENDER LOGIC FOR THE NEW TAB: */}
              {activeTab === 'users' && (
                <UserManagementView />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
export default App;