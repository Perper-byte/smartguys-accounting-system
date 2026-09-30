import React, { useRef, useEffect, useState } from 'react'
import { X, Printer, FileText, Image as ImageIcon, Edit3, Download, Eye } from 'lucide-react'
import { AttachmentPreviewModal } from './AttachmentPreviewModal'

export interface PatientInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  transaction?: any
  transactions?: any[]
  patientName?: string
  autoPrint?: boolean
  onEdit?: (transaction: any) => void
}

function SingleInvoiceContent({
  transaction,
  patientName
}: {
  transaction: any
  patientName?: string
}) {
  const description = transaction?.rawDescription || transaction?.description || ''

  // Extract items metadata if present
  let parsedMetaItems: any[] | null = null
  const itemsMatch = description.match(/\[ITEMS:([\s\S]*?)\]/)
  if (itemsMatch) {
    try {
      parsedMetaItems = JSON.parse(decodeURIComponent(itemsMatch[1]))
    } catch {
      try {
        parsedMetaItems = JSON.parse(itemsMatch[1])
      } catch {}
    }
  }

  // Extract remarks
  let remarks = transaction?.remarks || ''
  if (!remarks) {
    const remarksMatch = description.match(/(?:\n|^)Remarks:\s*([\s\S]*?)(?=\nDiagnostic Test|$)/i)
    if (remarksMatch) {
      remarks = remarksMatch[1].trim()
    }
  }

  const attachments: any[] = transaction?.attachments || []
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null)

  const handleDownloadAttachment = (att: any) => {
    const fileData = att.data || att.fileData
    const fileName = att.fileName || att.name || 'attachment'
    if (!fileData) {
      alert('Attachment data is missing or empty.')
      return
    }

    try {
      const link = document.createElement('a')
      link.href = fileData
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Download failed:', err)
      const w = window.open('')
      w?.document.write(`<img src="${fileData}" style="max-width:100%;"/>`)
    }
  }

  // Extract HMO / AR info
  const hmoMatch = description.match(/\| A\/R:\s*([^|\n]+)/)
  const hmoInfo = hmoMatch ? hmoMatch[1].trim() : ''

  // Extract payment info
  const paymentMatch = description.match(/\| Pt\. Paid:\s*([^|\n]+)/)
  const paymentInfo = paymentMatch ? paymentMatch[1].trim() : ''

  // Extract Diagnostic Tests list
  const diagMatch = description.match(/Diagnostic Test\s*\((.*?)(?:\s*-\s*[^)]*)?\)/)
  let testNames: string[] = []
  if (diagMatch && diagMatch[1]) {
    testNames = diagMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  // Calculate lines breakdown
  const lines: any[] = transaction?.lines || []

  // Revenue lines (credit > 0, excluding VAT 2020)
  const revenueLines = lines.filter((l) => {
    const code = l.account?.code || l.accountCode || l.accountId || ''
    return Number(l.credit) > 0 && code !== '2020'
  })

  // VAT Payable line
  const vatLine = lines.find((l) => {
    const code = l.account?.code || l.accountCode || l.accountId || ''
    return Number(l.credit) > 0 && code === '2020'
  })
  const vatAmount = vatLine ? Number(vatLine.credit) : 0

  // Total gross/net
  const subTotal = revenueLines.reduce((sum, l) => sum + Number(l.credit), 0)
  const fallbackTotal = Number(transaction?.totalAmount || transaction?.amount || 0)
  const grandTotal = subTotal + vatAmount > 0 ? subTotal + vatAmount : fallbackTotal
  const finalSubTotal = subTotal > 0 ? subTotal : grandTotal - vatAmount

  // Patient Share vs A/R share
  const arLines = lines.filter((l) => {
    const code = l.account?.code || l.accountCode || l.accountId || ''
    return Number(l.debit) > 0 && (code === '1210' || code === '1200')
  })
  const arAmount = arLines.reduce((sum, l) => sum + Number(l.debit), 0)
  const patientPaid = grandTotal - arAmount

  // Construct table items
  let itemsToDisplay: { item: string; description: string; amount: number }[] = []

  if (parsedMetaItems && Array.isArray(parsedMetaItems) && parsedMetaItems.length > 0) {
    itemsToDisplay = parsedMetaItems.map((item: any) => ({
      item: item.description || (item.accountCode === '4020' ? 'Laboratory / Diagnostic Test' : 'Medical Consultation / Services'),
      description: item.accountCode === '4020' ? 'Diagnostic & Laboratory Procedure' : 'Clinical & Medical Service',
      amount: (Number(item.quantity) || 1) * (Number(item.price) || 0)
    }))
  } else if (testNames.length > 0) {
    const amountPerTest = testNames.length > 0 ? finalSubTotal / testNames.length : finalSubTotal
    itemsToDisplay = testNames.map((name) => ({
      item: name,
      description: 'Diagnostic & Laboratory Procedure',
      amount: amountPerTest
    }))
  } else if (revenueLines.length > 0) {
    itemsToDisplay = revenueLines.map((l) => ({
      item: l.account?.name || l.accountName || 'Medical Service',
      description: `Account Code: ${l.account?.code || l.accountCode || l.accountId || '4000'}`,
      amount: Number(l.credit)
    }))
  } else {
    itemsToDisplay = [
      {
        item: 'Medical Consultation / Services',
        description: 'Healthcare & Clinical Services',
        amount: grandTotal
      }
    ]
  }

  const formattedDate = new Date(
    transaction?.date || transaction?.created_at || Date.now()
  ).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const resolvedPatientName =
    patientName || transaction?.patientName || transaction?.payeeName || 'Walk-in Patient'

  return (
    <div className="print-invoice-page bg-white px-6 py-4 space-y-3 text-gray-800 font-sans">
      {/* Top Header */}
      <div className="border-b border-gray-200 pb-2 flex justify-between items-center">
        <div>
          <h2 className="text-base font-black tracking-tight text-gray-900 uppercase">
            Patient History / Transaction
          </h2>
          <p className="text-[11px] text-gray-500 font-medium">
            Official billing statement & record
          </p>
        </div>
        <div className="text-right text-xs text-gray-600 font-mono">
          <span className="text-gray-400 font-medium">Date: </span>
          <strong className="text-gray-800 font-bold">{formattedDate}</strong>
        </div>
      </div>

      {/* Patient Information & Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        {/* Patient Info */}
        <div className="sm:col-span-2 bg-gray-50/80 border-l-4 border-[#1B9387] rounded-r-xl px-3 py-2 flex flex-col justify-center">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">
            Patient Information
          </span>
          <div className="text-sm font-black text-gray-900 leading-snug truncate">
            {resolvedPatientName}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-[10.5px]">
            {hmoInfo && (
              <span className="text-indigo-700 font-semibold">
                Coverage: <strong className="font-bold">{hmoInfo}</strong>
              </span>
            )}
            {paymentInfo && (
              <span className="text-gray-600">
                Payment: <strong className="font-semibold">{paymentInfo}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Invoice Number */}
        <div className="bg-gray-50/80 border border-gray-200 rounded-xl px-3 py-2 flex flex-col justify-center">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">
            Invoice Number
          </span>
          <span className="text-base font-black font-mono text-gray-900 leading-tight">
            {transaction?.reference_no || transaction?.referenceNo || 'N/A'}
          </span>
        </div>

        {/* Amount Due */}
        <div className="bg-[#E9FAFA] border border-[#B0DCDA] rounded-xl px-3 py-2 flex flex-col justify-center">
          <span className="text-[9px] font-bold text-[#1B9387] uppercase tracking-widest block">
            Amount Due
          </span>
          <span className="text-base font-black font-mono text-[#1B9387] leading-tight">
            ₱ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Items Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold text-[10.5px] uppercase tracking-wider">
              <th className="py-2 px-3 w-1/3">Item</th>
              <th className="py-2 px-3">Description</th>
              <th className="py-2 px-3 text-right w-1/4">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {itemsToDisplay.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50/50 transition">
                <td className="py-1.5 px-3 font-bold text-gray-800">{row.item}</td>
                <td className="py-1.5 px-3 text-gray-500 text-[11px]">{row.description}</td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-gray-800">
                  ₱ {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Section - Right-aligned */}
      <div className="flex justify-end pt-1">
        <div className="w-full sm:w-72 space-y-1 text-xs">
          <div className="flex justify-between items-center text-gray-600">
            <span className="font-bold uppercase tracking-wider text-[11px]">Sub Total</span>
            <span className="font-mono font-semibold">
              ₱ {finalSubTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {vatAmount > 0 ? (
            <div className="flex justify-between items-center text-gray-600">
              <span className="font-bold uppercase tracking-wider text-[11px]">Tax (12% VAT)</span>
              <span className="font-mono font-semibold">
                ₱ {vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div className="flex justify-between items-center text-gray-500 text-[11px]">
              <span className="font-bold uppercase tracking-wider">Tax Rate</span>
              <span className="font-mono">Non-VAT / Exempt</span>
            </div>
          )}

          {/* Total Banner */}
          <div className="flex justify-between items-center bg-[#E9FAFA] border border-[#B0DCDA] rounded-lg px-3 py-1.5 text-[#1B9387]">
            <span className="font-black uppercase tracking-wider text-xs">Total</span>
            <span className="text-base font-black font-mono">
              ₱ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Breakdown if HMO or Corporate covered */}
          {arAmount > 0 && (
            <div className="pt-1 border-t border-gray-100 space-y-0.5 text-[11px]">
              <div className="flex justify-between text-indigo-600 font-semibold">
                <span>HMO / Corp Coverage:</span>
                <span className="font-mono">
                  - ₱ {arAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-gray-700 font-bold">
                <span>Patient Paid:</span>
                <span className="font-mono">
                  ₱ {patientPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Remarks Section - Full Width below Totals */}
      <div className="w-full pt-1">
        <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-2.5 w-full">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
            Remarks & Audit Trail
          </span>
          {(() => {
            const userRemarksMatch = remarks.match(/\[User own remarks\]\s*([\s\S]*?)(?=\n\s*\[Initial generated Remarks\]|$)/i)
            const initialRemarksMatch = remarks.match(/\[Initial generated Remarks\]\s*([\s\S]*?)(?=\n\s*\[Edited Remarks\]|$)/i)
            const editedRemarksMatch = remarks.match(/\[Edited Remarks\]\s*([\s\S]*)$/i)
            const isStructured = Boolean(userRemarksMatch || initialRemarksMatch || editedRemarksMatch)

            if (!remarks) {
              return <span className="text-gray-400 italic font-normal text-xs">None</span>
            }

            if (!isStructured) {
              return (
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-medium break-words [overflow-wrap:anywhere]">
                  {remarks}
                </p>
              )
            }

            const userText = userRemarksMatch ? userRemarksMatch[1].trim() : ''
            const initialText = initialRemarksMatch ? initialRemarksMatch[1].trim() : ''
            const editedText = editedRemarksMatch ? editedRemarksMatch[1].trim() : ''

            return (
              <div className="space-y-1.5 text-xs w-full">
                {userText && userText !== 'None' && (
                  <div className="bg-white/95 p-2 rounded-lg border border-teal-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-[#1B9387] uppercase tracking-wider block mb-0.5">
                      [User own remarks]
                    </span>
                    <p className="text-gray-800 font-medium whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] text-[11px]">
                      {userText}
                    </p>
                  </div>
                )}

                {initialText && (
                  <div className="bg-white/90 p-2 rounded-lg border border-gray-200/90 shadow-2xs">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                      [Initial generated Remarks]
                    </span>
                    <p className="text-gray-600 font-normal whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] text-[10.5px]">
                      {initialText}
                    </p>
                  </div>
                )}

                {editedText && editedText !== 'None' && (
                  <div className="bg-amber-50/80 p-2 rounded-lg border border-amber-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block mb-0.5">
                      [Edited Remarks]
                    </span>
                    <p className="text-gray-700 font-medium whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] text-[10.5px]">
                      {editedText}
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Attached images/files indicator if any */}
          {attachments.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-gray-200/60">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                Attachments ({attachments.length}) • Click to preview
              </span>
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((att: any, idx: number) => {
                  const fileData = att.data || att.fileData
                  const fileName = att.fileName || att.name || 'Attachment'
                  const isImg = att.fileType?.includes('image') || att.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName)

                  return (
                    <div key={idx} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (fileData) {
                            setPreviewAttachment({
                              name: fileName,
                              data: fileData,
                              type: att.fileType || att.type || (isImg ? 'image/png' : 'application/pdf')
                            })
                          } else {
                            handleDownloadAttachment(att)
                          }
                        }}
                        title={`Click to preview ${fileName}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 rounded-md text-[10px] text-gray-700 hover:text-emerald-800 font-semibold shadow-2xs transition-all cursor-pointer group"
                      >
                        {isImg ? (
                          <ImageIcon size={12} className="text-[#1B9387] group-hover:scale-110 transition-transform" />
                        ) : (
                          <FileText size={12} className="text-[#1B9387] group-hover:scale-110 transition-transform" />
                        )}
                        <span className="truncate max-w-[180px]">{fileName}</span>
                        <Eye size={11} className="text-gray-400 group-hover:text-emerald-600 transition-colors ml-0.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {previewAttachment && (
            <AttachmentPreviewModal
              attachment={previewAttachment}
              onClose={() => setPreviewAttachment(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function PatientInvoiceModal({
  isOpen,
  onClose,
  transaction,
  transactions,
  patientName,
  autoPrint = false,
  onEdit
}: PatientInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const txList = transactions && transactions.length > 0 ? transactions : transaction ? [transaction] : []

  useEffect(() => {
    if (isOpen && autoPrint && txList.length > 0) {
      const timer = setTimeout(() => {
        window.print()
      }, 300)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [isOpen, autoPrint, txList.length])

  if (!isOpen || txList.length === 0) return null

  const handlePrint = () => {
    window.print()
  }

  const isBulk = txList.length > 1

  return (
    <div className="fixed inset-0 z-[30000] flex items-center justify-center bg-black/65 backdrop-blur-sm p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200 print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible print:[backdrop-filter:none] print:[filter:none] print:block print:w-full print:h-auto">
      {/* Print CSS styles to ensure clean 1-page fit and proper bulk page breaks */}
      <style>{`
        @page {
          size: portrait;
          margin: 8mm 10mm;
        }
        @media print {
          /* Force exact backgrounds and text colors */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything in the body by default */
          body * {
            visibility: hidden !important;
          }

          /* Explicitly restore visibility to the printable invoice modal and ALL its descendants */
          #printable-invoice-modal,
          #printable-invoice-modal * {
            visibility: visible !important;
          }

          /* Position the printable invoice modal at the very top of the page */
          #printable-invoice-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: visible !important;
            display: block !important;
            z-index: 99999 !important;
          }

          .print-invoice-scroll-area {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            display: block !important;
          }

          .print-invoice-wrapper {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-invoice-wrapper:not(:last-child) {
            page-break-after: always !important;
            break-after: page !important;
          }

          .print-invoice-wrapper:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .print-invoice-page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box;
            min-height: auto !important;
            height: auto !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      <div
        id="printable-invoice-modal"
        ref={printRef}
        className="bg-white border border-[#B0DCDA] rounded-2xl shadow-2xl w-full max-w-4xl my-auto flex flex-col overflow-hidden text-gray-800 font-sans print:border-none print:shadow-none print:w-full print:max-w-full print:m-0 print:p-0 print:overflow-visible print:block print:max-h-none max-h-[96vh]"
      >
        {/* Top Control Bar */}
        <div className="flex justify-between items-center px-6 py-3 border-b border-gray-100 bg-[#FBF8F8] print:hidden shrink-0">
          <div>
            <h2 className="text-base font-black tracking-tight text-gray-900 uppercase">
              {isBulk ? `Bulk Invoices (${txList.length} Pages)` : 'Patient History / Transaction'}
            </h2>
            <p className="text-[11px] text-gray-500 font-medium">
              {isBulk
                ? 'Each invoice will print on its own separate page in the PDF'
                : 'Official billing statement & record'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isBulk && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEdit(txList[0])
                }}
                className="px-3 py-1.5 bg-white hover:bg-teal-50 border border-gray-200 hover:border-[#B0DCDA] text-gray-700 hover:text-[#1B9387] rounded-xl transition flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
                title="Edit Transaction"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Invoice</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-xl transition flex items-center gap-1.5 text-xs font-bold shadow-md shadow-[#1B9387]/20 cursor-pointer"
              title="Print to PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isBulk ? `Print All (${txList.length} Pages)` : 'Print Record'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice(s) Scroll Area */}
        <div className="print-invoice-scroll-area flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden divide-y-2 divide-dashed divide-gray-200 print:divide-none">
          {txList.map((tx, idx) => (
            <div key={tx.id || idx} className="print-invoice-wrapper relative">
              {isBulk && (
                <div className="px-6 pt-3 pb-0 text-[10.5px] font-bold text-gray-400 uppercase tracking-widest print:hidden">
                  Invoice {idx + 1} of {txList.length}
                </div>
              )}
              <SingleInvoiceContent
                transaction={tx}
                patientName={patientName || tx.patientName || tx.payeeName}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-between items-center print:hidden shrink-0">
          <span className="text-[11px] text-gray-500 font-semibold">
            {isBulk ? `${txList.length} invoices ready for printing` : 'Ready to print or save as PDF'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition text-xs cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-[#1B9387] hover:bg-[#15796f] text-white font-bold transition flex items-center gap-1.5 text-xs shadow-md shadow-[#1B9387]/20 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              {isBulk ? `Print All (${txList.length})` : 'Print Record'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
