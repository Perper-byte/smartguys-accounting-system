// src/renderer/src/components/WelcomeView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
    Receipt,
    History,
    FileSignature,
    Wallet,
    Inbox,
    TrendingDown,
    TrendingUp,
    AlertCircle,
    BookOpen,
    Landmark,
    FileBarChart,
    ShieldCheck
} from 'lucide-react';

interface WelcomeViewProps {
    username: string;
    role: string;
    onNavigate?: (tabName: string) => void;
}

interface TransactionItem {
    id: string | number;
    createdAt: string | Date;
    patientName?: string;
    payeeName?: string;
    type: string;
    paymentMethod: string;
    amount: number;
    direction: 'IN' | 'OUT';
    status: string;
}

interface TodayStats {
    sales: number;
    payments: number;
    disbursements: number;
    transactions: number;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ username, role, onNavigate }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState<boolean>(true);

    const [pendingVoidsCount, setPendingVoidsCount] = useState<number>(0);
    const [todayStats, setTodayStats] = useState<TodayStats>({ sales: 0, payments: 0, disbursements: 0, transactions: 0 });
    const [recentTransactions, setRecentTransactions] = useState<TransactionItem[]>([]);

    // Permissions
    const canBilling = role === 'CASHIER';
    const canReceivePayment = role === 'CASHIER';
    const canHistory = role === 'CASHIER'; // Restored for Cashier
    const canJournalEntry = role === 'ACCOUNTANT';
    const canReconcile = role === 'ACCOUNTANT' || role === 'MANAGER';
    const canViewReports = role === 'ACCOUNTANT' || role === 'MANAGER';

    const hasQuickActions = canBilling || canReceivePayment || canHistory || canJournalEntry || canReconcile || canViewReports;

    // Shared style for every quick-action button (matches the former "Patient Billing" highlight)
    const quickActionBtnClass =
        "flex flex-col items-start p-4 rounded-xl border border-[#1B9387] bg-[#1B9387] text-white hover:bg-[#15796f] transition-all group shadow-md shadow-[#1B9387]/20";

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const api = (window as any).api || (window as any).electronAPI;

                if (api) {
                    if (api.getPendingVoids) {
                        const voids = await api.getPendingVoids().catch(() => []);
                        if (Array.isArray(voids)) setPendingVoidsCount(voids.length);
                    }

                    if (api.getTodayStats) {
                        const stats = await api.getTodayStats().catch(() => null);
                        if (stats) {
                            setTodayStats({
                                sales: stats.sales || 0,
                                payments: stats.payments || 0,
                                disbursements: stats.disbursements || 0,
                                transactions: stats.transactions || 0
                            });
                        }
                    }

                    if (api.getRecentTransactions) {
                        const txs = await api.getRecentTransactions().catch(() => []);
                        if (Array.isArray(txs)) {
                            setRecentTransactions(txs);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load dashboard metrics:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleActionClick = (targetTab: string) => {
        if (onNavigate) onNavigate(targetTab);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(amount);
    };

    const formatTime = (dateInput: string | Date) => {
        if (!dateInput) return '';
        return new Date(dateInput).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const displayRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

    return (
        <div className="w-full h-full flex justify-center p-4 lg:p-8 bg-slate-50/50 overflow-y-auto">
            <div className="w-full max-w-7xl flex flex-col font-sans text-slate-800 space-y-6">

                {/* 1. GREETING BANNER */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-[#1B9387] rounded-xl flex items-center justify-center shadow-lg shadow-[#1B9387]/20 text-white text-2xl font-black shrink-0">
                            {username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                                    Welcome back, <span className="text-[#1B9387]">{displayRole}!</span>
                                </h1>
                            </div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mt-0.5">
                                SmartGuys Clinic Workspace
                            </span>
                        </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                        <span className="text-xl font-black font-mono text-slate-800">
                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                            {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                    </div>
                </div>

                {/* 2. TODAY'S SUMMARY */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-[#1B9387]/30 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Today's Sales</span>
                            <Receipt className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="text-2xl font-black font-mono text-slate-800">{formatCurrency(todayStats.sales)}</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-emerald-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Money In (Received)</span>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="text-2xl font-black font-mono text-emerald-600">{formatCurrency(todayStats.payments)}</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-rose-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Money Out (Paid)</span>
                            <TrendingDown className="w-4 h-4 text-rose-500" />
                        </div>
                        <div className="text-2xl font-black font-mono text-rose-600">{formatCurrency(todayStats.disbursements)}</div>
                    </div>

                    <div className={`border rounded-xl p-5 shadow-sm transition-colors ${pendingVoidsCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-extrabold uppercase tracking-widest ${pendingVoidsCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                Pending Voids
                            </span>
                            {pendingVoidsCount > 0 ? (
                                <AlertCircle className="w-4 h-4 text-red-600 animate-pulse" />
                            ) : (
                                <FileSignature className="w-4 h-4 text-slate-400" />
                            )}
                        </div>
                        <div className={`text-2xl font-black font-mono ${pendingVoidsCount > 0 ? 'text-red-700' : 'text-slate-800'}`}>
                            {pendingVoidsCount}
                        </div>
                        <p className={`text-[10px] mt-1 font-bold uppercase tracking-wider ${pendingVoidsCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {pendingVoidsCount > 0 ? 'Requires attention' : 'All clear'}
                        </p>
                    </div>
                </div>

                {/* 3. QUICK ACTIONS */}
                {hasQuickActions && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">
                            Quick Actions
                        </h2>

                        {/* Dynamic Grid: 3 columns for Cashier, 4 columns for Accountant */}
                        <div className={`grid grid-cols-1 sm:grid-cols-2 ${role === 'CASHIER' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>

                            {/* 🔥 Cashier Specific Quick Actions 🔥 */}
                            {canBilling && (
                                <button onClick={() => handleActionClick('billing')} className={quickActionBtnClass}>
                                    <Receipt className="w-6 h-6 text-white/90 mb-3" />
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-bold text-sm tracking-wide">Patient Billing <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[9px] ml-1">POS</span></span>
                                    </div>
                                </button>
                            )}

                            {canReceivePayment && (
                                <button onClick={() => handleActionClick('collections')} className={quickActionBtnClass}>
                                    <Wallet className="w-6 h-6 text-white/90 mb-3" />
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-bold text-sm tracking-wide">Receive Payment</span>
                                    </div>
                                </button>
                            )}

                            {/* Restored History Button for Cashiers */}
                            {canHistory && (
                                <button onClick={() => handleActionClick('history')} className={quickActionBtnClass}>
                                    <History className="w-6 h-6 text-white/90 mb-3" />
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-bold text-sm tracking-wide">Transaction History</span>
                                    </div>
                                </button>
                            )}

                            {/* 🔥 Accountant & Manager Specific Quick Actions 🔥 */}
                            {canJournalEntry && (
                                <button onClick={() => handleActionClick('journal')} className={quickActionBtnClass}>
                                    <BookOpen className="w-6 h-6 text-white/90 mb-3" />
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-bold text-sm tracking-wide">Journal Entry</span>
                                    </div>
                                </button>
                            )}

                            {canReconcile && (
                                <button onClick={() => handleActionClick('reconciliation')} className={quickActionBtnClass}>
                                    <Landmark className="w-6 h-6 text-white/90 mb-3" />
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-bold text-sm tracking-wide">Bank Reconciliation</span>
                                    </div>
                                </button>
                            )}

                            {canViewReports && (
                                <button onClick={() => handleActionClick('statements')} className={quickActionBtnClass}>
                                    <FileBarChart className="w-6 h-6 text-white/90 mb-3" />
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-bold text-sm tracking-wide">Financial Statements</span>
                                    </div>
                                </button>
                            )}

                            {canViewReports && (
                                <button onClick={() => handleActionClick('bir')} className={quickActionBtnClass}>
                                    <ShieldCheck className="w-6 h-6 text-white/90 mb-3" />
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-bold text-sm tracking-wide">BIR Tax Compliance</span>
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. TODAY'S TRANSACTIONS */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 min-h-[350px] overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Today's Transactions</h2>
                        <button onClick={() => handleActionClick(role === 'CASHIER' ? 'history' : 'ledger')} className="text-xs font-bold text-[#1B9387] hover:text-teal-800 transition-colors uppercase tracking-wider">
                            {role === 'CASHIER' ? 'View History →' : 'View Ledger →'}
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8">
                            <div className="h-8 w-8 rounded-full border-4 border-[#E9FAFA] border-t-[#1B9387] animate-spin mb-4" />
                            <span className="text-slate-400 font-medium text-sm">Loading activity...</span>
                        </div>
                    ) : recentTransactions.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Inbox className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-700">No activity yet</h3>
                            <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                                Recent financial activity will appear here once posted today.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-extrabold tracking-widest sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 w-32">Time</th>
                                        <th className="px-6 py-3">Payee / Entity</th>
                                        <th className="px-6 py-3">Description</th>
                                        <th className="px-6 py-3">Method / Ref</th>
                                        <th className="px-6 py-3 text-right">Amount (₱)</th>
                                        <th className="px-6 py-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                    {recentTransactions.map((tx) => {
                                        const entityName = tx.payeeName || tx.patientName || 'Unknown Entity';

                                        return (
                                            <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 text-slate-500 text-xs font-semibold">{formatTime(tx.createdAt)}</td>
                                                <td className="px-6 py-4 font-bold text-slate-900">{entityName}</td>
                                                <td className="px-6 py-4 text-slate-600 truncate max-w-[250px]">{tx.type}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold tracking-widest uppercase border border-slate-200">
                                                        {tx.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-sm font-bold tracking-tight">
                                                    <span className={tx.direction === 'OUT' ? 'text-rose-600' : 'text-emerald-600'}>
                                                        {tx.direction === 'OUT' ? '- ' : '+ '}{formatCurrency(tx.amount).replace('₱', '').trim()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-extrabold tracking-widest uppercase ${tx.status === 'VOIDED'
                                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                        : tx.status === 'PENDING'
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${tx.status === 'VOIDED' ? 'bg-rose-500'
                                                            : tx.status === 'PENDING' ? 'bg-amber-500'
                                                                : 'bg-emerald-500'
                                                            }`}></span>
                                                        {tx.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
