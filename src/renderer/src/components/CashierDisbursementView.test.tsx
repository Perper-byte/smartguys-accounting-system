// src/renderer/src/components/CashierDisbursementView.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CashierDisbursementView } from './CashierDisbursementView'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('CashierDisbursementView Component', () => {
  let mockApi: ReturnType<typeof setupMockElectronAPI>

  const sampleRecentVouchers = [
    {
      id: 'pcv-1',
      referenceNo: 'PCV-001',
      date: '2026-10-12T10:00:00Z',
      description: 'Purchased 5 gallons distilled drinking water',
      payeeName: 'Aqua Pure Refilling',
      amount: 250,
      expenseAccountCode: '5020',
      expenseAccountName: 'Utilities & Water',
      sourceAccountCode: '1030',
      sourceAccountName: 'Cash in Hand',
      cashierName: 'cashier_mary',
      status: 'POSTED',
      attachments: []
    }
  ]

  beforeEach(() => {
    mockApi = setupMockElectronAPI({
      cashierDisbursements: sampleRecentVouchers,
      accounts: [
        { code: '5010', name: 'Clinic / Med Supplies', account_type: { name: 'Expense' } },
        { code: '5020', name: 'Utilities & Water', account_type: { name: 'Expense' } },
        { code: '1030', name: 'Cash in Hand', account_type: { name: 'Assets' } }
      ]
    })
  })

  test('renders Cashier Cash Out & Petty Cash header and quick category selectors', () => {
    render(<CashierDisbursementView userId="cashier-1" />)

    expect(screen.getByText(/Cashier Cash Out & Petty Cash/i)).toBeInTheDocument()
    expect(screen.getByText('Clinic / Med Supplies')).toBeInTheDocument()
    expect(screen.getByText('Utilities & Water')).toBeInTheDocument()
    expect(screen.getByText('Staff Meals & Snacks')).toBeInTheDocument()
  })

  test('filters history table by expense category', async () => {
    render(<CashierDisbursementView userId="cashier-1" />)

    await waitFor(() => {
      expect(screen.getAllByText('PCV-001').length).toBeGreaterThan(0)
      expect(screen.getByText('Aqua Pure Refilling')).toBeInTheDocument()
    })

    const categorySelect = screen.getByDisplayValue('All Categories')
    expect(categorySelect).toBeInTheDocument()

    fireEvent.change(categorySelect, { target: { value: 'Medical Supplies (5010)' } })

    await waitFor(() => {
      // Utilities voucher should be filtered out
      expect(screen.queryByText('Aqua Pure Refilling')).not.toBeInTheDocument()
    })
  })

  test('enforces mandatory receipt photo before disbursement submission', async () => {
    render(<CashierDisbursementView userId="cashier-1" />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Confirm & Issue Petty Cash Voucher/i })
      ).toBeInTheDocument()
    })

    const amountInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(amountInput, { target: { value: '350' } })

    const payeeInput = screen.getByPlaceholderText(/e\.g\. Water Station, Grab, Staff/i)
    fireEvent.change(payeeInput, { target: { value: 'Mercury Drug' } })

    const particularsInput = screen.getByPlaceholderText(/e\.g\. 5 gallons drinking water/i)
    fireEvent.change(particularsInput, { target: { value: 'Cotton rolls and 70% alcohol' } })

    const submitBtn = screen.getByRole('button', { name: /Confirm & Issue Petty Cash Voucher/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Receipt photo is mandatory/i)).toBeInTheDocument()
      expect(mockApi.submitJournalEntry).not.toHaveBeenCalled()
    })
  })
})
