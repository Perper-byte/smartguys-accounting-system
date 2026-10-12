// src/renderer/src/components/FinancialStatementsView.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FinancialStatementsView } from './FinancialStatementsView'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('FinancialStatementsView Component', () => {
  let mockApi: ReturnType<typeof setupMockElectronAPI>

  const sampleTrialBalance = {
    lines: [
      { accountCode: '1010', accountName: 'Cash on Hand', debit: 100000, credit: 0 },
      { accountCode: '4010', accountName: 'Consultation Revenue', debit: 0, credit: 100000 }
    ],
    totalDebit: 100000,
    totalCredit: 100000
  }

  const sampleIncomeStatement = {
    revenue: [{ name: 'Consultation Revenue', amount: 80000 }],
    totalRevenue: 80000,
    expenses: [{ name: 'Medical Supplies Expense', amount: 30000 }],
    totalExpenses: 30000,
    netIncome: 50000
  }

  beforeEach(() => {
    mockApi = setupMockElectronAPI()
    mockApi.getTrialBalance.mockResolvedValue(sampleTrialBalance)
    mockApi.getIncomeStatement.mockResolvedValue(sampleIncomeStatement)
  })

  test('renders Financial Statements controls, presets, and statement tabs', async () => {
    render(<FinancialStatementsView />)

    expect(screen.getByText(/Financial Statements/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Trial Balance/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Income Statement/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Balance Sheet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cash Flow/i })).toBeInTheDocument()
  })

  test('fetches and displays Trial Balance lines by default', async () => {
    render(<FinancialStatementsView />)

    await waitFor(() => {
      expect(mockApi.getTrialBalance).toHaveBeenCalled()
      expect(screen.getByText('Cash on Hand')).toBeInTheDocument()
      expect(screen.getByText('1010')).toBeInTheDocument()
      expect(screen.getByText('Consultation Revenue')).toBeInTheDocument()
    })
  })

  test('switches to Income Statement tab and displays Revenues and Operating Expenses', async () => {
    render(<FinancialStatementsView />)

    const incomeTab = screen.getByRole('button', { name: /Income Statement/i })
    fireEvent.click(incomeTab)

    await waitFor(() => {
      expect(mockApi.getIncomeStatement).toHaveBeenCalled()
      expect(screen.getByText('Operating Expenses')).toBeInTheDocument()
      expect(screen.getByText('Medical Supplies Expense')).toBeInTheDocument()
    })
  })

  test('handles period preset switching (e.g. Q1, Q2, All Year)', async () => {
    render(<FinancialStatementsView />)

    const q1Preset = screen.getByRole('button', { name: /^Q1$/i })
    fireEvent.click(q1Preset)

    await waitFor(() => {
      expect(mockApi.getTrialBalance).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'Q1'
      )
    })
  })
})
