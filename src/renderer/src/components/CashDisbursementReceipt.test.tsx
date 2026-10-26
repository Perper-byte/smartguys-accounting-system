// src/renderer/src/components/CashDisbursementReceipt.test.tsx
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { CashDisbursementReceipt } from './CashDisbursementReceipt'

describe('CashDisbursementReceipt Component', () => {
  it('renders check disbursement voucher for CV- series correctly (Image 2 style)', () => {
    render(
      <CashDisbursementReceipt
        referenceNo="CV-001"
        date="2026-10-22"
        payeeName="MedSupplies Corp"
        amount={11200}
        description="Payment to MedSupplies Corp for PJ-001"
        debitLines={[
          {
            account: { code: '2010', name: 'Accounts Payable' },
            debit: 11200
          }
        ]}
        creditAccount={{ code: '1010', name: 'Cash in Bank' }}
        preparedBy="Accountant"
        verifiedBy="Approved"
      />
    )

    // Clinic name & Voucher Subtitle
    expect(screen.getByText(/SmartGuys Clinic/i)).toBeInTheDocument()
    expect(screen.getByText(/CHECK DISBURSEMENT VOUCHER/i)).toBeInTheDocument()

    // Meta
    expect(screen.getByText('CV-001')).toBeInTheDocument()
    expect(screen.getByText(/Oct 22, 2026/)).toBeInTheDocument()

    // Payee & Disbursed Amount
    expect(screen.getByText('MedSupplies Corp')).toBeInTheDocument()
    expect(screen.getByText(/11,200\.00/)).toBeInTheDocument()

    // Description & Accounts
    expect(
      screen.getByText('Payment to MedSupplies Corp for PJ-001')
    ).toBeInTheDocument()
    expect(screen.getByText('2010 - Accounts Payable')).toBeInTheDocument()
    expect(screen.getByText('1010 - Cash in Bank')).toBeInTheDocument()

    // Signatures
    expect(screen.getByText('Accountant')).toBeInTheDocument()
    expect(screen.getByText(/Prepared By/i)).toBeInTheDocument()
    expect(screen.getByText(/Approved/i)).toBeInTheDocument()
    expect(screen.getByText(/Verified By/i)).toBeInTheDocument()
    expect(screen.getByText(/Received By/i)).toBeInTheDocument()

    // Footer
    expect(
      screen.getByText(/Clinic Internal Check Disbursement Control Slip/i)
    ).toBeInTheDocument()
  })

  it('renders petty cash voucher for PCV- series correctly (matching Image 2)', () => {
    render(
      <CashDisbursementReceipt
        referenceNo="PCV-001"
        date="2026-10-22"
        payeeName="DR. JOSE RIZAL"
        amount={1000}
        description="Petty Cash Out: Dr. Jose Rizal | Purpose: f | Account: Fare & Courier"
        debitLines={[
          {
            account: { code: '5080', name: 'Transportation & Delivery Expense' },
            debit: 1000
          }
        ]}
        preparedBy="cashier"
        verifiedBy="Approved"
      />
    )

    expect(screen.getByText(/PETTY CASH \/ CASH OUTFLOW VOUCHER/i)).toBeInTheDocument()
    expect(screen.getByText('PCV-001')).toBeInTheDocument()
    expect(screen.getByText('DR. JOSE RIZAL')).toBeInTheDocument()
    expect(screen.getByText(/1,000\.00/)).toBeInTheDocument()
    expect(screen.getByText('5080 - Transportation & Delivery Expense')).toBeInTheDocument()
    expect(screen.getByText('cashier')).toBeInTheDocument()
    expect(screen.getByText(/Clinic Internal Petty Cash Control Slip/i)).toBeInTheDocument()
  })

  it('handles multi-split debit lines correctly', () => {
    render(
      <CashDisbursementReceipt
        referenceNo="DV-002"
        date="2026-10-22"
        payeeName="Clinic Vendor"
        amount={3500}
        debitLines={[
          { account: { code: '5010', name: 'Clinic Supplies' }, debit: 2000 },
          { account: { code: '5060', name: 'Office Supplies' }, debit: 1500 }
        ]}
        creditAccount={{ code: '1030', name: 'Cash in Hand' }}
      />
    )

    expect(screen.getByText(/CASH DISBURSEMENT VOUCHER/i)).toBeInTheDocument()
    expect(screen.getByText('5010 - Clinic Supplies')).toBeInTheDocument()
    expect(screen.getByText(/2,000\.00/)).toBeInTheDocument()
    expect(screen.getByText('5060 - Office Supplies')).toBeInTheDocument()
    expect(screen.getByText(/1,500\.00/)).toBeInTheDocument()
    expect(screen.getByText('1030 - Cash in Hand')).toBeInTheDocument()
  })
})

