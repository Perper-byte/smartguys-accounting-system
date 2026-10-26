// src/renderer/src/components/CashDisbursementReceipt.tsx
import * as React from 'react'
import { cleanDescription } from '../utils/formatters'

export interface CashDisbursementReceiptProps {
  referenceNo: string
  date: string | Date
  payeeName?: string | null
  amount: number
  description?: string | null
  debitLines?: Array<{
    account?: { code: string; name: string }
    debit?: number
    description?: string
  }>
  creditAccount?: { code: string; name: string } | null
  preparedBy?: string | null
  verifiedBy?: string | null
  receivedBy?: string | null
  id?: string
  className?: string
}

export const CashDisbursementReceipt: React.FC<CashDisbursementReceiptProps> = ({
  referenceNo,
  date,
  payeeName,
  amount,
  description,
  debitLines = [],
  creditAccount,
  preparedBy,
  verifiedBy = 'Approved',
  receivedBy,
  id,
  className = ''
}) => {
  const refStr = String(referenceNo || '').toUpperCase()

  // Determine dynamic voucher title and footer based on reference type
  let voucherSubtitle = 'CASH DISBURSEMENT VOUCHER'
  let footerSlipText = 'Clinic Internal Cash Disbursement Control Slip'

  if (refStr.startsWith('PCV-')) {
    voucherSubtitle = 'PETTY CASH / CASH OUTFLOW VOUCHER'
    footerSlipText = 'Clinic Internal Petty Cash Control Slip'
  } else if (refStr.startsWith('CV-')) {
    voucherSubtitle = 'CHECK DISBURSEMENT VOUCHER'
    footerSlipText = 'Clinic Internal Check Disbursement Control Slip'
  } else if (refStr.startsWith('REF-')) {
    voucherSubtitle = 'BANK TRANSFER DISBURSEMENT VOUCHER'
    footerSlipText = 'Clinic Internal Bank Transfer Control Slip'
  } else if (refStr.startsWith('DV-') || refStr.startsWith('CDV-')) {
    voucherSubtitle = 'CASH DISBURSEMENT VOUCHER'
    footerSlipText = 'Clinic Internal Cash Disbursement Control Slip'
  }

  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : '—'

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // Prepared by default label
  const displayPreparedBy =
    preparedBy || (refStr.startsWith('PCV-') ? 'cashier' : 'Accountant')

  // Description fallback
  const cleanedDesc = description ? cleanDescription(description) : ''
  const displayDesc =
    cleanedDesc ||
    (debitLines.length > 0 && debitLines[0].description
      ? cleanDescription(debitLines[0].description)
      : 'Cash disbursement payout')

  return (
    <div
      id={id}
      className={`voucher-slip-card font-sans text-gray-900 bg-white ${className}`}
      style={{
        width: '450px',
        maxWidth: '450px',
        margin: '0 auto',
        border: '2px dashed #9ca3af',
        borderRadius: '8px',
        padding: '24px',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        display: 'block'
      }}
    >
      {/* Header */}
      <div className="text-center pb-4 border-b border-gray-300 mb-4">
        <h2 className="text-xl font-black uppercase tracking-wider text-gray-900">
          SmartGuys Clinic
        </h2>
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
          {voucherSubtitle}
        </p>
      </div>

      {/* Voucher Meta */}
      <div className="flex justify-between items-center text-xs mb-3">
        <div>
          <span className="text-gray-500">Voucher No: </span>
          <span className="font-mono font-bold text-gray-900">{referenceNo || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Date: </span>
          <span className="font-bold text-gray-900">{formattedDate}</span>
        </div>
      </div>

      {/* Payee & Amount Box */}
      <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-4 space-y-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 font-medium">Paid To:</span>
          <span className="font-black text-gray-800 uppercase truncate max-w-[280px]">
            {payeeName || '—'}
          </span>
        </div>
        <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-200">
          <span className="text-gray-500 font-medium">Amount Disbursed:</span>
          <span className="text-lg font-black font-mono text-gray-900">
            ₱ {formatCurrency(amount)}
          </span>
        </div>
      </div>

      {/* Particulars & Account */}
      <div className="space-y-3 text-xs mb-6">
        <div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
            Particulars / Description
          </span>
          <p className="font-semibold text-gray-800 mt-0.5 whitespace-pre-wrap leading-relaxed">
            {displayDesc}
          </p>
        </div>

        {/* Charge to Account */}
        <div className="pt-2 border-t border-gray-200">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
            Charge to Account
          </span>
          {debitLines.length <= 1 ? (
            <span className="font-mono font-bold text-gray-700">
              {debitLines[0]?.account?.code
                ? `${debitLines[0].account.code} - ${debitLines[0].account.name}`
                : '—'}
            </span>
          ) : (
            <div className="space-y-1 mt-1">
              {debitLines.map((line, idx) => (
                <div key={idx} className="flex justify-between items-center font-mono text-[11px]">
                  <span className="text-gray-700 font-bold">
                    {line.account?.code} - {line.account?.name}
                  </span>
                  <span className="text-gray-900 font-semibold">
                    ₱ {formatCurrency(Number(line.debit || 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disbursed From Account */}
        {creditAccount && (
          <div className="pt-2 border-t border-gray-200">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
              Disbursed From
            </span>
            <span className="font-mono font-bold text-gray-700">
              {creditAccount.code} - {creditAccount.name}
            </span>
          </div>
        )}
      </div>

      {/* Signature Blocks */}
      <div className="grid grid-cols-3 gap-2 pt-6 border-t-2 border-dashed border-gray-300 text-center text-[10px]">
        <div>
          <div className="border-b border-gray-400 pb-1 mb-1 font-bold text-gray-800 truncate">
            {displayPreparedBy}
          </div>
          <span className="text-gray-400 font-semibold uppercase">Prepared By</span>
        </div>
        <div>
          <div className="border-b border-gray-400 pb-1 mb-1 font-bold text-gray-800">
            {verifiedBy}
          </div>
          <span className="text-gray-400 font-semibold uppercase">Verified By</span>
        </div>
        <div>
          <div className="border-b border-gray-400 pb-1 mb-1 font-bold text-gray-800">
            {receivedBy || '\u00A0'}
          </div>
          <span className="text-gray-400 font-semibold uppercase">Received By</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-[9px] text-gray-400 italic">
        {footerSlipText}
      </div>
    </div>
  )
}
