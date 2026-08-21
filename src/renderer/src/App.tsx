// Make sure these are at the top of src/renderer/src/App.tsx
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


type Role = 'CASHIER' | 'ACCOUNTANT' | 'MANAGER' | 'IT_PERSONNEL';
const ROLES: Record<string, Role[]> = {
  ALL: ['CASHIER', 'ACCOUNTANT', 'MANAGER', 'IT_PERSONNEL'],
  CASHIER: ['CASHIER'],
  ACCOUNTING: ['ACCOUNTANT'],
  ACCOUNTANT_MANAGER: ['ACCOUNTANT', 'MANAGER'],
  MANAGER: ['MANAGER'],
  IT: ['IT_PERSONNEL'],
  ACCOUNTANT_MANAGER_IT: ['ACCOUNTANT', 'MANAGER', 'IT_PERSONNEL'],
  CASHIER_ACCOUNTANT_MANAGER: ['CASHIER', 'ACCOUNTANT', 'MANAGER'],
} as const;

const ALL_TABS = [
  // Home
  { id: 'home', label: 'Home', icon: '🏠', group: 'Home', allowedRoles: ROLES.ALL },

  // Clinic Operations: cashier workflows stay separate from accounting posting.
  { id: 'billing', label: 'Patient Billing (POS)', icon: '💳', group: 'Clinic Operations', allowedRoles: ROLES.CASHIER },
  { id: 'collections', label: 'Receive Payments', icon: '💰', group: 'Clinic Operations', allowedRoles: ROLES.CASHIER_ACCOUNTANT_MANAGER },
  { id: 'directory', label: 'Contact Directory', icon: '📇', group: 'Clinic Operations', allowedRoles: ROLES.ALL },
  { id: 'disbursement', label: 'Cash Disbursements', icon: '💸', group: 'Clinic Operations', allowedRoles: ROLES.ACCOUNTANT_MANAGER },
  { id: 'payouts', label: 'Doctor Payouts', icon: '🩺', group: 'Clinic Operations', allowedRoles: ROLES.ACCOUNTANT_MANAGER },
  { id: 'aging', label: 'Aged Receivables (HMO)', icon: '⏳', group: 'Clinic Operations', allowedRoles: ROLES.ACCOUNTANT_MANAGER },
  { id: 'tracker', label: 'Invoice Tracker', icon: '📋', group: 'Clinic Operations', allowedRoles: ROLES.CASHIER_ACCOUNTANT_MANAGER },
  { id: 'history', label: 'My Sales History', icon: '🧾', group: 'Clinic Operations', allowedRoles: ROLES.CASHIER },
  { id: 'payroll', label: 'HR & Payroll', icon: '🧑‍🤝‍🧑', group: 'Clinic Operations', allowedRoles: ROLES.ACCOUNTANT_MANAGER },

  // Accounting: posting and reconciliation belong to accountants; managers review.
  { id: 'journal', label: 'Journal Entry', icon: '📝', group: 'Accounting', allowedRoles: ROLES.ACCOUNTING },
  { id: 'adjusting', label: 'Adjusting Entries', icon: '🔧', group: 'Accounting', allowedRoles: ROLES.ACCOUNTING },
  { id: 'ledger', label: 'General Ledger', icon: '📖', group: 'Accounting', allowedRoles: ROLES.ACCOUNTING },
  { id: 'reconciliation', label: 'Bank Reconciliation', icon: '🏦', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_MANAGER },
  { id: 'books', label: 'Books of Accounts', icon: '📚', group: 'Accounting', allowedRoles: ROLES.ACCOUNTANT_MANAGER_IT },

  // Reports and compliance
  { id: 'analytics', label: 'Analytics Dashboard', icon: '📈', group: 'Reports & Taxes', allowedRoles: ROLES.MANAGER },
  { id: 'statements', label: 'Financial Statements', icon: '📄', group: 'Reports & Taxes', allowedRoles: ROLES.ACCOUNTANT_MANAGER },
  { id: 'bir', label: 'BIR Tax Compliance', icon: '🏛️', group: 'Reports & Taxes', allowedRoles: ROLES.ACCOUNTANT_MANAGER },
  { id: 'audit', label: 'Audit Trails', icon: '⏳', group: 'Reports & Taxes', allowedRoles: ROLES.IT },
  { id: 'voids', label: 'Void Approvals', icon: '↩️', group: 'Reports & Taxes', allowedRoles: ROLES.MANAGER },

  // System administration
  { id: 'users', label: 'User Management', icon: '👥', group: 'System Admin', allowedRoles: ROLES.IT },
  { id: 'backup', label: 'Database Backup', icon: '💾', group: 'System Admin', allowedRoles: ROLES.IT },
];


