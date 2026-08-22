// src/renderer/src/components/POSBillingView.tsx
import React, { useState, useEffect } from 'react';
import { NewContactModal } from './NewContactModal'; // Ensure this file exists in the same folder!

// Master list of Categories (Maps to your Chart of Accounts and sets VAT rules)
const CATEGORIES = {
  '4010': { label: '👨‍⚕️ Consultation', isVatable: false },
  '4020': { label: '🔬 Laboratory / X-Ray', isVatable: false },
  '4030': { label: '💊 Medicine / Pharmacy', isVatable: true },
  '4040': { label: '📄 Medical Certificate', isVatable: false },
};

export function POSBillingView({ userId }: { userId: string }) {
  
  // ---> PATIENT REGISTRY STATES <---
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // ---> GUARANTOR / HMO STATES <---
  const [payees, setPayees] = useState<any[]>([]);
  const [payeeId, setPayeeId] = useState('');
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('');

  // ---> NEW CONTACT MODAL STATES <---
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState('PATIENT');

  // ---> TRANSACTION STATES <---
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [hmoProvider, setHmoProvider] = useState('Maxicare');
  const [loaNumber, setLoaNumber] = useState('');

  const [isSCPWD, setIsSCPWD] = useState(false);
  const [scPwdId, setScPwdId] = useState('');

  const [items, setItems] = useState([
    { id: 1, accountCode: '4010', description: '', quantity: 1, price: 0, isVatable: false }
  ]);

  const [amountTendered, setAmountTendered] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // 1. Fetch Entities from database on load
  const loadInitialData = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI;
      
      // Load HMOs & Corporates for the Guarantor box
      const payeeData = await api.getPayees('HMO,CORPORATE');
      setPayees(payeeData || []);

      // Load Patients for the Patient box
      const patientData = await api.getPayees('PATIENT');
      setPatients(patientData || []);
    } catch (error) { 
        console.error("Failed to load initial data:", error); 
    }
  };

  useEffect(() => { 
      loadInitialData(); 
  }, []);

  // 2. What happens when the Custom Modal successfully saves a new contact
  const onContactSaved = (newId: string, newName: string) => {
      loadInitialData(); // Refresh the dropdowns
      // Auto-assign the new record to the correct box
      if (modalDefaultType === 'PATIENT') {
          setPatientId(newId);
      } else {
          setPayeeId(newId);
      }
      setStatus({ type: 'success', msg: `Successfully added ${newName} to the directory!` });
  };

  // --- ITEM FUNCTIONS ---
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
        // Auto-update VAT status if category changes
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

  const change = (Number(amountTendered) || 0) - grandTotal;

  // Render Selected Names
  const selectedPatientName = patients.find(p => p.id === patientId)?.name || '-- Select Patient --';
  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()));

  const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '-- Select Guarantor / Entity --';
  const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));

  // ==========================================
  // ---> STEP 1: VALIDATION <---
  // ==========================================
  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault(); 
    setStatus(null);

    if (!userId) return setStatus({ type: 'error', msg: "Developer Error: 'userId' is undefined!" });
    if (!patientId) return setStatus({ type: 'error', msg: "Please select a Patient from the registry." });
    if ((paymentMethod === 'HMO' || paymentMethod === 'CHARGE') && !payeeId) return setStatus({ type: 'error', msg: `A Guarantor must be selected for ${paymentMethod}!` });
    if (items.length === 0 || grandTotal === 0) return setStatus({ type: 'error', msg: "Please add at least one item." });
    if (paymentMethod === 'HMO' && !loaNumber.trim()) return setStatus({ type: 'error', msg: "HMO LOA Number is required!" });
    if (isSCPWD && !scPwdId.trim()) return setStatus({ type: 'error', msg: "SC/PWD ID is required!" });
    if ((paymentMethod === 'CASH' || paymentMethod === 'GCASH') && (Number(amountTendered) || 0) < grandTotal) return setStatus({ type: 'error', msg: "Amount tendered is less than total!" });
    
    setIsConfirmOpen(true);
  };

  // ==========================================
  // ---> STEP 2: ACTUAL DATABASE SUBMIT <---
  // ==========================================
  const handleConfirmSubmit = async () => {
    try {
      setLoading(true);
      const lines: any[] = [];
      let debitAccount = '1010'; 
      
      if (paymentMethod === 'HMO' || paymentMethod === 'CHARGE') debitAccount = '1200';
      else if (paymentMethod === 'CASH') debitAccount = '1020';

      // 1. DEBIT
      lines.push({ accountId: debitAccount, debit: grandTotal, credit: 0 });

      // 2. CREDIT REVENUE
      items.forEach(item => {
        const lineTotal = item.quantity * item.price;
        let revenueAmount = lineTotal;
        if (isSCPWD) {
           const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal;
           revenueAmount = netOfVat * 0.80; 
        } else if (item.isVatable) revenueAmount = lineTotal / 1.12;
        lines.push({ accountId: item.accountCode, debit: 0, credit: revenueAmount });
      });

      // 3. CREDIT OUTPUT VAT
      if (vatAmount > 0 && !isSCPWD) lines.push({ accountId: '2020', debit: 0, credit: vatAmount });

      // Build the Description (Includes Patient AND Guarantor)
      const finalPayeeId = payeeId || patientId; 
      const description = `Patient: ${selectedPatientName} | Billed To: ${payeeId ? selectedPayeeName : 'Self'} (${paymentMethod})${paymentMethod === 'HMO' ? ` LOA: ${loaNumber}` : ''}`;
      
      const entryData = {
        date: new Date().toISOString(),
        referenceNo: `INV-${Date.now()}`,
        description: description,
        vatType: vatAmount > 0 ? 'VATABLE' : 'EXEMPT',
        userId: userId,
        payeeId: finalPayeeId, 
        lines: lines
      };

      const api = (window as any).api || (window as any).electronAPI;
      const response = await api.submitJournalEntry(entryData);

      if (response && response.success === false) {
          setStatus({ type: 'error', msg: "Database Error: " + response.error });
          setIsConfirmOpen(false);
          return;
      }

      setStatus({ type: 'success', msg: `Invoice ${entryData.referenceNo} saved to Database! Billed ₱${grandTotal.toFixed(2)}.` });
      
      // Reset Form
      setPatientId(''); 
      setPayeeId('');
      setItems([{ id: Date.now(), accountCode: '4010', description: '', quantity: 1, price: 0, isVatable: false }]);
      setAmountTendered(''); 
      setLoaNumber(''); 
      setIsSCPWD(false); 
      setScPwdId(''); 
      setIsConfirmOpen(false); 
      setPaymentMethod('CASH');

    } catch (error: any) { 
        setStatus({ type: 'error', msg: "System Error: Could not connect to database." }); 
    } finally { 
        setLoading(false); 
        setIsConfirmOpen(false); 
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#121214] text-gray-200 font-sans relative">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Patient Billing & POS</h1>
          <p className="text-sm text-gray-400">Generate BIR EOPT-Compliant invoices and process payments.</p>
        </div>
      </div>

      {status && (
          <div className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
              {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
          </div>
      )}

      <form onSubmit={handleCheckout} className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* --- LEFT COLUMN: Transaction Details --- */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="bg-[#202024] rounded-xl p-6 border border-[#29292e] shadow-lg">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-[#8d8d99]">Transaction Details</h2>
            
            <div className="space-y-4">
              
              {/* ---> PATIENT DATABASE SEARCH <--- */}
              <div className="relative">
                <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs font-medium text-gray-400">Patient Name (Clinical Record)</label>
                    <button 
                        type="button" 
                        onClick={() => { setModalDefaultType('PATIENT'); setIsContactModalOpen(true); }} 
                        className="text-xs font-bold text-[#4f46e5] hover:text-[#5b54f6] transition hover:underline cursor-pointer"
                    >
                        + New Patient
                    </button>
                </div>

                <div className="relative mt-2">
                    <div onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)} className={`w-full bg-[#121214] border ${isPatientDropdownOpen ? 'border-[#4f46e5]' : 'border-[#29292e]'} rounded-md px-3 py-2.5 text-sm text-white transition cursor-pointer flex justify-between items-center`}>
                        <span className={patientId ? 'text-white font-bold' : 'text-gray-500'}>{selectedPatientName}</span>
                        <svg className="w-4 h-4 text-[#8d8d99]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </div>
                    {isPatientDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-[#202024] border border-[#29292e] rounded-md shadow-2xl overflow-hidden">
                            <div className="p-2 border-b border-[#29292e] bg-[#121214]">
                                <input type="text" autoFocus placeholder="🔍 Search patient registry..." value={patientSearchQuery} onChange={(e) => setPatientSearchQuery(e.target.value)} className="w-full bg-transparent p-2 text-sm text-white outline-none placeholder-[#3f3f46]" />
                            </div>
                            <ul className="max-h-48 overflow-y-auto">
                                <li onClick={() => { setPatientId(''); setIsPatientDropdownOpen(false); setPatientSearchQuery(''); }} className="p-3 text-sm text-[#8d8d99] hover:bg-[#4f46e5] hover:text-white cursor-pointer transition">-- Clear Selection --</li>
                                {filteredPatients.map(p => (
                                    <li key={p.id} onClick={() => { setPatientId(p.id); setIsPatientDropdownOpen(false); setPatientSearchQuery(''); }} className="p-3 text-sm text-white hover:bg-[#4f46e5] cursor-pointer transition border-t border-[#29292e]/50">
                                        {p.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
              </div>

              {/* SC / PWD Toggle */}
              <div className="p-3 bg-[#121214] border border-[#29292e] rounded-lg">
                <div className="flex items-center">
                    <input type="checkbox" id="scpwd" className="w-4 h-4 text-[#4f46e5] bg-gray-700 border-gray-600 rounded cursor-pointer" checked={isSCPWD} onChange={(e) => setIsSCPWD(e.target.checked)} />
                    <label htmlFor="scpwd" className="ml-2 text-sm font-medium text-yellow-400 cursor-pointer">Apply SC / PWD Discount</label>
                </div>
                {isSCPWD && (
                    <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-400 mb-1">ID Number (Required)</label>
                        <input type="text" required placeholder="e.g., SC-1234567" className="w-full bg-[#202024] border border-yellow-900/50 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 text-white" value={scPwdId} onChange={(e) => setScPwdId(e.target.value)} />
                    </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {['CASH', 'GCASH', 'HMO', 'CHARGE'].map((method) => (
                    <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`cursor-pointer py-2 text-xs font-bold rounded border transition-colors ${paymentMethod === method ? 'bg-[#4f46e5] border-[#4f46e5] text-white' : 'bg-[#121214] border-[#29292e] text-gray-400 hover:border-gray-500'}`}>{method}</button>
                  ))}
                </div>
              </div>

              {/* ---> DYNAMIC GUARANTOR BOX (Only required for A/R) <--- */}
              {(paymentMethod === 'HMO' || paymentMethod === 'CHARGE') && (
                <div className="p-4 bg-blue-900/10 border border-blue-900/30 rounded-lg space-y-4 mt-2">
                  <div className="relative">
                    <div className="flex justify-between items-end mb-1">
                        <label className="block text-xs font-bold text-blue-400 uppercase">Billed To / Guarantor</label>
                        <button 
                            type="button" 
                            onClick={() => { setModalDefaultType('HMO'); setIsContactModalOpen(true); }} 
                            className="text-xs font-bold text-[#4f46e5] hover:text-[#5b54f6] transition hover:underline cursor-pointer"
                        >
                            + Add New Entity
                        </button>
                    </div>

                    <div className="relative mt-2">
                        <div onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)} className={`w-full bg-[#121214] border ${isPayeeDropdownOpen ? 'border-[#4f46e5]' : 'border-[#29292e]'} rounded-md px-3 py-2.5 text-sm text-white transition cursor-pointer flex justify-between items-center`}>
                            <span className={payeeId ? 'text-white font-bold' : 'text-gray-500'}>{selectedPayeeName}</span>
                            <svg className="w-4 h-4 text-[#8d8d99]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </div>
                        {isPayeeDropdownOpen && (
                            <div className="absolute z-20 w-full mt-1 bg-[#202024] border border-[#29292e] rounded-md shadow-2xl overflow-hidden">
                                <div className="p-2 border-b border-[#29292e] bg-[#121214]">
                                    <input type="text" autoFocus placeholder="🔍 Search database..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-transparent p-2 text-sm text-white outline-none placeholder-[#3f3f46]" />
                                </div>
                                <ul className="max-h-48 overflow-y-auto">
                                    <li onClick={() => { setPayeeId(''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-[#8d8d99] hover:bg-[#4f46e5] hover:text-white cursor-pointer transition">-- Clear Selection --</li>
                                    {filteredPayees.map(p => (
                                        <li key={p.id} onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-white hover:bg-[#4f46e5] cursor-pointer transition border-t border-[#29292e]/50">
                                            {p.name} <span className="text-[9px] ml-2 text-gray-500 uppercase">{p.type}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                  </div>

                  {paymentMethod === 'HMO' && (
                    <div>
                        <label className="block text-xs font-medium text-blue-400 mb-1">LOA / Approval Number</label>
                        <input type="text" required placeholder="Enter Auth Code" className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white" value={loaNumber} onChange={(e) => setLoaNumber(e.target.value)} />
                    </div>
                  )}
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
              <button type="button" onClick={handleAddItem} className="cursor-pointer text-xs bg-[#29292e] hover:bg-gray-700 text-white px-3 py-1.5 rounded transition">+ Add Item</button>
            </div>

            <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-semibold text-gray-500 uppercase px-2">
              <div className="col-span-3">Category</div><div className="col-span-3">Description</div><div className="col-span-1 text-center">VAT</div><div className="col-span-1 text-center">Qty</div><div className="col-span-2 text-right">Price (₱)</div><div className="col-span-1 text-right">Total</div><div className="col-span-1 text-right"></div>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-[#121214] p-2 rounded border border-[#29292e]">
                  <div className="col-span-3">
                    <select className="w-full bg-transparent text-sm text-blue-400 focus:outline-none cursor-pointer" value={item.accountCode} onChange={(e) => updateItem(item.id, 'accountCode', e.target.value)}>
                      {Object.entries(CATEGORIES).map(([code, details]) => (<option key={code} value={code} className="bg-[#121214]">{details.label}</option>))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input type="text" required placeholder="e.g., Biogesic 500mg" className="w-full bg-transparent text-sm text-white focus:outline-none" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} />
                  </div>
                  <div className="col-span-1 text-center">
                    <input type="checkbox" className="w-4 h-4 text-[#4f46e5] bg-gray-700 border-gray-600 rounded cursor-pointer" checked={item.isVatable} onChange={(e) => updateItem(item.id, 'isVatable', e.target.checked)} />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min="1" required className="w-full bg-transparent text-sm text-white text-center focus:outline-none" value={item.quantity || ''} onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" required className="w-full bg-transparent text-sm text-white text-right focus:outline-none" value={item.price === 0 ? '' : item.price} onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium text-gray-300">{(item.quantity * item.price).toFixed(2)}</div>
                  <div className="col-span-1 text-right">
                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="cursor-pointer text-red-500 hover:text-red-400 text-lg">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#202024] rounded-xl p-6 border border-[#29292e] shadow-lg">
            <div className="flex justify-between items-end gap-8">
              <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-gray-400 border-r border-[#29292e] pr-8">
                  <div className="flex justify-between"><span>Vatable Sales:</span> <span>₱ {vatableSales.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>VAT Exempt Sales:</span> <span>₱ {vatExemptSales.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>VAT Amount (12%):</span> <span>₱ {vatAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Zero Rated Sales:</span> <span>₱ 0.00</span></div>
                  {isSCPWD && (<div className="col-span-2 flex justify-between text-yellow-400 mt-2 border-t border-[#29292e] pt-1"><span className="font-bold">Less: SC/PWD Discount:</span><span className="font-bold">- ₱ {totalDiscount.toFixed(2)}</span></div>)}
              </div>
              
              <div className="w-80 flex flex-col justify-end">
                {(paymentMethod === 'CASH' || paymentMethod === 'GCASH') && (
                    <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-400">Cash Tendered:</span>
                        <input type="number" min="0" step="0.01" className="w-32 bg-[#121214] border border-[#29292e] rounded px-3 py-1 text-sm text-right text-white focus:outline-none focus:border-[#4f46e5]" value={amountTendered === 0 ? '' : amountTendered} onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Change:</span>
                        <span className={`font-mono text-lg ${change < 0 ? 'text-red-500' : 'text-green-400'}`}>₱ {change >= 0 ? change.toFixed(2) : '0.00'}</span>
                    </div>
                    </div>
                )}

                <div className="text-right">
                    <p className="text-sm text-gray-400 mb-1">Total Amount Due</p>
                    <p className="text-4xl font-bold text-white tracking-tight mb-4">₱ {grandTotal.toFixed(2)}</p>
                    <button type="submit" disabled={loading} className={`cursor-pointer w-full text-white font-bold py-3 rounded-lg shadow-lg transition transform hover:scale-[1.02] ${loading ? 'bg-[#2b2b2f] text-gray-500 cursor-not-allowed border border-[#29292e]' : 'bg-[#4f46e5] hover:bg-[#4338ca]'}`}>
                      {loading ? 'Processing...' : (paymentMethod === 'HMO' ? 'Submit HMO Billing' : paymentMethod === 'CHARGE' ? 'Charge to Account' : 'Generate Invoice')}
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* CONFIRMATION MODAL */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-[450px] max-h-[85vh] overflow-y-auto">
             <h3 className="text-lg font-bold text-white mb-4 border-b border-[#29292e] pb-2">Confirm Transaction</h3>
             <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-y-2 pb-3 border-b border-[#29292e]/50">
                <span className="text-gray-400">Patient:</span><span className="text-white font-semibold text-right">{selectedPatientName}</span>
                <span className="text-gray-400">Payment Method:</span><span className={`font-bold text-right ${paymentMethod === 'CHARGE' ? 'text-red-400' : 'text-white'}`}>{paymentMethod}</span>
                
                {(paymentMethod === 'HMO' || paymentMethod === 'CHARGE') && (
                    <>
                        <span className="text-blue-400 font-bold uppercase text-[10px] tracking-wider mt-2">Billed To (A/R)</span>
                        <span className="text-blue-400 font-bold text-right mt-2">{selectedPayeeName}</span>
                    </>
                )}
                
                {paymentMethod === 'HMO' && (
                  <>
                    <span className="text-gray-400">HMO Provider:</span><span className="text-blue-400 font-semibold text-right">{hmoProvider}</span>
                    <span className="text-gray-400">LOA Number:</span><span className="text-blue-400 font-mono text-right">{loaNumber}</span>
                  </>
                )}
                {isSCPWD && (
                  <>
                    <span className="text-yellow-400 font-bold">SC/PWD ID:</span><span className="text-yellow-400 font-mono text-right">{scPwdId}</span>
                  </>
                )}
              </div>
              <div className="space-y-2"><span className="text-xs font-bold text-[#8d8d99] uppercase tracking-wider">Billed Items</span><div className="bg-[#121214] border border-[#29292e] rounded p-3 max-h-32 overflow-y-auto space-y-1">{items.map((item, idx) => (<div key={idx} className="flex justify-between text-xs"><span className="text-gray-300 truncate max-w-[220px]">{item.description || 'Medical Item/Service'}</span><span className="text-white font-mono">{item.quantity} x ₱{item.price.toFixed(2)}</span></div>))}</div></div>
              <div className="bg-[#121214] border border-[#29292e] rounded p-4 space-y-1 text-xs"><div className="flex justify-between text-white font-bold text-sm"><span>Total Due:</span><span className="text-lg">₱ {grandTotal.toFixed(2)}</span></div></div>
            </div>
             <div className="flex justify-end space-x-3 mt-6 border-t border-[#29292e] pt-4">
              <button type="button" onClick={() => setIsConfirmOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer">Go Back</button>
              <button type="button" onClick={handleConfirmSubmit} disabled={loading} className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded text-sm font-bold transition-colors shadow-lg disabled:opacity-50 cursor-pointer">Confirm & Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ---> INJECT THE NEW CRM POPUP HERE! <--- */}
      <NewContactModal 
          isOpen={isContactModalOpen} 
          onClose={() => setIsContactModalOpen(false)} 
          onSaveSuccess={onContactSaved} 
          defaultType={modalDefaultType} 
      />

    </div>
  );
}