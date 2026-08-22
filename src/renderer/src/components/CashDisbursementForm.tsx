import * as React from 'react';
import { useState, useEffect } from 'react';

 const getLocalDateString = () => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

export const CashDisbursementForm: React.FC<{ userId: string }> = ({ userId }) => {
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
     const [date, setDate] = useState(getLocalDateString());
    const [amount, setAmount] = useState<number | ''>('');
    const [expenseAccount, setExpenseAccount] = useState('');
    const [remarks, setRemarks] = useState('');

    // ---> NEW: Auto-Sequence States <---
    const [refPrefix] = useState('CV-');
    const [refSequence, setRefSequence] = useState('');

    // Payee States
    const [payees, setPayees] = useState<any[]>([]);
    const [payeeId, setPayeeId] = useState('');
    const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
    const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
    const [showAddPayee, setShowAddPayee] = useState(false);
    const [newPayeeName, setNewPayeeName] = useState('');
    const [isSubmittingPayee, setIsSubmittingPayee] = useState(false);

    // VAT & Source States
    const [sourceAccount, setSourceAccount] = useState('1010'); 
    const [isVatable, setIsVatable] = useState(false);
    const [payeeTin, setPayeeTin] = useState('');

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
                } catch (e) { console.error(e); }
            }
        };
        loadData();
    }, []);

    // ---> NEW: Fetch Sequence <---
    useEffect(() => {
        const fetchNextSeq = async () => {
            try {
                const api = (window as any).api || (window as any).electronAPI;
                const nextSeq = await api.getNextSequence(refPrefix);
                setRefSequence(nextSeq);
            } catch (error) { console.error(error); }
        };
        fetchNextSeq();
    }, [refPrefix, status]);

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
            if (!refSequence.trim()) throw new Error("Voucher Sequence is required.");
            if (isVatable && !payeeTin.trim()) throw new Error("Supplier TIN is required to claim Input VAT.");

            setLoading(true);

            let expenseDebit = numAmount;
            let vatDebit = 0;

            if (isVatable) {
                expenseDebit = Number((numAmount / 1.12).toFixed(2));
                vatDebit = Number((numAmount - expenseDebit).toFixed(2));
            }

            const lines: Array<{ accountId: string; debit: number; credit: number }> = [];
            lines.push({ accountId: expenseAccount, debit: expenseDebit, credit: 0 });
            if (isVatable && vatDebit > 0) lines.push({ accountId: '1300', debit: vatDebit, credit: 0 });
            lines.push({ accountId: sourceAccount, debit: 0, credit: numAmount });

            const api = (window as any).api || (window as any).electronAPI;
            if (isVatable && payeeTin.trim()) await api.updatePayeeTin(payeeId, payeeTin);

            const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || 'Supplier';
            const description = `Disbursement to ${selectedPayeeName} - ${remarks}${isVatable ? ' [VATABLE]' : ''}`;
            const fullReferenceNo = `${refPrefix}${refSequence.padStart(3, '0')}`;
       
            const entryData = {
                date: new Date(date).toISOString(),
                referenceNo: fullReferenceNo,
                description: description,
                vatType: isVatable ? 'VATABLE' : 'EXEMPT',
                userId: userId,
                payeeId: payeeId,
                lines: lines
            };

            const result = await api.submitJournalEntry(entryData);

            if (result.success) {
                setStatus({ type: 'success', msg: `Voucher ${fullReferenceNo} issued successfully!` });
                setAmount(''); setExpenseAccount(''); setRemarks('');
                setIsVatable(false); setPayeeTin(''); setSourceAccount('1010'); setPayeeId('');
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
<div className="max-w-3xl mx-auto bg-white border border-[#B0DCDA] rounded-xl p-8 shadow-sm">
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
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
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
                                                <li key={p.id} onClick={() => { setPayeeId(p.id); setPayeeTin(p.tin || ''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-white hover:bg-[#4f46e5] cursor-pointer transition border-t border-[#29292e]/50">{p.name}</li>
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

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Source of Funds (Credit)</label>
                        <select required value={sourceAccount} onChange={e => setSourceAccount(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition cursor-pointer">
                            <option value="1010" className="bg-[#202024]">1010 - Cash in Bank (Checking)</option>
                            <option value="1020" className="bg-[#202024]">1020 - Petty Cash Fund (On Hand)</option>
                        </select>
                    </div>
                    {/* ---> UPDATED: AUTO-SEQUENCE INPUT <--- */}
                    <div>
{/* 1. Reference / Voucher Field (From feature branch, restyled to light mode) */}
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Check / Voucher No.</label>
                            <div className="flex">
                                <span className="bg-gray-50 border border-[#B0DCDA] border-r-0 rounded-l-md px-4 py-3 text-sm font-bold text-gray-500 select-none">
                                    {refPrefix}
                                </span>
                                <input 
                                    type="text" 
                                    required 
                                    value={refSequence} 
                                    onChange={e => setRefSequence(e.target.value)} 
                                    placeholder="001" 
                                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-r-md p-3 text-sm font-mono text-gray-800 focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" 
                                />
                            </div>
                        </div>

                        {/* 2. Payee Field (From main branch) */}
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Payee</label>
                            <input 
                                type="text" 
                                required 
                                value={payee} 
                                onChange={e => setPayee(e.target.value)} 
                                placeholder="e.g. Meralco, Supplier Inc." 
                                className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" 
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
<label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Amount (₱)</label>
                        <div className="relative flex items-center">
                            <span className="absolute left-3 text-gray-400 font-mono text-sm">₱</span>
                            <input 
                                type="number" 
                                required 
                                min="0.01" 
                                step="0.01" 
                                value={amount} 
                                onChange={e => setAmount(parseFloat(e.target.value))} 
                                placeholder="0.00" 
                                className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md py-3 pl-8 pr-3 text-sm text-gray-800 font-mono font-bold focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" 
                            />
                        </div>
                    </div>
                    
                    {/* ACCOUNT DROPDOWN (From main branch) */}
                    <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Expense Account (Debit)</label>
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
                </div>

                {/* VAT SECTION (From Feature Branch, completely re-styled to match light mode!) */}
                <div className="p-5 bg-[#E9FAFA] border border-[#B0DCDA] rounded-xl mt-6">
                    <div className="flex items-center">
                        <input 
                            type="checkbox" 
                            id="isVatableDisb" 
                            className="w-4 h-4 text-[#1B9387] bg-white border-[#B0DCDA] rounded cursor-pointer focus:ring-[#1B9387]" 
                            checked={isVatable} 
                            onChange={(e) => setIsVatable(e.target.checked)} 
                        />
                        <label htmlFor="isVatableDisb" className="ml-3 text-sm font-bold text-[#1B9387] cursor-pointer">
                            This is a VATable Purchase (Extract 12% Input VAT)
                        </label>
                    </div>
                    {isVatable && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-lg border border-[#B0DCDA]/50">
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                                    Supplier TIN (Required to claim VAT)
                                </label>
                                <input 
                                    type="text" 
                                    required 
                                    placeholder="e.g. 123-456-789-000" 
                                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" 
                                    value={payeeTin} 
                                    onChange={e => setPayeeTin(e.target.value)} 
                                />
                            </div>
                            <div className="flex items-end text-xs text-gray-500 pb-2 font-medium">
                                * System will automatically record a debit entry of <strong className="text-[#1B9387] mx-1">₱{amount ? (Number(amount) - Number(amount) / 1.12).toFixed(2) : '0.00'}</strong> to Input VAT (1300).
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Remarks</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional details..." className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                </div>

<{/* SUBMIT BUTTON */}
                <button
                    type="submit"
                    disabled={loading}
                    className="cursor-pointer w-full mt-4 bg-red-500 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none text-white font-bold py-4 rounded-md transition hover:bg-red-600 uppercase tracking-widest shadow-md flex justify-center items-center"
                >
                    {loading ? 'Processing...' : 'Issue Disbursement'}
                </button>
            </form>
        </div>
    );
};