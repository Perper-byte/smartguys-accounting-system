import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      exportPayslipPDF: (payslipId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
      exportBatchPayslipsPDF: (journalEntryId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
      [key: string]: any
    }
  }
}
