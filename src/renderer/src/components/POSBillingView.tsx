import React, { useState, useEffect } from 'react';

// Master list of Categories (Maps to your Chart of Accounts and sets VAT rules)
const CATEGORIES = {
  '4010': { label: '👨‍⚕️ Consultation', isVatable: false },
  '4020': { label: '🔬 Laboratory / X-Ray', isVatable: false },
  '4030': { label: '💊 Medicine / Pharmacy', isVatable: true },
  '4040': { label: '📄 Medical Certificate', isVatable: false },
};

export function POSBillingView({ userId }: { userId: string }) {
  const [patientName, setPatientName] = useState('');
  
  // Database Payee/Entity States
  const [payees, setPayees] = useState<any[]>([]);
  const [payeeId, setPayeeId] = useState('');
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
  const [showAddPayee, setShowAddPayee] = useState(false);
  const [newPayeeName, setNewPayeeName] = useState('');
  const [isSubmittingPayee, setIsSubmittingPayee] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  
  // HMO Specific Fields
  const [hmoProvider, setHmoProvider] = useState('Maxicare');
  const [loaNumber, setLoaNumber] = useState('');

  // Senior Citizen / PWD Fields
  const [isSCPWD, setIsSCPWD] = useState(false);
  const [scPwdId, setScPwdId] = useState('');

  // Live Drawer Cash State
  const [drawerCash, setDrawerCash] = useState(0);

  // Line items for the bill
  const [items, setItems] = useState([
    { id: 1, accountCode: '4010', description: '', quantity: 1, price: 0, isVatable: false }
  ]);

  const [amountTendered, setAmountTendered] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // State to trigger the Confirmation Modal
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Shift Report State
  const [shiftReport, setShiftReport] = useState<any>(null);

  // 1. Fetch live Cash on Hand & Entities from database
  const loadInitialData = async () => {
    try {
      const api = (window as any).api;
      const balance = await api.getPettyCashBalance();
      setDrawerCash(balance);
      
      const payeeData = await api.getPayees();
      setPayees(payeeData);
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Inline Create Payee Function
  const handleCreatePayee = async () => {
    if (!newPayeeName.trim()) return;
    setIsSubmittingPayee(true);
    try {
        const api = (window as any).api;
        await api.createPayee(newPayeeName);
        
        // Refresh the list from the database
        const updatedPayees = await api.getPayees();
        setPayees(updatedPayees);
        
        // Auto-select the newly created record
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

  // Generate Shift Report Function
  const generateShiftReport = async () => {
    try {
      const report = await (window as any).api.getShiftReport(userId);
      setShiftReport(report);
    } catch (error) {
      console.error(error);
      alert("Failed to load shift report.");
    }
  };

  // --- Functions ---
  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), accountCode: '4010', description: '', quantity: 1, price: 0, isVatable: false }]);
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'accountCode') {
            updatedItem.isVatable = CATEGORIES[value as keyof typeof CATEGORIES].isVatable;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  // --- BIR VAT & DISCOUNT CALCULATIONS ---
  let grossAmount = 0;
  let vatableSales = 0;
  let vatExemptSales = 0;
  let vatAmount = 0;
  let totalDiscount = 0;
  let grandTotal = 0;

  items.forEach(item => {
    const lineTotal = item.quantity * item.price;
    grossAmount += lineTotal;

    if (isSCPWD) {
      const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal;
      const discountAmount = netOfVat * 0.20;
      const discountedPrice = netOfVat - discountAmount;
      
      vatExemptSales += discountedPrice;
      totalDiscount += (lineTotal - discountedPrice); 
      grandTotal += discountedPrice;
    } else {
      if (item.isVatable) {
        const net = lineTotal / 1.12;
        const vat = lineTotal - net;
        vatableSales += net;
        vatAmount += vat;
        grandTotal += lineTotal;
      } else {
        vatExemptSales += lineTotal;
        grandTotal += lineTotal;
      }
    }
  });

  const change = amountTendered - grandTotal;

  // Selected Payee Name for display
  const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '-- Select Patient or Entity --';
  const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));

  // STEP 1: VALIDATION (Opens Confirmation Modal)
  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null); // Clear previous alerts

    // Safety Prop Check
    if (!userId) {
      setStatus({ 
        type: 'error', 
        msg: "Developer Error: 'userId' is undefined! Make sure App.tsx passes the user ID." 
      });
      return;
    }

    if (!payeeId) {
      setStatus({ type: 'error', msg: "Please tag a Patient or Entity for this transaction." });
      return;
    }
    if (items.length === 0 || grandTotal === 0) {
      setStatus({ type: 'error', msg: "Please add at least one service or medicine item." });
      return;
    }
    if (paymentMethod === 'HMO' && !loaNumber.trim()) {
      setStatus({ type: 'error', msg: "HMO LOA Number is required!" });
      return;
    }
    if (isSCPWD && !scPwdId.trim()) {
        setStatus({ type: 'error', msg: "Senior Citizen / PWD ID Number is required for the discount!" });
        return;
    }
    
    // Check: Only require amount tendered if it's CASH or GCASH
    if ((paymentMethod === 'CASH' || paymentMethod === 'GCASH') && amountTendered < grandTotal) {
      setStatus({ type: 'error', msg: "Amount tendered is less than the total amount due!" });
      return;
    }

    // All checks pass! Open the double-check confirmation screen
    setIsConfirmOpen(true);
  };

  // STEP 2: ACTUAL DATABASE SUBMIT
  const handleConfirmSubmit = async () => {
    try {
      setLoading(true);

      const lines: any[] = [];
      
      // ROUTE CHARGE TO A/R
      let debitAccount = '1010'; // Default to Cash in Bank (for GCash)
      
      if (paymentMethod === 'HMO' || paymentMethod === 'CHARGE') {
        debitAccount = '1200'; // Accounts Receivable (No cash received yet)
      } else if (paymentMethod === 'CASH') {
        debitAccount = '1020'; // Petty Cash / Cash on Hand (In Hand!)
      }

      lines.push({
        accountId: debitAccount,
        debit: grandTotal,
        credit: 0
      });

      items.forEach(item => {
        const lineTotal = item.quantity * item.price;
        let revenueAmount = lineTotal;
        
        if (isSCPWD) {
           const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal;
           revenueAmount = netOfVat * 0.80; 
        } else if (item.isVatable) {
           revenueAmount = lineTotal / 1.12;
        }

        lines.push({
          accountId: item.accountCode,
          debit: 0,
          credit: revenueAmount
        });
      });

      if (vatAmount > 0 && !isSCPWD) {
        lines.push({
          accountId: '2020',
          debit: 0,
          credit: vatAmount
        });
      }

      const entryData = {
        date: new Date().toISOString(),
        referenceNo: `INV-${Date.now()}`,
        description: `POS Billing: ${selectedPayeeName} (${paymentMethod})${paymentMethod === 'HMO' ? ` LOA: ${loaNumber}` : ''}`,
        vatType: vatAmount > 0 ? 'VATABLE' : 'EXEMPT',
        userId: userId,
        payeeId: payeeId,
        lines: lines
      };

      const response = await (window as any).api.submitJournalEntry(entryData);

      if (response && response.success === false) {
        setStatus({ type: 'error', msg: "Database Error: " + response.error });
        setIsConfirmOpen(false);
        return;
      }

      setStatus({ 
        type: 'success', 
        msg: `Invoice ${entryData.referenceNo} saved to Database! Billed ₱${grandTotal.toFixed(2)} to ${selectedPayeeName}.` 
      });
      
      // Reset Form & Close Modal
      setPayeeId('');
      setItems([{ id: Date.now(), accountCode: '4010', description: '', quantity: 1, price: 0, isVatable: false }]);
      setAmountTendered(0);
      setLoaNumber('');
      setIsSCPWD(false);
      setScPwdId('');
      setIsConfirmOpen(false);
      setPaymentMethod('CASH');

      // Refresh live Cash
      loadInitialData();

    } catch (error: any) {
      console.error(error);
      setStatus({ type: 'error', msg: "System Error: Could not connect to the database." });
      setIsConfirmOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#121214] text-gray-200 font-sans relative">
      
      {/* Header Badge */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Patient Billing & POS</h1>
          <p className="text-sm text-gray-400">Generate BIR EOPT-Compliant invoices and process payments.</p>
        </div>
        
        <div className="flex space-x-4 items-center">
          <button 
            type="button"
            onClick={generateShiftReport}
            className="cursor-pointer px-4 py-2 bg-[#29292e] hover:bg-[#323238] text-gray-300 font-bold text-xs uppercase tracking-wider rounded-lg border border-[#323238] transition-colors"
          >
            📋 View Shift Report
          </button>

          <div className="bg-emerald-950/30 text-emerald-400 border border-emerald-800 rounded-lg px-4 py-2 text-right">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Drawer Cash (In Hand)</p>
            <p className="text-lg font-mono font-bold">
              ₱ {drawerCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* React Status Banner */}
      {status && (
          <div className={`mb-6 p-4 rounded-md text-sm font-medium ${
              status.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
              : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}>
              {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
          </div>
      )}

      <form onSubmit={handleCheckout} className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* --- LEFT COLUMN: Transaction Details --- */}
        <div className="col-span-1 flex flex-col gap-6">
          
          <div className="bg-[#202024] rounded-xl p-6 border border-[#29292e] shadow-lg">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-[#8d8d99]">Transaction Details</h2>
            
            <div className="space-y-4">
              
              {/* SEARCHABLE PATIENT / ENTITY DROPDOWN */}
              <div className="relative">
                <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs font-medium text-gray-400">Patient / Entity Name</label>
                    <button type="button" onClick={() => setShowAddPayee(!showAddPayee)} className="text-xs font-bold text-[#4f46e5] hover:text-[#5b54f6] transition hover:underline">
                        {showAddPayee ? 'Cancel' : '+ Add New Record'}
                    </button>
                </div>

                {showAddPayee && (
                    <div className="mb-3 p-3 bg-[#121214] border border-[#4f46e5]/50 rounded-md flex gap-3 shadow-inner">
                        <input 
                            type="text" 
                            placeholder="Enter Name..."
                            value={newPayeeName}
                            onChange={e => setNewPayeeName(e.target.value)}
                            className="flex-1 bg-transparent text-sm text-white outline-none placeholder-[#3f3f46]"
                            autoFocus
                        />
                        <button 
                            type="button"
                            onClick={handleCreatePayee}
                            disabled={isSubmittingPayee || !newPayeeName.trim()}
                            className="bg-[#4f46e5] hover:bg-[#5b54f6] text-white text-xs font-bold px-4 py-2 rounded transition disabled:opacity-50"
                        >
                            {isSubmittingPayee ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}

                <div className="relative mt-2">
                    <div 
                        onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)}
                        className={`w-full bg-[#121214] border ${isPayeeDropdownOpen ? 'border-[#4f46e5]' : 'border-[#29292e]'} rounded-md px-3 py-2.5 text-sm text-white transition cursor-pointer flex justify-between items-center`}
                    >
                        <span className={payeeId ? 'text-white' : 'text-gray-500'}>{selectedPayeeName}</span>
                        <svg className="w-4 h-4 text-[#8d8d99]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </div>

                    {isPayeeDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-[#202024] border border-[#29292e] rounded-md shadow-2xl overflow-hidden">
                            <div className="p-2 border-b border-[#29292e] bg-[#121214]">
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="🔍 Search database..." 
                                    value={payeeSearchQuery}
                                    onChange={(e) => setPayeeSearchQuery(e.target.value)}
                                    className="w-full bg-transparent p-2 text-sm text-white outline-none placeholder-[#3f3f46]"
                                />
                            </div>

                            <ul className="max-h-48 overflow-y-auto">
                                <li 
                                    onClick={() => { setPayeeId(''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }}
                                    className="p-3 text-sm text-[#8d8d99] hover:bg-[#4f46e5] hover:text-white cursor-pointer transition"
                                >
                                    -- Clear Selection --
                                </li>
                                {filteredPayees.length > 0 ? (
                                    filteredPayees.map(p => (
                                        <li 
                                            key={p.id}
                                            onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }}
                                            className="p-3 text-sm text-white hover:bg-[#4f46e5] cursor-pointer transition border-t border-[#29292e]/50"
                                        >
                                            {p.name}
                                        </li>
                                    ))
                                ) : (
                                    <li className="p-3 text-sm text-gray-500 text-center border-t border-[#29292e]/50">
                                        No records found. Click "+ Add New Record".
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
              </div>

              {/* SC / PWD Toggle */}
              <div className="p-3 bg-[#121214] border border-[#29292e] rounded-lg">
                <div className="flex items-center">
                    <input 
                        type="checkbox" 
                        id="scpwd" 
                        className="w-4 h-4 text-[#4f46e5] bg-gray-700 border-gray-600 rounded cursor-pointer"
                        checked={isSCPWD}
                        onChange={(e) => setIsSCPWD(e.target.checked)}
                    />
                    <label htmlFor="scpwd" className="ml-2 text-sm font-medium text-yellow-400 cursor-pointer">
                        Apply Senior Citizen / PWD Discount (20% & VAT Exempt)
                    </label>
                </div>
                {isSCPWD && (
                    <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-400 mb-1">SC / PWD ID Number (Required)</label>
                        <input type="text" required
                            placeholder="e.g., SC-1234567"
                            className="w-full bg-[#202024] border border-yellow-900/50 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 text-white"
                            value={scPwdId} onChange={(e) => setScPwdId(e.target.value)}
                        />
                    </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {['CASH', 'GCASH', 'HMO', 'CHARGE'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`cursor-pointer py-2 text-xs font-bold rounded border transition-colors ${
                        paymentMethod === method 
                        ? 'bg-[#4f46e5] border-[#4f46e5] text-white' 
                        : 'bg-[#121214] border-[#29292e] text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional HMO Fields */}
              {paymentMethod === 'HMO' && (
                <div className="p-4 bg-blue-900/10 border border-blue-900/30 rounded-lg space-y-3 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-blue-400 mb-1">HMO Provider</label>
                    <select 
                      className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white cursor-pointer"
                      value={hmoProvider} onChange={(e) => setHmoProvider(e.target.value)}
                    >
                      <option value="Maxicare">Maxicare</option>
                      <option value="Intellicare">Intellicare</option>
                      <option value="PhilHealth">PhilHealth</option>
                      <option value="Medicard">Medicard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-400 mb-1">LOA / Approval Number</label>
                    <input type="text" required
                      placeholder="Enter Auth Code"
                      className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                      value={loaNumber} onChange={(e) => setLoaNumber(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: Line Items & Checkout --- */}
        <div className="col-span-1 xl:col-span-2 flex flex-col gap-6">
          
          <div className="bg-[#202024] rounded-xl p-6 border border-[#29292e] shadow-lg flex-1">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider text-[#8d8d99]">Services & Medicines</h2>
              <button type="button" onClick={handleAddItem} className="cursor-pointer text-xs bg-[#29292e] hover:bg-gray-700 text-white px-3 py-1.5 rounded transition">
                + Add Item
              </button>
            </div>

            <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-semibold text-gray-500 uppercase px-2">
              <div className="col-span-3">Category</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-1 text-center">VAT</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-2 text-right">Price (₱)</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1 text-right"></div>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-[#121214] p-2 rounded border border-[#29292e]">
                  
                  {/* Category Dropdown */}
                  <div className="col-span-3">
                    <select 
                      className="w-full bg-transparent text-sm text-blue-400 focus:outline-none cursor-pointer"
                      value={item.accountCode} 
                      onChange={(e) => updateItem(item.id, 'accountCode', e.target.value)}
                    >
                      {Object.entries(CATEGORIES).map(([code, details]) => (
                          <option key={code} value={code} className="bg-[#121214]">{details.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3">
                    <input type="text" required placeholder="e.g., Biogesic 500mg"
                      className="w-full bg-transparent text-sm text-white focus:outline-none"
                      value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    />
                  </div>

                  <div className="col-span-1 text-center">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 text-[#4f46e5] bg-gray-700 border-gray-600 rounded cursor-pointer"
                      checked={item.isVatable}
                      onChange={(e) => updateItem(item.id, 'isVatable', e.target.checked)}
                    />
                  </div>
                  
                  <div className="col-span-1">
                    <input type="number" min="1" required
                      className="w-full bg-transparent text-sm text-white text-center focus:outline-none"
                      value={item.quantity || ''} onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" required
                      className="w-full bg-transparent text-sm text-white text-right focus:outline-none"
                      value={item.price === 0 ? '' : item.price} onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium text-gray-300">
                    {(item.quantity * item.price).toFixed(2)}
                  </div>
                  <div className="col-span-1 text-right">
                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="cursor-pointer text-red-500 hover:text-red-400 text-lg">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checkout Totals Box */}
          <div className="bg-[#202024] rounded-xl p-6 border border-[#29292e] shadow-lg">
            <div className="flex justify-between items-end gap-8">
              
              {/* BIR VAT BREAKDOWN */}
              <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-gray-400 border-r border-[#29292e] pr-8">
                  <div className="flex justify-between"><span>Vatable Sales:</span> <span>₱ {vatableSales.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>VAT Exempt Sales:</span> <span>₱ {vatExemptSales.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>VAT Amount (12%):</span> <span>₱ {vatAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Zero Rated Sales:</span> <span>₱ 0.00</span></div>
                  
                  {isSCPWD && (
                      <div className="col-span-2 flex justify-between text-yellow-400 mt-2 border-t border-[#29292e] pt-1">
                          <span className="font-bold">Less: SC/PWD Discount:</span> 
                          <span className="font-bold">- ₱ {totalDiscount.toFixed(2)}</span>
                      </div>
                  )}
              </div>
              
              <div className="w-80 flex flex-col justify-end">
                {/* Payment Tendered */}
                {(paymentMethod === 'CASH' || paymentMethod === 'GCASH') && (
                    <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-400">Cash Tendered:</span>
                        <input type="number" min="0" step="0.01"
                        className="w-32 bg-[#121214] border border-[#29292e] rounded px-3 py-1 text-sm text-right text-white focus:outline-none focus:border-[#4f46e5]"
                        value={amountTendered === 0 ? '' : amountTendered} onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Change:</span>
                        <span className={`font-mono text-lg ${change < 0 ? 'text-red-500' : 'text-green-400'}`}>
                        ₱ {change >= 0 ? change.toFixed(2) : '0.00'}
                        </span>
                    </div>
                    </div>
                )}

                {/* Grand Total */}
                <div className="text-right">
                    <p className="text-sm text-gray-400 mb-1">Total Amount Due</p>
                    <p className="text-4xl font-bold text-white tracking-tight mb-4">
                    ₱ {grandTotal.toFixed(2)}
                    </p>
                    <button type="submit" 
                      disabled={loading}
                      className={`cursor-pointer w-full text-white font-bold py-3 rounded-lg shadow-lg transition transform hover:scale-[1.02] ${
                        loading ? 'bg-[#2b2b2f] text-gray-500 cursor-not-allowed border border-[#29292e]' : 'bg-[#4f46e5] hover:bg-[#4338ca]'
                      }`}
                    >
                      {loading ? 'Processing Invoice...' : 
                        (paymentMethod === 'HMO' ? 'Submit HMO Billing' : 
                         paymentMethod === 'CHARGE' ? 'Charge to Account' : 'Generate Invoice')
                      }
                    </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </form>

      {/* ========================================== */}
      {/* ---> CONFIRMATION MODAL <--- */}
      {/* ========================================== */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-[450px] max-h-[85vh] overflow-y-auto">
             <h3 className="text-lg font-bold text-white mb-4 border-b border-[#29292e] pb-2">Confirm Transaction</h3>
             <div className="space-y-4 text-sm">
              {/* Patient Info Summary */}
              <div className="grid grid-cols-2 gap-y-2 pb-3 border-b border-[#29292e]/50">
                <span className="text-gray-400">Patient / Company:</span>
                <span className="text-white font-semibold text-right">{selectedPayeeName}</span>
                <span className="text-gray-400">Payment Method:</span>
                <span className={`font-bold text-right ${paymentMethod === 'CHARGE' ? 'text-red-400' : 'text-white'}`}>{paymentMethod}</span>
                
                {paymentMethod === 'HMO' && (
                  <>
                    <span className="text-gray-400">HMO Provider:</span>
                    <span className="text-blue-400 font-semibold text-right">{hmoProvider}</span>
                    <span className="text-gray-400">LOA Number:</span>
                    <span className="text-blue-400 font-mono text-right">{loaNumber}</span>
                  </>
                )}
                {isSCPWD && (
                  <>
                    <span className="text-yellow-400 font-bold">SC/PWD ID:</span>
                    <span className="text-yellow-400 font-mono text-right">{scPwdId}</span>
                  </>
                )}
              </div>

              {/* Items Summary */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#8d8d99] uppercase tracking-wider">Billed Items</span>
                <div className="bg-[#121214] border border-[#29292e] rounded p-3 max-h-32 overflow-y-auto space-y-1">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-300 truncate max-w-[220px]">{item.description || 'Medical Item/Service'}</span>
                      <span className="text-white font-mono">{item.quantity} x ₱{item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financials Breakdown */}
              <div className="bg-[#121214] border border-[#29292e] rounded p-4 space-y-1 text-xs">
                <div className="flex justify-between text-gray-400"><span>Vatable Sales:</span> <span>₱ {vatableSales.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-400"><span>VAT Exempt Sales:</span> <span>₱ {vatExemptSales.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-400"><span>VAT Amount (12%):</span> <span>₱ {vatAmount.toFixed(2)}</span></div>
                {isSCPWD && <div className="flex justify-between text-yellow-400"><span>Total Discount:</span> <span>- ₱ {totalDiscount.toFixed(2)}</span></div>}
                
                <div className="flex justify-between text-white font-bold text-sm border-t border-[#29292e] pt-2 mt-2">
                  <span>Total Due:</span> 
                  <span className="text-lg">₱ {grandTotal.toFixed(2)}</span>
                </div>

                {(paymentMethod === 'CASH' || paymentMethod === 'GCASH') && (
                  <>
                    <div className="flex justify-between text-gray-400 border-t border-[#29292e]/30 pt-2 mt-1">
                      <span>Cash Tendered:</span> 
                      <span>₱ {amountTendered.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Change:</span> 
                      <span>₱ {change.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
             <div className="flex justify-end space-x-3 mt-6 border-t border-[#29292e] pt-4">
              <button type="button" onClick={() => setIsConfirmOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer">Go Back</button>
              <button type="button" onClick={handleConfirmSubmit} disabled={loading} className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded text-sm font-bold transition-colors shadow-lg disabled:opacity-50 cursor-pointer">{loading ? 'Saving...' : 'Confirm & Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ---> SHIFT REPORT MODAL (X-READING) <--- */}
      {/* ========================================== */}
      {shiftReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-8 w-[400px]">
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white tracking-wide uppercase">X-Reading Report</h3>
                <p className="text-xs text-gray-400 mt-1">End of Shift Summary</p>
                <p className="text-xs text-[#4f46e5] font-mono mt-1">{new Date().toLocaleDateString()}</p>
            </div>

            <div className="space-y-4 text-sm bg-[#121214] p-4 rounded border border-[#29292e]">
                <div className="flex justify-between text-gray-400">
                    <span>Total Transactions:</span>
                    <span className="text-white font-mono">{shiftReport.transactionsCount}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                    <span>Gross Daily Sales:</span>
                    <span className="text-white font-mono">₱ {shiftReport.totalSales.toFixed(2)}</span>
                </div>
                
                <div className="border-t border-[#29292e] my-2 pt-2"></div>
                
                <div className="flex justify-between text-gray-400">
                    <span>GCash Transfers (1010):</span>
                    <span className="text-blue-400 font-mono">₱ {shiftReport.totalGCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                    <span>A/R Pending (HMO/Charge):</span>
                    <span className="text-yellow-400 font-mono">₱ {shiftReport.totalHMO.toFixed(2)}</span>
                </div>

                <div className="border-t border-[#29292e] my-2 pt-2"></div>

                <div className="flex justify-between text-emerald-400 font-bold text-base">
                    <span>Cash Collected (1020):</span>
                    <span>₱ {shiftReport.totalCash.toFixed(2)}</span>
                </div>
            </div>

            {/* ---> STRICT CASH REMITTANCE INSTRUCTION <--- */}
            <div className="bg-red-900/20 border border-red-900/50 rounded p-4 mt-6 text-center">
                <p className="text-xs text-red-400 font-bold uppercase tracking-wider mb-2">Action Required</p>
                <p className="text-sm text-gray-300">
                    Leave <strong className="text-white">₱2,000.00</strong> in the drawer. Remit exactly
                    <strong className="text-white text-xl block my-2">₱ {shiftReport.totalCash.toFixed(2)}</strong>
                    to the Manager.
                </p>
            </div>

            <button 
              type="button"
              onClick={() => setShiftReport(null)}
              className="mt-6 w-full px-4 py-3 bg-[#29292e] hover:bg-[#323238] text-white rounded text-sm font-bold transition-colors cursor-pointer border border-[#323238]"
            >
              Close Report
            </button>
          </div>
        </div>
      )}

    </div>
  );
}