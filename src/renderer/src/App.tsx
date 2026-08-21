// src/renderer/src/App.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { JournalEntryForm } from './components/JournalEntryForm';
import { CashDisbursementForm } from './components/CashDisbursementForm';
import { GeneralLedgerView } from './components/GeneralLedgerView';
import { FinancialStatementsView } from './components/FinancialStatementsView';
import { BIRReportsView } from './components/BIRReportsView';
import { DatabaseBackupView } from './components/DatabaseBackupView';
import { DashboardView } from './components/DashboardView';
import logoImage from './assets/smartguys_logo.jpg';

const ALL_TABS = [
  { id: 'dashboard', label: 'Analytics Dashboard', icon: '📊', allowedRoles: ['ACCOUNTANT', 'MANAGER'] },
  { id: 'journal', label: 'Journal Entry', icon: '📝', allowedRoles: ['CASHIER', 'ACCOUNTANT'] },
  { id: 'adjusting', label: 'Adjusting Entries', icon: '🔧', allowedRoles: ['ACCOUNTANT'] },
  { id: 'disbursement', label: 'Disbursements', icon: '💸', allowedRoles: ['CASHIER'] },
  { id: 'ledger', label: 'General Ledger', icon: '📖', allowedRoles: ['ACCOUNTANT'] },
  { id: 'statements', label: 'Financial Statements', icon: '📄', allowedRoles: ['ACCOUNTANT', 'MANAGER'] },
  { id: 'bir', label: 'BIR Tax Reports', icon: '🏛️', allowedRoles: ['MANAGER'] },
  { id: 'backup', label: 'Database Backup', icon: '💾', allowedRoles: ['IT_PERSONNEL'] },
];

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
    <div id="app-wrapper" className="flex h-screen bg-[#FBF8F8] text-gray-800 overflow-hidden font-sans">

      {/* PERSISTENT LEFT SIDEBAR */}
      <aside id="app-sidebar" className="w-64 bg-white border-r border-[#B0DCDA] flex flex-col justify-between shadow-sm z-10 flex-shrink-0">
        <div>
          <div className="p-6 border-b border-[#B0DCDA]">
            <div className="flex items-center space-x-3">
              <img src={logoImage} alt="Clinic Logo" className="h-10 w-10 object-contain drop-shadow-sm" />
              <span className="font-extrabold tracking-wide text-gray-800 text-lg">SmartGuys Clinic</span>
            </div>
          </div>
          <nav className="p-4 space-y-1">
            {permittedTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-sm font-bold transition ${activeTab === tab.id ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387]'}`}
              >
                <span className={activeTab === tab.id ? 'opacity-100' : 'opacity-70'}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-[#B0DCDA] bg-gray-50 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{currentUser.username}</p>
            <p className="text-[10px] text-[#28958B] uppercase font-extrabold tracking-widest">{currentUser.role}</p>
          </div>
          <button onClick={handleLogout} title="Log out of system" className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded transition">🚪</button>
        </div>
      </aside>

      {/* MAIN CONTAINER AREA */}
      <div className="flex-1 flex flex-col relative overflow-hidden print:overflow-visible">
        {/* TOP STATUS BAR */}
        <header id="app-header" className="h-16 bg-white border-b border-[#B0DCDA] flex items-center justify-between px-8 shadow-sm z-0 flex-shrink-0">
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
        <main id="app-main" className="flex-1 p-8 overflow-y-auto bg-[#FBF8F8]">
          {!permittedTabs.find(t => t.id === activeTab) ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center shadow-sm">
              <h3 className="text-red-600 font-bold text-lg">⚠️ Access Denied</h3>
              <p className="text-sm text-red-500 mt-2 font-medium">Your role does not have permission to view this module.</p>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'journal' && <JournalEntryForm userId={currentUser.id} />}
              {activeTab === 'adjusting' && <JournalEntryForm userId={currentUser.id} isAdjusting={true} />}
              {activeTab === 'disbursement' && <CashDisbursementForm userId={currentUser.id} />}
              {activeTab === 'ledger' && <GeneralLedgerView />}
              {activeTab === 'statements' && <FinancialStatementsView />}
              {activeTab === 'bir' && <BIRReportsView />}
              {activeTab === 'backup' && <DatabaseBackupView />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;