const GROUP_ORDER = ['Home', 'Clinic Operations', 'Accounting', 'Reports & Taxes', 'System Admin'];

function App(): React.ReactElement {
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');

  const permittedTabs = currentUser
    ? ALL_TABS.filter(tab => tab.allowedRoles.includes(currentUser.role))
    : [];

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
    <div className="flex h-screen bg-[#121214] text-[#e1e1e6] overflow-hidden print:bg-white print:text-black print:h-auto print:overflow-visible">

      <aside className="w-64 bg-[#202024] border-r border-[#29292e] flex flex-col justify-between print:hidden shadow-xl z-20">
        <div className="flex flex-col h-full overflow-hidden">
          
          <div className="p-6 border-b border-[#29292e] shrink-0">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-[#4f46e5] flex items-center justify-center font-bold text-white shadow-lg">S</div>
              <span className="font-bold tracking-wide text-white text-lg">SmartGuys</span>
            </div>
            <p className="text-[10px] text-[#7c7c8a] mt-1.5 font-bold tracking-widest uppercase ml-11">Clinic Accounting</p>
          </div>

          <nav className="p-4 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
            {GROUP_ORDER.map((groupName) => {
              const tabsInGroup = permittedTabs.filter(tab => tab.group === groupName);
              if (tabsInGroup.length === 0) return null;

              return (
                <div key={groupName}>
                  {groupName !== 'Home' && (
                    <h3 className="px-4 text-[10px] font-bold text-[#7c7c8a] uppercase tracking-widest mb-3">
                      {groupName}
                    </h3>
                  )}
                  
                  <div className="space-y-1">
                    {tabsInGroup.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          activeTab === tab.id
                          ? 'bg-[#4f46e5] text-white shadow-md shadow-[#4f46e5]/20'
                          : 'text-[#a1a1aa] hover:bg-[#29292e] hover:text-white'
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

        <div className="p-5 border-t border-[#29292e] bg-[#1a1a1e] flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{currentUser.username}</p>
            <p className="text-[10px] text-[#8d8d99] uppercase font-bold tracking-widest mt-0.5">{currentUser.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out of system"
            className="p-2.5 text-[#f75a68] hover:text-white hover:bg-[#f75a68] rounded-md transition-colors cursor-pointer"
          >
            🚪
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible bg-[#121214]">

        <header className="h-16 bg-[#202024] border-b border-[#29292e] flex items-center justify-between px-8 print:hidden shadow-sm z-10">
          <h2 className="text-lg font-bold text-white tracking-wide">
            {permittedTabs.find(t => t.id === activeTab)?.label || 'Workspace'}
          </h2>
          <div className="flex items-center space-x-3 bg-[#121214] px-4 py-1.5 rounded-full border border-[#29292e]">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs text-[#8d8d99] font-bold uppercase tracking-wider">System Online</span>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto print:p-0 print:bg-white print:overflow-visible relative">

          {!permittedTabs.find(t => t.id === activeTab) ? (
            <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-center print:hidden">
              <h3 className="text-red-500 font-bold">⚠️ Access Denied</h3>
              <p className="text-sm text-red-400 mt-1">
                Your role ({currentUser.role}) does not have permission to view this module.
              </p>
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