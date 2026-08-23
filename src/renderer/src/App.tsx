// src/renderer/src/App.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { DashboardView } from './components/DashboardView';
import { BIRReportsView } from './components/BIRReportsView';
import { DatabaseBackupView } from './components/DatabaseBackupView';
import { FinancialStatementsView } from './components/FinancialStatementsView';
import { GeneralLedgerView } from './components/GeneralLedgerView';
import { CashDisbursementForm } from './components/CashDisbursementForm';
import { JournalEntryForm } from './components/JournalEntryForm';
import { LoginScreen } from "./components/LoginScreen";
import { POSBillingView } from './components/POSBillingView';
import { EWTPayoutView } from './components/EWTPayoutView';
import UserManagementView from './components/UserManagementView';
import { ReceivePaymentView } from './components/ReceivePaymentView';
import { BooksOfAccountsView } from './components/BooksOfAccountsView';
import { AgedReceivablesView } from './components/AgedReceivablesView';
import { CashierHistoryView } from './components/CashierHistoryView';
import { VoidApprovalsView } from './components/VoidApprovalsView'; 
import { WelcomeView } from './components/WelcomeView';
import { SystemAuditLogView } from './components/SystemAuditLogView';
import { InvoiceTrackerView } from './components/InvoiceTrackerView';
import { PayrollView } from './components/PayrollView';
import { ContactDirectoryView } from './components/ContactDirectoryView';
import { ReconciliationView } from './components/ReconciliationView';

// Kept from main branch for the UI!
import logoImage from './assets/smartguys_logo.jpg';

type Role = 'CASHIER' | 'ACCOUNTANT' | 'MANAGER' | 'IT_PERSONNEL';

// Streamlined and strict role groupings
const ROLES: Record<string, Role[]> = {
  ALL: ['CASHIER', 'ACCOUNTANT', 'MANAGER', 'IT_PERSONNEL'],
  CASHIER_ONLY: ['CASHIER'],
  ACCOUNTANT_ONLY: ['ACCOUNTANT'],
  MANAGER_ONLY: ['MANAGER'],
  IT_ONLY: ['IT_PERSONNEL'],
  FINANCE_TEAM: ['ACCOUNTANT', 'MANAGER'], // Functions shared by Accounting and Management
  OPS_FINANCE: ['CASHIER', 'ACCOUNTANT'], // Functions shared by Cashiers and Accounting
} as const;

const ALL_TABS = [
  // Home (Available to everyone)
  { id: 'home', label: 'Home', icon: '🏠', group: 'Home', allowedRoles: ROLES.ALL },

  // Clinic Operations
  { id: 'billing', label: 'Patient Billing (POS)', icon: '💳', group: 'Clinic Operations', allowedRoles: ROLES.CASHIER_ONLY },
  { id: 'collections', label: 'Receive Payments', icon: '💰', group: 'Clinic Operations', allowedRoles: ROLES.OPS_FINANCE },
  { id: 'directory', label: 'Contact Directory', icon: '📇', group: 'Clinic Operations', allowedRoles: ROLES.ALL },
  { id: 'disbursement', label: 'Cash Disbursements', icon: '💸', group: 'Clinic Operations', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'payouts', label: 'Doctor Payouts', icon: '🩺', group: 'Clinic Operations', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'aging', label: 'Aged Receivables (HMO)', icon: '⏳', group: 'Clinic Operations', allowedRoles: ROLES.FINANCE_TEAM },
  { id: 'tracker', label: 'Invoice Tracker', icon: '📋', group: 'Clinic Operations', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'history', label: 'My Sales History', icon: '🧾', group: 'Clinic Operations', allowedRoles: ROLES.CASHIER_ONLY },
  { id: 'payroll', label: 'HR & Payroll', icon: '🧑‍🤝‍🧑', group: 'Clinic Operations', allowedRoles: ROLES.FINANCE_TEAM },

  // Accounting
  { id: 'journal', label: 'Journal Entry', icon: '📝', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'adjusting', label: 'Adjusting Entries', icon: '🔧', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'ledger', label: 'General Ledger', icon: '📖', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'reconciliation', label: 'Bank Reconciliation', icon: '🏦', group: 'Accounting', allowedRoles: ROLES.FINANCE_TEAM },
  { id: 'books', label: 'Books of Accounts', icon: '📚', group: 'Accounting', allowedRoles: ROLES.FINANCE_TEAM },

  // Reports and Compliance
  { id: 'analytics', label: 'Analytics Dashboard', icon: '📈', group: 'Reports & Taxes', allowedRoles: ROLES.MANAGER_ONLY },
  { id: 'statements', label: 'Financial Statements', icon: '📄', group: 'Reports & Taxes', allowedRoles: ROLES.FINANCE_TEAM },
  { id: 'bir', label: 'BIR Tax Compliance', icon: '🏛️', group: 'Reports & Taxes', allowedRoles: ROLES.ACCOUNTANT_ONLY },
  { id: 'voids', label: 'Void Approvals', icon: '↩️', group: 'Reports & Taxes', allowedRoles: ROLES.MANAGER_ONLY },

  // System Administration
  { id: 'audit', label: 'Audit Trails', icon: '⏳', group: 'System Admin', allowedRoles: ROLES.IT_ONLY },
  { id: 'users', label: 'User Management', icon: '👥', group: 'System Admin', allowedRoles: ROLES.IT_ONLY },
  { id: 'backup', label: 'Database Backup', icon: '💾', group: 'System Admin', allowedRoles: ROLES.IT_ONLY },
];


