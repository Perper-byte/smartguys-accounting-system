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

  test('renders interactive checkboxes for role permissions and allows toggling', async () => {
    render(<UserManagementView currentUser={{ username: 'admin' }} />)

    const rolesTab = screen.getByRole('button', { name: /Role Permissions Matrix/i })
    fireEvent.click(rolesTab)

    await waitFor(() => {
      expect(screen.getByText(/Role Responsibilities/i)).toBeInTheDocument()
    })

    // Find the CASHIER checkbox for Patient Billing (POS)
    const cashierBillingCheckbox = screen.getByLabelText(/CASHIER Patient Billing \(POS\)/i) as HTMLInputElement
    expect(cashierBillingCheckbox).toBeInTheDocument()
    expect(cashierBillingCheckbox.checked).toBe(true)

    // Uncheck it
    fireEvent.click(cashierBillingCheckbox)
    expect(cashierBillingCheckbox.checked).toBe(false)

    // Check it back
    fireEvent.click(cashierBillingCheckbox)
    expect(cashierBillingCheckbox.checked).toBe(true)

    // Verify Account Lock / Accounting Calendar & Security row exists and is checked for MANAGER
    expect(screen.getByText(/Accounting Calendar & Security \(Account Lock\)/i)).toBeInTheDocument()
    const managerLockCheckbox = screen.getByLabelText(/MANAGER Accounting Calendar & Security \(Account Lock\)/i) as HTMLInputElement
    expect(managerLockCheckbox).toBeInTheDocument()
    expect(managerLockCheckbox.checked).toBe(true)
  })

  test('saves role defaults without touching existing user accounts or prompting to touch them', async () => {
    render(<UserManagementView currentUser={{ username: 'admin' }} />)

    const rolesTab = screen.getByRole('button', { name: /Role Permissions Matrix/i })
    fireEvent.click(rolesTab)

    await waitFor(() => {
      expect(screen.getByText(/Role Responsibilities/i)).toBeInTheDocument()
    })

    // Toggle a checkbox for CASHIER
    const cashierBillingCheckbox = screen.getByLabelText(/CASHIER Patient Billing \(POS\)/i)
    fireEvent.click(cashierBillingCheckbox)

    // Save role defaults
    const saveBtn = screen.getByRole('button', { name: /Save Role Defaults/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockApi.updateRolePermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          CASHIER: expect.not.arrayContaining(['billing'])
        }),
        'admin'
      )
      // Strictly verify existing users were NOT updated
      expect(mockApi.updateUserPermissions).not.toHaveBeenCalled()
      // Verify no prompt modal to update existing accounts exists
      expect(screen.queryByText(/update existing users/i)).toBeNull()
      expect(screen.queryByText(/apply to existing accounts/i)).toBeNull()
    })
  })

  test('new user creation receives the updated role permissions template', async () => {
    // Custom role defaults where CASHIER only has 'collections'
    mockApi.getRolePermissions.mockResolvedValueOnce({
      CASHIER: ['collections'],
      ACCOUNTANT: ['billing'],
      MANAGER: ['billing'],
      IT_PERSONNEL: ['directory']
    })

    render(<UserManagementView currentUser={{ username: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByText('maria_cashier')).toBeInTheDocument()
    })

    const usernameInput = screen.getByPlaceholderText(/e\.g\. juan_cashier/i)
    fireEvent.change(usernameInput, { target: { value: 'custom_cashier' } })

    const createBtn = screen.getByRole('button', { name: /^Create Account$/i })
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(mockApi.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'custom_cashier',
          role: 'CASHIER',
          permissions: ['collections']
        }),
        'admin'
      )
    })
  })

  test('Force Role Changes button opens confirmation modal and applies changes to existing accounts when confirmed', async () => {
    mockApi.forceApplyRolePermissions.mockResolvedValueOnce({ success: true, count: 5 })

    render(<UserManagementView currentUser={{ username: 'admin' }} />)

    const rolesTab = screen.getByRole('button', { name: /Role Permissions Matrix/i })
    fireEvent.click(rolesTab)

    await waitFor(() => {
      expect(screen.getByText(/Role Responsibilities/i)).toBeInTheDocument()
    })

    const forceBtn = screen.getByRole('button', { name: /Force Role Changes/i })
    expect(forceBtn).toBeInTheDocument()

    // Clicking it opens confirmation dialog
    fireEvent.click(forceBtn)
    expect(screen.getByText(/Force Role Changes\?/i)).toBeInTheDocument()
    expect(screen.getByText(/overwrite the permissions of/i)).toBeInTheDocument()

    // Test cancel button closes modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelBtn)
    expect(screen.queryByText(/Force Role Changes\?/i)).toBeNull()
    expect(mockApi.forceApplyRolePermissions).not.toHaveBeenCalled()

    // Reopen and confirm
    fireEvent.click(forceBtn)
    const confirmBtn = screen.getByRole('button', { name: /Yes, Force Changes/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockApi.forceApplyRolePermissions).toHaveBeenCalledWith(
        expect.any(Object),
        'admin'
      )
      expect(screen.getByText(/Role permissions forced across all existing users/i)).toBeInTheDocument()
    })
  })
})
