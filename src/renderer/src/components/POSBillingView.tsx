import React, { useState } from 'react';

// Master list of Categories (Maps to your Chart of Accounts and sets VAT rules)
const CATEGORIES = {
  '4010': { label: '👨‍⚕️ Consultation', isVatable: false },
  '4020': { label: '🔬 Laboratory / X-Ray', isVatable: false },
  '4030': { label: '💊 Medicine / Pharmacy', isVatable: true },
  '4040': { label: '📄 Medical Certificate', isVatable: false },
};

// ---> ADDED userId PROP HERE <---
export function POSBillingView({ userId }: { userId: string }) {
  const [patientName, setPatientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  
  // HMO Specific Fields
  const [hmoProvider, setHmoProvider] = useState('Maxicare');
  const [loaNumber, setLoaNumber] = useState('');

  // Senior Citizen / PWD Fields
  const [isSCPWD, setIsSCPWD] = useState(false);
  const [scPwdId, setScPwdId] = useState('');

  // Line items for the bill
  const [items, setItems] = useState([
    { id: 1, accountCode: '4010', description: '', quantity: 1, price: 0, isVatable: false }
  ]);

  const [amountTendered, setAmountTendered] = useState(0);

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
        // If category changes, automatically update the VAT rule for that item!
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
      // SENIOR / PWD RULE: Strip VAT first (if vatable), then apply 20% discount. 100% is VAT Exempt.
      const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal;
      const discountAmount = netOfVat * 0.20;
      const discountedPrice = netOfVat - discountAmount;
      
      vatExemptSales += discountedPrice;
      totalDiscount += (lineTotal - discountedPrice); 
      grandTotal += discountedPrice;
    } else {
      // REGULAR RULE
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

  // ==========================================
  // ---> NEW DATABASE CHECKOUT LOGIC <---
  // ==========================================
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || grandTotal === 0) {
      alert("Please add at least one service/item.");
      return;
    }
    if (paymentMethod === 'HMO' && !loaNumber.trim()) {
      alert("HMO LOA Number is required!");
      return;
    }
    if (isSCPWD && !scPwdId.trim()) {
        alert("Senior Citizen / PWD ID Number is required for the discount!");
        return;
    }
    if (paymentMethod !== 'HMO' && amountTendered < grandTotal) {
      alert("Amount tendered is less than the total bill!");
      return;
    }

    try {
      // 1. Build the exact Journal Lines required by your Prisma Database
      const lines: any[] = [];

      // DEBIT: Increase Cash (1010) OR Accounts Receivable (1200)
      const debitAccount = paymentMethod === 'HMO' ? '1200' : '1010';
      lines.push({
        accountId: debitAccount, // <-- CAMEL CASE FIX
        debit: grandTotal,
        credit: 0
      });

      // CREDIT: Record the Revenue for each item
      items.forEach(item => {
        const lineTotal = item.quantity * item.price;
        let revenueAmount = lineTotal;
        
        // Strip VAT and Discount for accurate true revenue reporting
        if (isSCPWD) {
           const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal;
           revenueAmount = netOfVat * 0.80; 
        } else if (item.isVatable) {
           revenueAmount = lineTotal / 1.12;
        }

        lines.push({
          accountId: item.accountCode, // <-- CAMEL CASE FIX
          debit: 0,
          credit: revenueAmount
        });
      });

      // CREDIT: Output VAT (2020) if applicable
      if (vatAmount > 0 && !isSCPWD) {
        lines.push({
          accountId: '2020', // <-- CAMEL CASE FIX
          debit: 0,
          credit: vatAmount
        });
      }

      // 2. Package it into the Journal Entry format
      const entryData = {
        date: new Date().toISOString(),
        referenceNo: `INV-${Date.now()}`, // <-- CAMEL CASE FIX
        description: `POS Billing: ${patientName} (${paymentMethod})${paymentMethod === 'HMO' ? ` LOA: ${loaNumber}` : ''}`,
        vatType: vatAmount > 0 ? 'VATABLE' : 'EXEMPT', // <-- CAMEL CASE FIX
        userId: userId, // <-- CAMEL CASE FIX
        lines: lines
      };

      // 3. SEND TO DATABASE VIA BRIDGE!
      const response = await (window as any).api.submitJournalEntry(entryData);

      if (response && response.success === false) {
        alert("Database Error: " + response.error);
        return;
      }

      alert(`Transaction Saved to Database! \nGenerated BIR Invoice for ₱${grandTotal.toFixed(2)} to ${patientName}.`);
      
      // Reset Form
      setPatientName('');
      setItems([{ id: Date.now(), accountCode: '4010', description: '', quantity: 1, price: 0, isVatable: false }]);
      setAmountTendered(0);
      setLoaNumber('');
      setIsSCPWD(false);
      setScPwdId('');

    } catch (error: any) {
      console.error(error);
      alert("System Error: Could not connect to the database.");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#121214] text-gray-200 font-sans">
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Patient Billing & POS</h1>
        <p className="text-sm text-gray-400">Generate BIR EOPT-Compliant invoices and process payments.</p>
      </div>

      <form onSubmit={handleCheckout} className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* --- LEFT COLUMN: Transaction Details --- */}
        <div className="col-span-1 flex flex-col gap-6">
          
          <div className="bg-[#202024] rounded-xl p-6 border border-[#29292e] shadow-lg">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-[#8d8d99]">Transaction Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Patient Name</label>
                <input type="text" required
                  placeholder="e.g., Juan Dela Cruz"
                  className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#4f46e5] text-white"
                  value={patientName} onChange={(e) => setPatientName(e.target.value)}
                />
              </div>

              {/* SC / PWD Toggle */}
              <div className="p-3 bg-[#121214] border border-[#29292e] rounded-lg">
                <div className="flex items-center">
                    <input 
                        type="checkbox" 
                        id="scpwd" 
                        className="w-4 h-4 text-[#4f46e5] bg-gray-700 border-gray-600 rounded"
                        checked={isSCPWD}
                        onChange={(e) => setIsSCPWD(e.target.checked)}
                    />
                    <label htmlFor="scpwd" className="ml-2 text-sm font-medium text-yellow-400">
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
                <div className="grid grid-cols-3 gap-2">
                  {['CASH', 'GCASH', 'HMO'].map((method) => (
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
                      className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
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
              <div className="col-span-4">Description</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-2 text-right">Price (₱)</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1 text-right"></div>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-[#121214] p-2 rounded border border-[#29292e]">
                  
                  {/* Category Dropdown updates isVatable automatically */}
                  <div className="col-span-3">
                    <select 
                      className="w-full bg-transparent text-sm text-blue-400 focus:outline-none"
                      value={item.accountCode} 
                      onChange={(e) => updateItem(item.id, 'accountCode', e.target.value)}
                    >
                      {Object.entries(CATEGORIES).map(([code, details]) => (
                          <option key={code} value={code} className="bg-[#121214]">{details.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-4">
                    <input type="text" required placeholder="e.g., Biogesic 500mg"
                      className="w-full bg-transparent text-sm text-white focus:outline-none"
                      value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)}
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
                {paymentMethod !== 'HMO' && (
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
                    className="cursor-pointer w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-3 rounded-lg shadow-lg transition transform hover:scale-[1.02]">
                    {paymentMethod === 'HMO' ? 'Submit HMO Billing' : 'Generate Invoice'}
                    </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </form>
    </div>
  );
}