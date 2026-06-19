// src/renderer/src/App.tsx
import { useState } from "react";
import { LoginScreen } from "./components/LoginScreen";

function App(): JSX.Element {
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'ledger' | 'disbursement' | 'bir'>('dashboard');

  const handleLogout = () => {
    setCurrentUser(null);
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

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊'},
              { id: 'journal', label: 'Journal Entry', icon: '📝'},
              { id: 'ledger', label: 'General Ledger', icon: '📖'},
              { id: 'disbursement', label: 'Disbursements', icon: '💸'},
              { id: 'bir', label: 'BIR Tax Reports', icon: '🏛️'},
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-sm font-medium transition ${
                  activeTab === tab.id
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
            <p className="text-[10px] text-[#8d8d99] uppercase font-bold tracking-wide">{currentUser.role || 'Accountant'}</p>
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
            {activeTab === 'dashboard' ? 'Overview' : activeTab.replace('-', ' ')}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs text-[#8d8d99] font-medium">Local Connection: Online</span>
          </div>
        </header>

        {/* WORKSPACE CONTENT PANELS */}
        <main className="flex-1 p-8 overflow-y-auto bg-[#121214]">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="p-6 bg-[#202024] border border-[#29292e] rounded-lg">
                <h3 className="text-lg font-bold text-white">🎉 Welcome to the SmartGuys Accounting Core</h3>
                <p className="text-sm text-[#8d8d99] mt-1">
                  You are securely logged into the LAN-based database environment. Start navigating using the sidebar.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'journal' && (
            <div className="p-6 bg-[#202024] border border-[#29292e] rounded-lg text-center">
              <p className="text-[#8d8d99]">The Journal Entry transaction engine UI will go here.</p>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="p-6 bg-[#202024] border border-[#29292e] rounded-lg text-center">
              <p className="text-[#8d8d99]">The General Ledger and Running Balance view will go here.</p>
            </div>
          )}

          {activeTab === 'disbursement' && (
            <div className="p-6 bg-[#202024] border border-[#29292e] rounded-lg text-center">
              <p className="text-[#8d8d99]">The Cash Disbursement registers will go here.</p>
            </div>
          )}

          {activeTab === 'bir' && (
            <div className="p-6 bg-[#202024] border border-[#29292e] rounded-lg text-center">
              <p className="text-[#8d8d99]">The BIR Quarterly Form 2550Q generation will go here.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
export default App;