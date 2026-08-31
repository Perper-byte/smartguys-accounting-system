import React, { useState, useEffect, useRef } from 'react';
import {
  Search, CheckCircle, History,
  Info, X, Wallet, Smartphone, Landmark, Printer
} from 'lucide-react';

export function ReceivePaymentView({ userId }: { userId: string }) {
  // --- States ---
  const [payees, setPayees] = useState<any[]>([]);
  const [payeeId, setPayeeId] = useState('');
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('');

  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [amountReceived, setAmountReceived] = useState<number | ''>('');
  const [cwtAmount, setCwtAmount] = useState<number | ''>('');

  // FIXED: No default payment method. Cashier must actively select one.
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const [refPrefix] = useState('OR-');
  const [refSequence, setRefSequence] = useState('');

  // Modals & Views
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Computations ---
  const received = Number(amountReceived) || 0;
  const tax = Number(cwtAmount) || 0;
  const totalCredit = received + tax;
  const remainingBalance = Math.max(0, outstandingBalance - totalCredit);

  // Validation for enabling the confirm button
  const isValid =
    payeeId !== '' &&
    paymentMethod !== '' && // Must have a payment method
    received > 0 &&
    totalCredit <= (outstandingBalance + 0.01) &&
    refSequence.trim() !== '';

  // --- Effects ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPayeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchPayees = async () => {
      try {
        const data = await (window as any).api.getPayees();
        // IDEAL LOGIC NOTE: Ensure the backend only returns Patients and HMOs here.
        // e.g., setPayees(data.filter(p => p.type === 'Patient' || p.type === 'HMO'));
        setPayees(data);
      } catch (error) { console.error(error); }
    };
    fetchPayees();
  }, []);

  useEffect(() => {
    const fetchNextSeq = async () => {
      try {
        const api = (window as any).api || (window as any).electronAPI;
        const nextSeq = await api.getNextSequence(refPrefix);
        setRefSequence(nextSeq);
      } catch (error) { console.error(error); }
    };
    if (!successData) fetchNextSeq();
  }, [refPrefix, successData]);

  useEffect(() => {
    if (!payeeId) {
      setOutstandingBalance(0);
      setAmountReceived('');
      setCwtAmount('');
      setPaymentReference('');
      return;
    }
    const fetchBalance = async () => {
      try {
        // Balances update dynamically from a real record here
        const bal = await (window as any).api.getPayeeBalance(payeeId);
        setOutstandingBalance(bal?.receivable || 0);
        setAmountReceived('');
        setCwtAmount('');
      } catch (error) { console.error(error); }
    };
    fetchBalance();
  }, [payeeId]);

  // --- Handlers ---
  const handleAutoComputeTax = () => {
    if (outstandingBalance > 0) {
      const computedTax = outstandingBalance * 0.02;
      const netAmount = outstandingBalance - computedTax;
      setCwtAmount(Number(computedTax.toFixed(2)));
      setAmountReceived(Number(netAmount.toFixed(2)));
    }
  };

  const handleExactAmount = () => {
    const currentTax = Number(cwtAmount) || 0;
    const netAmount = outstandingBalance - currentTax;
    setAmountReceived(netAmount > 0 ? Number(netAmount.toFixed(2)) : outstandingBalance);
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsConfirmModalOpen(true);
  };

  const handleActualSubmit = async () => {
    setStatus(null);
    setLoading(true);

    try {
      const lines: any[] = [];
      const debitAccount = paymentMethod === 'CASH' ? '1020' : '1010';
      lines.push({ accountId: debitAccount, debit: received, credit: 0 });

      if (tax > 0) lines.push({ accountId: '1310', debit: tax, credit: 0 });
      lines.push({ accountId: '1200', debit: 0, credit: totalCredit });

      const selectedName = payees.find(p => p.id === payeeId)?.name;
      const fullReferenceNo = `${refPrefix}${refSequence.padStart(3, '0')}`;

      const entryData = {
        date: new Date().toISOString(),
        referenceNo: fullReferenceNo,
        description: `Collection of A/R from ${selectedName} via ${paymentMethod} ${paymentReference ? `(Ref: ${paymentReference})` : ''}`,
        vatType: 'EXEMPT',
        userId: userId,
        payeeId: payeeId,
        lines: lines
      };

      const response = await (window as any).api.submitJournalEntry(entryData);

      if (response && response.success === false) {
        setStatus({ type: 'error', msg: "Database Error: " + response.error });
        setIsConfirmModalOpen(false);
        return;
      }

      setIsConfirmModalOpen(false);
      setSuccessData({
        orNo: fullReferenceNo,
        name: selectedName,
        amount: received,
        method: paymentMethod,
        ref: paymentReference,
        remaining: remainingBalance
      });

    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', msg: "System Error: Could not save payment." });
      setIsConfirmModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPayeeId('');
    setPaymentMethod(''); // Reset method back to empty
    setSuccessData(null);
    setStatus(null);
  };

  // FIXED: Print Receipt was rendering a button with no onClick — wired it up.
  // Uses window.print() with a print-only stylesheet so only the receipt
  // block (#receipt-print-area) is visible on the printed page, regardless
  // of the surrounding app chrome (sidebar, header, etc).
  const handlePrintReceipt = () => {
    // Electron's window.print() opens the native print dialog for the
    // current renderer window, same as a browser tab.
    window.print();
  };

  const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));
  const selectedPayee = payees.find(p => p.id === payeeId);

  // ==========================================
  // VIEW 1: SUCCESS SCREEN
  // ==========================================
  if (successData) {
    return (
      <div className="w-full flex justify-center p-8 bg-slate-50 min-h-[calc(100vh-64px)]">
        {/* Print-only CSS: hides everything on the page except the receipt
            block when printing, and resets it to fill the printed page. */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #receipt-print-area, #receipt-print-area * { visibility: visible; }
            #receipt-print-area {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              margin: 0;
              padding: 24px;
              box-shadow: none !important;
              border: none !important;
            }
            #receipt-print-hide { display: none !important; }
          }
        `}</style>

        <div id="receipt-print-area" className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl p-12 shadow-sm flex flex-col items-center">
          <CheckCircle size={64} className="text-emerald-500 mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 tracking-widest uppercase mb-2">Payment Received</h2>
          <p className="text-5xl font-mono font-bold text-emerald-500 mb-8">₱ {successData.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>

          <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4 mb-8">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Patient/Entity</span>
              <span className="text-slate-800 font-bold">{successData.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">OR No.</span>
              <span className="text-slate-800 font-bold">{successData.orNo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Payment Method</span>
              <span className="text-slate-800 font-bold">{successData.method} {successData.ref && `(${successData.ref})`}</span>
            </div>
            <div className="border-t border-slate-200 pt-4 flex justify-between text-sm">
              <span className="text-slate-500">Remaining Balance</span>
              <span className="text-slate-800 font-bold">₱ {successData.remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div id="receipt-print-hide" className="flex gap-4 w-full max-w-md">
            <button onClick={handlePrintReceipt} className="flex-1 flex justify-center items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-md transition">
              <Printer size={20} /> Print Receipt
            </button>
            <button onClick={resetForm} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-md transition shadow-md">
              New Collection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: MAIN FORM
  // ==========================================
  return (
    <div className="w-full min-h-[calc(100vh-64px)] p-6 md:p-10 flex justify-center items-start bg-[#f9fafb]">
      <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-xl shadow-sm font-sans flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center p-6 lg:px-10 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 tracking-wide">Receive Payment (Collections)</h2>
          {/* FIXED: Changed badge to Emerald Green to clearly signal money-in, distinct from connection pill */}
          <span className="bg-emerald-50 text-emerald-600 text-xs px-3 py-1.5 rounded font-bold uppercase tracking-widest border border-emerald-200">
            Payment Collection
          </span>
        </div>

        <div className="p-6 lg:p-10">
          {status && (
            <div className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : ''}`}>
              ⚠️ {status.msg}
            </div>
          )}

          <form onSubmit={handleOpenConfirm} className="space-y-8">

            {/* STEP 1: ACCOUNT SELECTION */}
            <div className="grid grid-cols-2 gap-10">
              <div className="relative" ref={dropdownRef}>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">1. Select Account</label>
                <div className="relative mt-2">
                  <div onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)} className={`w-full bg-white border ${isPayeeDropdownOpen ? 'border-[#1B9387] ring-1 ring-[#1B9387]' : 'border-slate-200 hover:border-slate-300'} rounded-lg p-4 text-sm text-slate-700 transition cursor-pointer flex justify-between items-center shadow-sm`}>
                    <div className="flex items-center gap-3">
                      <Search size={18} className={payeeId ? 'text-[#1B9387]' : 'text-slate-400'} />
                      <span className={payeeId ? 'text-slate-800 font-bold text-base' : 'text-slate-400'}>
                        {selectedPayee?.name || 'Search patient or HMO...'}
                      </span>
                    </div>
                  </div>
                  {isPayeeDropdownOpen && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <input type="text" autoFocus placeholder="🔍 Type to search..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-transparent p-2 text-sm text-slate-800 outline-none placeholder-slate-400" />
                      </div>
                      <ul className="max-h-64 overflow-y-auto">
                        {filteredPayees.map(p => (
                          <li key={p.id} onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-4 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#1B9387] cursor-pointer transition border-b border-slate-50 last:border-0 font-medium">
                            {p.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {payeeId && (
                  <div className="mt-3 flex justify-between items-center px-1">
                    <span className="text-xs text-slate-400 font-mono">ID: {payeeId.slice(0, 8).toUpperCase()}</span>
                    <button type="button" onClick={() => setIsHistoryModalOpen(true)} className="text-xs text-[#1B9387] hover:text-[#157a70] flex items-center gap-1 font-bold transition">
                      <History size={14} /> View History
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-end">
                <div className={`p-5 rounded-xl border flex flex-col justify-center items-end shadow-sm ${outstandingBalance > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'}`}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Current Outstanding Balance</p>
                  <p className={`text-4xl font-bold font-mono ${outstandingBalance > 0 ? 'text-red-500' : 'text-[#10b981]'}`}>
                    ₱ {outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 2: COLLECTION DETAILS */}
            <div className="bg-white p-8 border border-slate-200 shadow-sm rounded-xl relative">

              {/* FIXED: Added Step 2 label to complete the numerical flow */}
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-8 pb-4 border-b border-slate-100">
                2. Payment Details
              </label>

              {!payeeId && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
                  <span className="text-slate-500 font-bold text-sm tracking-widest uppercase bg-white px-6 py-3 rounded-full shadow-sm border border-slate-200">Select an account to proceed</span>
                </div>
              )}

              <div className="space-y-10">
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Official Receipt No.</label>
                    <div className="flex shadow-sm rounded-md">
                      <span className="bg-slate-50 border border-slate-300 border-r-0 rounded-l-lg px-4 py-3 text-sm font-bold text-slate-500 select-none flex flex-col justify-center">
                        {refPrefix}
                      </span>
                      <div className="relative w-full flex">
                        <input
                          type="text"
                          required
                          value={refSequence}
                          onChange={e => setRefSequence(e.target.value)}
                          placeholder="000"
                          className="w-full bg-white border border-slate-300 rounded-r-lg p-3 text-base font-mono text-slate-800 focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none transition"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 uppercase tracking-wider font-bold select-none pointer-events-none">
                          Auto-Generated
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Method</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button type="button" onClick={() => setPaymentMethod('CASH')} className={`flex justify-center items-center gap-2 cursor-pointer py-3 text-xs font-bold rounded-lg border transition-all ${paymentMethod === 'CASH' ? 'bg-[#1B9387] border-[#1B9387] text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}><Wallet size={16} /> CASH</button>
                      <button type="button" onClick={() => setPaymentMethod('GCASH')} className={`flex justify-center items-center gap-2 cursor-pointer py-3 text-xs font-bold rounded-lg border transition-all ${paymentMethod === 'GCASH' ? 'bg-[#1B9387] border-[#1B9387] text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}><Smartphone size={16} /> GCASH</button>
                      <button type="button" onClick={() => setPaymentMethod('BANK')} className={`flex justify-center items-center gap-2 cursor-pointer py-3 text-xs font-bold rounded-lg border transition-all ${paymentMethod === 'BANK' ? 'bg-[#1B9387] border-[#1B9387] text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}><Landmark size={16} /> BANK</button>
                    </div>

                    {(paymentMethod === 'GCASH' || paymentMethod === 'BANK') && (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <input
                          type="text"
                          placeholder={paymentMethod === 'GCASH' ? "Enter GCash Reference No." : "Enter Bank Transfer Ref No."}
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-800 focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none transition shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-10 items-start">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-[#10b981] uppercase tracking-wider">Amount Received</label>
                      {outstandingBalance > 0 && (
                        <button type="button" onClick={handleExactAmount} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1 rounded-full transition">
                          Use Exact Amount
                        </button>
                      )}
                    </div>
                    <div className="relative shadow-sm rounded-lg">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-slate-400 font-mono">₱</span>
                      {/* FIXED: Removed stepper arrows using Tailwind appearance utilities */}
                      <input type="number" min="0.01" step="0.01" value={amountReceived} onChange={e => setAmountReceived(parseFloat(e.target.value) || '')} placeholder="0.00" className="w-full bg-white border-2 border-[#34d399] rounded-lg py-5 pl-12 pr-6 text-3xl text-slate-800 font-mono text-right focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none transition placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-1 group relative cursor-help">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">2% Withholding Tax <span className="lowercase font-normal text-slate-400">(Optional)</span></label>
                        <Info size={14} className="text-slate-400 group-hover:text-slate-700 transition" />
                        <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 text-xs text-white p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                          Usually applicable only for HMOs and corporate accounts.
                        </div>
                      </div>

                      {outstandingBalance > 0 && (
                        <button type="button" onClick={handleAutoComputeTax} className="text-[10px] bg-[#1B9387]/10 hover:bg-[#1B9387]/20 text-[#1B9387] font-bold px-3 py-1 rounded-full transition">
                          Auto-Compute
                        </button>
                      )}
                    </div>
                    <div className="relative shadow-sm rounded-lg">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400 font-mono">₱</span>
                      {/* FIXED: Removed resting yellow border; removed stepper arrows */}
                      <input type="number" min="0" step="0.01" value={cwtAmount} onChange={e => setCwtAmount(parseFloat(e.target.value) || '')} placeholder="0.00" className="w-full bg-white border border-slate-300 rounded-lg py-4 pl-12 pr-6 text-xl text-slate-800 font-mono text-right focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none transition placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                  </div>
                </div>

                {/* Remaining Balance Summary Box */}
                {payeeId && (received > 0 || tax > 0) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 font-mono text-sm animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-inner">
                    <div className="flex justify-between text-slate-500 mb-2">
                      <span>Outstanding Balance</span>
                      <span>₱ {outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {tax > 0 && (
                      <div className="flex justify-between text-amber-600 mb-2">
                        <span>Withholding Tax (2%)</span>
                        <span>- ₱ {tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-600 mb-4">
                      <span>Payment Received</span>
                      <span>- ₱ {received.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-3 flex justify-between text-slate-800 font-bold text-lg">
                      <span>Remaining Balance</span>
                      <span>₱ {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CONFIRM BUTTON */}
            <button type="submit" disabled={!isValid || loading} className="cursor-pointer w-full mt-4 bg-[#10b981] disabled:bg-[#f0fdfa] disabled:text-[#064e3b]/40 disabled:border disabled:border-emerald-100 disabled:shadow-none disabled:cursor-not-allowed text-white font-bold py-5 rounded-xl transition-all hover:bg-[#059669] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-3 text-lg">
              {loading ? 'Processing...' : (
                <>
                  <CheckCircle size={24} />
                  {isValid ? `Confirm & Collect ₱ ${received.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Confirm Collection'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ========================================== */}
      {/* CONFIRMATION MODAL                           */}
      {/* ========================================== */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-slate-800 font-bold tracking-wide">Confirm Payment</h3>
              <button onClick={() => setIsConfirmModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition bg-white rounded-full p-1 border border-slate-200 shadow-sm">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5 text-sm">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">Patient / Entity</p>
                <p className="text-slate-800 font-bold text-lg">{selectedPayee?.name}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 font-mono shadow-inner">
                <div className="flex justify-between text-slate-500">
                  <span>Outstanding</span>
                  <span>₱ {outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Amount Received</span>
                  <span>₱ {received.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>2% Tax</span>
                    <span>₱ {tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Method</span>
                  <span>{paymentMethod} {paymentReference && `(${paymentReference})`}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between text-slate-800 font-bold text-base mt-2">
                  <span>Remaining Balance</span>
                  <span>₱ {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-3 rounded-lg font-bold transition shadow-sm">
                Cancel
              </button>
              <button onClick={handleActualSubmit} className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white py-3 rounded-lg font-bold tracking-wide transition shadow-md">
                Confirm & Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* PAYMENT HISTORY MODAL                        */}
      {/* ========================================== */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-slate-800 font-bold tracking-wide flex items-center gap-2"><History size={18} className="text-[#1B9387]" /> Payment History</h3>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition bg-white rounded-full p-1 border border-slate-200 shadow-sm">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-500 text-sm mb-5">Recent collections for <strong className="text-slate-800">{selectedPayee?.name}</strong></p>

              <div className="space-y-3">
                {[
                  { date: 'Aug 20, 2026', or: 'OR-00182', amount: 1000, method: 'CASH' },
                  { date: 'Aug 12, 2026', or: 'OR-00151', amount: 2500, method: 'GCASH' },
                  { date: 'Aug 03, 2026', or: 'OR-00112', amount: 500, method: 'CASH' },
                ].map((hist, i) => (
                  <div key={i} className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl shadow-sm font-mono text-sm">
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-xs mb-1 font-sans font-bold">{hist.date}</span>
                      <span className="text-slate-800 font-bold">{hist.or}</span>
                    </div>
                    <div className="flex items-center gap-5">
                      <span className="text-slate-400 text-xs font-sans font-bold bg-slate-50 px-2 py-1 rounded">{hist.method}</span>
                      <span className="text-[#10b981] font-bold text-base">₱ {hist.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}