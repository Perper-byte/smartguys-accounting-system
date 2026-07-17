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

    // --- NEW: Source of Funds, VAT, and TIN States ---
    const [sourceAccount, setSourceAccount] = useState('1010'); // Default to 1010 Cash in Bank
    const [isVatable, setIsVatable] = useState(false);
    const [payeeTin, setPayeeTin] = useState('');

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
            if (isVatable && !payeeTin.trim()) throw new Error("Supplier TIN is required to claim Input VAT [2].");

            // --- AUTO VAT & DOUBLE-ENTRY LOGIC ---
            let expenseDebit = numAmount;
            let vatDebit = 0;

            if (isVatable) {
                // Auto-strip the 12% Input VAT to calculate true expense vs tax [2]
                expenseDebit = Number((numAmount / 1.12).toFixed(2));
                vatDebit = Number((numAmount - expenseDebit).toFixed(2));
            }

            const lines = [];

            // 1. DEBIT: The selected expense account (net of VAT if applicable)
            lines.push({ accountId: expenseAccount, debit: expenseDebit, credit: 0 });

            // 2. DEBIT: Input VAT Account (1300) if applicable [2]
            if (isVatable && vatDebit > 0) {
                lines.push({ accountId: '1300', debit: vatDebit, credit: 0 });
            }

            // 3. CREDIT: Selected Source of Funds (Cash in Bank 1010 or Petty Cash 1020)
            lines.push({ accountId: sourceAccount, debit: 0, credit: numAmount });

            // Format description to include the Payee's TIN for easy tax audit trailing
            const description = `Disbursement to ${payee}${payeeTin ? ` (TIN: ${payeeTin})` : ''} - ${remarks}${isVatable ? ' [VATABLE]' : ''}`;

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
                setIsVatable(false); setPayeeTin(''); setSourceAccount('1010');
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

                {/* ROW 1: Date & Payee */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Payee Name</label>
                        <input type="text" required value={payee} onChange={e => setPayee(e.target.value)} placeholder="e.g. Meralco, Supplier Inc." className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                    </div>
                </div>

                {/* ROW 2: Source of Funds & Check No. */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Source of Funds (Credit)</label>
                        <select required value={sourceAccount} onChange={e => setSourceAccount(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition cursor-pointer">
                            <option value="1010" className="bg-[#202024]">1010 - Cash in Bank (Checking)</option>
                            <option value="1020" className="bg-[#202024]">1020 - Petty Cash Fund (On Hand)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Check / Voucher No.</label>
                        <input type="text" required value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="e.g. CV-1029" className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                    </div>
                </div>

                {/* ROW 3: Amount & Expense Account */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Amount Paid (₱)</label>
                        <input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} placeholder="0.00" className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white font-mono focus:border-[#4f46e5] outline-none transition" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Expense Account (Debit)</label>
                        <select required value={expenseAccount} onChange={e => setExpenseAccount(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition cursor-pointer">
                            <option value="" className="text-[#8d8d99]">-- Select Utility, Payroll, or Supply Account --</option>
                            {expenseAccounts.map(acc => (
                                <option key={acc.code} value={acc.code} className="bg-[#202024]">{acc.code} - {acc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ROW 4: Input VAT Details (Appears dynamically) */}
                <div className="p-4 bg-[#121214] border border-[#29292e] rounded-lg">
                    <div className="flex items-center">
                        <input 
                            type="checkbox" 
                            id="isVatableDisb" 
                            className="w-4 h-4 text-[#4f46e5] bg-gray-700 border-gray-600 rounded cursor-pointer"
                            checked={isVatable}
                            onChange={(e) => setIsVatable(e.target.checked)}
                        />
                        <label htmlFor="isVatableDisb" className="ml-2 text-sm font-medium text-red-400 cursor-pointer">
                            This is a VATable Purchase (Extract 12% Input VAT) [2]
                        </label>
                    </div>
                    {isVatable && (
                        <div className="mt-4 grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Supplier TIN (Required to claim VAT) [2]</label>
                                <input type="text" required
                                    placeholder="e.g. 123-456-789-000"
                                    className="w-full bg-[#202024] border border-red-900/50 rounded-md p-3 text-sm text-white focus:border-red-500 outline-none transition"
                                    value={payeeTin} onChange={e => setScPwdId ? setPayeeTin(e.target.value) : setPayeeTin(e.target.value)} // Fallback check
                                />
                            </div>
                            <div className="flex items-end text-xs text-gray-500 pb-2">
                                * System will automatically record a debit entry of <strong>₱{amount ? (Number(amount) - Number(amount) / 1.12).toFixed(2) : '0.00'}</strong> to Input VAT (1300) [2].
                            </div>
                        </div>
                    )}
                </div>

                {/* ROW 5: Remarks */}
                <div>
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Remarks</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional details..." className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                </div>

                {/* SUBMIT BUTTON */}
                <button
                    type="submit"
                    disabled={loading}
                    className="cursor-pointer w-full mt-4 bg-[#f75a68] disabled:bg-[#29292e] disabled:text-[#8d8d99] text-white font-bold py-4 rounded-md transition hover:bg-[#ff7682] uppercase tracking-widest shadow-lg"
                >
                    {loading ? 'Processing...' : 'Issue Disbursement'}
                </button>
            </form>
        </div>
    );
};
export default CashDisbursementForm;