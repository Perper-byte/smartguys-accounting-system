import React, { useState, useEffect } from 'react';

// BIR Alphanumeric Tax Codes (ATC)
const ATC_CODES = [
    { code: 'WI011', desc: 'Professional Fees (5%) - Gross Income < 3M', rate: 5 },
    { code: 'WI010', desc: 'Professional Fees (10%) - Gross Income > 3M', rate: 10 },
    { code: 'WI100', desc: 'Real Property Rentals (5%)', rate: 5 },
    { code: 'WI157', desc: 'Payments to Medical Practitioners by Hospitals/Clinics (10%)', rate: 10 },
];

export function EWTPayoutView({ userId }: { userId: string }) {
    // ---> NEW: View State <---
    const [view, setView] = useState<'NEW' | 'HISTORY'>('NEW');
    const [historyData, setHistoryData] = useState<any[]>([]);

    const [payees, setPayees] = useState<any[]>([]);
    const [payeeId, setPayeeId] = useState('');
    const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
    const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
    
    const [payableBalance, setPayableBalance] = useState(0);
    const [amountToPay, setAmountToPay] = useState<number | ''>('');
    const [selectedATC, setSelectedATC] = useState(ATC_CODES[3]); 
    
    const [refPrefix] = useState('CV-');
    const [refSequence, setRefSequence] = useState('');
    const [remarks, setRemarks] = useState('');

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [generated2307, setGenerated2307] = useState<any | null>(null);

    // Fetch Payees
    useEffect(() => {
        const fetchPayees = async () => {
            try {
                const api = (window as any).api || (window as any).electronAPI;
                const data = await api.getPayees();
                setPayees(data);
            } catch (error) { console.error(error); }
        };
        fetchPayees();
    }, []);

    // Fetch Next Sequence Number
    useEffect(() => {
        const fetchNextSeq = async () => {
            if (view !== 'NEW') return;
            try {
                const api = (window as any).api || (window as any).electronAPI;
                const nextSeq = await api.getNextSequence(refPrefix);
                setRefSequence(nextSeq);
            } catch (error) { console.error(error); }
        };
        fetchNextSeq();
    }, [refPrefix, status, view]);

    // Fetch History when tab changes
    useEffect(() => {
        if (view === 'HISTORY') {
            const fetchHistory = async () => {
                setLoading(true);
                try {
                    const api = (window as any).api || (window as any).electronAPI;
                    const hist = await api.getPayoutHistory();
                    setHistoryData(hist || []);
                } catch (error) { console.error(error); }
                setLoading(false);
            };
            fetchHistory();
        }
    }, [view]);

    // Fetch Payee Balance
    useEffect(() => {
        if (!payeeId || view !== 'NEW') {
            setPayableBalance(0);
            setAmountToPay('');
            return;
        }
        const fetchBalance = async () => {
            try {
                const api = (window as any).api || (window as any).electronAPI;
                const bal = await api.getPayeeBalance(payeeId);
                setPayableBalance(bal?.payable || 0);
                setAmountToPay(bal?.payable || ''); 
            } catch (error) { console.error(error); }
        };
        fetchBalance();
    }, [payeeId, view]);

    // Math Calculations
    const grossAmount = Number(amountToPay) || 0;
    const ewtAmount = grossAmount * (selectedATC.rate / 100);
    const netAmount = grossAmount - ewtAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);

        if (!userId) return setStatus({ type: 'error', msg: "Developer Error: userId missing." });
        if (!payeeId) return setStatus({ type: 'error', msg: "Please select a Doctor or Vendor." });
        if (grossAmount <= 0) return setStatus({ type: 'error', msg: "Amount must be greater than zero." });
        if (grossAmount > payableBalance) return setStatus({ type: 'error', msg: "You cannot pay more than what you owe!" });
        if (!refSequence.trim()) return setStatus({ type: 'error', msg: "Voucher Sequence Number is required." });

        try {
            setLoading(true);
            const lines: any[] = [];
            
            lines.push({ accountId: '2010', debit: grossAmount, credit: 0 }); // AP
            if (ewtAmount > 0) lines.push({ accountId: '2050', debit: 0, credit: ewtAmount }); // EWT
            lines.push({ accountId: '1010', debit: 0, credit: netAmount }); // Bank

            const selectedPayee = payees.find(p => p.id === payeeId);
            const fullReferenceNo = `${refPrefix}${refSequence.padStart(3, '0')}`;

            const entryData = {
                date: new Date().toISOString(),
                referenceNo: fullReferenceNo,
                description: `Payout to ${selectedPayee?.name} - ${remarks} (Less ${selectedATC.rate}% EWT)`,
                vatType: 'EXEMPT',
                userId: userId,
                payeeId: payeeId,
                lines: lines
            };

            const api = (window as any).api || (window as any).electronAPI;
            const response = await api.submitJournalEntry(entryData);

            if (response && response.success === false) {
                setStatus({ type: 'error', msg: "Database Error: " + response.error });
                return;
            }

            setStatus({ type: 'success', msg: `Voucher ${fullReferenceNo} recorded! Net Check Amount: ₱${netAmount.toFixed(2)}.` });
            
            setGenerated2307({
                payee: selectedPayee,
                date: new Date(),
                gross: grossAmount,
                tax: ewtAmount,
                net: netAmount,
                atc: selectedATC
            });

            setAmountToPay('');
            setRemarks('');
            const newBal = await api.getPayeeBalance(payeeId);
            setPayableBalance(newBal?.payable || 0);

        } catch (error) {
            setStatus({ type: 'error', msg: "System Error: Could not save payout." });
        } finally {
            setLoading(false);
        }
    };

    // ---> NEW: Re-print old payslip from history <---
    const handleReprint = (tx: any) => {
        // Reconstruct the ATC from the tax math
        const taxRate = Math.round((tx.tax / tx.gross) * 100);
        let fallbackATC = ATC_CODES.find(a => a.rate === taxRate) || ATC_CODES[3];

        setGenerated2307({
            payee: tx.payee,
            date: new Date(tx.date),
            gross: tx.gross,
            tax: tx.tax,
            net: tx.net,
            atc: fallbackATC,
            isReprint: true,
            ref: tx.referenceNo
        });
    };

    const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));
    const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '-- Select Doctor or Landlord --';

    return (
        <div className="h-full flex flex-col font-sans relative text-gray-200">
            
            <div className="max-w-5xl mx-auto w-full bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg print:hidden flex flex-col h-full min-h-[600px]">
                
                {/* Header & Tabs */}
                <div className="flex justify-between items-end mb-6 border-b border-[#29292e] pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-wide">Doctor Payouts & Withholding Tax</h2>
                        <p className="text-sm text-gray-400 mt-1">Settle Accounts Payable and generate BIR 2307 equivalents.</p>
                    </div>
                    
                    <div className="flex bg-[#121214] p-1 rounded-md border border-[#29292e]">
                        <button onClick={() => setView('NEW')} className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${view === 'NEW' ? 'bg-[#4f46e5] text-white' : 'text-[#8d8d99] hover:text-white'}`}>New Payout</button>
                        <button onClick={() => setView('HISTORY')} className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider ${view === 'HISTORY' ? 'bg-[#4f46e5] text-white' : 'text-[#8d8d99] hover:text-white'}`}>Payout History</button>
                    </div>
                </div>

                {/* ========================================== */}
                {/* NEW PAYOUT TAB                             */}
                {/* ========================================== */}
                {view === 'NEW' && (
                    <div className="animate-in fade-in duration-300">
                        {status && (
                            <div className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div className="relative">
                                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Search Doctor / Vendor</label>
                                    <div className="relative mt-2">
                                        <div onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)} className={`w-full bg-[#121214] border ${isPayeeDropdownOpen ? 'border-[#4f46e5]' : 'border-[#29292e]'} rounded-md p-3 text-sm text-white transition cursor-pointer flex justify-between items-center`}>
                                            <span className={payeeId ? 'text-white' : 'text-gray-500'}>{selectedPayeeName}</span>
                                            <svg className="w-4 h-4 text-[#8d8d99]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        {isPayeeDropdownOpen && (
                                            <div className="absolute z-20 w-full mt-1 bg-[#202024] border border-[#29292e] rounded-md shadow-2xl overflow-hidden">
                                                <div className="p-2 border-b border-[#29292e] bg-[#121214]">
                                                    <input type="text" autoFocus placeholder="🔍 Search..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-transparent p-2 text-sm text-white outline-none placeholder-[#3f3f46]" />
                                                </div>
                                                <ul className="max-h-48 overflow-y-auto">
                                                    {filteredPayees.map(p => (
                                                        <li key={p.id} onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-white hover:bg-[#4f46e5] cursor-pointer transition border-t border-[#29292e]/50">
                                                            {p.name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex flex-col justify-end">
                                    <div className={`p-4 rounded-md border text-center ${payableBalance > 0 ? 'bg-orange-400/10 border-orange-400/30' : 'bg-[#121214] border-[#29292e]'}`}>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Total Unpaid Balance (Clinic Owes)</p>
                                        <p className={`text-2xl font-bold font-mono ${payableBalance > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                            ₱ {payableBalance.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#121214] p-6 border border-[#29292e] rounded-lg space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Check Voucher No.</label>
                                        <div className="flex">
                                            <span className="bg-[#2a2a2f] border border-[#29292e] border-r-0 rounded-l-md px-4 py-3 text-sm font-bold text-gray-400 select-none">
                                                {refPrefix}
                                            </span>
                                            <input 
                                                type="text" 
                                                required 
                                                value={refSequence} 
                                                onChange={e => setRefSequence(e.target.value)} 
                                                placeholder="001" 
                                                className="w-full bg-[#121214] border border-[#29292e] rounded-r-md p-3 text-sm font-mono text-white focus:border-[#4f46e5] outline-none transition" 
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Alphanumeric Tax Code (ATC)</label>
                                        <select value={selectedATC.code} onChange={e => setSelectedATC(ATC_CODES.find(atc => atc.code === e.target.value) || ATC_CODES[3])} className="w-full bg-[#202024] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition cursor-pointer">
                                            {ATC_CODES.map(atc => (
                                                <option key={atc.code} value={atc.code}>{atc.code} - {atc.desc}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6 items-end pt-4 border-t border-[#29292e]">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Gross Payout (A/P)</label>
                                        <input type="number" required min="0.01" step="0.01" value={amountToPay} onChange={e => setAmountToPay(parseFloat(e.target.value) || '')} placeholder="0.00" className="w-full bg-[#202024] border border-[#29292e] rounded-md p-3 text-lg text-white font-mono focus:border-[#4f46e5] outline-none transition" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-yellow-500 uppercase tracking-wider mb-2">Less: {selectedATC.rate}% EWT</label>
                                        <div className="w-full bg-[#202024] border border-yellow-500/30 rounded-md p-3 text-lg text-yellow-500 font-mono">
                                            - ₱ {ewtAmount.toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Net Check Amount</label>
                                        <div className="w-full bg-[#202024] border border-emerald-500/50 rounded-md p-3 text-xl text-emerald-400 font-bold font-mono">
                                            ₱ {netAmount.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Remarks</label>
                                <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g., PF Settlement for August Week 1" className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                            </div>

                            <button type="submit" disabled={loading || payableBalance <= 0} className="cursor-pointer w-full mt-4 bg-[#4f46e5] disabled:bg-[#29292e] disabled:text-[#8d8d99] text-white font-bold py-4 rounded-md transition hover:bg-[#4338ca] uppercase tracking-widest shadow-lg">
                                {loading ? 'Processing...' : 'Confirm Payout & Withhold Tax'}
                            </button>
                        </form>
                    </div>
                )}

                {/* ========================================== */}
                {/* PAYOUT HISTORY TAB                         */}
                {/* ========================================== */}
                {view === 'HISTORY' && (
                    <div className="animate-in fade-in duration-300 flex-1 flex flex-col overflow-hidden bg-[#121214] border border-[#29292e] rounded-md">
                        {loading ? (
                            <div className="flex-1 flex justify-center items-center text-[#4f46e5] animate-pulse">Loading History...</div>
                        ) : (
                            <div className="flex-1 overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#202024] sticky top-0 z-10 border-b border-[#29292e] shadow-sm">
                                        <tr className="text-[#8d8d99] uppercase tracking-wider text-xs">
                                            <th className="p-4 font-bold">Date</th>
                                            <th className="p-4 font-bold">Check Ref</th>
                                            <th className="p-4 font-bold">Payee</th>
                                            <th className="p-4 font-bold text-right">Gross (A/P)</th>
                                            <th className="p-4 font-bold text-right text-yellow-500">Tax Withheld</th>
                                            <th className="p-4 font-bold text-right text-emerald-400">Net Paid</th>
                                            <th className="p-4 font-bold text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#29292e]/50">
                                        {historyData.length === 0 ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-gray-500 italic">No past payouts found.</td></tr>
                                        ) : (
                                            historyData.map((tx, idx) => (
                                                <tr key={idx} className="hover:bg-[#2a2a2f] transition-colors">
                                                    <td className="p-4 text-gray-400">{new Date(tx.date).toLocaleDateString()}</td>
                                                    <td className="p-4 font-mono text-[#4f46e5] font-bold">{tx.referenceNo}</td>
                                                    <td className="p-4 text-white font-medium">{tx.payee?.name || 'Unknown Payee'}</td>
                                                    <td className="p-4 text-right font-mono text-gray-300">₱ {tx.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                    <td className="p-4 text-right font-mono text-yellow-500">₱ {tx.tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                    <td className="p-4 text-right font-mono text-emerald-400 font-bold">₱ {tx.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                    <td className="p-4 text-center">
                                                        <button 
                                                            onClick={() => handleReprint(tx)}
                                                            className="text-xs bg-[#29292e] hover:bg-[#323238] border border-[#3e3e44] px-3 py-1.5 rounded transition text-gray-300 hover:text-white"
                                                        >
                                                            🖨️ Re-print
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* BIR FORM 2307 MODAL / PRINT VIEW                          */}
            {/* ========================================================= */}
            {generated2307 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm print:bg-white print:block print:relative print:inset-auto print:z-0">
                    <div className="bg-white text-black p-8 rounded-lg shadow-2xl w-[800px] max-h-[90vh] overflow-y-auto print:w-full print:h-full print:max-h-full print:shadow-none print:p-0">
                        
                        <div className="flex justify-between items-center mb-4 print:hidden border-b pb-4">
                            <span className="text-red-600 font-bold uppercase tracking-widest text-xs">
                                {generated2307.isReprint ? "Reprinting Archive" : ""}
                            </span>
                            <div className="flex space-x-4">
                                <button onClick={() => setGenerated2307(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-black font-bold transition cursor-pointer">Close</button>
                                <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold transition shadow cursor-pointer">🖨️ Print Form 2307</button>
                            </div>
                        </div>

                        <div className="border-4 border-black p-4">
                            <div className="text-center border-b-2 border-black pb-4 mb-4">
                                <h1 className="font-bold text-xl uppercase">Certificate of Creditable Tax Withheld at Source</h1>
                                <p className="font-bold text-sm">(BIR Form No. 2307 Equivalent)</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-4 mb-4 text-sm">
                                <div>
                                    <p className="font-bold text-xs uppercase text-gray-600">Payee (Doctor/Supplier):</p>
                                    <p className="font-bold">{generated2307.payee?.name}</p>
                                    <p>TIN: {generated2307.payee?.tin || 'Not Provided'}</p>
                                </div>
                                <div>
                                    <p className="font-bold text-xs uppercase text-gray-600">Payor (Clinic):</p>
                                    <p className="font-bold">SMARTGUYS CLINIC INC.</p>
                                    <p>Date: {generated2307.date.toLocaleDateString()}</p>
                                    {generated2307.ref && <p className="text-xs text-gray-500 mt-1">Ref: {generated2307.ref}</p>}
                                </div>
                            </div>

                            <table className="w-full text-sm text-left border-collapse border border-black mb-12">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black p-2">Income Payment</th>
                                        <th className="border border-black p-2 text-center">ATC</th>
                                        <th className="border border-black p-2 text-right">Gross Amount</th>
                                        <th className="border border-black p-2 text-right">Tax Withheld</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border border-black p-2">{generated2307.atc.desc}</td>
                                        <td className="border border-black p-2 text-center font-bold">{generated2307.atc.code}</td>
                                        <td className="border border-black p-2 text-right font-mono">₱ {generated2307.gross.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                        <td className="border border-black p-2 text-right font-mono font-bold">₱ {generated2307.tax.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="text-xs text-center text-gray-500 mt-20 pt-4 border-t border-dashed border-gray-400">
                                This certificate is generated by the SmartGuys Clinic Accounting System and serves as proof of tax withheld for the period stated above.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}