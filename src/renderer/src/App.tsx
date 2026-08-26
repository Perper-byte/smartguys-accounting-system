// src/renderer/src/App.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

// Screens
import { LoginScreen } from "./components/LoginScreen";
import { WelcomeView } from './components/WelcomeView';
import { DashboardView } from './components/DashboardView';
import { POSBillingView } from './components/POSBillingView';
import { ReceivePaymentView } from './components/ReceivePaymentView';
import { ContactDirectoryView } from './components/ContactDirectoryView';
import { CashierHistoryView } from './components/CashierHistoryView';
import { InventoryView } from './components/InventoryView'; // 🔥 IMPORTED!
import { CashDisbursementForm } from './components/CashDisbursementForm';
import { EWTPayoutView } from './components/EWTPayoutView';
import { AgedReceivablesView } from './components/AgedReceivablesView';
import { InvoiceTrackerView } from './components/InvoiceTrackerView';
import { PayrollView } from './components/PayrollView';
import { JournalEntryForm } from './components/JournalEntryForm';
import { GeneralLedgerView } from './components/GeneralLedgerView';
import { ReconciliationView } from './components/ReconciliationView';
import { BooksOfAccountsView } from './components/BooksOfAccountsView';
import { FinancialStatementsView } from './components/FinancialStatementsView';
import { BIRReportsView } from './components/BIRReportsView';
import { VoidApprovalsView } from './components/VoidApprovalsView'; 
import { SystemAuditLogView } from './components/SystemAuditLogView';
import UserManagementView from './components/UserManagementView';
import { DatabaseBackupView } from './components/DatabaseBackupView';
import { ChartOfAccountsView } from './components/ChartOfAccountsView';
import { ServicesManagerView } from './components/ServicesManagerView';

import logoImage from './assets/smartguys_logo.jpg';

type User = { id: string; username: string; role: string; permissions?: string[] };
type Role = 'CASHIER' | 'ACCOUNTANT' | 'MANAGER' | 'IT_PERSONNEL';

const ROLES: Record<string, Role[]> = {
  ALL: ['CASHIER', 'ACCOUNTANT', 'MANAGER', 'IT_PERSONNEL'],
  CASHIER_ONLY: ['CASHIER'],
  ACCOUNTANT_ONLY: ['ACCOUNTANT'],
  MANAGER_ONLY: ['MANAGER'],
  IT_ONLY: ['IT_PERSONNEL'],
  FINANCE_TEAM: ['ACCOUNTANT', 'MANAGER'], 
  OPS_FINANCE: ['CASHIER', 'ACCOUNTANT'], 
} as const;

const GROUP_ORDER = ['Home', 'Clinic Operations', 'Accounting', 'Reports & Taxes', 'System Admin'];

