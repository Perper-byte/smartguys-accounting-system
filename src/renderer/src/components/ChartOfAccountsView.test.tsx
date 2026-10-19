// src/renderer/src/components/ChartOfAccountsView.test.tsx
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChartOfAccountsView } from './ChartOfAccountsView'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('ChartOfAccountsView Component', () => {
  const sampleAccounts = [
    { code: '1010', name: 'Cash on Hand', type_id: 'type-asset', account_type: { id: 'type-asset', name: 'Asset', normal_balance: 'DEBIT' } },
    { code: '1020', name: 'Cash in Bank', type_id: 'type-asset', account_type: { id: 'type-asset', name: 'Asset', normal_balance: 'DEBIT' } },
    { code: '2010', name: 'Accounts Payable', type_id: 'type-liability', account_type: { id: 'type-liability', name: 'Liability', normal_balance: 'CREDIT' } },
    { code: '3010', name: "Owner's Capital", type_id: 'type-equity', account_type: { id: 'type-equity', name: 'Equity', normal_balance: 'CREDIT' } },
    { code: '4010', name: 'Consultation Revenue', type_id: 'type-revenue', account_type: { id: 'type-revenue', name: 'Revenue', normal_balance: 'CREDIT' } },
    { code: '5010', name: 'Medical Supplies Expense', type_id: 'type-expense', account_type: { id: 'type-expense', name: 'Expense', normal_balance: 'DEBIT' } }
  ]

  const sampleTypes = [
    { id: 'type-asset', name: 'Asset', normal_balance: 'DEBIT' },
    { id: 'type-liability', name: 'Liability', normal_balance: 'CREDIT' },
    { id: 'type-equity', name: 'Equity', normal_balance: 'CREDIT' },
    { id: 'type-revenue', name: 'Revenue', normal_balance: 'CREDIT' },
    { id: 'type-expense', name: 'Expense', normal_balance: 'DEBIT' }
  ]

  beforeEach(() => {
    setupMockElectronAPI({
      accounts: sampleAccounts,
      accountTypes: sampleTypes
    })
  })

  test('renders accounts grouped into collapsible type dropdowns matching services and pricing style', async () => {
    render(<ChartOfAccountsView />)

    await waitFor(() => {
      expect(screen.getByText('Cash on Hand')).toBeInTheDocument()
    })

    // Verify category dropdown headers are displayed with counts
    expect(screen.getAllByText('Asset').length).toBeGreaterThan(0)
    expect(screen.getByText('2 items')).toBeInTheDocument()
    expect(screen.getAllByText('Liability').length).toBeGreaterThan(0)
    expect(screen.getByText('1010')).toBeInTheDocument()
    expect(screen.getByText('Cash on Hand')).toBeInTheDocument()
    expect(screen.getByText('Accounts Payable')).toBeInTheDocument()
  })

  test('clicking a category dropdown header collapses and expands its account rows', async () => {
    render(<ChartOfAccountsView />)

    await waitFor(() => {
      expect(screen.getByText('Cash on Hand')).toBeInTheDocument()
    })

    // Click on "Asset" header (which displays "2 items") to collapse
    const assetHeader = screen.getByText('2 items').closest('tr')!
    fireEvent.click(assetHeader)

    // Items under Asset should no longer be visible
    expect(screen.queryByText('Cash on Hand')).toBeNull()
    expect(screen.queryByText('Cash in Bank')).toBeNull()
    // Items under Liability should still be visible
    expect(screen.getByText('Accounts Payable')).toBeInTheDocument()

    // Click on "Asset" header again to expand
    fireEvent.click(assetHeader)
    expect(screen.getByText('Cash on Hand')).toBeInTheDocument()
    expect(screen.getByText('Cash in Bank')).toBeInTheDocument()
  })

  test('collapse all and expand all toggle button works', async () => {
    render(<ChartOfAccountsView />)

    await waitFor(() => {
      expect(screen.getByText('Cash on Hand')).toBeInTheDocument()
    })

    const toggleAllBtn = screen.getByRole('button', { name: /Collapse all/i })
    fireEvent.click(toggleAllBtn)

    // All account rows collapsed
    expect(screen.queryByText('Cash on Hand')).toBeNull()
    expect(screen.queryByText('Accounts Payable')).toBeNull()
    expect(screen.getByRole('button', { name: /Expand all/i })).toBeInTheDocument()

    // Expand all
    const expandAllBtn = screen.getByRole('button', { name: /Expand all/i })
    fireEvent.click(expandAllBtn)

    expect(screen.getByText('Cash on Hand')).toBeInTheDocument()
    expect(screen.getByText('Accounts Payable')).toBeInTheDocument()
  })

  test('selecting a type filter expands that group and collapses the others', async () => {
    render(<ChartOfAccountsView />)

    await waitFor(() => {
      expect(screen.getByText('Cash on Hand')).toBeInTheDocument()
    })

    const filterSelect = screen.getByDisplayValue('All Types')
    fireEvent.change(filterSelect, { target: { value: 'Liability' } })

    await waitFor(() => {
      expect(screen.getByText('Accounts Payable')).toBeInTheDocument()
      expect(screen.queryByText('Cash on Hand')).toBeNull()
    })
  })
})
