// src/renderer/src/components/POSBillingView.tsx
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NewContactModal } from './NewContactModal'
import { Search, Printer, Minus, Plus, Trash2, Info, CheckCircle, Wallet, Smartphone, CreditCard, Tag, SplitSquareHorizontal, Receipt } from 'lucide-react'

const CATEGORIES = {
  '4010': { label: '👨‍⚕️ Consultation', isVatable: false },
  '4020': { label: '🔬 Laboratory / X-Ray', isVatable: false },
  '4040': { label: '📄 Medical Certificate', isVatable: false },
};

export function POSBillingView({ userId }: { userId: string }) {
  const [patients, setPatients] = useState<any[]>([])
  const [patientId, setPatientId] = useState('')
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false)
  const [patientSearchQuery, setPatientSearchQuery] = useState('')
  
  const [payees, setPayees] = useState<any[]>([])
  const [payeeId, setPayeeId] = useState('')
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false)
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('')
  
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [modalDefaultType, setModalDefaultType] = useState('PATIENT')
  
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH' | 'SPLIT' | ''>('')
  const [amountTendered, setAmountTendered] = useState<number | ''>('')
  const [gcashAmount, setGcashAmount] = useState<number | ''>('')
  const [referenceNo, setReferenceNo] = useState('')
  
  const [loaNumber, setLoaNumber] = useState('')

  // 🔥 UPDATED: Locked to INV- only
  const [refPrefix] = useState('INV-')
  const [invoiceSequence, setInvoiceSequence] = useState('')
  
  const [isSCPWD, setIsSCPWD] = useState(false)
  const [discountType, setDiscountType] = useState('Senior Citizen')
  const [scPwdId, setScPwdId] = useState('')
  
  const [labTests, setLabTests] = useState<any[]>([])
  const [revenueAccounts, setRevenueAccounts] = useState<any[]>([])
  
  const [items, setItems] = useState([
    { id: 1, accountCode: '4010', description: '', quantity: 1, price: 500, isVatable: false, isHmoCovered: false, hmoCoverage: '' as number | '' }
  ])

  const [activeLabRow, setActiveLabRow] = useState<number | null>(null)
  const [labDropdownPosition, setLabDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const labInputRef = useRef<HTMLInputElement | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [successData, setSuccessData] = useState<any | null>(null)

  const loadInitialData = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (!api) return console.error('Electron API is unavailable.')

      const payeeData = await api.getPayees('HMO,CORPORATE')
      setPayees(payeeData || [])

      const patientData = await api.getPayees('PATIENT')
      setPatients(patientData || [])

      if (api.getServiceItems) setLabTests(await api.getServiceItems() || [])

      if (api.getAccounts) {
        const accData = await api.getAccounts()
        const revAccounts = accData.filter((a: any) => a.account_type?.name === 'Revenue')
        setRevenueAccounts(revAccounts)

        if (revAccounts.length > 0 && items[0].accountCode === '') {
          const defaultAccount = revAccounts.find((a: any) => a.code === '4010')?.code || revAccounts[0].code
          setItems([{ id: 1, accountCode: defaultAccount, description: '', quantity: 1, price: 500, isVatable: false, isHmoCovered: false, hmoCoverage: '' }])
        }
      }
    } catch (error) { console.error(error) }
  }

  useEffect(() => { loadInitialData() }, [])

  // Automatically fetch the next sequence number (e.g. 001) for the POS
  useEffect(() => {
    const fetchNextSeq = async () => {
      try {
        const api = (window as any).api || (window as any).electronAPI
        const nextSeq = await api.getNextSequence(refPrefix)
        setInvoiceSequence(nextSeq)
      } catch (error) { console.error(error) }
    }
    if (!successData) fetchNextSeq()
  }, [refPrefix, successData])

  // ============================================================
  // AUTO-FILL HMO / GUARANTOR WHEN PATIENT IS SELECTED
  // ============================================================
  useEffect(() => {
    if (!patientId) {
      setPayeeId('')
      return
    }

    const selectedPatient = patients.find((p) => p.id === patientId)
    
    if (selectedPatient) {
      const hmoName = 
        selectedPatient.hmo_affiliation || 
        selectedPatient.hmo_name || 
        selectedPatient.hmoName;

      if (hmoName && String(hmoName).trim() !== '') {
        const hmoSearchStr = String(hmoName).toLowerCase().trim()
        const match = payees.find(
          (p) => p.name ? String(p.name).toLowerCase().trim() === hmoSearchStr : false
        )
        
        if (match) {
          setPayeeId(match.id)
        } else {
          setPayeeId('') 
        }
      } else {
        setPayeeId('')
      }
    }
  }, [patientId, patients, payees])

  const onContactSaved = (newId?: string, newName?: string) => {
    loadInitialData()
    if (newId) {
      if (modalDefaultType === 'PATIENT') setPatientId(newId)
      else setPayeeId(newId)
    }
    setIsContactModalOpen(false)
  }

  const handleAddItem = () => {
    const defaultCode = revenueAccounts.find((a) => a.code === '4010')?.code || (revenueAccounts.length > 0 ? revenueAccounts[0].code : '')
    setItems([...items, { id: Date.now(), accountCode: defaultCode, description: '', quantity: 1, price: 500, isVatable: false, isHmoCovered: false, hmoCoverage: '' }])
  }

  const handleRemoveItem = (id: number) => {
    setItems(items.filter((item) => item.id !== id))
    if (activeLabRow === id) { setActiveLabRow(null); setLabDropdownPosition(null); }
  }

  const updateItemQty = (id: number, delta: number) => {
    setItems(items.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
  }

  const updateItem = (id: number, field: string, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }
          if (field === 'accountCode') {
            updatedItem.description = ''
            updatedItem.price = value === '4010' ? 500 : 0
            updatedItem.isHmoCovered = false
            updatedItem.hmoCoverage = ''
            setActiveLabRow(null)
            setLabDropdownPosition(null)
          }
          return updatedItem
        }
        return item
      })
    )
  }

  const toggleHmoCover = (id: number, isCovered: boolean, rowTotal: number) => {
    setItems(prevItems => prevItems.map(item => {
        if (item.id === id) {
            return {
                ...item,
                isHmoCovered: isCovered,
                hmoCoverage: isCovered ? rowTotal : ''
            };
        }
        return item;
    }));
  };

  const calculateLabDropdownPosition = (element: HTMLInputElement) => {
    const rect = element.getBoundingClientRect()
    const dropdownWidth = Math.max(rect.width, 400)
    let left = rect.left
    if (left + dropdownWidth > window.innerWidth - 16) left = window.innerWidth - dropdownWidth - 16
    let top = rect.bottom + 6
    if ((window.innerHeight - rect.bottom) < 180 && rect.top > 290) top = rect.top - 290 - 6
    return { top, left: Math.max(16, left), width: dropdownWidth }
  }

  useEffect(() => {
    const syncLabDropdown = () => {
      if (activeLabRow === null || !labInputRef.current) return
      const rect = labInputRef.current.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setActiveLabRow(null); setLabDropdownPosition(null); labInputRef.current = null;
        return
      }
      setLabDropdownPosition(calculateLabDropdownPosition(labInputRef.current))
    }
    window.addEventListener('scroll', syncLabDropdown, true)
    window.addEventListener('resize', syncLabDropdown)
    return () => { window.removeEventListener('scroll', syncLabDropdown, true); window.removeEventListener('resize', syncLabDropdown) }
  }, [activeLabRow])

  const openLabDropdown = (rowId: number, element: HTMLInputElement) => {
    labInputRef.current = element
    setLabDropdownPosition(calculateLabDropdownPosition(element))
    setActiveLabRow(rowId)
  }

  const closePayeeDropdown = () => { setIsPayeeDropdownOpen(false); setPayeeSearchQuery('') }

  const resetForm = () => {
    setSuccessData(null); setPatientId(''); setPayeeId(''); setPaymentMethod(''); setLoaNumber(''); setReferenceNo(''); 
    setIsSCPWD(false); setScPwdId(''); setAmountTendered(''); setGcashAmount(''); setPatientSearchQuery(''); setPayeeSearchQuery('')
    setIsPatientDropdownOpen(false); setIsPayeeDropdownOpen(false); setActiveLabRow(null); setLabDropdownPosition(null)
    const defaultCode = revenueAccounts.find((a) => a.code === '4010')?.code || (revenueAccounts.length > 0 ? revenueAccounts[0].code : '')
    setItems([{ id: Date.now(), accountCode: defaultCode, description: '', quantity: 1, price: 500, isVatable: false, isHmoCovered: false, hmoCoverage: '' }])
  }

  // ============================================================
  // SPLIT BILLING CALCULATIONS
  // ============================================================
  let grossAmount = 0
  let vatableSales = 0
  let vatExemptSales = 0
  let vatAmount = 0
  let totalDiscount = 0
  let grandTotal = 0
  
  let hmoShare = 0
  let patientShare = 0

  items.forEach((item) => {
    const lineTotal = item.quantity * item.price
    grossAmount += lineTotal
    let itemFinalPrice = lineTotal

    if (isSCPWD) {
      const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal
      const discountAmount = netOfVat * 0.2
      itemFinalPrice = netOfVat - discountAmount
      vatExemptSales += itemFinalPrice
      totalDiscount += lineTotal - itemFinalPrice
    } else {
      if (item.isVatable) {
        const net = lineTotal / 1.12
        vatableSales += net
        vatAmount += (lineTotal - net)
      } else {
        vatExemptSales += lineTotal
      }
    }
    
    grandTotal += itemFinalPrice

    if (item.isHmoCovered) {
        let safeCoverage = Number(item.hmoCoverage) || 0
        if (safeCoverage > itemFinalPrice) safeCoverage = itemFinalPrice
        hmoShare += safeCoverage
        patientShare += (itemFinalPrice - safeCoverage)
    } else {
        patientShare += itemFinalPrice
    }
  })

  const tendered = Number(amountTendered) || 0
  const splitGcash = Number(gcashAmount) || 0
  const cashNeeded = paymentMethod === 'SPLIT' ? (patientShare - splitGcash) : patientShare
  const change = tendered > cashNeeded ? tendered - cashNeeded : 0
  const hasHmoCoveredItem = items.some(i => i.isHmoCovered)

  let isPaid = false
  if (patientShare === 0) isPaid = true
  else if (paymentMethod === 'CASH') isPaid = tendered >= patientShare
  else if (paymentMethod === 'GCASH') isPaid = true 
  else if (paymentMethod === 'SPLIT') isPaid = (splitGcash > 0 && tendered >= cashNeeded)

  const selectedPatientName = patients.find((p) => p.id === patientId)?.name || ''
  
  const filteredPatients = patients.filter((p) => {
    if (!p || !p.name) return false;
    return String(p.name).toLowerCase().includes(patientSearchQuery.toLowerCase());
  })
  
  const selectedPayee = payees.find((p) => p.id === payeeId)
  const selectedPayeeName = selectedPayee?.name || ''
  
  const filteredPayees = payees.filter((p) => {
    if (!p || !p.name) return false;
    const matchesSearch = String(p.name).toLowerCase().includes(payeeSearchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (hasHmoCoveredItem) return p.type === 'HMO' || p.type === 'CORPORATE'
    if (paymentMethod === 'CHARGE') return p.type === 'CORPORATE'
    return true
  })

  // ============================================================
  // SUBMIT VALIDATION
  // ============================================================
  const handleCheckoutClick = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!patientId) return alert('Please select a Patient.')
    if (items.length === 0 || grandTotal === 0) return alert('Please add items to bill.')
    
    if (patientShare > 0 && !paymentMethod) return alert('Please select a Payment Method for the patient balance!')
    if (isSCPWD && !scPwdId.trim()) return alert('SC/PWD ID is required.')
    
    if (hasHmoCoveredItem) {
        if (!payeeId) return alert('A Guarantor / HMO must be selected for covered items.')
        if (selectedPayee?.type === 'HMO' && !loaNumber.trim()) return alert('LOA Number is required for HMO claims.')
    }

    if (patientShare > 0) {
        if (paymentMethod === 'CASH' && tendered < patientShare) return alert('Amount tendered is insufficient.')
        if (paymentMethod === 'GCASH' && !referenceNo.trim()) return alert('GCash Reference Number is required.')
        if (paymentMethod === 'SPLIT') {
            if (splitGcash <= 0 || splitGcash >= patientShare) return alert(`GCash split amount must be between ₱0.01 and ₱${(patientShare - 0.01).toFixed(2)}.`)
            if (!referenceNo.trim()) return alert('GCash Reference Number is required for the split.')
            if (tendered < cashNeeded) return alert(`Insufficient cash. ₱${cashNeeded.toFixed(2)} cash is required for this split.`)
        }
    }
    
    setIsConfirmOpen(true)
  }

  // ============================================================
  // MULTI-DEBIT JOURNAL ENTRY
  // ============================================================
  const handleConfirmSubmit = async () => {
    try {
      setLoading(true)
      const lines: any[] = []

      // DEBIT 1: HMO SHARE (A/R)
      if (hasHmoCoveredItem) {
        lines.push({ accountId: '1200', debit: hmoShare, credit: 0 })
      }

      // DEBIT 2: PATIENT SHARE (CASH/GCASH)
      if (patientShare > 0) {
        if (paymentMethod === 'CASH') {
            lines.push({ accountId: '1020', debit: patientShare, credit: 0 })
        } else if (paymentMethod === 'GCASH') {
            lines.push({ accountId: '1010', debit: patientShare, credit: 0 })
        } else if (paymentMethod === 'SPLIT') {
            lines.push({ accountId: '1010', debit: splitGcash, credit: 0 }) 
            lines.push({ accountId: '1020', debit: patientShare - splitGcash, credit: 0 }) 
        }
      }

      // CREDITS: Revenue
      items.forEach((item) => {
        const lineTotal = item.quantity * item.price
        let revenueAmount = lineTotal
        if (isSCPWD) {
          const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal
          revenueAmount = netOfVat * 0.8
        } else if (item.isVatable) {
          revenueAmount = lineTotal / 1.12
        }
        lines.push({ accountId: item.accountCode, debit: 0, credit: revenueAmount })
      })

      // CREDITS: VAT Payable
      if (vatAmount > 0 && !isSCPWD) {
        lines.push({ accountId: '2020', debit: 0, credit: vatAmount })
      }

      const finalPayeeId = payeeId || patientId
      
      let paymentDesc = ''
      if (patientShare > 0) {
          paymentDesc = `| Pt. Paid: ${paymentMethod}`
          if (paymentMethod === 'GCASH' || paymentMethod === 'SPLIT') paymentDesc += ` (Ref: ${referenceNo})`
      }
      
      const hmoDesc = hasHmoCoveredItem ? `| A/R: ${selectedPayeeName}${selectedPayee?.type === 'HMO' ? ` (LOA: ${loaNumber})` : ''}` : ''
      const description = `Patient: ${selectedPatientName} ${hmoDesc} ${paymentDesc}`

      const finalReferenceNo = `${refPrefix}${invoiceSequence.trim().padStart(3, '0')}`;
      
      const entryData = {
        date: new Date().toISOString(),
        referenceNo: finalReferenceNo,
        description: description.trim(),
        vatType: vatAmount > 0 ? 'VATABLE' : 'EXEMPT',
        userId: userId,
        payeeId: finalPayeeId,
        lines: lines
      }
      
      const api = (window as any).api || (window as any).electronAPI
      const response = await api.submitJournalEntry(entryData)
      
      if (response && response.success === false) {
        alert('Database Error: ' + response.error)
        setIsConfirmOpen(false)
        return
      }

      setSuccessData({
        invoiceNo: entryData.referenceNo,
        patientName: selectedPatientName,
        total: grandTotal,
        hmoShare: hmoShare,
        patientShare: patientShare,
        method: patientShare === 0 ? 'COVERED BY A/R' : paymentMethod,
        tendered: tendered,
        change: change
      })
      setIsConfirmOpen(false)
    } catch (error: any) {
      console.error('Billing Error:', error)
      alert('System Error: Could not connect to database.')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // SUCCESS SCREEN
  // ============================================================
  if (successData) {
    return (
      <div className="w-full flex justify-center items-center min-h-[calc(100vh-64px)] bg-[#f9fafb] animate-in zoom-in-95 duration-300 p-8">
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-[#B0DCDA] flex flex-col items-center max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-8">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3 uppercase">Transaction Complete</h1>
          <div className="text-5xl font-black font-mono tracking-tighter text-[#1B9387] mb-8">
            <span className="text-3xl mr-1">₱</span>{successData.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="w-full space-y-4 text-base border-t border-b border-gray-100 py-8 mb-8 text-left">
            <div className="flex justify-between"><span className="text-gray-500 font-medium">Patient</span><span className="font-bold text-gray-900">{successData.patientName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 font-medium">Invoice No.</span><span className="font-bold font-mono text-gray-900">{successData.invoiceNo}</span></div>
            
            {successData.hmoShare > 0 && (
                <div className="flex justify-between text-indigo-600"><span className="font-medium">A/R Covered</span><span className="font-bold font-mono">₱ {successData.hmoShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
            )}
            
            {successData.patientShare > 0 && (
                <div className="flex justify-between border-t border-gray-100 pt-3"><span className="text-gray-500 font-medium">Pt. Payment ({successData.method})</span><span className="font-bold text-gray-900 font-mono">₱ {successData.patientShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
            )}
            
            {(successData.method === 'CASH' || successData.method === 'SPLIT') && successData.patientShare > 0 && (
              <div className="flex justify-between pt-1"><span className="text-gray-500 font-medium">Change Due</span><span className="font-bold font-mono text-emerald-600">₱ {successData.change.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
            )}
          </div>
          <div className="flex w-full gap-5">
            <button type="button" onClick={() => window.print()} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-lg"><Printer className="w-5 h-5" /> Print Receipt</button>
            <button type="button" onClick={resetForm} className="flex-1 py-4 bg-[#1B9387] hover:bg-[#15796f] text-white font-bold rounded-xl shadow-lg shadow-[#1B9387]/20 transition-all uppercase tracking-wider text-lg">New Transaction</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-[calc(100vh-64px)] flex justify-center items-start bg-[#f9fafb] p-6 lg:p-10">
      <div className="w-full max-w-[1600px] flex flex-col text-gray-800 font-sans relative animate-in fade-in duration-300">
        
        <div className="mb-8 border-b border-[#B0DCDA] pb-6 flex items-center gap-4">
          <div className="bg-[#E9FAFA] p-3 rounded-xl border border-[#B0DCDA]">
            <Receipt className="w-8 h-8 text-[#1B9387]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Patient Billing
              <span className="bg-[#E9FAFA] text-[#1B9387] border border-[#1B9387]/30 px-2.5 py-1 rounded text-xs tracking-widest uppercase shadow-sm">POS</span>
            </h1>
            <p className="text-base text-slate-500 font-medium mt-1">Generate EOPT-Compliant invoices and process split transactions.</p>
          </div>
        </div>

        <form onSubmit={handleCheckoutClick} className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 pb-10">
          
          <div className="xl:col-span-4 space-y-8">
            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-sm">
              <div className="px-8 py-5 border-b border-gray-100 bg-[#FBF8F8] rounded-t-2xl flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#1B9387] text-white flex items-center justify-center text-sm font-black">1</div>
                <h2 className="text-sm font-black text-[#1B9387] uppercase tracking-wider">Patient Details</h2>
              </div>
              <div className="p-8 space-y-8">
                
                <div>
                  <div className="flex justify-between items-end mb-2.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Select Patient</label>
                    <button type="button" onClick={() => { setModalDefaultType('PATIENT'); setIsContactModalOpen(true); }} className="text-[10px] font-bold text-[#1B9387] hover:bg-[#E9FAFA] transition uppercase tracking-wider cursor-pointer bg-white px-2 py-1 rounded border border-[#B0DCDA] shadow-sm">+ New Patient</button>
                  </div>
                  <div className="relative">
                    <div onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)} className={`w-full bg-white border ${isPatientDropdownOpen ? 'border-[#1B9387] ring-2 ring-[#E9FAFA]' : 'border-gray-300 hover:border-gray-400'} rounded-xl px-4 py-3.5 text-base transition cursor-pointer flex justify-between items-center shadow-sm`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Search className="w-5 h-5 text-gray-400 shrink-0" />
                        <span className={patientId ? 'text-gray-900 font-bold truncate' : 'text-gray-400 font-medium'}>{patientId ? selectedPatientName : 'Search or select patient...'}</span>
                      </div>
                    </div>
                    {isPatientDropdownOpen && (
                      <div className="absolute z-[100] w-full mt-2 bg-white border border-[#B0DCDA] rounded-xl shadow-xl overflow-hidden">
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                          <input type="text" autoFocus placeholder="Type to search..." value={patientSearchQuery} onChange={(e) => setPatientSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-md p-3 text-sm text-gray-800 outline-none focus:border-[#1B9387] shadow-inner" />
                        </div>
                        <ul className="max-h-64 overflow-y-auto">
                          <li onClick={() => { setPatientId(''); setIsPatientDropdownOpen(false); setPatientSearchQuery(''); }} className="p-4 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer font-bold uppercase tracking-wider border-b border-gray-100">-- Clear Selection --</li>
                          {filteredPatients.map((p) => (
                            <li key={p.id} onClick={() => { setPatientId(p.id); setIsPatientDropdownOpen(false); setPatientSearchQuery(''); }} className="px-5 py-4 text-sm text-gray-800 font-bold hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-b border-gray-50 last:border-0">{p.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl transition-all bg-gray-50/50">
                  <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-100 transition-colors rounded-xl" onClick={() => setIsSCPWD(!isSCPWD)}>
                    <input type="checkbox" checked={isSCPWD} readOnly className="w-5 h-5 text-[#1B9387] rounded border-gray-300 focus:ring-[#1B9387]" />
                    <div className="flex items-center gap-2">
                      <Tag className="w-5 h-5 text-slate-500" />
                      <span className="text-base font-bold text-gray-700">Apply SC / PWD Discount</span>
                    </div>
                  </div>
                  {isSCPWD && (
                    <div className="p-5 border-t border-gray-200 bg-white space-y-5 rounded-b-xl animate-in slide-in-from-top-2">
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
                          <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
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

                {/* 🔥 UPDATED: Locked to INV- only, and made read-only */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Invoice Number</label>
                  <div className="flex shadow-sm rounded-xl">
                     <span className="bg-gray-100 border border-gray-300 border-r-0 rounded-l-xl px-4 py-3.5 text-sm font-bold text-gray-500 select-none flex flex-col justify-center">
                         INV-
                     </span>
                     <input 
                        type="text" 
                        readOnly 
                        value={invoiceSequence} 
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-300 rounded-r-xl text-base font-mono font-bold text-gray-500 focus:outline-none cursor-not-allowed select-none" 
                     />
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="xl:col-span-8 flex flex-col gap-8 xl:gap-10">
            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-sm flex flex-col overflow-hidden min-h-[300px]">
              <div className="px-8 py-5 border-b border-gray-100 bg-[#FBF8F8] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1B9387] text-white flex items-center justify-center text-sm font-black">2</div>
                  <h2 className="text-sm font-black text-[#1B9387] uppercase tracking-wider">Services & Medicines</h2>
                </div>
                <button type="button" onClick={handleAddItem} className="flex items-center gap-2 px-4 py-2 bg-white border border-[#B0DCDA] text-gray-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#E9FAFA] hover:text-[#1B9387] transition-colors shadow-sm cursor-pointer">
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead className="bg-white sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 w-48">Category</th>
                      <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">Description</th>
                      <th className="px-2 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-center">VAT</th>
                      <th className="px-4 py-4 text-[10px] font-black text-indigo-500 uppercase tracking-wider border-b border-indigo-100 text-center bg-indigo-50/50 w-36">HMO / Corp Cover</th>
                      <th className="px-2 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-center">Qty</th>
                      <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-right">Unit Price</th>
                      <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-right">Total</th>
                      <th className="px-2 py-4 border-b border-gray-200 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => {
                        const rowTotal = item.quantity * item.price;
                        return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-4 py-3 w-48">
                          <select className="w-full bg-transparent text-sm font-bold text-[#1B9387] focus:outline-none cursor-pointer text-ellipsis overflow-hidden" value={item.accountCode} onChange={(e) => updateItem(item.id, 'accountCode', e.target.value)}>
                            {revenueAccounts.map((acc) => (<option key={acc.code} value={acc.code} className="text-gray-800 font-medium">{acc.name}</option>))}
                          </select>
                        </td>
                        <td className="px-4 py-3 min-w-[200px] relative border-l border-gray-100">
                          <input
                            type="text" required placeholder={item.accountCode === '4020' ? 'Search test...' : 'Item name'}
                            className={`w-full bg-transparent text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1B9387]/30 rounded-lg px-3 py-2 ${item.accountCode === '4020' ? 'text-[#1B9387] placeholder-[#1B9387]/50' : 'text-gray-900'}`}
                            value={item.description}
                            onChange={(e) => { updateItem(item.id, 'description', e.target.value); if (item.accountCode === '4020') { openLabDropdown(item.id, e.currentTarget) } }}
                            onFocus={(e) => { if (item.accountCode === '4020') { openLabDropdown(item.id, e.currentTarget) } }}
                            onBlur={() => { setTimeout(() => { setActiveLabRow(null); setLabDropdownPosition(null) }, 200) }}
                          />
                          {activeLabRow === item.id && item.accountCode === '4020' && labDropdownPosition && createPortal(
                              <div className="fixed z-[9999] bg-white border border-[#1B9387] rounded-xl shadow-2xl overflow-hidden" style={{ top: `${labDropdownPosition.top}px`, left: `${labDropdownPosition.left}px`, width: `${labDropdownPosition.width}px` }}>
                                <div className="px-4 py-3 bg-[#E9FAFA] border-b border-[#B0DCDA] text-xs font-extrabold text-[#1B9387] uppercase tracking-wider">Clinic Master List</div>
                                <ul className="max-h-72 overflow-y-auto">
                                  {labTests.filter((test) => { 
                                      const query = String(item.description || '').toLowerCase(); 
                                      return (String(test.name || '').toLowerCase().includes(query) || String(test.category || '').toLowerCase().includes(query)) 
                                    }).map((test, index) => (
                                      <li key={test.id || index} onMouseDown={(e) => { e.preventDefault(); const newItems = [...items]; const targetIndex = newItems.findIndex((line) => line.id === item.id); if (targetIndex === -1) return; newItems[targetIndex] = { ...newItems[targetIndex], description: test.name, price: Number(test.price) > 0 ? Number(test.price) : newItems[targetIndex].price }; setItems(newItems); setActiveLabRow(null); setLabDropdownPosition(null) }} className="px-4 py-3 text-sm text-gray-800 hover:bg-[#E9FAFA] cursor-pointer transition border-b border-gray-100 last:border-b-0 flex justify-between items-center gap-4 group">
                                        <div className="min-w-0"><span className="font-bold text-sm block truncate group-hover:text-[#1B9387]">{test.name}</span><span className="block text-[10px] text-gray-400 uppercase font-bold mt-0.5 truncate">{test.category}</span></div>
                                        {Number(test.price) > 0 && <span className="font-mono text-[#1B9387] font-bold text-sm whitespace-nowrap">₱{Number(test.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                                      </li>
                                    ))}
                                </ul>
                              </div>, document.body
                            )}
                        </td>
                        <td className="px-2 py-3 text-center border-l border-gray-100">
                          <input type="checkbox" className="w-5 h-5 text-[#1B9387] bg-white border-gray-300 rounded cursor-pointer focus:ring-[#1B9387]" checked={item.isVatable} disabled={isSCPWD} onChange={(e) => updateItem(item.id, 'isVatable', e.target.checked)} title="Subject to VAT?" />
                        </td>
                        
                        <td className="px-3 py-3 bg-indigo-50/30 border-l border-indigo-100 align-middle min-w-[140px]">
                          {!item.isHmoCovered ? (
                              <div className="flex justify-center items-center h-full">
                                  <input 
                                      type="checkbox" 
                                      className="w-5 h-5 text-indigo-600 bg-white border-indigo-300 rounded cursor-pointer focus:ring-indigo-500" 
                                      checked={false} 
                                      onChange={() => toggleHmoCover(item.id, true, rowTotal)} 
                                      title="Cover with HMO or Corporate Account" 
                                  />
                              </div>
                          ) : (
                              <div className="flex flex-col items-center gap-1.5">
                                  <div className="flex items-center gap-2 w-full justify-center">
                                      <input 
                                          type="checkbox" 
                                          className="w-5 h-5 text-indigo-600 bg-white border-indigo-300 rounded cursor-pointer focus:ring-indigo-500 shrink-0" 
                                          checked={true} 
                                          onChange={() => toggleHmoCover(item.id, false, rowTotal)} 
                                      />
                                      <div className="relative flex items-center w-24 shrink-0">
                                          <span className="absolute left-2 text-indigo-400 font-mono text-xs font-bold">₱</span>
                                          <input 
                                              type="number" min="0" step="0.01" 
                                              className="w-full text-right bg-white border border-indigo-200 text-sm font-bold font-mono text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 rounded py-1.5 pr-2 pl-5 shadow-sm"
                                              value={item.hmoCoverage === 0 ? '' : item.hmoCoverage}
                                              onChange={(e) => updateItem(item.id, 'hmoCoverage', parseFloat(e.target.value) || '')}
                                              placeholder="0.00"
                                          />
                                      </div>
                                  </div>
                                  {Number(item.hmoCoverage) !== rowTotal && (
                                      <button 
                                          type="button" 
                                          onClick={() => updateItem(item.id, 'hmoCoverage', rowTotal)} 
                                          className="text-[9px] font-extrabold text-indigo-600 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded uppercase tracking-widest transition-colors shadow-sm cursor-pointer"
                                      >
                                          Set Full (₱{rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                                      </button>
                                  )}
                              </div>
                          )}
                        </td>

                        <td className="px-2 py-3 w-28 border-l border-gray-100">
                          <div className="flex items-center justify-between border border-gray-300 rounded-lg overflow-hidden bg-white hover:border-[#1B9387] transition-colors focus-within:ring-2 focus-within:ring-[#E9FAFA] focus-within:border-[#1B9387]">
                            <button type="button" onClick={() => updateItemQty(item.id, -1)} className="px-2 py-1.5 bg-gray-50 hover:bg-gray-200 text-gray-600 font-bold border-r border-gray-200 cursor-pointer"><Minus className="w-3 h-3" /></button>
                            <input type="number" min="1" required className="w-10 text-center bg-transparent text-sm font-bold text-gray-900 focus:outline-none appearance-none" value={item.quantity || ''} onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                            <button type="button" onClick={() => updateItemQty(item.id, 1)} className="px-2 py-1.5 bg-gray-50 hover:bg-gray-200 text-gray-600 font-bold border-l border-gray-200 cursor-pointer"><Plus className="w-3 h-3" /></button>
                          </div>
                        </td>
                        <td className="px-4 py-3 w-32 border-l border-gray-100">
                          <input type="number" min="0" step="0.01" required className="w-full text-right bg-transparent text-base font-bold font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B9387]/30 rounded-lg px-2 py-1.5" value={item.price === 0 ? '' : item.price} onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className={`px-4 py-3 w-32 text-right text-sm font-bold font-mono border-l border-gray-100 bg-[#FBF8F8]/50 ${item.isHmoCovered ? 'text-indigo-600' : 'text-gray-900'}`}>
                          ₱{rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-3 text-center w-12 border-l border-gray-100">
                          <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1.5 bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-200 cursor-pointer" title="Remove Item"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-lg p-8 relative overflow-visible">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1B9387]"></div>
              <div className="flex flex-col 2xl:flex-row justify-between gap-12">
                
                <div className="flex-1 max-w-sm space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                    <Info className="w-5 h-5 text-gray-400" />
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">VAT Breakdown</h3>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between font-medium text-gray-500"><span>Vatable Sales</span><span className="font-mono tabular-nums text-right w-28">₱ {vatableSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between font-bold text-gray-700"><span>VAT Amount (12%)</span><span className="font-mono tabular-nums text-right w-28 text-[#1B9387]">₱ {vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between font-medium text-gray-500 pt-2.5 border-t border-gray-50"><span>VAT Exempt Sales</span><span className="font-mono tabular-nums text-right w-28">₱ {vatExemptSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between font-medium text-gray-500"><span>Zero Rated Sales</span><span className="font-mono tabular-nums text-right w-28">₱ 0.00</span></div>
                  </div>
                  
                  {hasHmoCoveredItem && (
                    <div className="mt-8 p-5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-4 shadow-inner animate-in fade-in slide-in-from-bottom-2">
                        <div className="relative z-50">
                            <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Billed To (A/R Guarantor)</label>
                            <button type="button" onClick={() => { setIsPayeeDropdownOpen(!isPayeeDropdownOpen); if (isPayeeDropdownOpen) setPayeeSearchQuery(''); }} className={`w-full bg-white border rounded-lg px-4 py-3 text-sm transition cursor-pointer flex justify-between items-center shadow-sm text-left ${isPayeeDropdownOpen ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-indigo-200 hover:border-indigo-300'}`}>
                                <span className={payeeId ? 'text-indigo-900 font-bold truncate' : 'text-indigo-400 font-medium truncate'}>{payeeId ? selectedPayeeName : 'Select Provider / Corporate...'}</span>
                                <Search className="w-4 h-4 text-indigo-400 shrink-0" />
                            </button>
                            {isPayeeDropdownOpen && (
                                <div className="absolute z-[999] left-0 top-full mt-2 w-full min-w-[360px] bg-white border border-indigo-200 rounded-xl shadow-2xl overflow-hidden">
                                    <div className="p-3 border-b border-indigo-100 bg-indigo-50">
                                        <input type="text" autoFocus placeholder="Search entity..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-white px-3 py-2 border border-indigo-200 rounded-lg text-sm text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                    </div>
                                    <button type="button" onMouseDown={(e) => { e.preventDefault(); setModalDefaultType('HMO'); setIsContactModalOpen(true); closePayeeDropdown(); }} className="w-full text-left px-4 py-3 text-xs text-indigo-600 hover:bg-indigo-50 font-bold uppercase tracking-wider border-b border-gray-100 transition cursor-pointer">+ Add New Entity</button>
                                    <ul className="max-h-56 overflow-y-auto">
                                        {filteredPayees.map((p) => (
                                            <li key={p.id} onMouseDown={(e) => { e.preventDefault(); setPayeeId(p.id); closePayeeDropdown(); }} className="px-4 py-3 text-sm text-gray-800 font-bold hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer border-b border-gray-50 last:border-0 transition">
                                                <div className="flex justify-between items-center gap-3"><span className="truncate">{p.name}</span><span className="shrink-0 px-2 py-1 bg-indigo-50 text-indigo-500 rounded-md text-[9px] font-extrabold uppercase tracking-wider">{p.type}</span></div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        {selectedPayee?.type === 'HMO' && (
                            <div>
                                <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">LOA / Auth Number</label>
                                <input type="text" placeholder="Required for HMO" className="w-full px-4 py-3 bg-white border border-indigo-200 text-indigo-900 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 shadow-sm" value={loaNumber} onChange={(e) => setLoaNumber(e.target.value)} />
                            </div>
                        )}
                    </div>
                  )}
                </div>

                <div className="flex-[1.5] flex flex-col space-y-8">
                  <div className="flex flex-col items-end border-b border-gray-200 pb-6">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Gross Total</span>
                    <span className="text-5xl font-black text-gray-800 tracking-tighter font-mono tabular-nums leading-none">
                      <span className="text-3xl text-gray-400 mr-2 font-sans">₱</span>{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {hasHmoCoveredItem && (
                    <div className="flex flex-col items-end bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                      <span className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">A/R Covered Amount</span>
                      <span className="text-3xl font-black text-indigo-600 tracking-tighter font-mono tabular-nums leading-none">
                        <span className="text-xl text-indigo-400 mr-2 font-sans">- ₱</span>{hmoShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {patientShare > 0 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
                        <span className="text-sm font-black text-[#1B9387] uppercase tracking-wider block">Patient Due</span>
                        <span className="text-3xl font-black text-[#1B9387] font-mono tracking-tighter">₱ {patientShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        {[{ id: 'CASH', label: 'Cash', icon: Wallet }, { id: 'GCASH', label: 'E-Wallet', icon: Smartphone }, { id: 'SPLIT', label: 'Split (Cash+E-Wallet)', icon: SplitSquareHorizontal }].map((method) => (
                          <button key={method.id} type="button" onClick={() => { setPaymentMethod(method.id as any); setAmountTendered(''); setReferenceNo(''); setGcashAmount(''); }} className={`cursor-pointer flex flex-col items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold transition-all border ${paymentMethod === method.id ? 'bg-[#E9FAFA] border-[#1B9387] text-[#1B9387] shadow-sm ring-1 ring-[#1B9387]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'}`}>
                            <method.icon className={`w-6 h-6 ${paymentMethod === method.id ? 'text-[#1B9387]' : 'text-gray-400'}`} />
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="min-h-[100px]">
                    {paymentMethod === 'CASH' && patientShare > 0 && (
                      <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-2">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount Tendered</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">₱</span>
                            <input type="number" autoFocus placeholder="0.00" className={`w-full pl-10 pr-4 py-4 bg-white border rounded-xl text-xl font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 shadow-sm transition-colors ${amountTendered !== '' && tendered < patientShare ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-[#1B9387] focus:ring-[#E9FAFA]'}`} value={amountTendered === 0 ? '' : amountTendered} onChange={(e) => setAmountTendered(parseFloat(e.target.value) || '')} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Change</label>
                          <div className="w-full py-4 px-5 bg-gray-50 border border-gray-200 rounded-xl text-xl font-mono font-black text-right">
                            <span className={change > 0 ? 'text-[#1B9387]' : 'text-gray-400'}>₱ {change > 0 ? change.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {paymentMethod === 'GCASH' && patientShare > 0 && (
                      <div className="animate-in fade-in slide-in-from-bottom-2">
                        <label className="block text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">E-Wallet Reference No.</label>
                        <input type="text" autoFocus placeholder="e.g., 100012345678" className="w-full px-5 py-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-sm" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
                      </div>
                    )}

                    {paymentMethod === 'SPLIT' && patientShare > 0 && (
                      <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="col-span-2 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1.5">E-Wallet Amount</label>
                                    <input type="number" autoFocus placeholder="0.00" className="w-full bg-white border border-blue-200 rounded-lg p-2.5 text-sm font-mono font-bold text-blue-900 focus:outline-none focus:border-blue-400" value={gcashAmount === 0 ? '' : gcashAmount} onChange={(e) => setGcashAmount(parseFloat(e.target.value) || '')} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1.5">E-Wallet Ref No.</label>
                                    <input type="text" placeholder="e.g. 1002939" className="w-full bg-white border border-blue-200 rounded-lg p-2.5 text-sm font-mono font-bold text-blue-900 focus:outline-none focus:border-blue-400" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cash Tendered</label>
                          <input type="number" placeholder={`For remaining ₱${cashNeeded.toLocaleString()}`} className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-base font-mono font-bold text-gray-900 focus:outline-none focus:border-[#1B9387] shadow-sm" value={amountTendered === 0 ? '' : amountTendered} onChange={(e) => setAmountTendered(parseFloat(e.target.value) || '')} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Change</label>
                          <div className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-base font-mono font-black text-right"><span className={change > 0 ? 'text-[#1B9387]' : 'text-gray-400'}>₱ {change > 0 ? change.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={loading || !isPaid || items.length === 0 || (patientShare > 0 && !paymentMethod)} className={`cursor-pointer w-full py-5 rounded-xl flex items-center justify-center gap-3 text-lg font-black tracking-widest uppercase transition-all shadow-lg ${(!paymentMethod && patientShare > 0) || loading || !isPaid || items.length === 0 ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none' : 'bg-[#1B9387] text-white hover:bg-[#15796f] shadow-[#1B9387]/30 hover:shadow-xl hover:-translate-y-0.5'}`}>
                    {loading ? 'Processing...' : (patientShare > 0 && !paymentMethod) ? 'SELECT PAYMENT METHOD' : patientShare === 0 ? 'PROCESS A/R BILLING' : (
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
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-[#B0DCDA] rounded-3xl shadow-2xl p-10 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-extrabold text-gray-800 mb-6 border-b border-gray-100 pb-4 flex items-center gap-3"><CheckCircle className="w-7 h-7 text-[#1B9387]" /> Confirm Payment</h3>
              <div className="space-y-6 text-base">
                <div className="grid grid-cols-2 gap-y-4 pb-5 border-b border-gray-100">
                  <span className="text-gray-500 font-bold uppercase text-xs tracking-wider">Patient:</span>
                  <span className="text-gray-900 font-bold text-right truncate">{selectedPatientName}</span>
                  {patientShare > 0 && (
                    <><span className="text-gray-500 font-bold uppercase text-xs tracking-wider">Pt. Payment Method:</span><span className="font-bold text-right uppercase text-[#1B9387]">{paymentMethod}</span></>
                  )}
                  {hasHmoCoveredItem && (
                    <>
                      <span className="text-indigo-500 font-bold uppercase text-xs tracking-wider mt-3">Billed To (A/R):</span>
                      <span className="text-indigo-700 font-bold text-right mt-3 truncate">{selectedPayeeName}</span>
                      {selectedPayee?.type === 'HMO' && <><span className="text-gray-500 font-bold uppercase text-xs tracking-wider">LOA Number:</span><span className="text-indigo-700 font-mono font-bold text-right">{loaNumber}</span></>}
                    </>
                  )}
                </div>
                <div className="space-y-3">
                  <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Billed Items</span>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 max-h-48 overflow-y-auto space-y-3 shadow-inner">
                    {items.map((item, index) => {
                        const rowCover = Number(item.hmoCoverage) || 0;
                        return (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className={`font-medium truncate max-w-[280px] ${rowCover > 0 ? 'text-indigo-600' : 'text-gray-700'}`}>
                          {rowCover > 0 && <span className="font-bold mr-1">[A/R: ₱{rowCover.toLocaleString()}]</span>}
                          {item.quantity}x {item.description || 'Medical Service'}
                        </span>
                        <span className="text-gray-900 font-mono font-bold">₱{(item.quantity * item.price).toFixed(2)}</span>
                      </div>
                    )})}
                  </div>
                </div>
                <div className="bg-[#E9FAFA] border border-[#1B9387]/30 rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-center text-[#1B9387] font-extrabold mb-1">
                    <span className="uppercase tracking-wider text-sm">Total Invoice:</span>
                    <span className="text-2xl font-mono tracking-tighter">₱ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {hasHmoCoveredItem && (
                      <div className="flex justify-between items-center text-indigo-600 font-bold text-xs mb-1">
                          <span className="uppercase tracking-wider">A/R Coverage:</span>
                          <span className="font-mono">- ₱ {hmoShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                  )}
                  <div className="flex justify-between items-center text-gray-800 font-black border-t border-[#1B9387]/20 pt-2 mt-2">
                      <span className="uppercase tracking-wider text-xs">Patient Due:</span>
                      <span className="text-xl font-mono">₱ {patientShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-4 mt-10 pt-5 border-t border-gray-100">
                <button type="button" onClick={() => setIsConfirmOpen(false)} className="px-6 py-4 text-base font-bold text-gray-500 hover:text-gray-800 transition bg-white border border-gray-200 hover:bg-gray-100 rounded-xl cursor-pointer">Cancel</button>
                <button type="button" onClick={handleConfirmSubmit} disabled={loading} className="px-8 py-4 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-xl text-base font-black transition shadow-md disabled:opacity-50 cursor-pointer uppercase tracking-wider">{loading ? 'Saving...' : 'Confirm & Save'}</button>
              </div>
            </div>
          </div>
        )}
        <NewContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} onSaveSuccess={onContactSaved} defaultType={modalDefaultType} />
      </div>
    </div>
  )
}