// src/renderer/src/components/LoginScreen.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginScreen } from './LoginScreen'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('LoginScreen Component', () => {
  let mockApi: ReturnType<typeof setupMockElectronAPI>

  beforeEach(() => {
    mockApi = setupMockElectronAPI()
  })

  test('renders login inputs and submit button', () => {
    render(<LoginScreen onLoginSuccess={jest.fn()} />)

    expect(screen.getByPlaceholderText(/enter your username/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  test('submits credentials and calls onLoginSuccess on valid active user', async () => {
    const onLoginSuccess = jest.fn()
    mockApi.login.mockResolvedValueOnce({
      success: true,
      data: { id: 'usr-admin', username: 'admin', role: 'ADMIN', is_active: true }
    })

    render(<LoginScreen onLoginSuccess={onLoginSuccess} />)

    fireEvent.change(screen.getByPlaceholderText(/enter your username/i), {
      target: { value: 'admin' }
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Admin@123' }
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockApi.login).toHaveBeenCalledWith('admin', 'Admin@123')
      expect(onLoginSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin', role: 'ADMIN' })
      )
    })
  })

  test('rejects login and shows error when account is disabled', async () => {
    const onLoginSuccess = jest.fn()
    mockApi.login.mockResolvedValueOnce({
      success: true,
      data: { id: 'usr-disabled', username: 'inactive_user', role: 'STAFF', is_active: false }
    })

    render(<LoginScreen onLoginSuccess={onLoginSuccess} />)

    fireEvent.change(screen.getByPlaceholderText(/enter your username/i), {
      target: { value: 'inactive_user' }
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'pass123' }
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Access Denied: This account has been disabled by an Administrator/i)
      ).toBeInTheDocument()
      expect(onLoginSuccess).not.toHaveBeenCalled()
    })
  })

  test('displays error message when login credentials fail', async () => {
    mockApi.login.mockResolvedValueOnce({
      success: false,
      error: 'Invalid credentials provided'
    })

    render(<LoginScreen onLoginSuccess={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText(/enter your username/i), {
      target: { value: 'wrong_user' }
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrong_pass' }
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials provided/i)).toBeInTheDocument()
    })
  })
})
