// src/renderer/src/App.test.tsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// MOCK THE ELECTRON SECURE IPC BRIDGE
const mockLogin = jest.fn();

beforeAll(() => {
    global.window = Object.create(window);
    Object.defineProperty(window, 'electronAPI', {
        value: {
            login: mockLogin,
            submitJournalEntry: jest.fn(),
        },
        writable: true,
    });
});

describe('Sprint 2 - Week 1: Role-Based Access Control (RBAC)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('🔒 Standard State: Should render the Login Screen initially', () => {
        render(<App />);
        expect(screen.getByText(/SmartGuys Community HealthCare Inc./i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Enter your username/i)).toBeInTheDocument();
    });

    test('📊 Accountant Permissions: Should render Accountant-specific links', async () => {
        // Mock the backend returning an Accountant User
        mockLogin.mockResolvedValue({
            success: true,
            data: { id: 'user-1', username: 'john_accountant', role: 'ACCOUNTANT' }
        });

        render(<App />);

        // Simulate login interaction
        fireEvent.change(screen.getByPlaceholderText(/Enter your username/i), { target: { value: 'accountant'} });
        fireEvent.change(screen.getByPlaceholderText(/••••••/i), { target: { value: 'password123'} });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
        });

        expect(screen.getByText('john_accountant')).toBeInTheDocument();
        expect(screen.getByText('ACCOUNTANT')).toBeInTheDocument();

        // Check denials
        expect(screen.getAllByText(/Analytics Dashboard/i).length).toBeGreaterThan(0);
        expect(screen.queryByText('Disbursements')).toBeInTheDocument();
        expect(screen.getAllByText(/Database Backup/i).length).toBeGreaterThan(0);
        expect(screen.queryByText('BIR Tax Reports')).not.toBeInTheDocument();
    });

    test('📊 Cashier Permissions: Should render Cashier-specific links', async () => {
        mockLogin.mockResolvedValue({
            success: true,
            data: { id: 'user-2', username: 'mary_cashier', role: 'CASHIER' }
        });

        render(<App />);

        // Simulate login interaction
        fireEvent.change(screen.getByPlaceholderText(/Enter your username/i), { target: { value: 'cashier'} });
        fireEvent.change(screen.getByPlaceholderText(/••••••/i), { target: { value: 'password123'} });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
        });

        // VERIFY CASHIER SIDEBAR LINKS
        expect(screen.getByText('mary_cashier')).toBeInTheDocument();
        expect(screen.getByText('CASHIER')).toBeInTheDocument();
        expect(screen.getAllByText(/Journal Entry/i).length).toBeGreaterThan(0);
        expect(screen.getByText('Disbursements')).toBeInTheDocument();

        // STRICT DENIALS
        expect(screen.queryByText('Analytics Dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('General Ledger')).not.toBeInTheDocument();
        expect(screen.queryByText('Database Backup')).not.toBeInTheDocument();
    });

    test('💾 IT Personnel Permissions: Should render Database Backup ONLY', async () => {
        // Mock the backend returning an IT useer
        mockLogin.mockResolvedValue({
            success: true,
            data: { id: 'user-3', username: 'admin_it', role: 'IT_PERSONNEL' }
        });

        render(<App />);

        fireEvent.change(screen.getByPlaceholderText(/Enter your username/i), { target: { value: 'it'} });
        fireEvent.change(screen.getByPlaceholderText(/••••••/i), { target: { value: 'password123'} });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
        });

         // VERIFY IT SIDEBAR LINKS
        expect(screen.getByText('admin_it')).toBeInTheDocument();
        expect(screen.getByText('IT_PERSONNEL')).toBeInTheDocument();

        // Database Backup appears in Sidebar and Content
        expect(screen.getAllByText(/Database Backup/i).length).toBeGreaterThan(0);

        // STRICT DENIALS
        expect(screen.queryByText('Analytics Dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('Journal Entry')).not.toBeInTheDocument();
        expect(screen.queryByText('Disbursements')).not.toBeInTheDocument();
    });
});