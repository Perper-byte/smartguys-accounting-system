import React, { useState, useEffect } from 'react';

export function ReceivePaymentView({ userId }: { userId: string }) {
  const [payees, setPayees] = useState<any[]>([]);
  const [payeeId, setPayeeId] = useState('');
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
  
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [amountReceived, setAmountReceived] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [referenceNo, setReferenceNo] = useState('');
  const [cwtAmount, setCwtAmount] = useState<number | ''>(''); // For HMOs that withhold tax

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Load Payees
  useEffect(() => {
    const fetchPayees = async () => {
      try {
        const data = await (window as any).api.getPayees();
        setPayees(data);
      } catch (error) {
        console.error("Failed to load payees", error);
      }
    };
    fetchPayees();
    // Auto-generate a generic OR number
    setReferenceNo(`OR-${Date.now()}`);
  }, []);

  // Fetch specific Payee's A/R Balance when selected
  useEffect(() => {
    if (!payeeId) {
      setOutstandingBalance(0);
      setAmountReceived('');
      setCwtAmount('');
      return;
    }
    const fetchBalance = async () => {
      try {
        const bal = await (window as any).api.getPayeeBalance(payeeId);
        setOutstandingBalance(bal?.receivable || 0);
        setAmountReceived(bal?.receivable || ''); // Auto-fill with full balance
      } catch (error) {
        console.error("Failed to fetch balance", error);
      }
    };
    fetchBalance();
  }, [payeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    const received = Number(amountReceived) || 0;
    const taxWithheld = Number(cwtAmount) || 0;
    const totalCredit = received + taxWithheld;

    if (!userId) return setStatus({ type: 'error', msg: "Developer Error: userId missing." });
    if (!payeeId) return setStatus({ type: 'error', msg: "Please select a Patient or HMO." });
    if (totalCredit <= 0) return setStatus({ type: 'error', msg: "Amount received must be greater than zero." });
    if (totalCredit > outstandingBalance) return setStatus({ type: 'error', msg: "Cannot collect more than the outstanding balance!" });

    try {
      setLoading(true);

      const lines: any[] = [];
      
      // 1. DEBIT: Where the money is going
      const debitAccount = paymentMethod === 'CASH' ? '1020' : '1010'; // 1020 for Drawer, 1010 for Bank/GCash
      lines.push({
        accountId: debitAccount,
        debit: received,
        credit: 0
      });

      // 2. DEBIT: CWT (1310) if HMO withheld tax
      if (taxWithheld > 0) {
        lines.push({
          accountId: '1310', // Creditable Withholding Tax
          debit: taxWithheld,
          credit: 0
        });
      }

      // 3. CREDIT: Clear the Accounts Receivable (1200)
      lines.push({
        accountId: '1200',
        debit: 0,
        credit: totalCredit
      });

      const selectedName = payees.find(p => p.id === payeeId)?.name;

      const entryData = {
        date: new Date().toISOString(),
        referenceNo: referenceNo,
        description: `Collection of A/R from ${selectedName} via ${paymentMethod}`,
        vatType: 'EXEMPT', // Collections themselves don't trigger new VAT
        userId: userId,
        payeeId: payeeId,
        lines: lines
      };

      const response = await (window as any).api.submitJournalEntry(entryData);

      if (response && response.success === false) {
        setStatus({ type: 'error', msg: "Database Error: " + response.error });
        return;
      }

      setStatus({ type: 'success', msg: `Payment of ₱${received.toFixed(2)} recorded successfully! Collection Receipt: ${referenceNo}` });
      
      // Reset Form & Refetch Balance
      setReferenceNo(`OR-${Date.now()}`);
      setAmountReceived('');
      setCwtAmount('');
      
      // Refetch their new balance
      const newBal = await (window as any).api.getPayeeBalance(payeeId);
      setOutstandingBalance(newBal?.receivable || 0);

    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', msg: "System Error: Could not save payment." });
    } finally {
      setLoading(false);
    }
  };

  const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));
  const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '-- Select Patient or Entity --';

  return (
    <div className="max-w-4xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg font-sans">
      <div className="flex justify-between items-center mb-6 border-b border-[#29292e] pb-4">
        <h2 className="text-xl font-bold text-white tracking-wide">Receive Payment (Collections)</h2>
        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1 rounded font-bold uppercase tracking-widest border border-emerald-500/30">
          Cash Inflow
        </span>
      </div>

      {status && (
          <div className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
              {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
          </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* ROW 1: Payee Selection & Outstanding Balance */}
        <div className="grid grid-cols-2 gap-6">
          <div className="relative">
            <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Search Patient or HMO</label>
            <div className="relative mt-2">
                <div 
                    onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)}
                    className={`w-full bg-[#121214] border ${isPayeeDropdownOpen ? 'border-[#4f46e5]' : 'border-[#29292e]'} rounded-md p-3 text-sm text-white transition cursor-pointer flex justify-between items-center`}
                >
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
            <div className={`p-4 rounded-md border text-center ${outstandingBalance > 0 ? 'bg-[#f75a68]/10 border-[#f75a68]/30' : 'bg-[#121214] border-[#29292e]'}`}>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Current Outstanding Balance</p>
              <p className={`text-2xl font-bold font-mono ${outstandingBalance > 0 ? 'text-[#f75a68]' : 'text-emerald-400'}`}>
                ₱ {outstandingBalance.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* ROW 2: Payment Details */}
        <div className="bg-[#121214] p-6 border border-[#29292e] rounded-lg space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Collection Receipt (OR No.)</label>
              <input type="text" required value={referenceNo} onChange={e => setReferenceNo(e.target.value)} className="w-full bg-[#202024] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                  {['CASH', 'GCASH', 'BANK TRANSFER'].map((method) => (
                    <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`cursor-pointer py-2.5 text-xs font-bold rounded border transition-colors ${paymentMethod === method ? 'bg-[#4f46e5] border-[#4f46e5] text-white' : 'bg-[#202024] border-[#29292e] text-gray-400 hover:border-gray-500'}`}>{method}</button>
                  ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 items-end">
            <div>
              <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Amount Received (₱)</label>
              <input type="number" required min="0.01" step="0.01" value={amountReceived} onChange={e => setAmountReceived(parseFloat(e.target.value) || '')} placeholder="0.00" className="w-full bg-[#202024] border border-emerald-500/50 rounded-md p-4 text-xl text-white font-mono focus:border-emerald-500 outline-none transition" />
            </div>
            
            {/* CWT Box (Useful when HMOs pay but withhold 2% tax) */}
            <div>
              <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Less: 2% Tax Withheld by HMO (Optional)</label>
              <input type="number" min="0" step="0.01" value={cwtAmount} onChange={e => setCwtAmount(parseFloat(e.target.value) || '')} placeholder="0.00" className="w-full bg-[#202024] border border-yellow-500/30 rounded-md p-3 text-sm text-white font-mono focus:border-yellow-500 outline-none transition" />
            </div>
          </div>
        </div>

        <button
            type="submit"
            disabled={loading || outstandingBalance <= 0}
            className="cursor-pointer w-full mt-4 bg-emerald-600 disabled:bg-[#29292e] disabled:text-[#8d8d99] text-white font-bold py-4 rounded-md transition hover:bg-emerald-500 uppercase tracking-widest shadow-lg"
        >
            {loading ? 'Processing...' : 'Confirm & Collect Payment'}
        </button>
      </form>
    </div>
  );
}