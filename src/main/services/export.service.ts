// src/main/services/export.service.ts
import { dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as ExcelJS from 'exceljs'
import { ReportsService } from './reports.service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function buildPayslipHTML(payslip: any): string {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #333;">
      <h2 style="text-align: center; margin-bottom: 5px;">SmartGuys Community Healthcare Inc.</h2>
      <h3 style="text-align: center; margin-top: 0; color: #666;">Payslip</h3>
      
      <div style="display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
        <div>
          <strong>Employee:</strong> ${payslip.employee.first_name} ${payslip.employee.last_name}<br>
          <strong>Position:</strong> ${payslip.employee.position}<br>
          <strong>Reference No:</strong> ${payslip.reference_no}
        </div>
        <div style="text-align: right;">
          <strong>Date:</strong> ${new Date(payslip.date).toISOString().split('T')[0]}<br>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 10px;">
            <h4 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">Earnings</h4>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Base Pay</span>
              <span>₱ ${Number(payslip.base_pay).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Overtime</span>
              <span>₱ ${Number(payslip.overtime).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Night Differential</span>
              <span>₱ ${Number(payslip.night_diff).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Other Earnings</span>
              <span>₱ ${Number(payslip.other_earnings).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px; border-top: 1px solid #eee; padding-top: 5px;">
              <span>Gross Pay</span>
              <span>₱ ${Number(payslip.gross_pay).toFixed(2)}</span>
            </div>
          </td>
          
          <td style="width: 50%; vertical-align: top; padding-left: 10px; border-left: 1px solid #eee;">
            <h4 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">Deductions</h4>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>SSS</span>
              <span>₱ ${Number(payslip.sss).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>PhilHealth</span>
              <span>₱ ${Number(payslip.philhealth).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Pag-IBIG</span>
              <span>₱ ${Number(payslip.pagibig).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Cash Advance / Loans</span>
              <span>₱ ${Number(payslip.cash_advance).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Other Deductions</span>
              <span>₱ ${Number(payslip.other_deductions).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px; border-top: 1px solid #eee; padding-top: 5px;">
              <span>Total Deductions</span>
              <span>₱ ${Number(payslip.total_deductions).toFixed(2)}</span>
            </div>
          </td>
        </tr>
      </table>

      <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold;">
        <span>Withholding Tax</span>
        <span>₱ ${Number(payslip.tax_withheld).toFixed(2)}</span>
      </div>

      <div style="display: flex; justify-content: space-between; padding: 15px; background-color: #f8f9fa; border: 1px solid #ddd; font-weight: bold; font-size: 1.2em;">
        <span>NET PAY</span>
        <span>₱ ${Number(payslip.net_pay).toFixed(2)}</span>
      </div>
    </div>
  `
}

async function printHTMLToPDF(htmlString: string, defaultPath: string) {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath,
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
  })

  if (!filePath) return { success: false, error: 'Export cancelled by user.' }

  return new Promise<{ success: boolean; filePath?: string; error?: string }>((resolve) => {
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlString)}`)

    win.webContents.on('did-finish-load', async () => {
      try {
        const pdfBuffer = await win.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 }
        })
        fs.writeFileSync(filePath, pdfBuffer)
        resolve({ success: true, filePath })
      } catch (err: any) {
        resolve({ success: false, error: err.message })
      } finally {
        win.destroy()
      }
    })
  })
}

export class ExportService {
  /**
   * Generates a PDF for a single payslip
   */
  static async generatePayslipPDF(payslipId: string) {
    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: { employee: true }
    })
    
    if (!payslip) throw new Error('Payslip not found')

    const html = buildPayslipHTML(payslip)
    const empName = `${payslip.employee.first_name}${payslip.employee.last_name}`.replace(/\s/g, '')
    const defaultPath = `Payslip_${payslip.reference_no}_${empName}.pdf`

    return await printHTMLToPDF(html, defaultPath)
  }

  /**
   * Generates a multi-page PDF for all payslips in a batch
   */
  static async generateBatchPayslipsPDF(journalEntryId: string) {
    const payslips = await prisma.payslip.findMany({
      where: { journal_entry_id: journalEntryId },
      include: { employee: true }
    })

    if (!payslips || payslips.length === 0) {
      throw new Error('No payslips found for this payroll run')
    }

    const htmlPages = payslips.map(buildPayslipHTML)
    const htmlString = htmlPages.join('<div style="page-break-after: always;"></div>')
    
    // Use the reference_no of the first payslip as the batch reference or fallback
    const refNo = payslips[0].reference_no || 'PayrollRun'
    const defaultPath = `Batch_Payslips_${refNo}.pdf`

    return await printHTMLToPDF(htmlString, defaultPath)
  }

  /**
   * Generates an Excel spreadsheet for the Trial Balance and prompts user to save
   */
  static async exportTrialBalanceToExcel(year?: number, month?: number) {
    // 1. Setup the Date Filters and the Subtitle Text
    let endDate
    let dateText = 'All-Time'
    let filenameSuffix = new Date().toISOString().split('T')[0]

    if (year && month) {
      endDate = new Date(year, month, 0, 23, 59, 59)
      const monthName = new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' })
      dateText = `As of ${monthName} ${year}`
      filenameSuffix = `${year}_${month}`
    }

    // 2. Fetch the filtered data!
    const data = await ReportsService.getTrialBalance(undefined, endDate)

    // 3. Prompt user where to save the file
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Trial Balance',
      defaultPath: `Trial_Balance_${filenameSuffix}.xlsx`,
      filters: [{ name: 'Excel Worksheets', extensions: ['xlsx'] }]
    })

    if (!filePath) return { success: false, error: 'Export cancelled by user.' }

    // 4. Build the Excel Workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Trial Balance')

    // Title Header
    worksheet.mergeCells('A1:D1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'SmartGuys Community Healthcare Inc.'
    titleCell.font = { name: 'Arial', size: 14, bold: true }
    titleCell.alignment = { horizontal: 'center' }

    // Subtitle Header with the Date!
    worksheet.mergeCells('A2:D2')
    const subtitleCell = worksheet.getCell('A2')
    subtitleCell.value = `Trial Balance Report - ${dateText}` // 🔥 Added the Date Text here!
    subtitleCell.font = { name: 'Arial', size: 11, italic: true }
    subtitleCell.alignment = { horizontal: 'center' }

    worksheet.addRow([])
    const headerRow = worksheet.addRow(['Account Code', 'Account Name', 'Debit', 'Credit'])
    headerRow.font = { name: 'Arial', size: 11, bold: true }

    data.lines.forEach((line: any) => {
      worksheet.addRow([
        Number(line.accountCode),
        line.accountName,
        line.debit > 0 ? line.debit : null,
        line.credit > 0 ? line.credit : null
      ])
    })

    const totalRow = worksheet.addRow(['', 'Total', data.totalDebits, data.totalCredits])
    totalRow.font = { name: 'Arial', size: 11, bold: true }

    worksheet.getColumn(3).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)'
    worksheet.getColumn(4).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)'

    worksheet.getColumn(1).alignment = { horizontal: 'center' }

    worksheet.columns.forEach((col) => {
      col.width = 25
    })

    const buffer = await workbook.xlsx.writeBuffer()
    fs.writeFileSync(filePath, Buffer.from(buffer))

    return { success: true, filePath }
  }
}
