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
        <div className="w-full bg-white border border-[#B0DCDA] rounded-xl p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-[#B0DCDA] pb-4">
                <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">New Disbursement</h2>
                <span className="bg-red-50 text-red-500 text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-widest border border-red-200">
                    Cash Outflow
                </span>
            </div>

            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* TOP ROW: Date & Payee */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Payee</label>
                        <input type="text" required value={payee} onChange={e => setPayee(e.target.value)} placeholder="e.g. Meralco, Supplier Inc." className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                    </div>
                </div>

                {/* MIDDLE ROW: Amount & Check No */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Amount (₱)</label>
                        <div className="relative flex items-center">
                            <span className="absolute left-3 text-gray-400 font-mono text-sm">₱</span>
                            <input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} placeholder="0.00" className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md py-3 pl-8 pr-3 text-sm text-gray-800 font-mono font-bold focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Check / Voucher No.</label>
                        <input type="text" required value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="e.g. CV-1029" className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-bold focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                    </div>
                </div>

                {/* ACCOUNT DROPDOWN */}
                <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Expense Account</label>
                    <div className="relative">
                        <select required value={expenseAccount} onChange={e => setExpenseAccount(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 pr-10 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition appearance-none cursor-pointer">
                            <option value="" className="text-gray-400">-- Select Utility, Payroll, or Supply Account --</option>
                            {expenseAccounts.map(acc => (
                                <option key={acc.code} value={acc.code} className="text-gray-800 bg-white">{acc.code} - {acc.name}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                            <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </div>
                    </div>
                </div>

                {/* REMARKS */}
                <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Remarks</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional details..." className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                </div>

                {/* SUBMIT BUTTON */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 bg-red-500 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none text-white font-bold py-4 rounded-md transition hover:bg-red-600 uppercase tracking-widest shadow-md flex justify-center items-center"
                >
                    {loading ? 'Processing...' : 'Issue Disbursement'}
                </button>
            </form>
        </div>
    );
};