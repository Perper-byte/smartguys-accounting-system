// src/renderer/src/components/CashDisbursementForm.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export const CashDisbursementForm: React.FC<{ userId: string }> = ({ userId }) => {
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [payee, setPayee] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [expenseAccount, setExpenseAccount] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [remarks, setRemarks] = useState('');

    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch accounts and filter only Expenses and Liabilities (for paying bills)
        const api = (window as any).electronAPI;
        if (api && api.getAccounts) {
            api.getAccounts().then((data: any[]) => {
                const filtered = data.filter(acc =>
                    acc.account_type.name === 'Expense' || acc.account_type.name === 'Liability'
                );
                setExpenseAccounts(filtered);
            }).catch(() => setExpenseAccounts([]));
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);
        setLoading(true);

        try {
            const numAmount = Number(amount);
            if (numAmount <= 0) throw new Error("Amount must be greater than zero.");

            // Formulate the Double-Entry logic under the hood!
            // Debit: The selected expense account
            // Credit: Cash in Bank (1010)
            const lines = [
                { accountId: expenseAccount, debit: numAmount, credit: 0 },
                { accountId: '1010', debit: 0, credit: numAmount } // 1010 is our seeded Cash in Bank
            ];

            const description = `Disbursement to ${payee} - ${remarks}`;

            const api = (window as any).electronAPI;
            const result = await api.submitJournalEntry({
                date: new Date(date),
                referenceNo: referenceNo,
                description: description,
                userId,
                lines: lines
            });

            if (result.success) {
                setStatus({ type: 'success', msg: `Voucher ${result.referenceNo} issued successfully!` });
                // Reset form
                setPayee(''); setAmount(''); setExpenseAccount(''); setReferenceNo(''); setRemarks('');
            } else {
                setStatus({ type: 'error', msg: result.error });
            }
        } catch (err: any) {
            setStatus({ type: 'error', msg: err.message || "Failed to process disbursement." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b border-[#29292e] pb-4">
                <h2 className="text-xl font-bold text-white tracking-wide">New Disbursement</h2>
                <span className="bg-[#f75a68]/20 text-[#f75a68] text-xs px-3 py-1 rounded font-bold uppercase tracking-widest border border-[#f75a68]/30">Cash Outflow</span>
            </div>

            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* TOP ROW: Date & Payee */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Payee</label>
                        <input type="text" required value={payee} onChange={e => setPayee(e.target.value)} placeholder="e.g. Meralco, Supplier Inc." className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                    </div>
                </div>

                {/* MIDDLE ROW: Amount & Check No */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Amount (₱)</label>
                        <input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} placeholder="0.00" className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white font-mono focus:border-[#4f46e5] outline-none transition" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Check / Voucher No.</label>
                        <input type="text" required value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="e.g. CV-1029" className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                    </div>
                </div>

                {/* ACCOUNT DROPDOWN */}
                <div>
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Expense Account</label>
                    <select required value={expenseAccount} onChange={e => setExpenseAccount(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition cursor-pointer">
                        <option value="" className="text-[#8d8d99]">-- Select Utility, Payroll, or Supply Account --</option>
                        {expenseAccounts.map(acc => (
                            <option key={acc.code} value={acc.code} className="bg-[#202024]">{acc.code} - {acc.name}</option>
                        ))}
                    </select>
                </div>

                {/* REMARKS */}
                <div>
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Remarks</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional details..." className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                </div>

                {/* SUBMIT BUTTON */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 bg-[#f75a68] disabled:bg-[#29292e] disabled:text-[#8d8d99] text-white font-bold py-4 rounded-md transition hover:bg-[#ff7682] uppercase tracking-widest shadow-lg"
                >
                    {loading ? 'Processing...' : 'Issue Disbursement'}
                </button>
            </form>
        </div>
    );
};