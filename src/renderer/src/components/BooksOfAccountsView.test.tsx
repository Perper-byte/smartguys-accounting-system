// src/renderer/src/components/BooksOfAccountsView.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BooksOfAccountsView } from './BooksOfAccountsView'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('BooksOfAccountsView Component', () => {
  let mockApi: ReturnType<typeof setupMockElectronAPI>

  const sampleJournalRows = [
    {
      date: '2026-10-01',
      referenceNo: 'SJ-001',
      payeeName: 'Customer A',
      description: 'Consultation and Medicine',
      accountCode: '1010',
      accountName: 'Cash on Hand',
      debit: 1120,
      credit: 0
    },
    {
      date: '2026-10-01',
      referenceNo: 'SJ-001',
      payeeName: 'Customer A',
      description: 'Consultation and Medicine',
      accountCode: '4010',
      accountName: 'Sales Revenue',
      debit: 0,
      credit: 1000
    },
    {
      date: '2026-10-01',
      referenceNo: 'SJ-001',
      payeeName: 'Customer A',
      description: 'Consultation and Medicine',
      accountCode: '2040',
      accountName: 'Output Tax (VAT)',
      debit: 0,
      credit: 120
    }
  ]

  beforeEach(() => {
    mockApi = setupMockElectronAPI()
    mockApi.getBooksOfAccounts.mockResolvedValue(sampleJournalRows)
  })

  test('renders header, date filters, and journal book tabs', async () => {
    render(<BooksOfAccountsView />)

    expect(screen.getByText(/BIR Books of Accounts/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sales$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^receipts$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^disbursements$/i })).toBeInTheDocument()
  })

  test('fetches and renders journal rows and summary totals', async () => {
    render(<BooksOfAccountsView />)

    await waitFor(() => {
      expect(mockApi.getBooksOfAccounts).toHaveBeenCalledWith('SJ', expect.any(String), expect.any(String))
      expect(screen.getByText('Customer A')).toBeInTheDocument()
      expect(screen.getByText('SJ-001')).toBeInTheDocument()
    })
  })

  test('switches to Cash Disbursements Journal (CDJ) and toggles Checks report subtab', async () => {
    mockApi.getBooksOfAccounts.mockImplementation(async (type) => {
      if (type === 'CDJ') {
        return [
          {
            date: '2026-10-02',
            referenceNo: 'CV-101',
            payeeName: 'Pharma Supplier Inc.',
            description: 'Payment for medical stock',
            accountCode: '5010',
            accountName: 'Medical Supplies Expense',
            debit: 10000,
            credit: 0
          },
          {
            date: '2026-10-02',
            referenceNo: 'CV-101',
            payeeName: 'Pharma Supplier Inc.',
            description: 'Payment for medical stock',
            accountCode: '2050',
            accountName: 'Withholding Tax Payable',
            debit: 0,
            credit: 100
          },
          {
            date: '2026-10-02',
            referenceNo: 'CV-101',
            payeeName: 'Pharma Supplier Inc.',
            description: 'Payment for medical stock',
            accountCode: '1020',
            accountName: 'Cash in Bank',
            debit: 0,
            credit: 9900
          }
        ]
      }
      return sampleJournalRows
    })

    render(<BooksOfAccountsView />)

    const cdjTab = screen.getByRole('button', { name: /^disbursements$/i })
    fireEvent.click(cdjTab)

    await waitFor(() => {
      expect(mockApi.getBooksOfAccounts).toHaveBeenCalledWith('CDJ', expect.any(String), expect.any(String))
      expect(screen.getByRole('button', { name: /checks report/i })).toBeInTheDocument()
    })

    const checksSubTab = screen.getByRole('button', { name: /checks report/i })
    fireEvent.click(checksSubTab)

    await waitFor(() => {
      expect(screen.getByText('Pharma Supplier Inc.')).toBeInTheDocument()
      expect(screen.getByText('CV-101')).toBeInTheDocument()
    })
  })
})
