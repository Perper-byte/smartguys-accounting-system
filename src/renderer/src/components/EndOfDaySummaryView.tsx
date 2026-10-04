import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { Edit3, ShieldAlert, KeyRound, Lock, X, AlertCircle } from 'lucide-react'
import { PatientHistoryModal } from './PatientHistoryModal'
import { cleanDescription } from '../utils/formatters'

const formatLocalDate = (dateInput: Date | string | number = new Date()): string => {
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function EndOfDaySummaryView({ 
  userId: _userId, 
  isOpen = true, 
  onClose,
  onEditTransaction
}: { 
  userId: string; 
  isOpen?: boolean; 
  onClose?: () => void;
  onEditTransaction?: (transaction: any) => void;
}) {
  if (!isOpen) return null;
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState(formatLocalDate())
  const [historyModalPatient, setHistoryModalPatient] = useState<{ id: string, name: string } | null>(null)

  // Manager PIN Authorization Modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pendingEditRow, setPendingEditRow] = useState<any | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinVerifying, setPinVerifying] = useState(false)

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api && api.getAllRecentTransactions) {
        // We fetch all recent transactions and filter by date on the client for now.
        const response = await api.getAllRecentTransactions()
        if (response && response.success !== false) {
          const data = response.data || response || []
          setTransactions(Array.isArray(data) ? data : [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchHistory()
    }
  }, [isOpen])

  const isJournalEntry = (tx: any) => {
    const ref = (tx.referenceNo || tx.reference_no || tx.orNo || '').trim().toUpperCase()
    return ref.startsWith('JV') || ref.startsWith('ADJ') || ref.startsWith('PJ') || ref.startsWith('PY')
  }

  const { revenueTransactions, expenseTransactions } = useMemo(() => {
    const revs: any[] = []
    const exps: any[] = []

    transactions.forEach((tx) => {
      // Do not include journal entries
      if (isJournalEntry(tx)) {
        return
      }

      const txDateStr = formatLocalDate(tx.date || tx.createdAt)
      if (txDateStr === dateFilter) {
        // Determine if it's revenue or expense
        const isExpense = tx.rawLines?.some((l: any) => l.accountCode.startsWith('5') || l.accountCode.startsWith('6'))
        if (isExpense) {
          exps.push(tx)
        } else {
          // Assume revenue if not an explicit expense (e.g. POS transactions)
          revs.push(tx)
        }
      }
    })
    return { revenueTransactions: revs, expenseTransactions: exps }
  }, [transactions, dateFilter])

  const processedData = useMemo(() => {
    return revenueTransactions.map((tx, idx) => {
      let cashAmt = 0
      let gcashAmt = 0
      let chargeAmt = 0
      const amount = tx.totalAmount || tx.amount || 0
      
      if (tx.method === 'CASH') cashAmt = amount
      else if (tx.method === 'GCASH') gcashAmt = amount
      else if (tx.method === 'SPLIT') {
        const cashLine = tx.rawLines?.find((l: any) => l.accountCode === '1020') 
        const gcashLine = tx.rawLines?.find((l: any) => l.accountCode === '1010')
        cashAmt = cashLine ? cashLine.debit : 0
        gcashAmt = gcashLine ? gcashLine.debit : 0
      } else if (tx.method === 'CHARGE') chargeAmt = amount

      const isPreEmp = tx.examType === 'PRE-EMP'
      const isApe = tx.examType === 'APE'
      
      const companyVal = tx.billedEntityType === 'CORPORATE' ? tx.billedEntity : ''
      const clientVal = tx.billedEntityType === 'HMO' ? tx.billedEntity : ''
      const opdWalkin = tx.clientType || 'WALKIN'

        return {
          id: tx.id,
          rawDate: tx.date || tx.createdAt,
          rawLines: tx.rawLines || [],
          items: tx.items || null,
          method: tx.method,
          payeeId: tx.payeeId,
          billedEntity: tx.billedEntity || '',
          billedEntityType: tx.billedEntityType || '',
          examType: tx.examType,
          clientType: tx.clientType,
          no: idx + 1,
          name: tx.patientName || tx.payeeName || '',
          company: companyVal,
          orNo: tx.referenceNo || '',
          client: clientVal,
          opdWalkin: opdWalkin,
          date: new Date(tx.date || tx.createdAt).toLocaleDateString('en-US'),
          particular: cleanDescription(tx.description) || '',
          rawDescription: tx.rawDescription || tx.description || '',
          attachments: tx.attachments || [],
          remarks: tx.remarks || '',
          cash: cashAmt,
          gcash: gcashAmt,
          charge: chargeAmt,
          amount: amount,
          isPreEmp: isPreEmp,
          isApe: isApe
        }
      })
  }, [revenueTransactions])

  const totals = useMemo(() => {
    return processedData.reduce(
      (acc, curr) => {
        acc.cash += curr.cash
        acc.gcash += curr.gcash
        acc.charge += curr.charge
        acc.amount += curr.amount
        return acc
      },
      { cash: 0, gcash: 0, charge: 0, amount: 0 }
    )
  }, [processedData])

  const totalExpenses = useMemo(() => {
    return expenseTransactions.reduce((sum, tx) => {
      const amount = tx.totalAmount || tx.amount || 0
      return sum + amount
    }, 0)
  }, [expenseTransactions])

  const handleExportExcel = () => {
    if (processedData.length === 0) return alert('No data to export.')

    const exportData = processedData.map((row) => ({
      'No.': row.no,
      NAME: row.name,
      COMPANY: row.company,
      'OR NO.': row.orNo,
      'CLIENT (OPD/WALKIN)': row.clientType,
      [row.date]: row.particular, // Template logic: Date header above particular
      'CASH IN HAND': row.cash,
      GCASH: row.gcash,
      CHARGE: row.charge,
      AMOUNT: row.amount,
      'PRE-EMP': row.isPreEmp ? 'YES' : '-',
      APE: row.isApe ? 'YES' : '-'
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)

    // Add Totals Row
    XLSX.utils.sheet_add_json(
      worksheet,
      [
        {
          'No.': '',
          NAME: 'TOTALS',
          COMPANY: '',
          'OR NO.': '',
          'CLIENT (OPD/WALKIN)': '',
          [processedData[0]?.date || 'Date']: '',
          'CASH IN HAND': totals.cash,
          GCASH: totals.gcash,
          CHARGE: totals.charge,
          AMOUNT: totals.amount,
          'PRE-EMP': '-',
          APE: '-'
        }
      ],
      { skipHeader: true, origin: -1 }
    )

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'End of Day Summary')
    XLSX.writeFile(workbook, `End_of_Day_Summary_${dateFilter}.xlsx`)
  }

  const formatCurrency = (val: number) =>
    val > 0
      ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '-'

  const handleEditTransaction = async (row: any) => {
    const todayStr = formatLocalDate()
    const isToday = formatLocalDate(row.rawDate) === todayStr

    if (isToday) {
      if (onEditTransaction) {
        onEditTransaction(row)
      }
    } else {
      // Transaction is after its publication date - prompt for Manager Override PIN
      setPendingEditRow(row)
      setPinInput('')
      setPinError('')
      setIsPinModalOpen(true)
    }
  }

  const handleVerifyAndProceed = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!pinInput.trim()) {
      setPinError('Please enter the Manager Override PIN.')
      return
    }

    setPinVerifying(true)
    setPinError('')

    try {
      const api = (window as any).api || (window as any).electronAPI
      if (!api || !api.verifyManagerPin) {
        setPinError('System Error: Manager verification service unavailable.')
        setPinVerifying(false)
        return
      }

      const res = await api.verifyManagerPin(pinInput.trim())
      if (res && res.success) {
        const rowToEdit = pendingEditRow
        setIsPinModalOpen(false)
        setPendingEditRow(null)
        setPinInput('')
        if (onEditTransaction && rowToEdit) {
          onEditTransaction({
            ...rowToEdit,
            managerOverridePin: pinInput.trim()
          })
        }
      } else {
        setPinError(res?.error || 'Incorrect Manager Override PIN. Access denied.')
      }
    } catch (err: any) {
      setPinError('Verification error: ' + (err?.message || String(err)))
    } finally {
      setPinVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-[#B0DCDA] rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col font-sans text-gray-800 animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 p-6 border-b border-[#B0DCDA] bg-[#f9fafb]">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">
              End of Day Summary Report
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Daily collection summary template for POS.
            </p>
          </div>

        <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
          <div>
            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
              Report Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-40 bg-white border border-[#B0DCDA] rounded-md py-2 px-3 text-sm text-gray-800 font-bold outline-none focus:border-[#1B9387]"
            />
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-4 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-1.5 cursor-pointer h-[38px] disabled:opacity-50"
            title="Refresh transactions"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-5 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2 cursor-pointer h-[38px]"
          >
            <span>📊</span> <span>Export Excel</span>
          </button>
          <button
            onClick={onClose}
            className="bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center cursor-pointer h-[38px]"
          >
            Close
          </button>
        </div>
      </div>

      <div className="bg-white border-t border-[#B0DCDA] flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-full text-[#1B9387]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#FBF8F8] sticky top-0 z-10 border-b border-[#B0DCDA] shadow-sm">
                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                  <th className="p-3 border-r border-gray-100 text-center" rowSpan={2}>
                    No.
                  </th>
                  <th className="p-3 border-r border-gray-100" rowSpan={2}>
                    NAME
                  </th>
                  <th className="p-3 border-r border-gray-100" rowSpan={2}>
                    COMPANY
                  </th>
                  <th className="p-3 border-r border-gray-100" rowSpan={2}>
                    OR NO.
                  </th>
                  <th className="p-3 border-r border-gray-100 text-center" rowSpan={2}>
                    CLIENT
                  </th>
                  <th className="p-3 border-r border-gray-100 text-center" rowSpan={2}>
                    OPD/WALKIN
                  </th>
                  <th className="p-2 border-b border-gray-100 text-center" colSpan={8}>
                    {(() => {
                      const parts = dateFilter.split('-')
                      return parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : dateFilter
                    })()}
                  </th>
                </tr>
                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold bg-[#FBF8F8]">
                  <th className="p-2 border-r border-gray-100">PARTICULAR</th>
                  <th className="p-2 border-r border-gray-100 text-right">CASH IN HAND</th>
                  <th className="p-2 border-r border-gray-100 text-right">GCASH</th>
                  <th className="p-2 border-r border-gray-100 text-right">CHARGE</th>
                  <th className="p-2 border-r border-gray-100 text-right">
                    AMOUNT
                    <br />({totals.amount > 0 ? totals.amount : '...'})
                  </th>
                  <th className="p-2 border-r border-gray-100 text-center">PRE-EMP</th>
                  <th className="p-2 border-r border-gray-100 text-center">APE</th>
                  <th className="p-2 text-center border-gray-100">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedData.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-12 text-center text-gray-500 italic font-medium">
                      No records found for this date.
                    </td>
                  </tr>
                ) : (
                  <>
                    {processedData.map((row) => (
                      <tr
                        key={row.no}
                        className="hover:bg-gray-50 transition-colors even:bg-gray-50/50 odd:bg-white group"
                      >
                        <td className="p-2 text-center border-r border-gray-100 font-bold">
                          {row.no}
                        </td>
                        <td className="p-2 border-r border-gray-100">
                          <button
                            onClick={() => setHistoryModalPatient({ id: (row.company || row.client) ? '' : (row.payeeId || ''), name: row.name })}
                            className="text-[#1B9387] hover:underline hover:text-teal-700 font-semibold text-left"
                          >
                            {row.name}
                          </button>
                        </td>
                        <td className="p-2 border-r border-gray-100">{row.company}</td>
                        <td className="p-2 border-r border-gray-100 font-mono text-xs">
                          {row.orNo}
                        </td>
                        <td className="p-2 border-r border-gray-100 text-center text-xs">
                          {row.client}
                        </td>
                        <td className="p-2 border-r border-gray-100 text-center text-xs">
                          {row.opdWalkin}
                        </td>
                        <td className="p-2 border-r border-gray-100 text-xs truncate max-w-[200px]" title={row.particular}>{row.particular}</td>
                        <td className="p-2 text-right border-r border-gray-100 font-mono">
                          {formatCurrency(row.cash)}
                        </td>
                        <td className="p-2 text-right border-r border-gray-100 font-mono">
                          {formatCurrency(row.gcash)}
                        </td>
                        <td className="p-2 text-right border-r border-gray-100 font-mono">
                          {formatCurrency(row.charge)}
                        </td>
                        <td className="p-2 text-right border-r border-gray-100 font-mono font-bold bg-gray-50/30">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="p-2 text-center border-r border-gray-100 font-extrabold text-xs">
                          {row.isPreEmp ? <span className="text-[#1B9387]">YES</span> : '-'}
                        </td>
                        <td className="p-2 text-center border-r border-gray-100 font-extrabold text-xs">
                          {row.isApe ? <span className="text-[#1B9387]">YES</span> : '-'}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleEditTransaction(row)}
                            className="p-1.5 text-gray-400 hover:text-[#1B9387] hover:bg-[#E9FAFA] rounded-md transition"
                            title="Edit Transaction"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-[#E9FAFA] font-bold border-t-2 border-[#1B9387]">
                      <td
                        colSpan={7}
                        className="p-3 text-right border-r border-[#B0DCDA] text-[#1B9387]"
                      >
                        GRAND TOTAL
                      </td>
                      <td className="p-3 text-right border-r border-[#B0DCDA] font-mono text-[#1B9387]">
                        {formatCurrency(totals.cash)}
                      </td>
                      <td className="p-3 text-right border-r border-[#B0DCDA] font-mono text-[#1B9387]">
                        {formatCurrency(totals.gcash)}
                      </td>
                      <td className="p-3 text-right border-r border-[#B0DCDA] font-mono text-[#1B9387]">
                        {formatCurrency(totals.charge)}
                      </td>
                      <td className="p-3 text-right border-r border-[#B0DCDA] font-mono text-[#1B9387] bg-[#1B9387]/10">
                        {formatCurrency(totals.amount)}
                      </td>
                      <td className="p-3 text-center border-r border-[#B0DCDA] font-mono text-[#1B9387]">
                        -
                      </td>
                      <td className="p-3 text-center font-mono text-[#1B9387] border-r border-[#B0DCDA]">
                        -
                      </td>
                      <td className="p-3 bg-[#E9FAFA]"></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
            <div className="bg-white border border-[#B0DCDA] rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Revenue</h4>
              <p className="text-2xl font-black font-mono text-[#1B9387]">₱ {formatCurrency(totals.amount)}</p>
            </div>
            <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Expenses</h4>
              <p className="text-2xl font-black font-mono text-rose-600">₱ {formatCurrency(totalExpenses)}</p>
            </div>
            <div className="bg-[#1B9387] border border-[#1B9387] rounded-xl p-5 shadow-md">
              <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-1">Net Income</h4>
              <p className="text-2xl font-black font-mono text-white">₱ {formatCurrency(totals.amount - totalExpenses)}</p>
            </div>
          </div>
          </div>
        </div>
      </div>
      <PatientHistoryModal
        isOpen={historyModalPatient !== null}
        onClose={() => setHistoryModalPatient(null)}
        patientId={historyModalPatient?.id || ''}
        patientName={historyModalPatient?.name || ''}
      />

      {/* MANAGER PIN OVERRIDE MODAL */}
      {isPinModalOpen && pendingEditRow && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-amber-50/80 px-6 py-4 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-amber-950 uppercase tracking-wider">
                    Manager Authorization
                  </h3>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Publication Date Lock Override
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPinModalOpen(false)
                  setPendingEditRow(null)
                  setPinInput('')
                  setPinError('')
                }}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleVerifyAndProceed} className="p-6 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-500 uppercase text-[10px]">Invoice Ref:</span>
                  <span className="font-mono font-bold text-gray-800">{pendingEditRow.orNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-500 uppercase text-[10px]">Published Date:</span>
                  <span className="font-bold text-amber-700">{pendingEditRow.date || 'Past Date'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-500 uppercase text-[10px]">Patient:</span>
                  <span className="font-semibold text-gray-800 truncate max-w-[200px]">{pendingEditRow.name || 'Walk-in'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 mt-1">
                  <span className="font-bold text-gray-500 uppercase text-[10px]">Total Amount:</span>
                  <span className="font-mono font-extrabold text-[#1B9387]">₱ {Number(pendingEditRow.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="text-xs text-gray-600 leading-relaxed">
                This transaction was published on a previous date. To modify its items, prices, or patient records, please authorize using the <strong>Manager Override PIN</strong>.
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  Manager PIN
                </label>
                <input
                  type="password"
                  autoFocus
                  maxLength={10}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value)
                    setPinError('')
                  }}
                  placeholder="••••"
                  className="w-full text-center text-2xl font-mono tracking-widest px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-[#1B9387] focus:ring-2 focus:ring-[#1B9387]/20 outline-none transition"
                />
              </div>

              {pinError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false)
                    setPendingEditRow(null)
                    setPinInput('')
                    setPinError('')
                  }}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pinVerifying || !pinInput.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#1B9387] hover:bg-[#167d73] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {pinVerifying ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Authorize & Edit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}