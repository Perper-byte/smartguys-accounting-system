// src/renderer/src/components/POSBillingView.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { POSBillingView } from './POSBillingView'
import { setupMockElectronAPI } from '../test-utils/mock-electron'

describe('POSBillingView Component', () => {
  let mockApi: ReturnType<typeof setupMockElectronAPI>

  beforeEach(() => {
    mockApi = setupMockElectronAPI({
      payees: [
        { id: 'pat-1', name: 'Maria Santos', type: 'PATIENT' },
        { id: 'hmo-1', name: 'Maxicare Healthcare', type: 'HMO' }
      ],
      accounts: [
        { code: '4010', name: 'Consultation Revenue', type_id: 'type-revenue' },
        { code: '4020', name: 'Laboratory Revenue', type_id: 'type-revenue' }
      ]
    })
  })

  test('renders POS billing view with header, client type toggles, and default item', () => {
    render(<POSBillingView userId="cashier-1" />)

    expect(screen.getByText(/Patient Billing/i)).toBeInTheDocument()
    expect(screen.getByText('WALKIN')).toBeInTheDocument()
    expect(screen.getByText('OPD')).toBeInTheDocument()
    expect(screen.getByText(/Services & Medicines/i)).toBeInTheDocument()
  })

  test('calculates VAT-exempt revenue correctly for default medical consultation', () => {
    render(<POSBillingView userId="cashier-1" />)

    // Default item is price 500, exempt from VAT
    expect(screen.getByText('₱500.00')).toBeInTheDocument()
  })

  test('toggles SC/PWD discount and renders 20% discount subtotal', async () => {
    render(<POSBillingView userId="cashier-1" />)

    const scPwdCheckbox = screen.getByText(/Apply SC \/ PWD Discount/i)
    fireEvent.click(scPwdCheckbox)

    await waitFor(() => {
      expect(screen.getByText(/Discount \(20%\)/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Required for BIR/i)).toBeInTheDocument()
    })
  })

  test('displays payment methods (Cash, E-Wallet, Split) in checkout section', () => {
    render(<POSBillingView userId="cashier-1" />)

    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('E-Wallet')).toBeInTheDocument()
    expect(screen.getByText(/Split \(Cash\+E-Wallet\)/i)).toBeInTheDocument()
  })
})