const GROUP_ORDER = ['Home', 'Clinic Operations', 'Accounting', 'Reports & Taxes', 'System Admin'];

function App(): React.ReactElement {
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [isOnline, setIsOnline] = useState(true);

const permittedTabs = currentUser ? ALL_TABS.filter(tab => tab.allowedRoles.includes(currentUser.role)) : [];

  useEffect(() => {
    if (currentUser && permittedTabs.length > 0) {
      const isTabValid = permittedTabs.some(t => t.id === activeTab);
      if (!isTabValid) {
        setActiveTab(permittedTabs[0].id); // Auto-clicks 'Analytics Dashboard' for Accountant
      }
    }
  }, [currentUser]); 

  useEffect(() => {
    // Only start pinging if the user is logged in
    if (!currentUser) return;

    const checkConnection = async () => {
      const api = (window as any).electronAPI;
      if (api && api.pingDatabase) {
        const status = await api.pingDatabase();
        setIsOnline(status);
      }
    };

    checkConnection(); // Check immediately
    const interval = setInterval(checkConnection, 5000); // Ping every 5 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('');
  };

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
<div id="app-wrapper" className="flex h-screen bg-[#FBF8F8] text-gray-800 overflow-hidden font-sans print:bg-white print:text-black print:h-auto print:overflow-visible">

      {/* PERSISTENT LEFT SIDEBAR */}
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
                    <h3 className="px-4 text-[10px] font-bold text-[#1B9387] uppercase tracking-widest mb-3">
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
            <p className="text-[10px] text-[#28958B] uppercase font-extrabold tracking-widest mt-0.5">{currentUser.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out of system"
            className="p-2.5 text-red-400 hover:text-white hover:bg-red-500 rounded-md transition-colors cursor-pointer"
          >
            🚪
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER AREA */}
      <div className="flex-1 flex flex-col relative overflow-hidden print:overflow-visible bg-[#FBF8F8]">
        
        {/* TOP STATUS BAR */}
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

        {/* WORKSPACE CONTENT PANELS */}
        <main id="app-main" className="flex-1 p-8 overflow-y-auto print:p-0 print:bg-white print:overflow-visible relative">
          
          {!permittedTabs.find(t => t.id === activeTab) ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center shadow-sm print:hidden">
              <h3 className="text-red-600 font-bold text-lg">⚠️ Access Denied</h3>
              <p className="text-sm text-red-500 mt-2 font-medium">Your role ({currentUser.role}) does not have permission to view this module.</p>
            </div>
          ) : (
            <div className="h-full animate-in fade-in duration-300">
              
              {/* ---> RENDER THE NEW WELCOME SCREEN <--- */}
              {activeTab === 'home' && <WelcomeView username={currentUser.username} role={currentUser.role} />}
              
              {/* ---> RENDER THE DASHBOARD (NOW ANALYTICS ONLY) <--- */}
              {activeTab === 'analytics' && <DashboardView />}
              {activeTab === 'journal' && <JournalEntryForm userId={currentUser.id} />}
              {activeTab === 'adjusting' && <JournalEntryForm userId={currentUser.id} isAdjusting={true} />}
              {activeTab === 'disbursement' && <CashDisbursementForm userId={currentUser.id} />}
              {activeTab === 'ledger' && <GeneralLedgerView />}
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
