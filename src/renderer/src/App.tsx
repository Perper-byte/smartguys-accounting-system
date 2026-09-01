// src/renderer/src/App.tsx
import * as React from 'react'
import { useState, useEffect } from 'react'

// Lucide Icons
import {
  Home,
  CreditCard,
  DollarSign,
  Contact,
  LineChart,
  Package,
  ArrowUpRight,
  Stethoscope,
  Clock,
  ClipboardList,
  Users,
  Edit3,
  Wrench,
  BookOpen,
  Landmark,
  Library,
  PieChart,
  FileText,
  Building2,
  Ban,
  History,
  Database,
  ListTree,
  Tags,
  LogOut
} from 'lucide-react'

// Screens
import { LoginScreen } from './components/LoginScreen'
import { WelcomeView } from './components/WelcomeView'
import { DashboardView } from './components/DashboardView'
import { POSBillingView } from './components/POSBillingView'
import { ReceivePaymentView } from './components/ReceivePaymentView'
import { ContactDirectoryView } from './components/ContactDirectoryView'
import { CashierHistoryView } from './components/CashierHistoryView'
import { InventoryView } from './components/InventoryView'
import { CashDisbursementForm } from './components/CashDisbursementForm'
import { EWTPayoutView } from './components/EWTPayoutView'
import { AgedReceivablesView } from './components/AgedReceivablesView'
import { InvoiceTrackerView } from './components/InvoiceTrackerView'
import { PayrollView } from './components/PayrollView'
import { JournalManagementView } from './components/JournalManagementView';
import { GeneralLedgerView } from './components/GeneralLedgerView'
import { ReconciliationView } from './components/ReconciliationView'
import { BooksOfAccountsView } from './components/BooksOfAccountsView'
import { FinancialStatementsView } from './components/FinancialStatementsView'
import { BIRReportsView } from './components/BIRReportsView'
import { VoidApprovalsView } from './components/VoidApprovalsView'
import { SystemAuditLogView } from './components/SystemAuditLogView'
import UserManagementView from './components/UserManagementView'
import { DatabaseBackupView } from './components/DatabaseBackupView'
import { ChartOfAccountsView } from './components/ChartOfAccountsView'
import { ServicesManagerView } from './components/ServicesManagerView'

import logoImage from './assets/smartguys_logo.jpg'

type User = { id: string; username: string; role: string; permissions?: string[] }
type Role = 'CASHIER' | 'ACCOUNTANT' | 'MANAGER' | 'IT_PERSONNEL'

const ROLES: Record<string, Role[]> = {
  ALL: ['CASHIER', 'ACCOUNTANT', 'MANAGER', 'IT_PERSONNEL'],
  CASHIER_ONLY: ['CASHIER'],
  ACCOUNTANT_ONLY: ['ACCOUNTANT'],
  MANAGER_ONLY: ['MANAGER'],
  IT_ONLY: ['IT_PERSONNEL'],
  FINANCE_TEAM: ['ACCOUNTANT', 'MANAGER'],
  OPS_FINANCE: ['CASHIER', 'ACCOUNTANT']
} as const

const GROUP_ORDER = ['Home', 'Clinic Operations', 'Accounting', 'Reports & Taxes', 'System Admin']

