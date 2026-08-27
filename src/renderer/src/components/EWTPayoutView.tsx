import React, { useState, useEffect } from 'react';

const ATC_CODES = [
    { code: 'WI011', desc: 'Professional Fees (5%) - Gross < 3M', rate: 5 },
    { code: 'WI010', desc: 'Professional Fees (10%) - Gross > 3M', rate: 10 },
    { code: 'WI100', desc: 'Real Property Rentals (5%)', rate: 5 },
    { code: 'WI157', desc: 'Payments to Medical Practitioners (10%)', rate: 10 },
];

const getLocalDateString = () => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

export function EWTPayoutView({ userId }: { userId: string }) {
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [payees, setPayees] = useState<any[]>([]);

    // Form States
    const [date, setDate] = useState(getLocalDateString());
    const [sourceAccount, setSourceAccount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'check' | 'transfer' | 'cash' | ''>('');
    const [payeeId, setPayeeId] = useState('');
    const [payableBalance, setPayableBalance] = useState(0);
    const [amountToPay, setAmountToPay] = useState<number | ''>('');
    const [selectedATC, setSelectedATC] = useState(ATC_CODES[3]);
    const [refSequence, setRefSequence] = useState('');
    const [remarks, setRemarks] = useState('');

    // Dynamic Reference Logic
    const refPrefix = paymentMethod === 'check' ? 'CV-' : paymentMethod === 'transfer' ? 'REF-' : paymentMethod === 'cash' ? 'DV-' : '';
    const refLabel = paymentMethod === 'check' ? 'Check No.' : paymentMethod === 'transfer' ? 'Bank Reference No.' : paymentMethod === 'cash' ? 'Voucher No.' : 'Reference No.';

    // UI States
    const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
    const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
    const [showAddPayee, setShowAddPayee] = useState(false);
    const [newPayeeName, setNewPayeeName] = useState('');

    const [isSubmittingPayee, setIsSubmittingPayee] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [generated2307, setGenerated2307] = useState<any | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const loadData = async () => {
        try {
            const api = (window as any).api || (window as any).electronAPI;
            if (!api) return;

            const payeeData = await api.getPayees('DOCTOR');
            setPayees(payeeData);

            const accData = await api.getAccounts();
            const assets = accData.filter((acc: any) => acc.account_type?.name === 'Asset');
            setCashAccounts(assets);
            if (assets.length > 0 && !sourceAccount) setSourceAccount(assets.find((a: any) => a.code === '1010')?.code || assets[0].code);

            const hist = await api.getPayoutHistory();
            const doctorHist = (hist || []).filter((tx: any) => tx.payee?.type === 'DOCTOR');
            setHistoryData(doctorHist);
        } catch (error) { console.error(error); }
    };

    useEffect(() => { loadData(); }, []);

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

    // Auto-fill when selecting a doctor
    useEffect(() => {
        if (!payeeId) {
            setPayableBalance(0);
            setAmountToPay('');
            return;
        }

        setSelectedATC(ATC_CODES[3]);

        const fetchBalance = async () => {
            try {
                const api = (window as any).api || (window as any).electronAPI;
                const bal = await api.getPayeeBalance(payeeId);
                const rawUnpaid = Number(bal?.payable) || 0;
                const unpaid = Math.abs(rawUnpaid);

                setPayableBalance(unpaid);
                setAmountToPay(unpaid > 0 ? unpaid : '');
            } catch (error) { console.error(error); }
        };
        fetchBalance();
    }, [payeeId]);

    const handleCreatePayee = async () => {
        if (!newPayeeName.trim()) return;
        setIsSubmittingPayee(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            await api.createPayee(newPayeeName, 'DOCTOR');
            await loadData();

            const newRecord = payees.find((p: any) => p.name.toLowerCase() === newPayeeName.toLowerCase());
            if (newRecord) setPayeeId(newRecord.id);

            setShowAddPayee(false); setNewPayeeName('');
            setStatus({ type: 'success', msg: `Successfully added ${newPayeeName}!` });
            setTimeout(() => setStatus(null), 4000);
        } catch (error) {
            setStatus({ type: 'error', msg: "Failed to create new record." });
        } finally { setIsSubmittingPayee(false); }
    };

    // Live Calculations
    const grossAmount = Math.abs(Number(amountToPay) || 0);
    const ewtAmount = grossAmount * (selectedATC.rate / 100);
    const netAmount = grossAmount - ewtAmount;
    const formatCurrency = (val: number) => `₱ ${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const executeSubmit = async () => {
        setShowConfirmModal(false);
        setStatus(null);

        try {
            setLoading(true);
            const lines = [
                { accountId: '2010', debit: grossAmount, credit: 0 },
                { accountId: sourceAccount, debit: 0, credit: netAmount }
            ];
            if (ewtAmount > 0) lines.splice(1, 0, { accountId: '2050', debit: 0, credit: ewtAmount });

            const selectedPayee = payees.find(p => p.id === payeeId);
            const fullReferenceNo = `${refPrefix}${refSequence.padStart(3, '0')}`;

            const entryData = {
                date: new Date(date).toISOString(),
                referenceNo: fullReferenceNo,
                description: `Payout to ${selectedPayee?.name} - ${remarks} (Less ${selectedATC.rate}% EWT)`,
                vatType: 'EXEMPT', userId: userId, payeeId: payeeId, lines: lines
            };

            const api = (window as any).api || (window as any).electronAPI;
            const response = await api.submitJournalEntry(entryData);
            if (response && response.success === false) throw new Error(response.error);

            setStatus({ type: 'success', msg: `Voucher ${fullReferenceNo} recorded! Net Payout: ${formatCurrency(netAmount)}.` });
            setGenerated2307({ payee: selectedPayee, date: new Date(date), gross: grossAmount, tax: ewtAmount, net: netAmount, atc: selectedATC });

            // Reset
            setAmountToPay(''); setRemarks(''); setPayeeId(''); setPaymentMethod('');
            loadData();
            setTimeout(() => setStatus(null), 6000);
        } catch (error: any) {
            setStatus({ type: 'error', msg: error.message || "System Error: Could not save payout." });
        } finally { setLoading(false); }
    };

    // 🔥 Form is valid as long as required fields are filled and amount > 0
    const isFormValid = Boolean(
        payeeId &&
        paymentMethod &&
        sourceAccount &&
        refSequence &&
        grossAmount > 0
    );

    // 🔥 Informative Button Label Helper
    const getButtonLabel = () => {
        if (loading) return 'Processing...';
        if (!payeeId) return 'Select a Doctor';
        if (!paymentMethod) return 'Select Payment Method';
        if (!sourceAccount) return 'Select Source of Funds';
        if (!refSequence) return 'Enter Reference / Voucher No.';
        if (grossAmount <= 0) return 'Enter Gross Payout Amount';
        return `✓ ISSUE PAYOUT — ${formatCurrency(netAmount)}`;
    };

    const selectedPayee = payees.find(p => p.id === payeeId);

    return (
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col font-sans text-gray-800 animate-in fade-in duration-300">

            {isPayeeDropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setIsPayeeDropdownOpen(false)}></div>}

            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Doctor Payouts & Withholding Tax</h2>
                <p className="text-sm text-gray-500 mt-1 font-medium">Settle Accounts Payable and generate BIR Form 2307 equivalents.</p>
            </div>

            <div className="flex flex-col lg:flex-row items-start gap-8">

                {/* LEFT SIDE: MAIN FORM */}
                <div className="flex-1 w-full bg-white border border-[#B0DCDA] rounded-xl shadow-sm relative overflow-hidden">

                    <div className="bg-[#FBF8F8] border-b border-[#B0DCDA] px-6 py-4 flex justify-between items-center">
                        <h3 className="text-lg font-extrabold text-gray-800">New Payout</h3>
                        <span className="bg-rose-50 text-rose-600 text-[10px] px-3 py-1.5 rounded-md font-extrabold uppercase tracking-widest border border-rose-200">
                            💸 Professional Fee
                        </span>
                    </div>

                    {status && (
                        <div className={`m-6 mb-0 p-4 rounded-md text-sm font-bold shadow-sm border ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                        </div>
                    )}

                    <form className="p-6 space-y-6" onSubmit={(e) => { e.preventDefault(); if (isFormValid) setShowConfirmModal(true); }}>

                        {/* ROW 1: PAYEE SELECTION */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="col-span-2 relative z-20">
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Search Doctor</label>
                                    <button type="button" onClick={() => setShowAddPayee(!showAddPayee)} className="text-[10px] font-extrabold text-[#1B9387] hover:text-[#28958B] transition uppercase tracking-wider cursor-pointer">
                                        {showAddPayee ? 'Cancel' : '+ Add New'}
                                    </button>
                                </div>

                                {showAddPayee && (
                                    <div className="mb-2 p-2.5 bg-[#E9FAFA] border border-[#B0DCDA] rounded-md flex gap-2 shadow-inner">
                                        <input type="text" placeholder="e.g. Dr. Smith" value={newPayeeName} onChange={e => setNewPayeeName(e.target.value)} className="flex-1 bg-white border border-[#B0DCDA] rounded px-3 text-sm text-gray-800 outline-none" autoFocus />
                                        <button type="button" onClick={handleCreatePayee} disabled={isSubmittingPayee || !newPayeeName.trim()} className="bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-bold px-4 py-1.5 rounded transition">Save</button>
                                    </div>
                                )}

                                <div onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)} className={`w-full bg-[#FBF8F8] border ${isPayeeDropdownOpen ? 'border-[#1B9387] ring-1 ring-[#1B9387]' : 'border-[#B0DCDA]'} rounded-md p-3 text-sm transition cursor-pointer flex justify-between items-center shadow-sm`}>
                                    <span className={payeeId ? 'text-gray-800 font-bold' : 'text-gray-400 font-medium'}>{selectedPayee?.name || '-- Select Doctor --'}</span>
                                    <span className="text-xs text-gray-400">▼</span>
                                </div>

                                {isPayeeDropdownOpen && (
                                    <div className="absolute w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden">
                                        <div className="p-2 border-b border-[#B0DCDA] bg-[#FBF8F8]">
                                            <input type="text" autoFocus placeholder="🔍 Search doctors..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-800 outline-none focus:border-[#1B9387]" />
                                        </div>
                                        <ul className="max-h-48 overflow-y-auto">
                                            <li onClick={() => { setPayeeId(''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition font-medium">-- Clear Selection --</li>
                                            {payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase())).map(p => (
                                                <li key={p.id} onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-gray-800 font-bold hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-t border-gray-50 flex justify-between items-center">
                                                    <span>{p.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col justify-end">
                                <div className={`p-2.5 rounded-md border text-center relative ${payeeId && payableBalance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-[#FBF8F8] border-[#B0DCDA]'}`}>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold mb-0.5">Unpaid Balance</p>

                                    <p className={`text-xl font-black font-mono ${!payeeId ? 'text-gray-300' : payableBalance > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                                        {payeeId ? formatCurrency(payableBalance) : '—'}
                                    </p>

                                    {payeeId && payableBalance > 0 && (
                                        <button type="button" onClick={() => setAmountToPay(payableBalance)} className="absolute -top-3 -right-2 bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-extrabold uppercase px-2 py-1 rounded shadow transition">
                                            Pay In Full
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: PAYMENT METHOD & SOURCE */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
                                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none shadow-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                                <select required value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm cursor-pointer">
                                    <option value="" disabled className="text-gray-400 font-normal">-- Select --</option>
                                    <option value="check">Check</option>
                                    <option value="transfer">Bank Transfer</option>
                                    <option value="cash">Cash</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">{refLabel}</label>
                                <div className="flex shadow-sm">
                                    <span className={`bg-[#FBF8F8] border border-[#B0DCDA] border-r-0 rounded-l-md px-3 py-2.5 text-sm font-extrabold select-none ${paymentMethod ? 'text-gray-500' : 'text-gray-300'}`}>
                                        {paymentMethod ? refPrefix : '---'}
                                    </span>
                                    <input type="text" required disabled={!paymentMethod} value={refSequence} onChange={e => setRefSequence(e.target.value)} className="w-full bg-white border border-[#B0DCDA] rounded-r-md p-2.5 text-sm font-mono font-bold text-[#1B9387] focus:border-[#1B9387] outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Source of Funds</label>
                                <select required value={sourceAccount} onChange={e => setSourceAccount(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm cursor-pointer">
                                    {cashAccounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* ROW 3: ATC & REMARKS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">ATC (Tax Code)</label>
                                <select value={selectedATC.code} onChange={e => setSelectedATC(ATC_CODES.find(atc => atc.code === e.target.value) || ATC_CODES[3])} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm cursor-pointer">
                                    {ATC_CODES.map(atc => (<option key={atc.code} value={atc.code}>{atc.code} - {atc.rate}% ({atc.desc.split('-')[0].trim()})</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Remarks</label>
                                <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g., PF Settlement for Aug Week 1" className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none shadow-sm" />
                            </div>
                        </div>

                        {/* ROW 4: INTEGRATED PAYOUT SUMMARY */}
                        <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl p-6 shadow-inner max-w-xl mx-auto mt-4">

                            <div className="flex justify-between items-center mb-3 relative">
                                <label className="text-xs font-extrabold text-gray-700 uppercase tracking-widest">Gross Payout (A/P)</label>
                                <div className="relative w-48 shadow-sm">
                                    <span className="absolute left-3 top-2.5 text-gray-400 font-mono font-bold">₱</span>
                                    <input
                                        type="number"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        value={amountToPay}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            setAmountToPay(isNaN(val) ? '' : Math.abs(val));
                                        }}
                                        className="w-full bg-white border border-[#B0DCDA] focus:border-[#1B9387] rounded-md py-2.5 pl-8 pr-3 text-right font-mono font-bold text-gray-800 outline-none transition"
                                    />
                                </div>
                            </div>

                            {/* 🔥 Friendly Advance / Overpayment Indicator */}
                            {payableBalance > 0 && grossAmount > payableBalance && (
                                <p className="text-[10px] text-amber-600 font-bold text-right -mt-2 mb-2">
                                    ℹ️ Note: ₱ {(grossAmount - payableBalance).toFixed(2)} will be recorded as an advance.
                                </p>
                            )}

                            <div className="flex justify-between items-center mb-4 text-orange-500">
                                <label className="text-xs font-extrabold uppercase tracking-widest">Less: {selectedATC.rate}% EWT</label>
                                <span className="font-mono text-lg font-bold w-48 text-right pr-3">- {formatCurrency(ewtAmount)}</span>
                            </div>

                            <div className="border-t border-dashed border-[#B0DCDA] my-4"></div>

                            <div className="flex justify-between items-center text-[#1B9387]">
                                <span className="font-black uppercase tracking-widest text-lg">Net Payout</span>
                                <span className="font-mono font-black text-2xl w-48 text-right pr-3">{formatCurrency(netAmount)}</span>
                            </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <div className="border-t-2 border-gray-800 pt-6">
                            <button
                                type="submit"
                                disabled={!isFormValid || loading}
                                className={`w-full py-4 rounded-lg font-black uppercase tracking-widest transition shadow-md flex justify-center items-center text-sm
                                    ${isFormValid
                                        ? 'bg-[#1B9387] hover:bg-[#28958B] text-white cursor-pointer'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none border border-gray-300'
                                    }`}
                            >
                                {getButtonLabel()}
                            </button>
                        </div>
                    </form>
                </div>

                {/* RIGHT SIDE: RECENT HISTORY */}
                <div className="w-full lg:w-[340px] flex flex-col space-y-4 sticky top-6">
                    <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm h-full">
                        <div className="flex items-center justify-between border-b border-[#B0DCDA] pb-3 mb-4">
                            <h3 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider">Recent Payouts</h3>
                            <span className="text-xs text-[#1B9387] font-bold cursor-pointer hover:underline">View All</span>
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[700px] pr-1">
                            {historyData.length === 0 ? (
                                <p className="text-xs text-gray-400 italic text-center mt-8">No recent payouts found.</p>
                            ) : (
                                historyData.slice(0, 10).map((tx: any, idx: number) => (
                                    <div key={idx} className="bg-[#FBF8F8] border border-[#B0DCDA]/60 rounded-lg p-3 shadow-sm hover:border-[#1B9387] transition group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-sm font-extrabold text-gray-800 truncate mb-0.5">{tx.payee?.name || 'Unknown'}</p>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(tx.date).toLocaleDateString()} • {tx.referenceNo}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1 text-xs font-mono text-gray-500 mb-3 border-t border-gray-200 pt-2">
                                            <div className="flex justify-between"><span>Gross:</span> <span>{formatCurrency(tx.gross)}</span></div>
                                            <div className="flex justify-between text-orange-500"><span>EWT:</span> <span>- {formatCurrency(tx.tax)}</span></div>
                                            <div className="flex justify-between font-bold text-gray-800"><span>Net:</span> <span>{formatCurrency(tx.net)}</span></div>
                                        </div>

                                        <button onClick={() => {
                                            const taxRate = Math.round((tx.tax / tx.gross) * 100);
                                            let fallbackATC = ATC_CODES.find(a => a.rate === taxRate) || ATC_CODES[3];
                                            setGenerated2307({ payee: tx.payee, date: new Date(tx.date), gross: tx.gross, tax: tx.tax, net: tx.net, atc: fallbackATC, isReprint: true, ref: tx.referenceNo });
                                        }} className="w-full py-1.5 bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] text-[10px] font-extrabold uppercase tracking-widest rounded shadow-sm transition">
                                            📄 Generate Form 2307
                                        </button>
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
                            <h2 className="text-xl font-black uppercase tracking-widest">Confirm Doctor Payout</h2>
                            <p className="text-sm font-medium mt-1 text-[#E9FAFA]">Review tax and accounting details before posting.</p>
                        </div>
                        <div className="p-6 space-y-4 text-sm font-medium text-gray-600">
                            <div className="flex justify-between border-b border-gray-100 pb-2"><span>Payee:</span> <span className="font-bold text-gray-800">{selectedPayee?.name}</span></div>
                            <div className="flex justify-between border-b border-gray-100 pb-2"><span>Source of Funds:</span> <span className="font-bold text-gray-800 truncate max-w-[200px] text-right">{cashAccounts.find(a => a.code === sourceAccount)?.name}</span></div>
                            <div className="flex justify-between border-b border-gray-100 pb-2"><span>{refLabel}:</span> <span className="font-mono font-bold text-gray-800">{refPrefix}{refSequence.padStart(3, '0')}</span></div>
                            <div className="flex justify-between border-b border-gray-100 pb-2"><span>ATC Code:</span> <span className="font-bold text-gray-800">{selectedATC.code}</span></div>

                            <div className="bg-[#FBF8F8] p-4 rounded-lg mt-4 border border-gray-200 font-mono">
                                <div className="flex justify-between mb-1"><span>Debit: A/P (Gross)</span> <span>{formatCurrency(grossAmount)}</span></div>
                                <div className="flex justify-between mb-1 text-orange-500"><span>Credit: EWT Payable</span> <span>{formatCurrency(ewtAmount)}</span></div>
                                <div className="border-t border-gray-300 my-2"></div>
                                <div className="flex justify-between text-lg font-black text-[#1B9387]"><span className="font-sans uppercase tracking-widest">Net Payout:</span> <span>{formatCurrency(netAmount)}</span></div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                            <button onClick={() => setShowConfirmModal(false)} className="px-5 py-2.5 rounded-md font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition">Cancel</button>
                            <button onClick={executeSubmit} className="px-5 py-2.5 rounded-md font-black uppercase tracking-wider text-white bg-[#1B9387] hover:bg-[#28958B] shadow-md transition">Confirm & Post</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINT MODAL (2307) */}
            {generated2307 && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm print:bg-white print:block print:relative print:inset-auto print:z-0">
                    <div className="bg-white text-black p-8 rounded-lg shadow-2xl w-[800px] max-h-[90vh] overflow-y-auto print:w-full print:h-full print:max-h-full print:shadow-none print:p-0">
                        <div className="flex justify-end space-x-4 mb-4 print:hidden border-b pb-4">
                            <button onClick={() => setGenerated2307(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-black font-bold transition">Close</button>
                            <button onClick={() => window.print()} className="px-4 py-2 bg-[#1B9387] hover:bg-[#28958B] text-white rounded text-sm font-bold transition shadow cursor-pointer">🖨️ Print Form 2307</button>
                        </div>
                        <div className="border-4 border-black p-4">
                            <div className="text-center border-b-2 border-black pb-4 mb-4">
                                <h1 className="font-bold text-xl uppercase">Certificate of Creditable Tax Withheld at Source</h1>
                                <p className="font-bold text-sm">(BIR Form No. 2307 Equivalent)</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-4 mb-4 text-sm">
                                <div><p className="font-bold text-xs uppercase text-gray-600">Payee (Doctor/Supplier):</p><p className="font-bold">{generated2307.payee?.name}</p><p>TIN: {generated2307.payee?.tin || 'Not Provided'}</p></div>
                                <div><p className="font-bold text-xs uppercase text-gray-600">Payor (Clinic):</p><p className="font-bold">SMARTGUYS CLINIC INC.</p><p>Date: {generated2307.date.toLocaleDateString()}</p></div>
                            </div>
                            <table className="w-full text-sm text-left border-collapse border border-black mb-12">
                                <thead className="bg-gray-100"><tr><th className="border border-black p-2">Income Payment</th><th className="border border-black p-2 text-center">ATC</th><th className="border border-black p-2 text-right">Gross Amount</th><th className="border border-black p-2 text-right">Tax Withheld</th></tr></thead>
                                <tbody><tr><td className="border border-black p-2">{generated2307.atc.desc}</td><td className="border border-black p-2 text-center font-bold">{generated2307.atc.code}</td><td className="border border-black p-2 text-right font-mono">₱ {generated2307.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td className="border border-black p-2 text-right font-mono font-bold">₱ {generated2307.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}