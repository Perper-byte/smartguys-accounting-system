import { dialog } from 'electron';
import * as fs from 'fs';

const mockPayslip = {
  id: 'ps-101',
  reference_no: 'PY-2026-001-EMP01',
  date: new Date('2026-09-30'),
  base_pay: 20000,
  overtime: 1500,
  night_diff: 500,
  other_earnings: 0,
  gross_pay: 22000,
  sss: 900,
  philhealth: 500,
  pagibig: 200,
  cash_advance: 1000,
  other_deductions: 0,
  tax_withheld: 1200,
  total_deductions: 3800,
  net_pay: 18200,
  employee: {
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    position: 'Staff Nurse'
  }
};

const mockBatchPayslips = [
  {
    id: 'ps-001',
    reference_no: 'PY-BATCH-01',
    date: new Date('2026-09-30'),
    base_pay: 20000,
    overtime: 0,
    night_diff: 0,
    other_earnings: 0,
    gross_pay: 20000,
    sss: 900,
    philhealth: 500,
    pagibig: 200,
    cash_advance: 0,
    other_deductions: 0,
    tax_withheld: 1000,
    total_deductions: 2600,
    net_pay: 17400,
    employee: { first_name: 'Alice', last_name: 'Smith', position: 'Physician' }
  },
  {
    id: 'ps-002',
    reference_no: 'PY-BATCH-02',
    date: new Date('2026-09-30'),
    base_pay: 15000,
    overtime: 0,
    night_diff: 0,
    other_earnings: 0,
    gross_pay: 15000,
    sss: 675,
    philhealth: 375,
    pagibig: 200,
    cash_advance: 0,
    other_deductions: 0,
    tax_withheld: 500,
    total_deductions: 1750,
    net_pay: 13250,
    employee: { first_name: 'Bob', last_name: 'Jones', position: 'Medical Technologist' }
  }
];

jest.mock('@prisma/client', () => {
  const mPrisma = {
    payslip: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(mockPayslip)),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(mockBatchPayslips))
    }
  };
  return {
    PrismaClient: jest.fn(() => mPrisma)
  };
});

jest.mock('electron', () => {
  const mockWebContents = {
    on: jest.fn((event, callback) => {
      if (event === 'did-finish-load') {
        setTimeout(callback, 10);
      }
    }),
    printToPDF: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test mock pdf'))
  };

  const MockBrowserWindow = jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    webContents: mockWebContents,
    destroy: jest.fn()
  }));

  return {
    dialog: {
      showSaveDialog: jest.fn()
    },
    BrowserWindow: MockBrowserWindow
  };
});

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn()
}));

import { ExportService } from './export.service';

describe('ExportService - Phase 4 Headless Payslip PDF Generator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Single Payslip PDF Export: Builds HTML, requests save dialog, and writes PDF buffer', async () => {
    (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
      filePath: 'C:/Exports/Payslip_Juan_Dela_Cruz.pdf'
    });

    const result = await ExportService.generatePayslipPDF('ps-101');

    expect(result.success).toBe(true);
    expect(result.filePath).toBe('C:/Exports/Payslip_Juan_Dela_Cruz.pdf');
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Export PDF',
        defaultPath: expect.stringContaining('Payslip')
      })
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'C:/Exports/Payslip_Juan_Dela_Cruz.pdf',
      expect.any(Buffer)
    );
  });

  test('Batch Payslips PDF Export: Aggregates employee payslips with page breaks and exports', async () => {
    (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
      filePath: 'C:/Exports/Batch_Payslips_PY-BATCH.pdf'
    });

    const result = await ExportService.generateBatchPayslipsPDF('je-batch-999');

    expect(result.success).toBe(true);
    expect(result.filePath).toBe('C:/Exports/Batch_Payslips_PY-BATCH.pdf');
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Export PDF',
        defaultPath: expect.stringContaining('Batch_Payslips')
      })
    );
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
