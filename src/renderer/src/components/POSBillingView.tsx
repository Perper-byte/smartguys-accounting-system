// src/renderer/src/components/POSBillingView.tsx
import React, { useState, useEffect } from 'react';
import { NewContactModal } from './NewContactModal'; 

export function POSBillingView({ userId }: { userId: string }) {
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  const [payees, setPayees] = useState<any[]>([]);
  const [payeeId, setPayeeId] = useState('');
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('');

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState('PATIENT');

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [hmoProvider, setHmoProvider] = useState('Maxicare');
  const [loaNumber, setLoaNumber] = useState('');
  const [manualInvoiceNo, setManualInvoiceNo] = useState('');
  const [isSCPWD, setIsSCPWD] = useState(false);
  const [scPwdId, setScPwdId] = useState('');

  const [labTests, setLabTests] = useState<any[]>([]);
  
  // 🔥 NEW: Dynamic Revenue Categories State
  const [revenueAccounts, setRevenueAccounts] = useState<any[]>([]);

  const [items, setItems] = useState([
    { id: 1, accountCode: '', description: '', quantity: 1, price: 500, isVatable: false }
  ]);
  
  const [activeLabRow, setActiveLabRow] = useState<number | null>(null);

  const [amountTendered, setAmountTendered] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const loadInitialData = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI;
      const payeeData = await api.getPayees('HMO,CORPORATE');
      setPayees(payeeData || []);
      const patientData = await api.getPayees('PATIENT');
      setPatients(patientData || []);
      
      // Load Database Procedures
      if (api.getServiceItems) {
          const itemsData = await api.getServiceItems();
          setLabTests(itemsData || []);
      }

      // 🔥 DYNAMIC FILTER: Pull Revenue Accounts from DB for the Categories
      if (api.getAccounts) {
          const accData = await api.getAccounts();
          const revAccounts = accData.filter((a: any) => a.account_type?.name === 'Revenue');
          setRevenueAccounts(revAccounts);
          
          // Auto-set the first row to the default Consultation (4010) if available
          if (revAccounts.length > 0) {
              setItems([{ id: 1, accountCode: revAccounts.find(a => a.code === '4010')?.code || revAccounts[0].code, description: '', quantity: 1, price: 500, isVatable: false }]);
          }
      }
    } catch (error) { 
        console.error("Failed to load initial data:", error); 
    }
  };

  useEffect(() => { loadInitialData(); }, []);

  const onContactSaved = (newId: string, newName: string) => {
      loadInitialData(); 
      if (modalDefaultType === 'PATIENT') setPatientId(newId);
      else setPayeeId(newId);
      setStatus({ type: 'success', msg: `Successfully added ${newName} to the directory!` });
      setTimeout(() => setStatus(null), 3000);
  };

  const handleAddItem = () => {
      const defaultCode = revenueAccounts.find(a => a.code === '4010')?.code || (revenueAccounts.length > 0 ? revenueAccounts[0].code : '');
      setItems([...items, { id: Date.now(), accountCode: defaultCode, description: '', quantity: 1, price: 500, isVatable: false }]);
  };

  const handleRemoveItem = (id: number) => {
      setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        if (field === 'accountCode') {
            updatedItem.description = ''; 
            
            // Snap to 500 if Consultation, otherwise let them type it
            if (value === '4010') {
                updatedItem.price = 500;
            } else {
                updatedItem.price = 0;
            }
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

  const selectedPatientName = patients.find(p => p.id === patientId)?.name || '-- Select Patient --';
  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()));

  const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '-- Select Guarantor / Entity --';
  const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault(); 
    setStatus(null);

    if (!userId) return setStatus({ type: 'error', msg: "Developer Error: 'userId' is undefined!" });
    if (!patientId) return setStatus({ type: 'error', msg: "Please select a Patient from the registry." });
    if ((paymentMethod === 'HMO' || paymentMethod === 'CHARGE') && !payeeId) return setStatus({ type: 'error', msg: `A Guarantor must be selected for ${paymentMethod}!` });
    if (items.length === 0 || grandTotal === 0) return setStatus({ type: 'error', msg: "Please add at least one valid item." });
    if (paymentMethod === 'HMO' && !loaNumber.trim()) return setStatus({ type: 'error', msg: "HMO LOA Number is required!" });
    if (isSCPWD && !scPwdId.trim()) return setStatus({ type: 'error', msg: "SC/PWD ID is required!" });
    if ((paymentMethod === 'CASH' || paymentMethod === 'GCASH') && (Number(amountTendered) || 0) < grandTotal) return setStatus({ type: 'error', msg: "Amount tendered is less than total!" });
    
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setLoading(true);
      const lines: any[] = [];
      let debitAccount = '1010'; 
      
      if (paymentMethod === 'HMO' || paymentMethod === 'CHARGE') debitAccount = '1200';
      else if (paymentMethod === 'CASH') debitAccount = '1020';

      lines.push({ accountId: debitAccount, debit: grandTotal, credit: 0 });

      items.forEach(item => {
        const lineTotal = item.quantity * item.price;
        let revenueAmount = lineTotal;
        if (isSCPWD) {
           const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal;
           revenueAmount = netOfVat * 0.80; 
        } else if (item.isVatable) revenueAmount = lineTotal / 1.12;
        lines.push({ accountId: item.accountCode, debit: 0, credit: revenueAmount });
      });

      if (vatAmount > 0 && !isSCPWD) lines.push({ accountId: '2020', debit: 0, credit: vatAmount });

      const finalPayeeId = payeeId || patientId; 
      const description = `Patient: ${selectedPatientName} | Billed To: ${payeeId ? selectedPayeeName : 'Self'} (${paymentMethod})${paymentMethod === 'HMO' ? ` LOA: ${loaNumber}` : ''}`;
      
      const finalReferenceNo = manualInvoiceNo.trim() ? manualInvoiceNo.trim() : `SYS-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;
      
      const entryData = {
        date: new Date().toISOString(),
        referenceNo: finalReferenceNo,
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
      
      setPatientId(''); setPayeeId('');
      
      // Reset items back to Consultation
      const defaultCode = revenueAccounts.find(a => a.code === '4010')?.code || (revenueAccounts.length > 0 ? revenueAccounts[0].code : '');
      setItems([{ id: Date.now(), accountCode: defaultCode, description: '', quantity: 1, price: 500, isVatable: false }]);
      
      setAmountTendered(''); setLoaNumber(''); setIsSCPWD(false); setScPwdId(''); setIsConfirmOpen(false); setPaymentMethod('CASH');
      setManualInvoiceNo('');

      setTimeout(() => setStatus(null), 5000);

    } catch (error: any) { 
        setStatus({ type: 'error', msg: "System Error: Could not connect to database." }); 
    } finally { 
        setLoading(false); 
        setIsConfirmOpen(false); 
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#FBF8F8] text-gray-800 font-sans relative max-w-7xl mx-auto animate-in fade-in duration-300">
      
      <div className="mb-6 flex justify-between items-center border-b border-[#B0DCDA] pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-wide">Patient Billing & POS</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Generate BIR EOPT-Compliant invoices and process payments.</p>
        </div>
      </div>

      {status && (
          <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
              {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
          </div>
      )}

      <form onSubmit={handleCheckout} className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* --- LEFT COLUMN: Transaction Details --- */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-xl p-6 border border-[#B0DCDA] shadow-sm">
            <h2 className="text-sm font-extrabold text-[#1B9387] mb-5 uppercase tracking-wider border-b border-gray-100 pb-2">Transaction Details</h2>
            
            <div className="space-y-5">
              
              {/* PATIENT REGISTRY */}
              <div className="relative">
                <div className="flex justify-between items-end mb-1.5">
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Patient Name (Clinical Record)</label>
                    <button type="button" onClick={() => { setModalDefaultType('PATIENT'); setIsContactModalOpen(true); }} className="text-[10px] font-extrabold text-[#1B9387] hover:text-[#28958B] transition uppercase tracking-wider cursor-pointer bg-[#E9FAFA] px-2 py-0.5 rounded border border-[#B0DCDA]">
                        + New Patient
                    </button>
                </div>

                <div className="relative">
                    <div onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)} className={`w-full bg-[#FBF8F8] border ${isPatientDropdownOpen ? 'border-[#1B9387] ring-2 ring-[#E9FAFA]' : 'border-[#B0DCDA]'} rounded-md px-3 py-2.5 text-sm transition cursor-pointer flex justify-between items-center`}>
                        <span className={patientId ? 'text-gray-800 font-bold' : 'text-gray-400 font-medium'}>{selectedPatientName}</span>
                        <svg className="w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </div>
                    {isPatientDropdownOpen && (
                        <div className="absolute z-30 w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden">
                            <div className="p-2 border-b border-[#B0DCDA] bg-gray-50">
                                <input type="text" autoFocus placeholder="🔍 Search patient registry..." value={patientSearchQuery} onChange={(e) => setPatientSearchQuery(e.target.value)} className="w-full bg-transparent p-2 text-sm text-gray-800 outline-none placeholder-gray-400" />
                            </div>
                            <ul className="max-h-48 overflow-y-auto">
                                <li onClick={() => { setPatientId(''); setIsPatientDropdownOpen(false); setPatientSearchQuery(''); }} className="p-3 text-sm text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition font-medium">-- Clear Selection --</li>
                                {filteredPatients.map(p => (
                                    <li key={p.id} onClick={() => { setPatientId(p.id); setIsPatientDropdownOpen(false); setPatientSearchQuery(''); }} className="p-3 text-sm text-gray-800 font-medium hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-t border-gray-100">
                                        {p.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
              </div>

              {/* SC / PWD Toggle */}
              <div className="p-4 bg-[#FBF8F8] border border-[#B0DCDA] rounded-lg shadow-inner">
                <div className="flex items-center">
                    <input type="checkbox" id="scpwd" className="w-4 h-4 text-[#1B9387] bg-white border-[#B0DCDA] rounded cursor-pointer focus:ring-[#1B9387]" checked={isSCPWD} onChange={(e) => setIsSCPWD(e.target.checked)} />
                    <label htmlFor="scpwd" className="ml-2 text-sm font-bold text-amber-500 cursor-pointer">Apply SC / PWD Discount</label>
                </div>
                {isSCPWD && (
                    <div className="mt-3">
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">ID Number (Required)</label>
                        <input type="text" required placeholder="e.g., SC-1234567" className="w-full bg-white border border-[#B0DCDA] rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA]" value={scPwdId} onChange={(e) => setScPwdId(e.target.value)} />
                    </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                    Official Receipt / Invoice No. (Optional)
                </label>
                <input 
                    type="text" 
                    placeholder="Leave blank to auto-generate" 
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm text-gray-800 font-mono font-bold focus:outline-none focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA]" 
                    value={manualInvoiceNo} 
                    onChange={(e) => setManualInvoiceNo(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {['CASH', 'GCASH', 'HMO', 'CHARGE'].map((method) => (
                    <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`cursor-pointer py-2 text-xs font-bold rounded-md border transition-colors shadow-sm ${paymentMethod === method ? 'bg-[#1B9387] border-transparent text-white' : 'bg-white border-[#B0DCDA] text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387]'}`}>{method}</button>
                  ))}
                </div>
              </div>

              {/* GUARANTOR BOX (Only required for A/R) */}
              {(paymentMethod === 'HMO' || paymentMethod === 'CHARGE') && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4 shadow-inner">
                  <div className="relative">
                    <div className="flex justify-between items-end mb-1">
                        <label className="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">Billed To / Guarantor</label>
                        <button type="button" onClick={() => { setModalDefaultType('HMO'); setIsContactModalOpen(true); }} className="text-[10px] font-extrabold text-blue-600 bg-white border border-blue-200 hover:bg-blue-100 transition uppercase tracking-wider cursor-pointer px-2 py-0.5 rounded shadow-sm">
                            + Add New Entity
                        </button>
                    </div>

                    <div className="relative mt-2">
                        <div onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)} className={`w-full bg-white border ${isPayeeDropdownOpen ? 'border-blue-400 ring-2 ring-blue-100' : 'border-blue-200'} rounded-md px-3 py-2.5 text-sm transition cursor-pointer flex justify-between items-center`}>
                            <span className={payeeId ? 'text-gray-800 font-bold' : 'text-gray-400 font-medium'}>{selectedPayeeName}</span>
                            <svg className="w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </div>
                        {isPayeeDropdownOpen && (
                            <div className="absolute z-20 w-full mt-1 bg-white border border-blue-200 rounded-md shadow-xl overflow-hidden">
                                <div className="p-2 border-b border-blue-100 bg-blue-50">
                                    <input type="text" autoFocus placeholder="🔍 Search database..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-transparent p-2 text-sm text-gray-800 outline-none placeholder-gray-400" />
                                </div>
                                <ul className="max-h-48 overflow-y-auto">
                                    <li onClick={() => { setPayeeId(''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-gray-500 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition font-medium">-- Clear Selection --</li>
                                    {filteredPayees.map(p => (
                                        <li key={p.id} onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-gray-800 font-medium hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition border-t border-gray-100">
                                            {p.name} <span className="text-[9px] ml-2 text-blue-400 uppercase font-bold">{p.type}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                  </div>

                  {paymentMethod === 'HMO' && (
                    <div>
                        <label className="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider mb-1">LOA / Approval Number</label>
                        <input type="text" required placeholder="Enter Auth Code" className="w-full bg-white border border-blue-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-gray-800 font-mono font-bold shadow-sm" value={loaNumber} onChange={(e) => setLoaNumber(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: Line Items & Checkout --- */}
        <div className="col-span-1 xl:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-xl p-6 border border-[#B0DCDA] shadow-sm flex-1">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-2">
              <h2 className="text-sm font-extrabold text-[#1B9387] uppercase tracking-wider">Services & Medicines</h2>
              <button type="button" onClick={handleAddItem} className="cursor-pointer text-[10px] font-extrabold uppercase tracking-wider bg-white border border-[#B0DCDA] text-gray-600 hover:text-[#1B9387] hover:bg-[#E9FAFA] px-3 py-1.5 rounded-md transition shadow-sm">+ Add Item</button>
            </div>

            <div className="grid grid-cols-12 gap-2 mb-2 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider px-2">
              <div className="col-span-3">Category</div>
              <div className="col-span-3">Description / Test Name</div>
              <div className="col-span-1 text-center">VAT</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-2 text-right">Price (₱)</div>
              <div className="col-span-2 text-right pr-6">Total</div>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-[#FBF8F8] p-2 rounded-lg border border-[#B0DCDA] shadow-sm">
                  
                  {/* 🔥 DYNAMIC REVENUE DROPDOWN */}
                  <div className="col-span-3">
                    <select className="w-full bg-transparent text-xs font-bold text-[#1B9387] focus:outline-none cursor-pointer" value={item.accountCode} onChange={(e) => updateItem(item.id, 'accountCode', e.target.value)}>
                      {revenueAccounts.map(acc => (<option key={acc.code} value={acc.code} className="bg-white text-gray-800 font-medium">{acc.name}</option>))}
                    </select>
                  </div>
                  
                  <div className="col-span-3 relative border-l border-gray-200 pl-2">
                    <input 
                        type="text" 
                        required 
                        placeholder={item.accountCode === '4020' ? "🔍 Search Lab Test..." : "e.g., Annual Checkup"} 
                        className={`w-full bg-transparent text-sm font-medium focus:outline-none ${item.accountCode === '4020' ? 'text-[#1B9387]' : 'text-gray-800'}`} 
                        value={item.description} 
                        onChange={(e) => {
                            updateItem(item.id, 'description', e.target.value);
                            if (item.accountCode === '4020') setActiveLabRow(item.id);
                        }} 
                        onFocus={() => { if (item.accountCode === '4020') setActiveLabRow(item.id); }}
                        onBlur={() => setTimeout(() => setActiveLabRow(null), 200)}
                    />
                    {activeLabRow === item.id && item.accountCode === '4020' && (
                        <ul className="absolute z-50 left-0 top-full mt-2 w-[350px] bg-white border border-[#1B9387] rounded-md shadow-2xl max-h-64 overflow-y-auto">
                            <li className="p-2 bg-[#E9FAFA] border-b border-[#B0DCDA] text-[10px] font-extrabold text-[#1B9387] uppercase tracking-wider sticky top-0">Clinic Master List</li>
                            {labTests.filter(t => t.name.toLowerCase().includes(item.description.toLowerCase()) || t.category.toLowerCase().includes(item.description.toLowerCase())).map((test, i) => (
                                <li 
                                    key={i} 
                                    onMouseDown={() => {
                                        const newItems = [...items];
                                        const targetIndex = newItems.findIndex(l => l.id === item.id);
                                        newItems[targetIndex].description = test.name;
                                        if (test.price > 0) newItems[targetIndex].price = test.price;
                                        setItems(newItems);
                                        setActiveLabRow(null);
                                    }}
                                    className="p-3 text-sm text-gray-800 hover:bg-[#E9FAFA] cursor-pointer transition border-b border-gray-50 flex justify-between items-center group"
                                >
                                    <div>
                                        <span className="font-bold group-hover:text-[#1B9387]">{test.name}</span>
                                        <span className="block text-[10px] text-gray-400 uppercase font-bold mt-0.5">{test.category}</span>
                                    </div>
                                    {test.price > 0 && <span className="font-mono text-[#1B9387] font-bold">₱{test.price.toLocaleString()}</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                  </div>

                  <div className="col-span-1 text-center border-l border-gray-200">
                    <input type="checkbox" className="w-4 h-4 text-[#1B9387] bg-white border-gray-300 rounded cursor-pointer focus:ring-[#1B9387]" checked={item.isVatable} onChange={(e) => updateItem(item.id, 'isVatable', e.target.checked)} />
                  </div>
                  <div className="col-span-1 border-l border-gray-200">
                    <input type="number" min="1" required className="w-full bg-transparent text-sm text-gray-800 font-bold text-center focus:outline-none" value={item.quantity || ''} onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2 border-l border-gray-200 pl-1 pr-1">
                    <input type="number" min="0" step="0.01" required className="w-full bg-transparent text-sm text-gray-800 font-mono font-bold text-right focus:outline-none" value={item.price === 0 ? '' : item.price} onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)} />
                  </div>
                  
                  <div className="col-span-2 flex justify-end items-center space-x-3 border-l border-gray-200 pl-3 pr-2">
                    <span className="text-sm font-bold font-mono text-gray-600">{(item.quantity * item.price).toFixed(2)}</span>
                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="cursor-pointer text-gray-300 hover:text-red-500 transition text-lg font-bold">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-[#B0DCDA] shadow-sm">
            <div className="flex justify-between items-end gap-8">
              <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-bold text-gray-500 border-r border-gray-200 pr-8">
                  <div className="flex justify-between"><span>Vatable Sales:</span> <span className="font-mono">₱ {vatableSales.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>VAT Exempt Sales:</span> <span className="font-mono">₱ {vatExemptSales.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[#1B9387]"><span>VAT Amount (12%):</span> <span className="font-mono">₱ {vatAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Zero Rated Sales:</span> <span className="font-mono">₱ 0.00</span></div>
                  {isSCPWD && (<div className="col-span-2 flex justify-between text-amber-500 mt-2 border-t border-gray-100 pt-2"><span className="font-extrabold uppercase">Less: SC/PWD Discount:</span><span className="font-mono font-bold">- ₱ {totalDiscount.toFixed(2)}</span></div>)}
              </div>
              
              <div className="w-80 flex flex-col justify-end">
                {(paymentMethod === 'CASH' || paymentMethod === 'GCASH') && (
                    <div className="mb-4 bg-[#FBF8F8] p-3 rounded-lg border border-[#B0DCDA] shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cash Tendered:</span>
                            <input type="number" min="0" step="0.01" className="w-32 bg-white border border-[#B0DCDA] rounded px-3 py-1.5 text-sm text-right font-mono font-bold text-gray-800 focus:outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#E9FAFA] shadow-sm" value={amountTendered === 0 ? '' : amountTendered} onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Change:</span>
                            <span className={`font-mono font-bold text-lg ${change < 0 ? 'text-red-500' : 'text-[#1B9387]'}`}>₱ {change >= 0 ? change.toFixed(2) : '0.00'}</span>
                        </div>
                    </div>
                )}

                <div className="text-right">
                    <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Total Amount Due</p>
                    <p className="text-4xl font-black text-gray-800 tracking-tight mb-4 font-mono">₱ {grandTotal.toFixed(2)}</p>
                    <button type="submit" disabled={loading} className={`cursor-pointer w-full text-white font-bold py-3.5 rounded-lg shadow-md transition uppercase tracking-wider text-sm ${loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#1B9387] hover:bg-[#28958B]'}`}>
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
          <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-8 w-[480px] max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
             <h3 className="text-xl font-extrabold text-gray-800 mb-5 border-b border-gray-100 pb-3">Confirm Transaction</h3>
             <div className="space-y-5 text-sm">
              
              <div className="grid grid-cols-2 gap-y-3 pb-4 border-b border-gray-100">
                <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">Patient:</span>
                <span className="text-gray-800 font-bold text-right">{selectedPatientName}</span>
                
                <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">Payment Method:</span>
                <span className={`font-bold text-right ${paymentMethod === 'CHARGE' ? 'text-red-500' : 'text-[#1B9387]'}`}>{paymentMethod}</span>
                
                {(paymentMethod === 'HMO' || paymentMethod === 'CHARGE') && (
                    <>
                        <span className="text-blue-500 font-bold uppercase text-[10px] tracking-wider mt-2">Billed To (A/R):</span>
                        <span className="text-blue-600 font-bold text-right mt-2">{selectedPayeeName}</span>
                    </>
                )}
                
                {paymentMethod === 'HMO' && (
                  <>
                    <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">HMO Provider:</span><span className="text-blue-600 font-bold text-right">{hmoProvider}</span>
                    <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">LOA Number:</span><span className="text-blue-600 font-mono font-bold text-right">{loaNumber}</span>
                  </>
                )}
                {isSCPWD && (
                  <>
                    <span className="text-amber-500 font-bold uppercase text-[10px] tracking-wider">SC/PWD ID:</span><span className="text-amber-600 font-mono font-bold text-right">{scPwdId}</span>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Billed Items</span>
                <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-4 max-h-40 overflow-y-auto space-y-2 shadow-inner">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-gray-700 font-medium truncate max-w-[220px]">{item.description || 'Medical Service'}</span>
                            <span className="text-gray-800 font-mono font-bold">{item.quantity} x ₱{item.price.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
              </div>

              <div className="bg-[#E9FAFA] border border-[#1B9387]/30 rounded-lg p-5">
                  <div className="flex justify-between items-center text-[#1B9387] font-extrabold">
                      <span className="uppercase tracking-wider text-xs">Total Due:</span>
                      <span className="text-2xl font-mono">₱ {grandTotal.toFixed(2)}</span>
                  </div>
              </div>

            </div>
             <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsConfirmOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 rounded-md cursor-pointer">Go Back</button>
              <button type="button" onClick={handleConfirmSubmit} disabled={loading} className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold transition shadow-sm disabled:opacity-50 cursor-pointer uppercase tracking-wider">Confirm & Save</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW CONTACT MODAL */}
      <NewContactModal 
          isOpen={isContactModalOpen} 
          onClose={() => setIsContactModalOpen(false)} 
          onSaveSuccess={onContactSaved} 
          defaultType={modalDefaultType} 
      />
    </div>
  );
}