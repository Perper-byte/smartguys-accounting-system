// src/renderer/src/components/POSBillingView.tsx
import React, { useState, useEffect } from 'react';
import { NewContactModal } from './NewContactModal';
import {
  Plus,
  Trash2,
  Wallet,
  Smartphone,
  ShieldPlus,
  CreditCard,
  Tag,
  CheckCircle,
  Search,
  Printer,
  Minus,
  Info,
  Receipt,
} from 'lucide-react';

export function POSBillingView({ userId }: { userId: string }) {
  // --- STATE ---
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

  const [paymentMethod, setPaymentMethod] = useState('');
  const [loaNumber, setLoaNumber] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [manualInvoiceNo, setManualInvoiceNo] = useState('');

  const [isSCPWD, setIsSCPWD] = useState(false);
  const [discountType, setDiscountType] = useState('Senior Citizen');
  const [scPwdId, setScPwdId] = useState('');

  const [labTests, setLabTests] = useState<any[]>([]);
  const [revenueAccounts, setRevenueAccounts] = useState<any[]>([]);

  const [items, setItems] = useState([
    { id: 1, accountCode: '', description: '', quantity: 1, price: 500, isVatable: false }
  ]);

  const [activeLabRow, setActiveLabRow] = useState<number | null>(null);

  const [amountTendered, setAmountTendered] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Success Screen State
  const [successData, setSuccessData] = useState<any | null>(null);

  // --- DATA LOADING ---
  const loadInitialData = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI;
      const payeeData = await api.getPayees('HMO,CORPORATE');
      setPayees(payeeData || []);
      const patientData = await api.getPayees('PATIENT');
      setPatients(patientData || []);

      if (api.getServiceItems) {
        const itemsData = await api.getServiceItems();
        setLabTests(itemsData || []);
      }

      if (api.getAccounts) {
        const accData = await api.getAccounts();
        const revAccounts = accData.filter((a: any) => a.account_type?.name === 'Revenue');
        setRevenueAccounts(revAccounts);

        if (revAccounts.length > 0 && items[0].accountCode === '') {
          setItems([{ id: 1, accountCode: revAccounts.find(a => a.code === '4010')?.code || revAccounts[0].code, description: '', quantity: 1, price: 500, isVatable: false }]);
        }
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  };

  useEffect(() => { loadInitialData(); }, []);

  // --- HANDLERS ---
  const onContactSaved = (newId: string, newName: string) => {
    loadInitialData();
    if (modalDefaultType === 'PATIENT') setPatientId(newId);
    else setPayeeId(newId);
    setIsContactModalOpen(false);
  };

  const handleAddItem = () => {
    const defaultCode = revenueAccounts.find(a => a.code === '4010')?.code || (revenueAccounts.length > 0 ? revenueAccounts[0].code : '');
    setItems([...items, { id: Date.now(), accountCode: defaultCode, description: '', quantity: 1, price: 500, isVatable: false }]);
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItemQty = (id: number, delta: number) => {
    setItems(items.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'accountCode') {
          updatedItem.description = '';
          if (value === '4010') updatedItem.price = 500;
          else updatedItem.price = 0;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const resetForm = () => {
    setSuccessData(null);
    setPatientId('');
    setPayeeId('');
    setPaymentMethod('');
    setLoaNumber('');
    setReferenceNo('');
    setManualInvoiceNo('');
    setIsSCPWD(false);
    setScPwdId('');
    setAmountTendered('');
    const defaultCode = revenueAccounts.find(a => a.code === '4010')?.code || (revenueAccounts.length > 0 ? revenueAccounts[0].code : '');
    setItems([{ id: Date.now(), accountCode: defaultCode, description: '', quantity: 1, price: 500, isVatable: false }]);
  };

  // --- CALCULATIONS ---
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

  const tendered = Number(amountTendered) || 0;
  const change = tendered > grandTotal ? tendered - grandTotal : 0;
  const isPaid = paymentMethod ? (['CASH'].includes(paymentMethod) ? tendered >= grandTotal : true) : false;

  const selectedPatientName = patients.find(p => p.id === patientId)?.name || '';
  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()));

  const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '';
  const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));

  // --- SUBMIT ---
  const handleCheckoutClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethod) return alert("Please select a Payment Method!");
    if (!patientId) return alert("Please select a Patient.");
    if (items.length === 0 || grandTotal === 0) return alert("Please add items to bill.");
    if ((paymentMethod === 'CASH') && tendered < grandTotal) return alert("Amount tendered is insufficient.");
    if (isSCPWD && !scPwdId.trim()) return alert("SC/PWD ID is required.");
    if ((paymentMethod === 'HMO' || paymentMethod === 'CHARGE') && !payeeId) return alert("A Guarantor must be selected.");
    if (paymentMethod === 'HMO' && !loaNumber.trim()) return alert("LOA Number is required.");
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setLoading(true);
      const lines: any[] = [];
      let debitAccount = '1010'; // Default Cash on Hand

      if (paymentMethod === 'HMO' || paymentMethod === 'CHARGE') debitAccount = '1200';
      else if (paymentMethod === 'GCASH') debitAccount = '1010';

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
      const description = `Patient: ${selectedPatientName} | Billed To: ${payeeId ? selectedPayeeName : 'Self'} (${paymentMethod})${paymentMethod === 'HMO' ? ` LOA: ${loaNumber}` : ''}${paymentMethod === 'GCASH' ? ` Ref: ${referenceNo}` : ''}`;
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
        alert("Database Error: " + response.error);
        setIsConfirmOpen(false);
        return;
      }

      setSuccessData({
        invoiceNo: entryData.referenceNo,
        patientName: selectedPatientName,
        total: grandTotal,
        method: paymentMethod,
        tendered: tendered,
        change: change
      });

      setIsConfirmOpen(false);
    } catch (error: any) {
      alert("System Error: Could not connect to database.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // VIEW: SUCCESS SCREEN
  // ==========================================
  if (successData) {
    return (
      <div className="w-full flex justify-center items-center min-h-[calc(100vh-64px)] bg-[#f9fafb] animate-in zoom-in-95 duration-300 p-8">
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-[#B0DCDA] flex flex-col items-center max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-8">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3 uppercase">Payment Completed</h1>

          <div className="text-6xl font-black font-mono tracking-tighter text-[#1B9387] mb-8">
            <span className="text-4xl mr-1">₱</span>{successData.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>

          <div className="w-full space-y-4 text-base border-t border-b border-gray-100 py-8 mb-8 text-left">
            <div className="flex justify-between"><span className="text-gray-500 font-medium">Patient</span> <span className="font-bold text-gray-900">{successData.patientName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 font-medium">Invoice No.</span> <span className="font-bold font-mono text-gray-900">{successData.invoiceNo}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 font-medium">Payment Method</span> <span className="font-bold text-gray-900 uppercase">{successData.method}</span></div>
            {successData.method === 'CASH' && (
              <div className="flex justify-between"><span className="text-gray-500 font-medium">Change Due</span> <span className="font-bold font-mono text-emerald-600">₱ {successData.change.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
            )}
          </div>

          <div className="flex w-full gap-5">
            <button className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-lg">
              <Printer className="w-5 h-5" /> Print Receipt
            </button>
            <button onClick={resetForm} className="flex-1 py-4 bg-[#1B9387] hover:bg-[#15796f] text-white font-bold rounded-xl shadow-lg shadow-[#1B9387]/20 transition-all uppercase tracking-wider text-lg">
              New Transaction
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: MAIN POS
  // ==========================================
  return (
    <div className="w-full min-h-[calc(100vh-64px)] flex justify-center items-start bg-[#f9fafb] p-6 lg:p-10">

      <div className="w-full max-w-[1600px] flex flex-col text-gray-800 font-sans relative animate-in fade-in duration-300">

        {/* HEADER */}
        <div className="mb-8 border-b border-[#B0DCDA] pb-6 flex items-center gap-4">
          <div className="bg-[#E9FAFA] p-3 rounded-xl border border-[#B0DCDA]">
            <Receipt className="w-8 h-8 text-[#1B9387]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Patient Billing <span className="bg-[#E9FAFA] text-[#1B9387] border border-[#1B9387]/30 px-2.5 py-1 rounded text-xs tracking-widest uppercase shadow-sm">POS</span>
            </h1>
            <p className="text-base text-slate-500 font-medium mt-1">Generate EOPT-Compliant invoices and process transactions.</p>
          </div>
        </div>

        <form onSubmit={handleCheckoutClick} className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 pb-10">

          {/* ========================================================================= */}
          {/* 1. LEFT COLUMN: PATIENT DETAILS */}
          {/* ========================================================================= */}
          <div className="xl:col-span-4 space-y-8">
            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-100 bg-[#FBF8F8] flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#1B9387] text-white flex items-center justify-center text-sm font-black">1</div>
                <h2 className="text-sm font-black text-[#1B9387] uppercase tracking-wider">Patient Details</h2>
              </div>

              <div className="p-8 space-y-8">

                {/* PATIENT SEARCH */}
                <div>
                  <div className="flex justify-between items-end mb-2.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Select Patient</label>
                    <button type="button" onClick={() => { setModalDefaultType('PATIENT'); setIsContactModalOpen(true); }} className="text-[10px] font-bold text-[#1B9387] hover:bg-[#E9FAFA] transition uppercase tracking-wider cursor-pointer bg-white px-2 py-1 rounded border border-[#B0DCDA] shadow-sm">
                      + New Patient
                    </button>
                  </div>

                  <div className="relative">
                    <div onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)} className={`w-full bg-white border ${isPatientDropdownOpen ? 'border-[#1B9387] ring-2 ring-[#E9FAFA]' : 'border-gray-300 hover:border-gray-400'} rounded-xl px-4 py-3.5 text-base transition cursor-pointer flex justify-between items-center shadow-sm`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Search className="w-5 h-5 text-gray-400 shrink-0" />
                        <span className={patientId ? 'text-gray-900 font-bold truncate' : 'text-gray-400 font-medium'}>{patientId ? selectedPatientName : 'Search or select patient...'}</span>
                      </div>
                    </div>
                    {isPatientDropdownOpen && (
                      <div className="absolute z-30 w-full mt-2 bg-white border border-[#B0DCDA] rounded-xl shadow-xl overflow-hidden">
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                          <input type="text" autoFocus placeholder="Type to search..." value={patientSearchQuery} onChange={(e) => setPatientSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-md p-3 text-sm text-gray-800 outline-none focus:border-[#1B9387] shadow-inner" />
                        </div>
                        <ul className="max-h-64 overflow-y-auto">
                          <li onClick={() => { setPatientId(''); setIsPatientDropdownOpen(false); setPatientSearchQuery(''); }} className="p-4 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer font-bold uppercase tracking-wider border-b border-gray-100">-- Clear Selection --</li>
                          {filteredPatients.map(p => (
                            <li key={p.id} onClick={() => { setPatientId(p.id); setIsPatientDropdownOpen(false); setPatientSearchQuery(''); }} className="px-5 py-4 text-sm text-gray-800 font-bold hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-b border-gray-50 last:border-0">
                              {p.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* SC / PWD TOGGLE & INPUTS */}
                <div className="border border-gray-200 rounded-xl overflow-hidden transition-all bg-gray-50/50">
                  <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsSCPWD(!isSCPWD)}>
                    <input type="checkbox" checked={isSCPWD} readOnly className="w-5 h-5 text-[#1B9387] rounded border-gray-300 focus:ring-[#1B9387]" />
                    <div className="flex items-center gap-2">
                      <Tag className="w-5 h-5 text-slate-500" />
                      <span className="text-base font-bold text-gray-700">Apply SC / PWD Discount</span>
                    </div>
                  </div>

                  {isSCPWD && (
                    <div className="p-5 border-t border-gray-200 bg-white space-y-5 animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center text-sm pb-3 border-b border-gray-100">
                        <span className="font-medium text-gray-500">Subtotal</span>
                        <span className="font-mono font-bold">₱{grossAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-amber-600 font-bold pb-3 border-b border-gray-100">
                        <span>Discount (20%)</span>
                        <span className="font-mono">- ₱{totalDiscount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-base font-black pt-1">
                        <span>Net Total</span>
                        <span className="font-mono text-[#1B9387]">₱{grandTotal.toFixed(2)}</span>
                      </div>

                      <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <label className="flex-[1.5]">
                          <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Discount Type</span>
                          <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none" value={discountType} onChange={e => setDiscountType(e.target.value)}>
                            <option value="Senior Citizen">Senior Citizen</option>
                            <option value="PWD">PWD</option>
                          </select>
                        </label>
                        <label className="flex-[2]">
                          <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">ID Number</span>
                          <input type="text" required placeholder="Required for BIR" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none" value={scPwdId} onChange={(e) => setScPwdId(e.target.value)} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* INVOICE NUMBER */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Invoice / OR Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if left blank"
                    className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl text-base font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#E9FAFA] focus:border-[#1B9387] shadow-sm placeholder:font-sans"
                    value={manualInvoiceNo}
                    onChange={(e) => setManualInvoiceNo(e.target.value)}
                  />
                </div>

              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2 & 3. RIGHT COLUMN: ITEMS & CHECKOUT */}
          {/* ========================================================================= */}
          <div className="xl:col-span-8 flex flex-col gap-8 xl:gap-10">

            {/* 2. ITEMS TABLE */}
            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-sm flex flex-col overflow-hidden min-h-[300px]">
              <div className="px-8 py-5 border-b border-gray-100 bg-[#FBF8F8] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1B9387] text-white flex items-center justify-center text-sm font-black">2</div>
                  <h2 className="text-sm font-black text-[#1B9387] uppercase tracking-wider">Services & Medicines</h2>
                </div>
                <button type="button" onClick={handleAddItem} className="flex items-center gap-2 px-4 py-2 bg-white border border-[#B0DCDA] text-gray-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#E9FAFA] hover:text-[#1B9387] transition-colors shadow-sm">
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {/* ✨ FIX: Increased table min-width to 900px to prevent squeezing on smaller displays */}
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead className="bg-white sticky top-0 shadow-sm z-10">
                    <tr>
                      {/* ✨ FIX: Increased Category column width to w-64 */}
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 w-64">Category</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">Description</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-center">VAT</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-center">Qty</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-right">Unit Price</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-right">Total</th>
                      <th className="px-6 py-4 border-b border-gray-200 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                        {/* ✨ FIX: Increased Category TD width to match header (w-64) */}
                        <td className="px-6 py-3 w-64">
                          <select className="w-full bg-transparent text-sm font-bold text-[#1B9387] focus:outline-none cursor-pointer text-ellipsis overflow-hidden" value={item.accountCode} onChange={(e) => updateItem(item.id, 'accountCode', e.target.value)}>
                            {revenueAccounts.map(acc => (<option key={acc.code} value={acc.code} className="text-gray-800 font-medium">{acc.name}</option>))}
                          </select>
                        </td>
                        <td className="px-6 py-3 relative min-w-[250px]">
                          <input
                            type="text" required
                            placeholder={item.accountCode === '4020' ? "Search test..." : "Item name"}
                            className={`w-full bg-transparent text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#1B9387]/30 rounded-lg px-3 py-2 ${item.accountCode === '4020' ? 'text-[#1B9387] placeholder-[#1B9387]/50' : 'text-gray-900'}`}
                            value={item.description}
                            onChange={(e) => {
                              updateItem(item.id, 'description', e.target.value);
                              if (item.accountCode === '4020') setActiveLabRow(item.id);
                            }}
                            onFocus={() => { if (item.accountCode === '4020') setActiveLabRow(item.id); }}
                            onBlur={() => setTimeout(() => setActiveLabRow(null), 200)}
                          />
                          {activeLabRow === item.id && item.accountCode === '4020' && (
                            <ul className="absolute z-50 left-0 top-full mt-1 w-[400px] bg-white border border-[#1B9387] rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                              <li className="p-3 bg-[#E9FAFA] border-b border-[#B0DCDA] text-xs font-extrabold text-[#1B9387] uppercase tracking-wider sticky top-0">Clinic Master List</li>
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
                                  className="p-4 text-sm text-gray-800 hover:bg-[#E9FAFA] cursor-pointer transition border-b border-gray-50 flex justify-between items-center group/row"
                                >
                                  <div>
                                    <span className="font-bold text-base group-hover/row:text-[#1B9387]">{test.name}</span>
                                    <span className="block text-xs text-gray-400 uppercase font-bold mt-1">{test.category}</span>
                                  </div>
                                  {test.price > 0 && <span className="font-mono text-[#1B9387] font-bold text-base">₱{test.price.toLocaleString()}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <input type="checkbox" className="w-5 h-5 text-[#1B9387] rounded border-gray-300 focus:ring-[#1B9387]" checked={item.isVatable} disabled={isSCPWD} onChange={(e) => updateItem(item.id, 'isVatable', e.target.checked)} title="Is this item subject to VAT?" />
                        </td>
                        <td className="px-6 py-3 w-32">
                          <div className="flex items-center justify-between border border-gray-300 rounded-lg overflow-hidden bg-white hover:border-[#1B9387] transition-colors focus-within:ring-2 focus-within:ring-[#E9FAFA] focus-within:border-[#1B9387]">
                            <button type="button" onClick={() => updateItemQty(item.id, -1)} className="px-3 py-2 bg-gray-50 hover:bg-gray-200 text-gray-600 font-bold border-r border-gray-200 transition-colors"><Minus className="w-4 h-4" /></button>
                            <input type="number" min="1" required className="w-10 text-center bg-transparent text-base font-bold text-gray-900 focus:outline-none appearance-none" value={item.quantity || ''} onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                            <button type="button" onClick={() => updateItemQty(item.id, 1)} className="px-3 py-2 bg-gray-50 hover:bg-gray-200 text-gray-600 font-bold border-l border-gray-200 transition-colors"><Plus className="w-4 h-4" /></button>
                          </div>
                        </td>
                        <td className="px-6 py-3 w-36">
                          <input type="number" min="0" step="0.01" required className="w-full text-right bg-transparent text-base font-bold font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B9387]/30 rounded-lg px-3 py-2" value={item.price === 0 ? '' : item.price} onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="px-6 py-3 w-40 text-right text-base font-bold font-mono text-gray-900">
                          ₱{(item.quantity * item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3 text-center w-16">
                          <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-2 bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-200" title="Remove Item">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. CHECKOUT & PAYMENT CARD (Consolidated Bottom Right) */}
            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-lg p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1B9387]"></div>

              <div className="flex flex-col 2xl:flex-row justify-between gap-12">

                {/* Left Side: VAT Breakdown */}
                <div className="flex-1 max-w-sm space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                    <Info className="w-5 h-5 text-gray-400" />
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">VAT Breakdown</h3>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between font-medium text-gray-500"><span>Vatable Sales</span> <span className="font-mono tabular-nums text-right w-28">₱ {vatableSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between font-bold text-gray-700"><span>VAT Amount (12%)</span> <span className="font-mono tabular-nums text-right w-28 text-[#1B9387]">₱ {vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between font-medium text-gray-500 pt-2.5 border-t border-gray-50"><span>VAT Exempt Sales</span> <span className="font-mono tabular-nums text-right w-28">₱ {vatExemptSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between font-medium text-gray-500"><span>Zero Rated Sales</span> <span className="font-mono tabular-nums text-right w-28">₱ 0.00</span></div>
                  </div>
                </div>

                {/* Right Side: Payment Execution */}
                <div className="flex-[1.5] flex flex-col space-y-8">

                  {/* 3.1 GRAND TOTAL ANCHOR */}
                  <div className="flex flex-col items-end border-b border-gray-200 pb-6">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Amount Due</span>
                    <span className="text-6xl font-black text-[#1B9387] tracking-tighter font-sans tabular-nums leading-none">
                      <span className="text-4xl text-[#1B9387]/70 mr-2 font-sans">₱</span>
                      {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* 3.2 SELECT PAYMENT METHOD */}
                  <div className="space-y-3">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest block">Payment Method</span>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { id: 'CASH', label: 'Cash', icon: Wallet },
                        { id: 'GCASH', label: 'GCash', icon: Smartphone },
                        { id: 'HMO', label: 'HMO', icon: ShieldPlus },
                        { id: 'CHARGE', label: 'Charge', icon: CreditCard }
                      ].map((method) => (
                        <button
                          key={method.id} type="button" onClick={() => { setPaymentMethod(method.id); setAmountTendered(''); setReferenceNo(''); setPayeeId(''); }}
                          className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold transition-all border ${paymentMethod === method.id ? 'bg-[#E9FAFA] border-[#1B9387] text-[#1B9387] shadow-sm ring-1 ring-[#1B9387]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'}`}
                        >
                          <method.icon className={`w-6 h-6 ${paymentMethod === method.id ? 'text-[#1B9387]' : 'text-gray-400'}`} />
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3.3 ADAPTIVE PAYMENT INPUTS */}
                  <div className="min-h-[100px]">
                    {/* CASH OR GCASH INPUTS */}
                    {paymentMethod === 'CASH' && (
                      <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-2">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount Tendered</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">₱</span>
                            <input
                              type="number" autoFocus placeholder="0.00"
                              className={`w-full pl-10 pr-4 py-4 bg-white border rounded-xl text-xl font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#E9FAFA] shadow-sm transition-colors ${amountTendered !== '' && tendered < grandTotal ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-[#1B9387]'}`}
                              value={amountTendered === 0 ? '' : amountTendered}
                              onChange={(e) => setAmountTendered(parseFloat(e.target.value) || '')}
                            />
                          </div>
                          {amountTendered !== '' && tendered < grandTotal && (
                            <p className="text-xs font-bold text-red-500 uppercase mt-2">Insufficient Amount</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Change</label>
                          <div className="w-full py-4 px-5 bg-gray-50 border border-gray-200 rounded-xl text-xl font-mono font-black text-right">
                            <span className={change > 0 ? 'text-[#1B9387]' : 'text-gray-400'}>
                              ₱ {change > 0 ? change.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'GCASH' && (
                      <div className="animate-in fade-in slide-in-from-bottom-2">
                        <label className="block text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">GCash Reference No.</label>
                        <input type="text" autoFocus placeholder="e.g., 100012345678" className="w-full px-5 py-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-sm" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
                      </div>
                    )}

                    {/* HMO OR CHARGE INPUTS */}
                    {(paymentMethod === 'HMO' || paymentMethod === 'CHARGE') && (
                      <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="relative">
                          <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Guarantor / Provider</label>
                          <div onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)} className="w-full bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 text-base transition cursor-pointer flex justify-between items-center shadow-sm">
                            <span className={payeeId ? 'text-indigo-900 font-bold truncate' : 'text-indigo-400 font-medium'}>{payeeId ? selectedPayeeName : 'Select Guarantor...'}</span>
                            <Search className="w-5 h-5 text-indigo-400 shrink-0" />
                          </div>
                          {isPayeeDropdownOpen && (
                            <div className="absolute z-20 w-full mt-2 bg-white border border-indigo-200 rounded-xl shadow-xl overflow-hidden">
                              <div className="p-3 border-b border-indigo-100 bg-indigo-50">
                                <input type="text" autoFocus placeholder="Search..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-white p-3 border border-indigo-200 rounded-lg text-sm outline-none" />
                              </div>
                              <ul className="max-h-56 overflow-y-auto">
                                <li onClick={() => { setModalDefaultType('HMO'); setIsContactModalOpen(true); setIsPayeeDropdownOpen(false); }} className="p-4 text-xs text-indigo-600 hover:bg-indigo-50 cursor-pointer font-bold uppercase tracking-wider border-b border-gray-100 bg-white sticky top-0">+ Add New Entity</li>
                                {filteredPayees.map(p => (
                                  <li key={p.id} onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-4 text-base text-gray-800 font-bold hover:bg-indigo-50 cursor-pointer border-b border-gray-50">
                                    {p.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {paymentMethod === 'HMO' && (
                          <div>
                            <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">LOA / Auth Number</label>
                            <input type="text" placeholder="Required" className="w-full px-5 py-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 shadow-sm" value={loaNumber} onChange={(e) => setLoaNumber(e.target.value)} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3.4 PRIMARY ACTION BUTTON */}
                  <button
                    type="submit"
                    disabled={loading || !isPaid || items.length === 0 || !paymentMethod}
                    className={`w-full py-5 rounded-xl flex items-center justify-center gap-3 text-lg font-black tracking-widest uppercase transition-all shadow-lg
                      ${(!paymentMethod || loading || !isPaid || items.length === 0)
                        ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none'
                        : 'bg-[#1B9387] text-white hover:bg-[#15796f] shadow-[#1B9387]/30 hover:shadow-xl hover:-translate-y-0.5'}`}
                  >
                    {loading ? 'Processing...' : (
                      !paymentMethod ? 'SELECT PAYMENT METHOD' :
                        paymentMethod === 'CASH' ? <><Receipt className="w-6 h-6 mr-1" /> PROCESS PAYMENT — ₱ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</> :
                          <><CheckCircle className="w-6 h-6 mr-1" /> COMPLETE TRANSACTION</>
                    )}
                  </button>

                </div>
              </div>
            </div>
          </div>
        </form>

        {/* CONFIRMATION MODAL */}
        {isConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white border border-[#B0DCDA] rounded-3xl shadow-2xl p-10 w-[550px] max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-extrabold text-gray-800 mb-6 border-b border-gray-100 pb-4 flex items-center gap-3">
                <CheckCircle className="w-7 h-7 text-[#1B9387]" /> Confirm Payment
              </h3>
              <div className="space-y-6 text-base">
                <div className="grid grid-cols-2 gap-y-4 pb-5 border-b border-gray-100">
                  <span className="text-gray-500 font-bold uppercase text-xs tracking-wider">Patient:</span>
                  <span className="text-gray-900 font-bold text-right truncate">{selectedPatientName}</span>
                  <span className="text-gray-500 font-bold uppercase text-xs tracking-wider">Payment Method:</span>
                  <span className={`font-bold text-right uppercase ${paymentMethod === 'CHARGE' ? 'text-rose-500' : 'text-[#1B9387]'}`}>{paymentMethod}</span>

                  {(paymentMethod === 'HMO' || paymentMethod === 'CHARGE') && (
                    <><span className="text-indigo-500 font-bold uppercase text-xs tracking-wider mt-3">Billed To (A/R):</span><span className="text-indigo-700 font-bold text-right mt-3">{selectedPayeeName}</span></>
                  )}
                  {paymentMethod === 'HMO' && (
                    <><span className="text-gray-500 font-bold uppercase text-xs tracking-wider">LOA Number:</span><span className="text-indigo-700 font-mono font-bold text-right">{loaNumber}</span></>
                  )}
                  {paymentMethod === 'GCASH' && (
                    <><span className="text-gray-500 font-bold uppercase text-xs tracking-wider">Reference No:</span><span className="text-blue-600 font-mono font-bold text-right">{referenceNo}</span></>
                  )}
                </div>

                <div className="space-y-3">
                  <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Billed Items</span>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 max-h-48 overflow-y-auto space-y-3 shadow-inner">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700 font-medium truncate max-w-[280px]">{item.quantity}x {item.description || 'Medical Service'}</span>
                        <span className="text-gray-900 font-mono font-bold">₱{(item.quantity * item.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#E9FAFA] border border-[#1B9387]/30 rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-center text-[#1B9387] font-extrabold">
                    <span className="uppercase tracking-wider text-sm">Total Due:</span>
                    <span className="text-4xl font-mono tracking-tighter">₱ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-10 pt-5 border-t border-gray-100">
                <button type="button" onClick={() => setIsConfirmOpen(false)} className="px-6 py-4 text-base font-bold text-gray-500 hover:text-gray-800 transition bg-white border border-gray-200 hover:bg-gray-100 rounded-xl cursor-pointer">Cancel</button>
                <button type="button" onClick={handleConfirmSubmit} disabled={loading} className="px-8 py-4 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-xl text-base font-black transition shadow-md disabled:opacity-50 cursor-pointer uppercase tracking-wider">
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        )}

        <NewContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} onSaveSuccess={onContactSaved} defaultType={modalDefaultType} />
      </div>
    </div>
  );
}