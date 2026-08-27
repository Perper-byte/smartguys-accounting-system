// src/renderer/src/components/WelcomeView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
    Receipt,
    CreditCard,
    History,
    FileSignature,
    Wallet,
    Inbox,
    TrendingDown,
    TrendingUp,
    AlertCircle
} from 'lucide-react';

interface WelcomeViewProps {
    username: string;
    role: string;
    onNavigate?: (tabName: string) => void;
}

interface TransactionItem {
    id: string | number;
    createdAt: string | Date;
    patientName: string;
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

    const canBilling = role === 'CASHIER';
    const canReceivePayment = role === 'CASHIER' || role === 'ACCOUNTANT';
    const canHistory = role === 'CASHIER';
    const canJournalEntry = role === 'ACCOUNTANT';
    const canReconcile = role === 'ACCOUNTANT' || role === 'MANAGER';
    const canViewReports = role === 'ACCOUNTANT' || role === 'MANAGER';

    const hasQuickActions = canBilling || canReceivePayment || canHistory || canJournalEntry || canReconcile || canViewReports;

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

    return (
        <div className="min-h-full p-8 bg-slate-50 text-slate-800 font-sans space-y-6">

            {/* 1. GREETING BANNER */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-[#1B9387] rounded-lg flex items-center justify-center shadow-md shadow-[#1B9387]/20 text-white text-xl font-bold shrink-0">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                                Welcome back, <span className="text-[#1B9387] lowercase">{role}!</span>
                            </h1>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">
                            SmartGuys Clinic Workspace
                        </span>
                    </div>
                </div>

                <div className="text-right flex flex-col items-end">
                    <span className="text-lg font-bold font-mono text-slate-800">
                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-xs text-slate-500 font-medium mt-0.5">
                        {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                </div>
            </div>

            {/* 2. TODAY'S SUMMARY (4 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Sales */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today's Sales</span>
                        <Receipt className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{formatCurrency(todayStats.sales)}</div>
                </div>

                {/* Money In */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Money In (Received)</span>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600">{formatCurrency(todayStats.payments)}</div>
                </div>

                {/* Money Out */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Money Out (Paid)</span>
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="text-2xl font-black text-rose-600">{formatCurrency(todayStats.disbursements)}</div>
                </div>

                {/* Pending Voids (High Contrast Alert State when > 0) */}
                <div className={`border rounded-xl p-5 shadow-sm transition-colors ${pendingVoidsCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${pendingVoidsCount > 0 ? 'text-red-700' : 'text-slate-500'}`}>
                            Pending Voids
                        </span>
                        {pendingVoidsCount > 0 ? (
                            <AlertCircle className="w-4 h-4 text-red-600 animate-pulse" />
                        ) : (
                            <FileSignature className="w-4 h-4 text-slate-400" />
                        )}
                    </div>
                    <div className={`text-2xl font-black ${pendingVoidsCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        {pendingVoidsCount}
                    </div>
                    <p className={`text-[10px] mt-1 font-semibold ${pendingVoidsCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {pendingVoidsCount > 0 ? 'Requires manager attention immediately' : 'All clear'}
                    </p>
                </div>
            </div>

            {/* 3. QUICK ACTIONS */}
            {hasQuickActions && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Quick Actions
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {canBilling && (
                            <button onClick={() => handleActionClick('billing')} className="flex items-center justify-between p-4 rounded-xl border border-[#1B9387] bg-[#1B9387] text-white hover:bg-[#15796f] transition-all group shadow-md shadow-[#1B9387]/20">
                                <div className="flex items-center gap-3">
                                    <Receipt className="w-6 h-6 text-white/90" />
                                    <span className="font-bold text-sm tracking-wide">Patient Billing <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[9px] ml-1">POS</span></span>
                                </div>
                                <kbd className="hidden lg:inline-block text-[11px] font-bold font-sans px-2 py-1 rounded bg-black/10 text-white border border-white/20 shadow-sm">Alt + P</kbd>
                            </button>
                        )}
                        {canReceivePayment && (
                            <button onClick={() => handleActionClick('collections')} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-[#1B9387] hover:bg-slate-50 text-slate-700 hover:text-[#1B9387] transition-all group shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 group-hover:bg-[#1B9387] group-hover:text-white transition-colors">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-sm">Receive Payment</span>
                                </div>
                                <kbd className="hidden lg:inline-block text-[11px] font-bold font-sans px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200 shadow-sm group-hover:border-teal-200 group-hover:text-teal-600">Alt + R</kbd>
                            </button>
                        )}
                        {canHistory && (
                            <button onClick={() => handleActionClick('history')} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-[#1B9387] hover:bg-slate-50 text-slate-700 hover:text-[#1B9387] transition-all group shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <History className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-sm">Transaction History</span>
                                </div>
                                <kbd className="hidden lg:inline-block text-[11px] font-bold font-sans px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200 shadow-sm group-hover:border-indigo-200 group-hover:text-indigo-600">Alt + T</kbd>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 4. TODAY'S TRANSACTIONS */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-h-[300px] overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today's Transactions</h2>
                    <button onClick={() => handleActionClick('history')} className="text-xs font-bold text-[#1B9387] hover:text-teal-800 transition-colors">
                        View All →
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-sm">
                        Loading transactions...
                    </div>
                ) : recentTransactions.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Inbox className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700">No activity yet</h3>
                        <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                            Your recent cashier activities will appear here after you process your first transaction today.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 w-32">Time</th>
                                    <th className="px-6 py-3 min-w-[200px]">Payee / Entity</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3">Method</th>
                                    <th className="px-6 py-3 text-right">Amount</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                {recentTransactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3.5 text-slate-500 text-xs">{formatTime(tx.createdAt)}</td>
                                        <td className="px-6 py-3.5 font-bold text-slate-900">{tx.patientName}</td>
                                        <td className="px-6 py-3.5 text-slate-600 truncate max-w-[250px]">{tx.type}</td>
                                        <td className="px-6 py-3.5">
                                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wider uppercase border border-slate-200">
                                                {tx.paymentMethod}
                                            </span>
                                        </td>
                                        {/* AMOUNT COLUMN (Right aligned, Monospaced, Color-Coded Signed values) */}
                                        <td className="px-6 py-3.5 text-right font-mono text-[13px] font-bold tracking-tight">
                                            <span className={tx.direction === 'OUT' ? 'text-rose-600' : 'text-emerald-600'}>
                                                {tx.direction === 'OUT' ? '- ' : '+ '}{formatCurrency(tx.amount)}
                                            </span>
                                        </td>
                                        {/* STATUS COLUMN (Distinct Void State) */}
                                        <td className="px-6 py-3.5 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider border ${tx.status === 'VOIDED'
                                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                    : tx.status === 'PENDING'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${tx.status === 'VOIDED'
                                                        ? 'bg-rose-500'
                                                        : tx.status === 'PENDING'
                                                            ? 'bg-amber-500'
                                                            : 'bg-emerald-500'
                                                    }`}></span>
                                                {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
};