import * as React from 'react';
import { useState, useEffect } from 'react';

export const CashDisbursementForm: React.FC<{ userId: string }> = ({ userId }) => {
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState<number | ''>('');
    const [expenseAccount, setExpenseAccount] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [remarks, setRemarks] = useState('');

    // --- PAYEE / VENDOR STATES ---
    const [payees, setPayees] = useState<any[]>([]);
    const [payeeId, setPayeeId] = useState('');
    const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
    const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
    const [showAddPayee, setShowAddPayee] = useState(false);
    const [newPayeeName, setNewPayeeName] = useState('');
    const [isSubmittingPayee, setIsSubmittingPayee] = useState(false);

    // --- VAT & SOURCE STATES ---
    const [sourceAccount, setSourceAccount] = useState('1010'); 
    const [isVatable, setIsVatable] = useState(false);
    const [payeeTin, setPayeeTin] = useState(''); // We keep this for the audit description

    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const api = (window as any).api || (window as any).electronAPI;
            if (api) {
                try {
                    const accData = await api.getAccounts();
                    const filtered = accData.filter((acc: any) =>
                        acc.account_type.name === 'Expense' || acc.account_type.name === 'Liability'
                    );
                    setExpenseAccounts(filtered);

                    const payeeData = await api.getPayees();
                    setPayees(payeeData);
                } catch (e) {
                    console.error(e);
                }
            }
        };
        loadData();
    }, []);

    // Inline Create Vendor
    const handleCreatePayee = async () => {
        if (!newPayeeName.trim()) return;
        setIsSubmittingPayee(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            await api.createPayee(newPayeeName);
            
            const updatedPayees = await api.getPayees();
            setPayees(updatedPayees);
            
            const newRecord = updatedPayees.find((p: any) => p.name.toLowerCase() === newPayeeName.toLowerCase());
            if (newRecord) setPayeeId(newRecord.id);

            setShowAddPayee(false);
            setNewPayeeName('');
            setStatus({ type: 'success', msg: `Successfully added ${newPayeeName} to the database!` });
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', msg: "Failed to create new record." });
        } finally {
            setIsSubmittingPayee(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);

        try {
            const numAmount = Number(amount);
            if (!userId) throw new Error("Developer Error: userId is missing.");
            if (!payeeId) throw new Error("Please tag a Vendor/Supplier.");
            if (numAmount <= 0) throw new Error("Amount must be greater than zero.");
            if (isVatable && !payeeTin.trim()) throw new Error("Supplier TIN is required to claim Input VAT.");

            setLoading(true);

            let expenseDebit = numAmount;
            let vatDebit = 0;

            if (isVatable) {
                expenseDebit = Number((numAmount / 1.12).toFixed(2));
                vatDebit = Number((numAmount - expenseDebit).toFixed(2));
            }

            const lines = [];
            lines.push({ accountId: expenseAccount, debit: expenseDebit, credit: 0 });
            if (isVatable && vatDebit > 0) lines.push({ accountId: '1300', debit: vatDebit, credit: 0 });
            lines.push({ accountId: sourceAccount, debit: 0, credit: numAmount });

            // ---> NEW: Save the TIN to the Payee's database profile permanently! <---
            const api = (window as any).api || (window as any).electronAPI;
            if (isVatable && payeeTin.trim()) {
                await api.updatePayeeTin(payeeId, payeeTin);
            }

            const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || 'Supplier';
            const description = `Disbursement to ${selectedPayeeName} - ${remarks}${isVatable ? ' [VATABLE]' : ''}`;
       
            const entryData = {
                date: new Date(date).toISOString(),
                referenceNo: referenceNo,
                description: description,
                vatType: isVatable ? 'VATABLE' : 'EXEMPT',
                userId: userId,
                payeeId: payeeId, // ---> THIS FIXES THE BIR REPORT! <---
                lines: lines
            };

            const result = await api.submitJournalEntry(entryData);

            if (result.success) {
                setStatus({ type: 'success', msg: `Voucher ${result.referenceNo} issued successfully!` });
                setAmount(''); setExpenseAccount(''); setReferenceNo(''); setRemarks('');
                setIsVatable(false); setPayeeTin(''); setSourceAccount('1010'); setPayeeId('');
                
                // Refresh payees silently to get any newly saved TINs into state
                const updatedPayees = await api.getPayees();
                setPayees(updatedPayees);
            } else {
                setStatus({ type: 'error', msg: result.error });
            }
        } catch (err: any) {
            setStatus({ type: 'error', msg: err.message || "Failed to process disbursement." });
        } finally {
            setLoading(false);
        }
    };

    const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));
    const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '-- Select Vendor / Supplier --';

    return (
        <div className="max-w-3xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg font-sans">
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

                {/* ROW 1: Date & Payee Dropdown */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                    </div>
                    
                    <div className="relative">
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider">Vendor / Supplier</label>
                            <button type="button" onClick={() => setShowAddPayee(!showAddPayee)} className="text-xs font-bold text-[#4f46e5] hover:text-[#5b54f6] transition hover:underline">
                                {showAddPayee ? 'Cancel' : '+ Add New'}
                            </button>
                        </div>

                        {showAddPayee && (
                            <div className="mb-3 p-3 bg-[#121214] border border-[#4f46e5]/50 rounded-md flex gap-3 shadow-inner">
                                <input type="text" placeholder="e.g. Metro Drug Inc." value={newPayeeName} onChange={e => setNewPayeeName(e.target.value)} className="flex-1 bg-transparent text-sm text-white outline-none placeholder-[#3f3f46]" autoFocus />
                                <button type="button" onClick={handleCreatePayee} disabled={isSubmittingPayee || !newPayeeName.trim()} className="bg-[#4f46e5] hover:bg-[#5b54f6] text-white text-xs font-bold px-4 py-2 rounded transition disabled:opacity-50">Save</button>
                            </div>
                        )}

                        <div className="relative">
                            <div onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)} className={`w-full bg-[#121214] border ${isPayeeDropdownOpen ? 'border-[#4f46e5]' : 'border-[#29292e]'} rounded-md p-3 text-sm text-white transition cursor-pointer flex justify-between items-center`}>
                                <span className={payeeId ? 'text-white' : 'text-gray-500'}>{selectedPayeeName}</span>
                                <svg className="w-4 h-4 text-[#8d8d99]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </div>

                            {isPayeeDropdownOpen && (
                                <div className="absolute z-20 w-full mt-1 bg-[#202024] border border-[#29292e] rounded-md shadow-2xl overflow-hidden">
                                    <div className="p-2 border-b border-[#29292e] bg-[#121214]">
                                        <input type="text" autoFocus placeholder="🔍 Search vendor..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-transparent p-2 text-sm text-white outline-none placeholder-[#3f3f46]" />
                                    </div>
                                    <ul className="max-h-48 overflow-y-auto">
                                        <li onClick={() => { setPayeeId(''); setPayeeTin(''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-[#8d8d99] hover:bg-[#4f46e5] hover:text-white cursor-pointer transition">-- Clear Selection --</li>
                                        {filteredPayees.length > 0 ? (
                                            filteredPayees.map(p => (
                                                <li 
                                                    key={p.id} 
                                                    onClick={() => { 
                                                        setPayeeId(p.id); 
                                                        // ==========================================
                                                        // ---> QoL FEATURE: AUTO-FILL THE TIN! <---
                                                        // ==========================================
                                                        setPayeeTin(p.tin || ''); 
                                                        setIsPayeeDropdownOpen(false); 
                                                        setPayeeSearchQuery(''); 
                                                    }} 
                                                    className="p-3 text-sm text-white hover:bg-[#4f46e5] cursor-pointer transition border-t border-[#29292e]/50"
                                                >
                                                    {p.name}
                                                </li>
                                            ))
                                        ) : (
                                            <li className="p-3 text-sm text-gray-500 text-center border-t border-[#29292e]/50">No vendors found.</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
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

                {/* ROW 4: Input VAT Details */}
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
                            This is a VATable Purchase (Extract 12% Input VAT)
                        </label>
                    </div>
                    {isVatable && (
                        <div className="mt-4 grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Supplier TIN (Required to claim VAT)</label>
                                <input type="text" required
                                    placeholder="e.g. 123-456-789-000"
                                    className="w-full bg-[#202024] border border-red-900/50 rounded-md p-3 text-sm text-white focus:border-red-500 outline-none transition"
                                    value={payeeTin} onChange={e => setPayeeTin(e.target.value)} 
                                />
                            </div>
                            <div className="flex items-end text-xs text-gray-500 pb-2">
                                * System will automatically record a debit entry of <strong>₱{amount ? (Number(amount) - Number(amount) / 1.12).toFixed(2) : '0.00'}</strong> to Input VAT (1300).
                            </div>
                        </div>
                    )}
                </div>

                {/* ROW 5: Remarks */}
                <div>
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Remarks</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional details..." className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                </div>

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