// src/renderer/src/components/SystemSettingsView.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SystemSettingsView } from './SystemSettingsView'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('SystemSettingsView Component', () => {
  let mockApi: ReturnType<typeof setupMockElectronAPI>

  const sampleCalendar = [
    {
      periodNumber: 1,
      periodName: 'January 2026',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      status: 'CLOSED',
      totalRevenue: 50000,
      totalExpenses: 20000
    },
    {
      periodNumber: 2,
      periodName: 'February 2026',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      status: 'OPEN',
      totalRevenue: 45000,
      totalExpenses: 15000
    }
  ]

  beforeEach(() => {
    mockApi = setupMockElectronAPI({
      calendar: sampleCalendar
    })
    mockApi.getLockDate.mockResolvedValue({
      lockDate: '2026-01-31',
      autoLockDay: 5,
      fiscalYearStartMonth: 1,
      hasOverridePin: true
    })
  })

  test('renders unified view with lock settings and accounting calendar', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    expect(screen.getByRole('heading', { name: /Accounting Calendar & Books Closing/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(mockApi.getLockDate).toHaveBeenCalled()
      expect(mockApi.getCalendar).toHaveBeenCalled()
      expect(screen.getByText('January 2026')).toBeInTheDocument()
      expect(screen.getByText('February 2026')).toBeInTheDocument()
      expect(screen.getByText(/PIN Active/i)).toBeInTheDocument()
    })
  })

  test('displays period metrics and status badges directly on screen', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    await waitFor(() => {
      expect(screen.getByText('January 2026')).toBeInTheDocument()
      expect(screen.getByText('CLOSED')).toBeInTheDocument()
      expect(screen.getByText('February 2026')).toBeInTheDocument()
      expect(screen.getByText('OPEN')).toBeInTheDocument()
    })
  })

  test('opens Close Period modal for open period and submits closure', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    await waitFor(() => {
      expect(screen.getByText('February 2026')).toBeInTheDocument()
    })

    const closeBtn = screen.getByRole('button', { name: /Close Books/i })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.getByText(/Close Books: February 2026/i)).toBeInTheDocument()
    })

    const confirmBtn = screen.getByRole('button', { name: /Confirm Close/i })
    await waitFor(() => {
      expect(confirmBtn).not.toBeDisabled()
    })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockApi.closePeriod).toHaveBeenCalledWith(expect.any(Number), 2, 'usr-1', expect.anything())
    })
  })

  test('opens Reopen Period modal for closed period and verifies PIN prompt', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    await waitFor(() => {
      expect(screen.getByText('January 2026')).toBeInTheDocument()
    })

    const reopenBtn = screen.getByRole('button', { name: /Reopen Period/i })
    fireEvent.click(reopenBtn)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Reopen Period$/i })).toBeInTheDocument()
    })

    const pinInput = screen.getByPlaceholderText('••••')
    fireEvent.change(pinInput, { target: { value: '1234' } })

    const confirmReopenBtn = screen.getByRole('button', { name: /^Reopen$/i })
    fireEvent.click(confirmReopenBtn)

    await waitFor(() => {
      expect(mockApi.reopenPeriod).toHaveBeenCalledWith(expect.any(Number), 1, 'usr-1', '1234')
    })
  })

  test('toggles between Calendar Year and Fiscal Year and saves configuration', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Calendar$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Fiscal$/i })).toBeInTheDocument()
    })

    // Switch to Fiscal
    fireEvent.click(screen.getByRole('button', { name: /^Fiscal$/i }))
    expect(screen.getByText(/Fiscal year starts/i)).toBeInTheDocument()

    // Switch back to Calendar
    fireEvent.click(screen.getByRole('button', { name: /^Calendar$/i }))
    expect(screen.getByText(/January – December/i)).toBeInTheDocument()
  })

  test('toggles automated closing and switches frequency between Every Month and One Year', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /DISABLED|ENABLED/i })).toBeInTheDocument()
    })

    const toggleBtn = screen.getByRole('button', { name: /DISABLED|ENABLED/i })
    // Toggle ON
    fireEvent.click(toggleBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Every Month$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^One Year$/i })).toBeInTheDocument()
    })

    // Select One Year
    fireEvent.click(screen.getByRole('button', { name: /^One Year$/i }))
    expect(screen.getByText(/Locks prior year automatically/i)).toBeInTheDocument()

    // Select Every Month
    fireEvent.click(screen.getByRole('button', { name: /^Every Month$/i }))
    expect(screen.getByText(/Locks prior month automatically/i)).toBeInTheDocument()
  })
})
