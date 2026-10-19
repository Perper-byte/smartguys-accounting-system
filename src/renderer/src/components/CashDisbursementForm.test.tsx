// src/renderer/src/components/CashDisbursementForm.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { CashDisbursementForm } from './CashDisbursementForm'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('CashDisbursementForm Component - Source of Funds Filtering', () => {
  const sampleAccounts = [
    { code: '1010', name: 'Cash in Bank', account_type: { name: 'Asset' } },
    { code: '1020', name: 'Petty Cash Fund', account_type: { name: 'Asset' } },
    { code: '1030', name: 'Cash in Hand', account_type: { name: 'Asset' } },
    { code: '1200', name: 'Accounts Receivable', account_type: { name: 'Asset' } },
    { code: '1210', name: 'Advances to Officers & Employees', account_type: { name: 'Asset' } },
    { code: '1300', name: 'Input VAT', account_type: { name: 'Asset' } },
    { code: '1310', name: 'Creditable Withholding Tax (CWT)', account_type: { name: 'Asset' } },
    { code: '1400', name: 'Prepaid Rent', account_type: { name: 'Asset' } },
    { code: '1500', name: 'Medical Equipment', account_type: { name: 'Asset' } },
    { code: '1501', name: 'Accumulated Depreciation', account_type: { name: 'Asset' } },
    { code: '5010', name: 'Medical Supplies Expense', account_type: { name: 'Expense' } },
    { code: '5020', name: 'Utilities Expense', account_type: { name: 'Expense' } }
  ]

  beforeEach(() => {
    setupMockElectronAPI({
      accounts: sampleAccounts,
      recentDisbursements: [],
      historicalDisbursements: [],
      cashierDisbursements: []
    })
  })

  test('only leaves cash in hand, bank, and petty cash in Source of Funds dropdown', async () => {
    render(<CashDisbursementForm userId="usr-1" />)

    let sourceSelect: HTMLSelectElement
    await waitFor(() => {
      sourceSelect = screen.getByLabelText(/Source of Funds \(Credit Asset\)/i) as HTMLSelectElement
      expect(sourceSelect.options.length).toBeGreaterThan(0)
    })

    const optionTexts = Array.from(sourceSelect!.options).map((opt) => opt.text.trim())

    // 1010, 1020, 1030 must be in the options
    expect(optionTexts).toContain('1010 - Cash in Bank')
    expect(optionTexts).toContain('1020 - Petty Cash Fund')
    expect(optionTexts).toContain('1030 - Cash in Hand')

    // Only 3 cash accounts should be present
    expect(optionTexts.length).toBe(3)

    // Non-cash asset accounts MUST NOT be present
    expect(optionTexts.some((t) => t.includes('1200'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('1210'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('1300'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('1310'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('1400'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('1500'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('1501'))).toBe(false)
  })
})
