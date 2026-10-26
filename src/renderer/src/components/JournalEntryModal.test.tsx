// src/renderer/src/components/JournalEntryModal.test.tsx
import * as React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { JournalEntryModal } from './JournalEntryModal'

describe('JournalEntryModal Component', () => {
  const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {})

  afterEach(() => {
    printSpy.mockClear()
  })

  afterAll(() => {
    printSpy.mockRestore()
  })

  const cashDisbursementEntry = {
    id: 'je-cv-001',
    reference_no: 'CV-001',
    date: '2026-10-22T00:00:00.000Z',
    status: 'ACTIVE',
    description: 'Payment to MedSupplies Corp for PJ-001',
    payee: { id: 'p-1', name: 'MedSupplies Corp' },
    user: { username: 'Accountant' },
    lines: [
      {
        id: 'l-1',
        account: { code: '2010', name: 'Accounts Payable' },
        debit: 11200,
        credit: 0
      },
      {
        id: 'l-2',
        account: { code: '1010', name: 'Cash in Bank' },
        debit: 0,
        credit: 11200
      }
    ]
  }

  const generalJournalEntry = {
    id: 'je-jv-001',
    reference_no: 'JV-001',
    date: '2026-10-22T00:00:00.000Z',
    status: 'ACTIVE',
    description: 'Year-end depreciation adjustment',
    payee: null,
    user: { username: 'Accountant' },
    lines: [
      {
        id: 'l-3',
        account: { code: '5030', name: 'Depreciation Expense' },
        debit: 5000,
        credit: 0
      },
      {
        id: 'l-4',
        account: { code: '1510', name: 'Accumulated Depreciation' },
        debit: 0,
        credit: 5000
      }
    ]
  }

  it('renders cash disbursement with printable voucher slip matching Image 2', () => {
    const handleClose = jest.fn()
    const { container } = render(
      <JournalEntryModal
        entry={cashDisbursementEntry}
        isCashDisbursement={true}
        onClose={handleClose}
      />
    )

    // Modal title & status
    expect(screen.getByText('Journal: CV-001')).toBeInTheDocument()
    expect(screen.getAllByText('Recorded').length).toBeGreaterThanOrEqual(1)

    // View toggle is available for disbursements
    expect(screen.getByText('Journal Details')).toBeInTheDocument()
    expect(screen.getByText('Voucher Slip')).toBeInTheDocument()

    // The printable voucher receipt container MUST exist
    const printableSlip = container.querySelector('#printable-voucher-receipt')
    expect(printableSlip).toBeInTheDocument()
    expect(printableSlip).toHaveTextContent(/CHECK DISBURSEMENT VOUCHER/i)
    expect(within(printableSlip as HTMLElement).getByText('CV-001')).toBeInTheDocument()
    expect(within(printableSlip as HTMLElement).getByText('MedSupplies Corp')).toBeInTheDocument()
    expect(printableSlip).toHaveTextContent(/11,200\.00/)

    // Standard journal sheet should NOT exist for cash disbursement
    const standardSheet = container.querySelector('#printable-journal-sheet')
    expect(standardSheet).toBeNull()

    // Clicking Print calls window.print()
    const printBtn = screen.getByTitle('Print Cash Disbursement Voucher Slip')
    fireEvent.click(printBtn)
    expect(printSpy).toHaveBeenCalled()
  })

  it('allows toggling to Voucher Slip preview tab on screen for cash disbursements', () => {
    render(
      <JournalEntryModal
        entry={cashDisbursementEntry}
        isCashDisbursement={true}
        onClose={jest.fn()}
      />
    )

    const voucherTab = screen.getByText('Voucher Slip')
    fireEvent.click(voucherTab)

    expect(
      screen.getByText('Print Preview — Receipt / Voucher Slip')
    ).toBeInTheDocument()

    // Both on-screen preview and printable slip contain the footer text
    const footers = screen.getAllByText(/Clinic Internal Check Disbursement Control Slip/i)
    expect(footers.length).toBeGreaterThanOrEqual(1)
  })

  it('strictly ensures non-disbursements (JV/ADJ/PJ) DO NOT use the receipt voucher slip', () => {
    const { container } = render(
      <JournalEntryModal
        entry={generalJournalEntry}
        isCashDisbursement={false}
        onClose={jest.fn()}
      />
    )

    expect(screen.getByText('Journal: JV-001')).toBeInTheDocument()

    // View toggle MUST NOT be present for non-disbursements
    expect(screen.queryByText('Voucher Slip')).toBeNull()

    // Receipt voucher MUST NOT exist
    const printableSlip = container.querySelector('#printable-voucher-receipt')
    expect(printableSlip).toBeNull()

    // Standard journal sheet MUST exist
    const standardSheet = container.querySelector('#printable-journal-sheet')
    expect(standardSheet).toBeInTheDocument()
    expect(standardSheet).toHaveTextContent('JOURNAL VOUCHER')
    expect(within(standardSheet as HTMLElement).getByText('JV-001')).toBeInTheDocument()

    // Print button should say Print Journal
    const printBtn = screen.getByTitle('Print Journal Voucher')
    fireEvent.click(printBtn)
    expect(printSpy).toHaveBeenCalled()
  })
})

