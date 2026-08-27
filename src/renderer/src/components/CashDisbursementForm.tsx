// src/renderer/src/components/CashDisbursementForm.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { NewContactModal } from './NewContactModal';

const getLocalDateString = () => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

export const CashDisbursementForm: React.FC<{ userId: string }> = ({ userId }) => {
    // Dropdowns & Data
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [payees, setPayees] = useState<any[]>([]);
    const [recentVouchers, setRecentVouchers] = useState<any[]>([]);

    // Section 1: Payment Info
    const [date, setDate] = useState(getLocalDateString());
    const [payeeId, setPayeeId] = useState('');
    // 🔥 Default to empty to force explicit selection
    const [paymentMethod, setPaymentMethod] = useState<'check' | 'transfer' | 'cash' | ''>('');
    const [refSequence, setRefSequence] = useState('');

    // Section 2: Accounting Details
    const [sourceAccount, setSourceAccount] = useState('');
    const [expenseAccount, setExpenseAccount] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [isVatable, setIsVatable] = useState(false);
    const [payeeTin, setPayeeTin] = useState('');

    // Section 3: Supporting Info
    const [remarks, setRemarks] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);

    // UI States
    const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
    const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
    const [showAddPayee, setShowAddPayee] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [loading, setLoading] = useState(false);

    // 🔥 Dynamic Logic based on Payment Method
    const refPrefix = paymentMethod === 'check' ? 'CV-' : paymentMethod === 'transfer' ? 'REF-' : paymentMethod === 'cash' ? 'DV-' : '';
    const refLabel = paymentMethod === 'check' ? 'Check / Voucher No.' : paymentMethod === 'transfer' ? 'Bank Reference No.' : paymentMethod === 'cash' ? 'Disbursement Voucher No.' : 'Reference No.';

    const loadData = async () => {
        const api = (window as any).api || (window as any).electronAPI;
        if (!api) return;
        try {
            const accData = await api.getAccounts();
            setExpenseAccounts(accData.filter((a: any) => a.account_type?.name === 'Expense' || a.account_type?.name === 'Liability'));
            const assets = accData.filter((a: any) => a.account_type?.name === 'Asset');
            setCashAccounts(assets);

            if (assets.length > 0 && !sourceAccount) setSourceAccount(assets.find((a: any) => a.code === '1010')?.code || assets[0].code);
            if (api.getPayees) setPayees(await api.getPayees());

            // Note: If this is empty, verify API is querying the exact same table/dates as the Dashboard
            if (api.getRecentDisbursements) setRecentVouchers(await api.getRecentDisbursements(5) || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { loadData(); }, []);

    // Only fetch sequence if a payment method is selected
    useEffect(() => {
        const fetchNextSeq = async () => {
            if (!refPrefix) { setRefSequence(''); return; }
            try {
                const api = (window as any).api || (window as any).electronAPI;
                const nextSeq = await api.getNextSequence(refPrefix);
                setRefSequence(nextSeq);
            } catch (error) { console.error(error); }
        };
        fetchNextSeq();
    }, [refPrefix, status]);

    // Live Calculations
    const { netExpense, inputVat, totalCashOut } = useMemo(() => {
        const numAmount = Number(amount) || 0;
        if (numAmount === 0) return { netExpense: 0, inputVat: 0, totalCashOut: 0 };
        let exp = numAmount;
        let vat = 0;
        if (isVatable) {
            exp = Number((numAmount / 1.12).toFixed(2));
            vat = Number((numAmount - exp).toFixed(2));
        }
        return { netExpense: exp, inputVat: vat, totalCashOut: numAmount };
    }, [amount, isVatable]);

    const formatCurrency = (val: number) => `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setAttachments([...attachments, ...Array.from(e.target.files)]);
    };

    const removeFile = (index: number) => setAttachments(attachments.filter((_, i) => i !== index));

    const executeSubmit = async () => {
        setShowConfirmModal(false);
        setStatus(null);
        setLoading(true);

        try {
            const lines = [
                { accountId: expenseAccount, debit: netExpense, credit: 0 },
                { accountId: sourceAccount, debit: 0, credit: totalCashOut }
            ];
            if (isVatable && inputVat > 0) lines.splice(1, 0, { accountId: '1300', debit: inputVat, credit: 0 });

            const api = (window as any).api || (window as any).electronAPI;
            if (isVatable && payeeTin.trim()) await api.updatePayeeTin(payeeId, payeeTin);

            const selectedPayee = payees.find(p => p.id === payeeId);
            const description = `Disbursement to ${selectedPayee?.name || 'Supplier'} - ${remarks}${isVatable ? ' [VATABLE]' : ''}`;
            const fullReferenceNo = `${refPrefix}${refSequence.padStart(3, '0')}`;

            const result = await api.submitJournalEntry({
                date: new Date(date).toISOString(),
                referenceNo: fullReferenceNo,
                description: description,
                vatType: isVatable ? 'VATABLE' : 'EXEMPT',
                userId, payeeId, lines
            });

            if (result.success) {
                setStatus({ type: 'success', msg: `Payment ${fullReferenceNo} issued successfully!` });
                setAmount(''); setExpenseAccount(''); setRemarks(''); setAttachments([]);
                setIsVatable(false); setPayeeTin(''); setPayeeId(''); setPaymentMethod('');
                loadData();
                setTimeout(() => setStatus(null), 5000);
            } else {
                setStatus({ type: 'error', msg: result.error });
            }
        } catch (err: any) {
            setStatus({ type: 'error', msg: err.message || "Failed to process disbursement." });
        } finally { setLoading(false); }
    };

    // Validations
    const isFormValid = totalCashOut > 0 && expenseAccount && sourceAccount && payeeId && refSequence && paymentMethod !== '' && (!isVatable || payeeTin.trim());

    // Lookups for Display
    const selectedPayee = payees.find(p => p.id === payeeId);
    const selectedSourceData = cashAccounts.find(a => a.code === sourceAccount);
    const selectedExpenseData = expenseAccounts.find(a => a.code === expenseAccount);

    return (
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col font-sans text-gray-800 animate-in fade-in duration-300">

            {/* Global Overlay */}
            {isPayeeDropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setIsPayeeDropdownOpen(false)}></div>}

            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Cash Disbursements</h2>
                <p className="text-sm text-gray-500 mt-1 font-medium">Record outgoing payments, expenses, and supplier settlements.</p>
            </div>

            {/* 🔥 Added items-start to allow the sticky right column to work correctly */}
            <div className="flex flex-col lg:flex-row items-start gap-8">

                {/* LEFT SIDE: MAIN FORM */}
                <div className="flex-1 w-full bg-white border border-[#B0DCDA] rounded-xl shadow-sm relative overflow-hidden">

                    <div className="bg-[#FBF8F8] border-b border-[#B0DCDA] px-8 py-5 flex justify-between items-center">
                        <h3 className="text-lg font-extrabold text-gray-800">New Disbursement</h3>
                        <span className="bg-rose-50 text-rose-600 text-[10px] px-3 py-1.5 rounded-md font-extrabold uppercase tracking-widest border border-rose-200">
                            💸 Cash Outflow
                        </span>
                    </div>

                    {status && (
                        <div className={`m-8 mb-0 p-4 rounded-md text-sm font-bold shadow-sm border ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                        </div>
                    )}

                    <form className="p-8 space-y-10" onSubmit={(e) => { e.preventDefault(); if (isFormValid) setShowConfirmModal(true); }}>

                        {/* ① PAYMENT INFORMATION */}
                        <section>
                            <h4 className="text-xs font-extrabold text-[#1B9387] uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">① Payment Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Date</label>
                                    <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition shadow-sm" />
                                </div>

                                <div className="relative z-20">
                                    <div className="flex justify-between items-end mb-2">
                                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Vendor / Supplier</label>
                                        <button type="button" onClick={() => setShowAddPayee(true)} className="text-[10px] font-extrabold text-[#1B9387] hover:text-[#28958B] transition uppercase tracking-wider cursor-pointer">
                                            + Add New
                                        </button>
                                    </div>
                                    <div onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)} className={`w-full bg-[#FBF8F8] border ${isPayeeDropdownOpen ? 'border-[#1B9387] ring-1 ring-[#1B9387]' : 'border-[#B0DCDA]'} rounded-md p-3 text-sm transition cursor-pointer flex justify-between items-center shadow-sm`}>
                                        {selectedPayee ? (
                                            <div className="flex flex-col">
                                                <span className="text-gray-800 font-bold">{selectedPayee.name}</span>
                                                {selectedPayee.youOwe > 0 && <span className="text-[10px] text-orange-500 font-bold">Outstanding Payable: {formatCurrency(selectedPayee.youOwe)}</span>}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 font-medium">-- Select Vendor / Supplier --</span>
                                        )}
                                        <span className="text-xs text-gray-400">▼</span>
                                    </div>

                                    {isPayeeDropdownOpen && (
                                        <div className="absolute w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden">
                                            <div className="p-2 border-b border-[#B0DCDA] bg-[#FBF8F8]">
                                                <input type="text" autoFocus placeholder="🔍 Search vendor..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-800 outline-none focus:border-[#1B9387]" />
                                            </div>
                                            <ul className="max-h-48 overflow-y-auto">
                                                <li onClick={() => { setPayeeId(''); setPayeeTin(''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition font-medium">-- Clear Selection --</li>
                                                {payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase())).map(p => (
                                                    <li key={p.id} onClick={() => { setPayeeId(p.id); setPayeeTin(p.tin || ''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-gray-800 font-bold hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-t border-gray-50 flex justify-between items-center">
                                                        <div>
                                                            {p.name}
                                                            {p.tin && <span className="block text-[10px] text-gray-400 font-mono font-normal mt-0.5">TIN: {p.tin}</span>}
                                                        </div>
                                                        {p.youOwe > 0 && <span className="text-xs text-orange-500 font-mono">{formatCurrency(p.youOwe)}</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Dynamic Payment Method */}
                                <div>
                                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Payment Method</label>
                                    <select required value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm">
                                        <option value="" disabled className="text-gray-400 font-normal">-- Select Method --</option>
                                        <option value="check">Check</option>
                                        <option value="transfer">Bank Transfer</option>
                                        <option value="cash">Cash</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">{refLabel}</label>
                                    <div className="flex shadow-sm">
                                        <span className={`bg-[#FBF8F8] border border-[#B0DCDA] border-r-0 rounded-l-md px-4 py-3 text-sm font-extrabold select-none ${paymentMethod ? 'text-gray-500' : 'text-gray-300'}`}>
                                            {refPrefix || 'XXX-'}
                                        </span>
                                        <input
                                            type="text"
                                            required
                                            disabled={!paymentMethod}
                                            value={refSequence}
                                            onChange={e => setRefSequence(e.target.value)}
                                            placeholder={paymentMethod ? "001" : "Select method first"}
                                            className="w-full bg-white border border-[#B0DCDA] rounded-r-md p-3 text-sm font-mono font-bold text-[#1B9387] focus:border-[#1B9387] outline-none transition disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ② ACCOUNTING DETAILS */}
                        <section>
                            <h4 className="text-xs font-extrabold text-[#1B9387] uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">② Accounting Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Source of Funds (Credit)</label>
                                    <p className="text-[10px] text-gray-400 mb-2 italic">Select the asset account paying for this.</p>
                                    <select required value={sourceAccount} onChange={e => setSourceAccount(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm">
                                        {cashAccounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Account to Debit</label>
                                    <p className="text-[10px] text-gray-400 mb-2 italic">Select the expense or account receiving the debit.</p>
                                    <select required value={expenseAccount} onChange={e => setExpenseAccount(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm">
                                        <option value="" disabled className="text-gray-400 font-normal">-- Select Account --</option>
                                        {expenseAccounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Massive Total Amount Input */}
                            <div className="mb-6">
                                <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-widest mb-2">Total Disbursement Amount</label>
                                <div className="relative flex items-center shadow-sm">
                                    <span className="absolute left-4 text-gray-400 font-mono font-bold text-2xl">₱</span>
                                    <input
                                        type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(parseFloat(e.target.value))}
                                        placeholder="0.00"
                                        className="w-full bg-white border-2 border-[#B0DCDA] rounded-lg py-4 pl-12 pr-4 text-3xl text-gray-800 font-mono font-black focus:border-[#1B9387] outline-none transition"
                                    />
                                </div>
                            </div>

                            {/* Live VAT Calculator */}
                            <div className="p-5 bg-[#FBF8F8] border border-[#B0DCDA] rounded-lg">
                                <div className="flex items-center">
                                    <input type="checkbox" id="isVatableDisb" className="w-5 h-5 text-[#1B9387] bg-white border-[#B0DCDA] rounded cursor-pointer" checked={isVatable} onChange={(e) => setIsVatable(e.target.checked)} />
                                    <label htmlFor="isVatableDisb" className="ml-3 text-sm font-extrabold text-gray-800 cursor-pointer uppercase tracking-wide">Record 12% Input VAT</label>
                                </div>
                                {isVatable && (
                                    <div className="mt-4 pt-4 border-t border-[#B0DCDA] grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                        <div>
                                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Supplier TIN (Required)</label>
                                            <input type="text" required placeholder="e.g. 123-456-789-000" className="w-full bg-white border border-[#B0DCDA] rounded-md p-2.5 text-sm font-mono text-gray-800 focus:border-[#1B9387] shadow-sm" value={payeeTin} onChange={e => setPayeeTin(e.target.value)} />
                                        </div>
                                        <div className="bg-white p-3 rounded border border-gray-200 text-xs shadow-sm font-mono">
                                            <div className="flex justify-between text-gray-500 mb-1"><span>VAT-Inclusive Total:</span> <span>{formatCurrency(totalCashOut)}</span></div>
                                            <div className="flex justify-between text-gray-500 mb-1"><span>Net Expense:</span> <span>{formatCurrency(netExpense)}</span></div>
                                            <div className="border-t border-gray-100 my-1"></div>
                                            <div className="flex justify-between text-[#1B9387] font-bold"><span>Input VAT (12%):</span> <span>{formatCurrency(inputVat)}</span></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ③ SUPPORTING INFORMATION */}
                        <section>
                            <h4 className="text-xs font-extrabold text-[#1B9387] uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">③ Supporting Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Remarks</label>
                                    <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Optional details..." className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none shadow-sm resize-none" />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Supporting Documents</label>
                                    <label className="w-full flex items-center justify-center bg-[#FBF8F8] border border-dashed border-[#B0DCDA] hover:bg-[#E9FAFA] hover:border-[#1B9387] rounded-md p-4 text-sm font-bold text-[#1B9387] cursor-pointer transition h-14">
                                        📎 Attach Receipt / Invoice
                                        <input type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.png" />
                                    </label>
                                    {attachments.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            {attachments.map((f, i) => (
                                                <div key={i} className="flex justify-between items-center bg-white border border-gray-200 rounded p-2 text-xs shadow-sm">
                                                    <span className="truncate max-w-[200px] text-gray-600">📎 {f.name}</span>
                                                    <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 font-bold px-2">×</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* PAYMENT SUMMARY & SUBMIT */}
                        <div className="border-t-2 border-gray-800 pt-6">
                            <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 text-center">Payment Summary</h4>

                            <div className="bg-[#FBF8F8] rounded-xl p-5 mb-6 shadow-inner border border-gray-200 max-w-sm mx-auto">
                                <div className="flex justify-between text-sm mb-2"><span className="text-gray-500 font-medium">Vendor:</span> <span className="font-bold text-gray-800 truncate w-40 text-right">{selectedPayee?.name || '—'}</span></div>
                                <div className="flex justify-between text-sm mb-2"><span className="text-gray-500 font-medium">Account:</span> <span className="font-bold text-gray-800 truncate w-40 text-right">{selectedExpenseData ? `${selectedExpenseData.code} - ${selectedExpenseData.name}` : '—'}</span></div>
                                <div className="flex justify-between text-sm mb-2"><span className="text-gray-500 font-medium">Source:</span> <span className="font-bold text-gray-800 truncate w-40 text-right">{selectedSourceData ? `${selectedSourceData.code} - ${selectedSourceData.name}` : '—'}</span></div>

                                {/* 🔥 VAT Summary explicitly surfaced before hitting Submit */}
                                {isVatable && totalCashOut > 0 && (
                                    <>
                                        <div className="border-t border-dashed border-gray-300 my-2"></div>
                                        <div className="flex justify-between text-sm mb-1"><span className="text-gray-500 font-medium">Net Expense:</span> <span className="font-bold text-gray-800">{formatCurrency(netExpense)}</span></div>
                                        <div className="flex justify-between text-sm mb-2"><span className="text-[#1B9387] font-medium">Input VAT (12%):</span> <span className="font-bold text-[#1B9387]">{formatCurrency(inputVat)}</span></div>
                                    </>
                                )}

                                <div className="border-t border-dashed border-gray-300 my-3"></div>
                                <div className="flex justify-between text-lg font-black text-gray-800"><span className="uppercase tracking-widest">Total</span> <span className="font-mono text-[#1B9387]">{formatCurrency(totalCashOut)}</span></div>
                            </div>

                            <button
                                type="submit"
                                disabled={!isFormValid || loading}
                                className={`w-full py-4 rounded-lg font-black uppercase tracking-widest transition shadow-md flex justify-center items-center space-x-2 text-sm
                                    ${isFormValid
                                        ? 'bg-[#1B9387] hover:bg-[#28958B] text-white cursor-pointer'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none border border-gray-300'
                                    }`}
                            >
                                {loading ? 'Processing...' : isFormValid ? `💸 Issue Disbursement — ${formatCurrency(totalCashOut)}` : 'Complete Required Fields to Issue'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* 🔥 RIGHT SIDE: RECENT ACTIVITY (Now Sticky!) */}
                <div className="w-full lg:w-96 flex flex-col space-y-4 sticky top-6">
                    <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm h-full">
                        <div className="flex items-center justify-between border-b border-[#B0DCDA] pb-3 mb-4">
                            <h3 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider">Recent Disbursements</h3>
                            <span className="text-xs text-[#1B9387] font-bold cursor-pointer hover:underline">View All</span>
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[700px] pr-1">
                            {recentVouchers.length === 0 ? (
                                <p className="text-xs text-gray-400 italic text-center mt-8">No recent disbursements found.</p>
                            ) : (
                                recentVouchers.map((v: any, i: number) => (
                                    <div key={i} className="bg-[#FBF8F8] border border-[#B0DCDA]/60 rounded-lg p-4 shadow-sm hover:border-[#1B9387] transition cursor-pointer group">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-mono font-extrabold text-[#1B9387] group-hover:underline">{v.referenceNo}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(v.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm font-extrabold text-gray-800 truncate mb-1">{v.payeeName || 'Unknown Vendor'}</p>
                                        <div className="flex justify-between items-end mt-3 border-t border-gray-200 pt-2">
                                            <span className="text-[10px] text-emerald-600 font-bold flex items-center">✓ ISSUED</span>
                                            <span className="text-base font-mono font-black text-rose-600">{formatCurrency(v.amount)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* CONFIRMATION MODAL */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#B0DCDA]">
                        <div className="bg-[#1B9387] p-5 text-center text-white">
                            <h2 className="text-xl font-black uppercase tracking-widest">Confirm Disbursement</h2>
                            <p className="text-sm font-medium mt-1 text-[#E9FAFA]">Review details before posting to ledger.</p>
                        </div>
                        <div className="p-6 space-y-4 text-sm font-medium text-gray-600">
                            <div className="flex justify-between border-b border-gray-100 pb-2"><span>Vendor:</span> <span className="font-bold text-gray-800">{selectedPayee?.name}</span></div>
                            <div className="flex justify-between border-b border-gray-100 pb-2"><span>Account to Debit:</span> <span className="font-bold text-gray-800 truncate max-w-[200px] text-right">{selectedExpenseData?.name}</span></div>
                            <div className="flex justify-between border-b border-gray-100 pb-2"><span>Source of Funds:</span> <span className="font-bold text-gray-800 truncate max-w-[200px] text-right">{selectedSourceData?.name}</span></div>
                            <div className="flex justify-between border-b border-gray-100 pb-2"><span>{refLabel}:</span> <span className="font-mono font-bold text-gray-800">{refPrefix}{refSequence.padStart(3, '0')}</span></div>

                            <div className="bg-[#FBF8F8] p-4 rounded-lg mt-4 border border-gray-200 font-mono">
                                <div className="flex justify-between mb-1"><span>Net Amount:</span> <span>{formatCurrency(netExpense)}</span></div>
                                <div className="flex justify-between mb-1"><span>Input VAT:</span> <span>{formatCurrency(inputVat)}</span></div>
                                <div className="border-t border-gray-300 my-2"></div>
                                <div className="flex justify-between text-lg font-black text-[#1B9387]"><span className="font-sans uppercase">Total:</span> <span>{formatCurrency(totalCashOut)}</span></div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                            <button onClick={() => setShowConfirmModal(false)} className="px-5 py-2.5 rounded-md font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition">Cancel</button>
                            <button onClick={executeSubmit} className="px-5 py-2.5 rounded-md font-black uppercase tracking-wider text-white bg-[#1B9387] hover:bg-[#28958B] shadow-md transition">Confirm & Issue</button>
                        </div>
                    </div>
                </div>
            )}

            <NewContactModal isOpen={showAddPayee} onClose={() => setShowAddPayee(false)} onSaveSuccess={() => { loadData(); setStatus({ type: 'success', msg: 'Vendor successfully added!' }); }} defaultType="SUPPLIER" />
        </div>
    );
};