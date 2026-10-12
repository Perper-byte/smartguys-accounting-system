// src/renderer/src/components/UserManagementView.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UserManagementView from './UserManagementView'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('UserManagementView Component', () => {
  let mockApi: ReturnType<typeof setupMockElectronAPI>

  const sampleUsers = [
    {
      id: 'usr-1',
      username: 'maria_cashier',
      role: 'CASHIER',
      is_active: 1,
      created_at: '2026-01-10T08:00:00Z',
      permissions: JSON.stringify(['billing', 'collections'])
    },
    {
      id: 'usr-2',
      username: 'john_accountant',
      role: 'ACCOUNTANT',
      is_active: 0,
      created_at: '2026-01-12T08:00:00Z',
      permissions: null
    }
  ]

  beforeEach(() => {
    mockApi = setupMockElectronAPI({
      users: sampleUsers
    })
  })

  test('renders user list with username, role badges, and active/disabled statuses', async () => {
    render(<UserManagementView currentUser={{ username: 'admin' }} />)

    await waitFor(() => {
      expect(mockApi.getUsers).toHaveBeenCalled()
      expect(screen.getByText('maria_cashier')).toBeInTheDocument()
      expect(screen.getByText('john_accountant')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })
  })

  test('pre-fills auto-generated 12-character secure password in creation form', async () => {
    render(<UserManagementView currentUser={{ username: 'admin' }} />)

    const passwordInput = screen.getByPlaceholderText(/Set initial password/i) as HTMLInputElement
    expect(passwordInput.value.length).toBe(12)
  })

  test('creates new user and displays created credentials modal with copy option', async () => {
    mockApi.createUser.mockResolvedValueOnce({ success: true, data: { id: 'usr-new' } })

    render(<UserManagementView currentUser={{ username: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByText('maria_cashier')).toBeInTheDocument()
    })

    const usernameInput = screen.getByPlaceholderText(/e\.g\. juan_cashier/i)
    fireEvent.change(usernameInput, { target: { value: 'new_nurse' } })

    const createBtn = screen.getByRole('button', { name: /^Create Account$/i })
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(mockApi.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'new_nurse', role: 'CASHIER' }),
        'admin'
      )
      expect(screen.getByText(/Account Created & Credentials/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Copy Password/i })).toBeInTheDocument()
    })
  })

  test('switches between User Accounts tab and Roles & Permissions matrix tab', async () => {
    render(<UserManagementView currentUser={{ username: 'admin' }} />)

    const rolesTab = screen.getByRole('button', { name: /Role Permissions Matrix/i })
    fireEvent.click(rolesTab)

    await waitFor(() => {
      expect(screen.getByText(/Role Responsibilities/i)).toBeInTheDocument()
      expect(screen.getByText(/Patient Billing \(POS\)/i)).toBeInTheDocument()
    })
  })
})