const ALL_TABS = [
  { id: 'home', label: 'Home', icon: Home, group: 'Home', allowedRoles: ROLES.ALL },
  {
    id: 'billing',
    label: 'Patient Billing',
    icon: CreditCard,
    group: 'Clinic Operations',
    allowedRoles: ROLES.CASHIER_ONLY
  },
  {
    id: 'collections',
    label: 'Receive Payments',
    icon: DollarSign,
    group: 'Clinic Operations',
    allowedRoles: ROLES.OPS_FINANCE
  },
  {
    id: 'directory',
    label: 'Contact Directory',
    icon: Contact,
    group: 'Clinic Operations',
    allowedRoles: ROLES.ALL
  },
  {
    id: 'history',
    label: 'Transaction History',
    icon: LineChart,
    group: 'Clinic Operations',
    allowedRoles: ROLES.CASHIER_ONLY
  },
  {
    id: 'inventory',
    label: 'Stock & Inventory',
    icon: Package,
    group: 'Clinic Operations',
    allowedRoles: ['CASHIER', 'MANAGER']
  },
  {
    id: 'disbursement',
    label: 'Cash Disbursements',
    icon: ArrowUpRight,
    group: 'Accounting',
    allowedRoles: ROLES.ACCOUNTANT_ONLY
  },
  {
    id: 'payouts',
    label: 'Doctor Payouts',
    icon: Stethoscope,
    group: 'Accounting',
    allowedRoles: ROLES.ACCOUNTANT_ONLY
  },
  {
    id: 'aging',
    label: 'Aged Receivables (HMO)',
    icon: Clock,
    group: 'Accounting',
    allowedRoles: ROLES.FINANCE_TEAM
  },
  {
    id: 'tracker',
    label: 'Invoice Tracker',
    icon: ClipboardList,
    group: 'Accounting',
    allowedRoles: ROLES.ACCOUNTANT_ONLY
  },
  {
    id: 'payroll',
    label: 'HR & Payroll',
    icon: Users,
    group: 'Accounting',
    allowedRoles: ROLES.FINANCE_TEAM
  },
  {
    id: 'journal',
    label: 'Journal Entry',
    icon: Edit3,
    group: 'Accounting',
    allowedRoles: ROLES.ACCOUNTANT_ONLY
  },
  {
    id: 'adjusting',
    label: 'Adjusting Entries',
    icon: Wrench,
    group: 'Accounting',
    allowedRoles: ROLES.ACCOUNTANT_ONLY
  },
  {
    id: 'ledger',
    label: 'General Ledger',
    icon: BookOpen,
    group: 'Accounting',
    allowedRoles: ROLES.ACCOUNTANT_ONLY
  },
  {
    id: 'reconciliation',
    label: 'Bank Reconciliation',
    icon: Landmark,
    group: 'Accounting',
    allowedRoles: ROLES.FINANCE_TEAM
  },
  {
    id: 'books',
    label: 'Books of Accounts',
    icon: Library,
    group: 'Accounting',
    allowedRoles: ROLES.FINANCE_TEAM
  },
  {
    id: 'analytics',
    label: 'Analytics Dashboard',
    icon: PieChart,
    group: 'Reports & Taxes',
    allowedRoles: ROLES.MANAGER_ONLY
  },
  {
    id: 'statements',
    label: 'Financial Statements',
    icon: FileText,
    group: 'Reports & Taxes',
    allowedRoles: ROLES.FINANCE_TEAM
  },
  {
    id: 'bir',
    label: 'BIR Tax Compliance',
    icon: Building2,
    group: 'Reports & Taxes',
    allowedRoles: ROLES.ACCOUNTANT_ONLY
  },
  {
    id: 'voids',
    label: 'Void Approvals',
    icon: Ban,
    group: 'Reports & Taxes',
    allowedRoles: ROLES.MANAGER_ONLY
  },
  {
    id: 'audit',
    label: 'Audit Trails',
    icon: History,
    group: 'System Admin',
    allowedRoles: ROLES.IT_ONLY
  },
  {
    id: 'users',
    label: 'User Management',
    icon: Users,
    group: 'System Admin',
    allowedRoles: ROLES.IT_ONLY
  },
  {
    id: 'backup',
    label: 'Database Backup',
    icon: Database,
    group: 'System Admin',
    allowedRoles: ROLES.IT_ONLY
  },
  {
    id: 'coa',
    label: 'Chart of Accounts',
    icon: ListTree,
    group: 'System Admin',
    allowedRoles: ROLES.MANAGER_ONLY
  },
  {
    id: 'services',
    label: 'Services & Pricing',
    icon: Tags,
    group: 'System Admin',
    allowedRoles: ROLES.MANAGER_ONLY
  }
]

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState('home')
  const [navData, setNavData] = useState<any>(null)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const checkConnection = async () => {
      const api = (window as any).electronAPI || (window as any).api
      if (api && api.pingDatabase) {
        const ok = await api.pingDatabase()
        setIsOnline(ok)
      }
    }
    checkConnection()
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user)
    setActiveTab('home')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setActiveTab('home')
  }

  const handleNavigation = (tabId: string, data?: any) => {
    setActiveTab(tabId)
    setNavData(data || null)
  }

  const permittedTabs = currentUser
    ? ALL_TABS.filter((tab) => {
        if (currentUser.permissions && currentUser.permissions.length > 0) {
          return tab.id === 'home' || currentUser.permissions.includes(tab.id)
        }
        return tab.allowedRoles.includes(currentUser.role as Role)
      })
    : []

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div
      id="app-wrapper"
      className="flex h-screen bg-[#FBF8F8] text-gray-800 overflow-hidden font-sans print:bg-white print:text-black print:h-auto print:overflow-visible selection:bg-[#1B9387]/20"
    >
      <aside
        id="app-sidebar"
        className="w-64 bg-white border-r border-[#B0DCDA] flex flex-col justify-between shadow-sm z-20 flex-shrink-0 print:hidden"
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-6 border-b border-[#B0DCDA] shrink-0">
            <div className="flex items-center space-x-3">
              <img
                src={logoImage}
                alt="Clinic Logo"
                className="h-10 w-10 object-contain drop-shadow-sm rounded-lg"
              />
              <span className="font-extrabold tracking-wide text-gray-800 text-lg">
                SmartGuys Clinic
              </span>
            </div>
          </div>

          <nav className="py-2 px-3 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
            {GROUP_ORDER.map((groupName) => {
              const tabsInGroup = permittedTabs.filter((tab) => tab.group === groupName)
              if (tabsInGroup.length === 0) return null

              return (
                <div key={groupName} className="mb-2">
                  {groupName !== 'Home' && (
                    <h3 className="px-3 text-[10px] font-extrabold text-[#1B9387] uppercase tracking-widest mb-2 mt-2">
                      {groupName}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {tabsInGroup.map((tab) => {
                      const Icon = tab.icon
                      const isActive = activeTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            isActive
                              ? 'bg-[#1B9387] text-white shadow-md shadow-[#1B9387]/20'
                              : 'text-gray-600 hover:bg-[#E9FAFA] hover:text-[#1B9387]'
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`}
                          />
                          <div className="flex items-center gap-2">
                            <span>{tab.label}</span>
                            {tab.id === 'billing' && (
                              <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[9px] font-extrabold tracking-wider border border-teal-200 shadow-sm">
                                POS
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[#B0DCDA] bg-gray-50 shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-[#B0DCDA] shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-[#1B9387] text-white flex items-center justify-center font-bold text-lg shrink-0">
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate capitalize">
                {currentUser.username}
              </p>
              <p className="text-[10px] font-bold text-[#1B9387] uppercase tracking-wider truncate">
                {currentUser.permissions && currentUser.permissions.length > 0
                  ? 'CUSTOM ACCESS'
                  : currentUser.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden print:overflow-visible bg-[#FBF8F8]">
        {/* HEADER (Search Bar Removed) */}
        <header
          id="app-header"
          className="h-16 bg-white border-b border-[#B0DCDA] flex items-center justify-between px-8 shadow-sm z-10 flex-shrink-0 print:hidden"
        >
          <h2 className="text-lg font-extrabold text-gray-800 tracking-wide capitalize">
            {permittedTabs.find((t) => t.id === activeTab)?.label || 'Workspace'}
          </h2>

          <div className="flex items-center gap-6">
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition-colors duration-300 ${isOnline ? 'bg-[#E9FAFA] border-[#B0DCDA]' : 'bg-red-50 border-red-200'}`}
            >
              <div
                className={`h-2 w-2 rounded-full ${isOnline ? 'bg-[#1B9387] animate-pulse' : 'bg-red-500'}`}
              ></div>
              <span
                className={`text-xs font-bold tracking-wide uppercase ${isOnline ? 'text-[#1B9387]' : 'text-red-600'}`}
              >
                Local Connection: {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </header>

        <main
          id="app-main"
          className="flex-1 overflow-y-auto print:p-0 print:bg-white print:overflow-visible relative"
        >
          {!permittedTabs.find((t) => t.id === activeTab) ? (
            <div className="p-6 m-8 bg-red-50 border border-red-200 rounded-lg text-center shadow-sm print:hidden">
              <h3 className="text-red-600 font-bold text-lg">⚠️ Access Denied</h3>
              <p className="text-sm text-red-500 mt-2 font-medium">
                Your role does not have permission to view this module.
              </p>
            </div>
          ) : (
            <div className="h-full animate-in fade-in duration-300">
              {activeTab === 'home' && (
                <WelcomeView
                  username={currentUser.username}
                  role={currentUser.role}
                  onNavigate={setActiveTab}
                />
              )}
              {activeTab === 'analytics' && <DashboardView />}
              {activeTab === 'reconciliation' && <ReconciliationView userId={currentUser.id} />}
              {activeTab === 'books' && <BooksOfAccountsView />}
              {activeTab === 'statements' && <FinancialStatementsView />}
              {activeTab === 'bir' && <BIRReportsView />}
              {activeTab === 'backup' && <DatabaseBackupView />}
              {activeTab === 'billing' && <POSBillingView userId={currentUser.id} />}
              {activeTab === 'collections' && (
                <ReceivePaymentView userId={currentUser.id} prefillData={navData} />
              )}
              {activeTab === 'payouts' && <EWTPayoutView userId={currentUser.id} />}
              {activeTab === 'users' && <UserManagementView />}
              {activeTab === 'aging' && <AgedReceivablesView onNavigate={handleNavigation} />}
              {activeTab === 'history' && (
                <CashierHistoryView userId={currentUser.id} prefillData={navData} />
              )}
              {activeTab === 'voids' && <VoidApprovalsView userId={currentUser.id} />}
              {activeTab === 'audit' && <SystemAuditLogView />}
              {activeTab === 'tracker' && <InvoiceTrackerView onNavigate={handleNavigation} />}
              {activeTab === 'payroll' && <PayrollView userId={currentUser.id} />}
              {activeTab === 'directory' && <ContactDirectoryView onNavigate={handleNavigation} />}
              {activeTab === 'coa' && <ChartOfAccountsView />}
              {activeTab === 'services' && <ServicesManagerView />}
              {activeTab === 'inventory' && (
                <InventoryView userId={currentUser.id} role={currentUser.role} />
              )}

             {activeTab === 'journal' && <JournalManagementView userId={currentUser.id} />}
              {activeTab === 'disbursement' && <CashDisbursementForm userId={currentUser.id} />}
              {activeTab === 'ledger' && <GeneralLedgerView />}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
