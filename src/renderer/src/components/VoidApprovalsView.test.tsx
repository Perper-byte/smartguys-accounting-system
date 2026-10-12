// src/renderer/src/components/VoidApprovalsView.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VoidApprovalsView } from './VoidApprovalsView'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('VoidApprovalsView Component', () => {
  let mockApi: ReturnType<typeof setupMockElectronAPI>

  const samplePendingVoids = [
    {
      id: 'void-1',
      reference_no: 'OR-2026-001',
      date: '2026-10-05T10:00:00Z',
      void_reason: 'Entered incorrect medicine quantity',
      user: { username: 'cashier_mary' },
      lines: [
        {
          account_id: '1010',
          account: { title: 'Cash on Hand' },
          debit: 1500,
          credit: 0
        },
        {
          account_id: '4010',
          account: { title: 'Sales Revenue' },
          debit: 0,
          credit: 1500
        }
      ]
    }
  ]

  const sampleHistory = [
    {
      id: 'void-old-1',
      reference_no: 'OR-2026-000',
      date: '2026-10-01T09:00:00Z',
      void_reason: 'Duplicate billing test',
      status: 'APPROVED',
      user: { username: 'cashier_mary' },
      approver: { username: 'admin_boss' },
      decided_at: '2026-10-01T11:00:00Z'
    }
  ]

  beforeEach(() => {
    mockApi = setupMockElectronAPI({
      pendingVoids: samplePendingVoids,
      voidHistory: sampleHistory
    })
  })

  test('renders pending void list with reference number, staff, and reason', async () => {
    render(<VoidApprovalsView userId="admin-1" />)

    await waitFor(() => {
      expect(mockApi.getPendingVoids).toHaveBeenCalled()
      expect(screen.getByText('OR-2026-001')).toBeInTheDocument()
      expect(screen.getByText('cashier_mary')).toBeInTheDocument()
      expect(screen.getByText(/"Entered incorrect medicine quantity"/i)).toBeInTheDocument()
    })
  })

  test('opens approval modal with debit/credit line details and executes approval', async () => {
    render(<VoidApprovalsView userId="admin-1" />)

    await waitFor(() => {
      expect(screen.getByText('OR-2026-001')).toBeInTheDocument()
    })

    const approveBtn = screen.getByRole('button', { name: /^Approve$/i })
    fireEvent.click(approveBtn)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Confirm & Execute Void/i })).toBeInTheDocument()
      expect(screen.getByText('Cash on Hand')).toBeInTheDocument()
      expect(screen.getByText('Sales Revenue')).toBeInTheDocument()
    })

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Execute Void/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockApi.approveVoid).toHaveBeenCalledWith('void-1', 'admin-1')
    })
  })

  test('opens rejection modal, enforces rejection reason, and submits rejection', async () => {
    render(<VoidApprovalsView userId="admin-1" />)

    await waitFor(() => {
      expect(screen.getByText('OR-2026-001')).toBeInTheDocument()
    })

    const rejectBtn = screen.getByRole('button', { name: /^Reject$/i })
    fireEvent.click(rejectBtn)

    await waitFor(() => {
      expect(screen.getByText(/Reject Void Request/i)).toBeInTheDocument()
    })

    const submitBtn = screen.getByRole('button', { name: /Submit Rejection/i })
    expect(submitBtn).toBeDisabled()

    const reasonInput = screen.getByPlaceholderText(/Explain why this void request is being denied/i)
    fireEvent.change(reasonInput, { target: { value: 'Customer receipt is already stamped and claimed.' } })

    expect(submitBtn).not.toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockApi.rejectVoid).toHaveBeenCalledWith(
        'void-1',
        'Customer receipt is already stamped and claimed.',
        'admin-1'
      )
    })
  })

  test('switches to History tab and displays resolved void records', async () => {
    render(<VoidApprovalsView userId="admin-1" />)

    const historyTab = screen.getByRole('button', { name: /History/i })
    fireEvent.click(historyTab)

    await waitFor(() => {
      expect(mockApi.getVoidHistory).toHaveBeenCalled()
      expect(screen.getByText('OR-2026-000')).toBeInTheDocument()
      expect(screen.getByText('admin_boss')).toBeInTheDocument()
      expect(screen.getByText(/Approved/i)).toBeInTheDocument()
    })
  })
})
