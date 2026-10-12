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

  test('renders Security Settings tab by default with lock settings', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    expect(screen.getByRole('button', { name: /^Security Settings$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accounting Calendar/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(mockApi.getLockDate).toHaveBeenCalled()
      expect(screen.getByDisplayValue('2026-01-31')).toBeInTheDocument()
    })
  })

  test('switches to Accounting Calendar tab and displays period cards', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    const calendarTab = screen.getByRole('button', { name: /Accounting Calendar/i })
    fireEvent.click(calendarTab)

    await waitFor(() => {
      expect(mockApi.getCalendar).toHaveBeenCalled()
      expect(screen.getByText('January 2026')).toBeInTheDocument()
      expect(screen.getByText('February 2026')).toBeInTheDocument()
    })
  })

  test('opens Close Period modal for open period and submits closure', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    const calendarTab = screen.getByRole('button', { name: /Accounting Calendar/i })
    fireEvent.click(calendarTab)

    await waitFor(() => {
      expect(screen.getByText('February 2026')).toBeInTheDocument()
    })

    const closeBtn = screen.getByRole('button', { name: /Close Books/i })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.getByText(/Close Books: February 2026/i)).toBeInTheDocument()
    })

    const confirmBtn = screen.getByRole('button', { name: /Confirm Close/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockApi.closePeriod).toHaveBeenCalledWith(expect.any(Number), 2, 'usr-1')
    })
  })

  test('opens Reopen Period modal for closed period and verifies PIN prompt', async () => {
    render(<SystemSettingsView userId="usr-1" />)

    const calendarTab = screen.getByRole('button', { name: /Accounting Calendar/i })
    fireEvent.click(calendarTab)

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
})