const ALL_TABS = [
  // Home
  { id: 'home', label: 'Home', icon: '🏠', group: 'Home', allowedRoles: ROLES.ALL },

  // Clinic Operations
  { id: 'billing', label: 'Patient Billing (POS)', icon: '💳', group: 'Clinic Operations', allowedRoles: ROLES.CASHIER_ONLY },
  { id: 'collections', label: 'Receive Payments', icon: '💰', group: 'Clinic Operations', allowedRoles: ROLES.OPS_FINANCE },
  { id: 'directory', label: 'Contact Directory', icon: '📇', group: 'Clinic Operations', allowedRoles: ROLES.ALL },
  { id: 'history', label: 'My Sales History', icon: '🧾', group: 'Clinic Operations', allowedRoles: ROLES.CASHIER_ONLY },
  { id: 'inventory', label: 'Stock & Inventory', icon: '📦', group: 'Clinic Operations', allowedRoles: ['CASHIER', 'MANAGER'] },

  // Accounting
  { id: 'disbursement', label: 'Cash Disbursements', icon: '💸', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'payouts', label: 'Doctor Payouts', icon: '🩺', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'aging', label: 'Aged Receivables (HMO)', icon: '⏳', group: 'Accounting', allowedRoles: ROLES.FINANCE_TEAM },
  { id: 'tracker', label: 'Invoice Tracker', icon: '📋', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'payroll', label: 'HR & Payroll', icon: '🧑‍🤝‍🧑', group: 'Accounting', allowedRoles: ROLES.FINANCE_TEAM },
  { id: 'journal', label: 'Journal Entry', icon: '📝', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'adjusting', label: 'Adjusting Entries', icon: '🔧', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'ledger', label: 'General Ledger', icon: '📖', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'reconciliation', label: 'Bank Reconciliation', icon: '🏦', group: 'Accounting', allowedRoles: ROLES.FINANCE_TEAM },
  { id: 'books', label: 'Books of Accounts', icon: '📚', group: 'Accounting', allowedRoles: ROLES.FINANCE_TEAM },

  // Reports & Taxes
  { id: 'analytics', label: 'Analytics Dashboard', icon: '📈', group: 'Reports & Taxes', allowedRoles: ROLES.MANAGER_ONLY },
  { id: 'statements', label: 'Financial Statements', icon: '📄', group: 'Reports & Taxes', allowedRoles: ROLES.FINANCE_TEAM },
  { id: 'bir', label: 'BIR Tax Compliance', icon: '🏛️', group: 'Reports & Taxes', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'voids', label: 'Void Approvals', icon: '↩️', group: 'Reports & Taxes', allowedRoles: ROLES.MANAGER_ONLY },

  // System Admin
  { id: 'audit', label: 'Audit Trails', icon: '⏳', group: 'System Admin', allowedRoles: ROLES.IT_ONLY },
  { id: 'users', label: 'User Management', icon: '👥', group: 'System Admin', allowedRoles: ROLES.IT_ONLY },
  { id: 'backup', label: 'Database Backup', icon: '💾', group: 'System Admin', allowedRoles: ROLES.IT_ONLY },
  { id: 'coa', label: 'Chart of Accounts', icon: '🏦', group: 'System Admin', allowedRoles: ROLES.MANAGER_ONLY },
  { id: 'services', label: 'Services & Pricing', icon: '🏷️', group: 'System Admin', allowedRoles: ROLES.MANAGER_ONLY }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      const api = (window as any).electronAPI || (window as any).api;
      if (api && api.pingDatabase) {
        const ok = await api.pingDatabase();
        setIsOnline(ok);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user); 
    setActiveTab('home');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('home');
  };

  const permittedTabs = currentUser
    ? ALL_TABS.filter(tab => {
        if (currentUser.permissions && currentUser.permissions.length > 0) {
          return tab.id === 'home' || currentUser.permissions.includes(tab.id);
        }
        return tab.allowedRoles.includes(currentUser.role as Role);
      })
    : [];

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="app-wrapper" className="flex h-screen bg-[#FBF8F8] text-gray-800 overflow-hidden font-sans print:bg-white print:text-black print:h-auto print:overflow-visible">

      {/* LEFT SIDEBAR */}
      <aside id="app-sidebar" className="w-64 bg-white border-r border-[#B0DCDA] flex flex-col justify-between shadow-sm z-20 flex-shrink-0 print:hidden">
        <div className="flex flex-col h-full overflow-hidden">
          
          <div className="p-6 border-b border-[#B0DCDA] shrink-0">
            <div className="flex items-center space-x-3">
              <img src={logoImage} alt="Clinic Logo" className="h-10 w-10 object-contain drop-shadow-sm" />
              <span className="font-extrabold tracking-wide text-gray-800 text-lg">SmartGuys Clinic</span>
            </div>
          </div>

          <nav className="p-4 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
            {GROUP_ORDER.map((groupName) => {
              const tabsInGroup = permittedTabs.filter(tab => tab.group === groupName);
              if (tabsInGroup.length === 0) return null;

              return (
                <div key={groupName}>
                  {groupName !== 'Home' && (
                    <h3 className="px-4 text-[10px] font-extrabold text-[#1B9387] uppercase tracking-widest mb-3">
                      {groupName}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {tabsInGroup.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                          activeTab === tab.id
                          ? 'bg-[#1B9387] text-white shadow-md'
                          : 'text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387]'
                        }`}
                      >
                        <span className="text-lg opacity-90">{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="p-5 border-t border-[#B0DCDA] bg-gray-50 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{currentUser.username}</p>
            <p className="text-[10px] text-[#28958B] uppercase font-extrabold tracking-widest mt-0.5">
                {currentUser.permissions && currentUser.permissions.length > 0 ? 'CUSTOM ACCESS' : currentUser.role}
            </p>
          </div>
          <button onClick={handleLogout} title="Log out" className="p-2.5 text-red-400 hover:text-white hover:bg-red-500 rounded-md transition-colors cursor-pointer">
            🚪
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col relative overflow-hidden print:overflow-visible bg-[#FBF8F8]">
        
        <header id="app-header" className="h-16 bg-white border-b border-[#B0DCDA] flex items-center justify-between px-8 shadow-sm z-10 flex-shrink-0 print:hidden">
          <h2 className="text-lg font-extrabold text-gray-800 tracking-wide capitalize">
            {permittedTabs.find(t => t.id === activeTab)?.label || 'Workspace'}
          </h2>
          
          <div className={`flex items-center space-x-4 px-4 py-1.5 rounded-full border transition-colors duration-300 ${isOnline ? 'bg-[#E9FAFA] border-[#B0DCDA]' : 'bg-red-50 border-red-200'}`}>
            <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-[#1B9387] animate-pulse' : 'bg-red-500'}`}></div>
            <span className={`text-xs font-bold tracking-wide uppercase ${isOnline ? 'text-[#1B9387]' : 'text-red-600'}`}>
              Local Connection: {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </header>

        <main id="app-main" className="flex-1 p-8 overflow-y-auto print:p-0 print:bg-white print:overflow-visible relative">
          
          {!permittedTabs.find(t => t.id === activeTab) ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center shadow-sm print:hidden">
              <h3 className="text-red-600 font-bold text-lg">⚠️ Access Denied</h3>
              <p className="text-sm text-red-500 mt-2 font-medium">Your role does not have permission to view this module.</p>
            </div>
          ) : (
            <div className="h-full animate-in fade-in duration-300">
              
              {/* SCREENS */}
              {activeTab === 'home' && <WelcomeView username={currentUser.username} role={currentUser.role} />}
              {activeTab === 'analytics' && <DashboardView />}
              {activeTab === 'reconciliation' && <ReconciliationView userId={currentUser.id} />}
              {activeTab === 'books' && <BooksOfAccountsView />}
              {activeTab === 'statements' && <FinancialStatementsView />}
              {activeTab === 'bir' && <BIRReportsView />}
              {activeTab === 'backup' && <DatabaseBackupView />}
              {activeTab === 'billing' && <POSBillingView userId={currentUser.id} />}
              {activeTab === 'collections' && <ReceivePaymentView userId={currentUser.id} />}
              {activeTab === 'payouts' && <EWTPayoutView userId={currentUser.id} />}
              {activeTab === 'users' && <UserManagementView />}
              {activeTab === 'aging' && <AgedReceivablesView />}
              {activeTab === 'history' && <CashierHistoryView userId={currentUser.id} />}
              {activeTab === 'voids' && <VoidApprovalsView userId={currentUser.id} />}
              {activeTab === 'audit' && <SystemAuditLogView />}
              {activeTab === 'tracker' && <InvoiceTrackerView />}
              {activeTab === 'payroll' && <PayrollView userId={currentUser.id} />}
              {activeTab === 'directory' && <ContactDirectoryView />}
              {activeTab === 'coa' && <ChartOfAccountsView />}
              {activeTab === 'services' && <ServicesManagerView />}
              
              {/* 🔥 THE FIX: Added the missing Inventory Screen to the renderer! */}
              {activeTab === 'inventory' && <InventoryView userId={currentUser.id} role={currentUser.role} />}
              
              {/* FORMS */}
              {activeTab === 'journal' && <JournalEntryForm userId={currentUser.id} isAdjusting={false} />}
              {activeTab === 'adjusting' && <JournalEntryForm userId={currentUser.id} isAdjusting={true} />}
              {activeTab === 'disbursement' && <CashDisbursementForm userId={currentUser.id} />}
              {activeTab === 'ledger' && <GeneralLedgerView />}
              
            </div>
          )}
        </main>
      </div>
    </div>
  );
}