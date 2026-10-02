// src/main/services/export.service.ts
import { dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as ExcelJS from 'exceljs'
import { ReportsService, resolvePeriodDateRange } from './reports.service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function buildPayslipHTML(payslip: any): string {
  const emp = payslip.employee || {}
  const monthlySalary = emp.monthly_salary ? Number(emp.monthly_salary) : 0
  const semiMonthlyRate = monthlySalary > 0 ? monthlySalary / 2 : 0
  const dailyRate = monthlySalary > 0 ? monthlySalary / 26 : 0
  const hourlyRate = dailyRate > 0 ? dailyRate / 8 : 0
  const empIdFormatted = emp.id ? `EMP-${String(emp.id).padStart(4, '0')}` : '—'
  const payDateFormatted = new Date(payslip.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const fmt = (num: any) =>
    `₱ ${Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const totalDeductionsWithTax = Number(payslip.total_deductions || 0) + Number(payslip.tax_withheld || 0)

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 30px; max-width: 780px; margin: 0 auto; color: #1e293b; font-size: 11px; line-height: 1.4;">
      <!-- CLINIC HEADER -->
      <div style="border-bottom: 2px solid #1B9387; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="font-size: 16px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -0.2px;">SMARTGUYS CLINIC & COMMUNITY HEALTHCARE</h2>
          <p style="font-size: 10px; color: #64748b; margin: 3px 0 0 0; font-weight: 500;">Official Employee Compensation & Payroll Voucher</p>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; background-color: #E9FAFA; border: 1px solid #B0DCDA; color: #1B9387; font-weight: 900; font-size: 10px; padding: 3px 8px; border-radius: 4px; font-family: monospace;">${payslip.reference_no}</span>
          <p style="font-size: 10px; color: #64748b; margin: 4px 0 0 0; font-family: monospace;">Pay Date: ${payDateFormatted}</p>
        </div>
      </div>

      <!-- EMPLOYEE METADATA PROFILE -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <tr>
            <td style="width: 40%; vertical-align: top;">
              <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #94a3b8; display: block; letter-spacing: 0.5px;">Employee Name</span>
              <strong style="font-size: 13px; color: #0f172a;">${emp.first_name || ''} ${emp.last_name || ''}</strong>
            </td>
            <td style="width: 35%; vertical-align: top;">
              <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #94a3b8; display: block; letter-spacing: 0.5px;">Position / Designation</span>
              <strong style="font-size: 12px; color: #1B9387;">${emp.position || 'Staff'}</strong>
            </td>
            <td style="width: 25%; vertical-align: top; text-align: right;">
              <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #94a3b8; display: block; letter-spacing: 0.5px;">Employee ID</span>
              <strong style="font-family: monospace; font-size: 11px; color: #1e293b;">${empIdFormatted}</strong>
            </td>
          </tr>
        </table>

        <!-- STATUTORY IDS -->
        <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding-top: 6px; padding-bottom: 6px; margin-bottom: 8px; font-family: monospace; font-size: 9.5px;">
          <tr>
            <td style="width: 25%; padding: 4px 0;"><span style="color: #94a3b8;">TIN:</span> <strong>${emp.tin || '—'}</strong></td>
            <td style="width: 25%; padding: 4px 0;"><span style="color: #94a3b8;">SSS:</span> <strong>${emp.sss_no || '—'}</strong></td>
            <td style="width: 25%; padding: 4px 0;"><span style="color: #94a3b8;">PhilHealth:</span> <strong>${emp.philhealth_no || '—'}</strong></td>
            <td style="width: 25%; padding: 4px 0; text-align: right;"><span style="color: #94a3b8;">Pag-IBIG:</span> <strong>${emp.pagibig_no || '—'}</strong></td>
          </tr>
        </table>

        <!-- RATES BASIS -->
        <table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 9.5px;">
          <tr>
            <td style="width: 25%;"><span style="color: #94a3b8;">Monthly:</span> <strong>${fmt(monthlySalary)}</strong></td>
            <td style="width: 25%;"><span style="color: #94a3b8;">Semi-Mo:</span> <strong>${fmt(semiMonthlyRate)}</strong></td>
            <td style="width: 25%;"><span style="color: #94a3b8;">Daily (26d):</span> <strong>${fmt(dailyRate)}</strong></td>
            <td style="width: 25%; text-align: right;"><span style="color: #94a3b8;">Hourly:</span> <strong>${fmt(hourlyRate)}</strong></td>
          </tr>
        </table>
      </div>

      <!-- ITEMIZED TABLES: EARNINGS VS DEDUCTIONS -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-left: -12px; margin-right: -12px; margin-bottom: 16px;">
        <tr>
          <!-- EARNINGS -->
          <td style="width: 50%; vertical-align: top; border: 1px solid #dbeafe; border-radius: 8px; padding: 12px; background-color: #ffffff;">
            <div style="border-bottom: 1px solid #bfdbfe; padding-bottom: 6px; margin-bottom: 8px; display: flex; justify-content: space-between;">
              <span style="font-weight: 900; text-transform: uppercase; color: #1d4ed8; font-size: 9.5px; letter-spacing: 0.5px;">Earnings & Additions</span>
              <span style="background-color: #eff6ff; color: #1e40af; font-size: 8.5px; font-weight: 800; padding: 1px 4px; border-radius: 3px;">CREDIT</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
              <tr><td style="padding: 3px 0; color: #475569;">Basic Semi-Monthly Pay</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.base_pay)}</td></tr>
              <tr><td style="padding: 3px 0; color: #475569;">Overtime Pay (DOLE)</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.overtime)}</td></tr>
              <tr><td style="padding: 3px 0; color: #475569;">Night Differential</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.night_diff)}</td></tr>
              <tr><td style="padding: 3px 0; color: #475569;">Other Allowances / Adj.</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.other_earnings)}</td></tr>
              <tr style="border-top: 2px solid #bfdbfe; font-weight: 900;">
                <td style="padding: 8px 0 2px 0; color: #1e3a8a;">GROSS EARNINGS</td>
                <td style="padding: 8px 0 2px 0; text-align: right; font-family: monospace; font-size: 11.5px; color: #1d4ed8;">${fmt(payslip.gross_pay)}</td>
              </tr>
            </table>
          </td>

          <!-- DEDUCTIONS -->
          <td style="width: 50%; vertical-align: top; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; background-color: #ffffff;">
            <div style="border-bottom: 1px solid #fdba74; padding-bottom: 6px; margin-bottom: 8px; display: flex; justify-content: space-between;">
              <span style="font-weight: 900; text-transform: uppercase; color: #c2410c; font-size: 9.5px; letter-spacing: 0.5px;">Itemized Deductions</span>
              <span style="background-color: #fff7ed; color: #9a3412; font-size: 8.5px; font-weight: 800; padding: 1px 4px; border-radius: 3px;">DEBIT</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
              <tr><td style="padding: 2px 0; color: #475569;">SSS Contribution (EE)</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.sss)}</td></tr>
              <tr><td style="padding: 2px 0; color: #475569;">PhilHealth (EE)</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.philhealth)}</td></tr>
              <tr><td style="padding: 2px 0; color: #475569;">Pag-IBIG / HDMF (EE)</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.pagibig)}</td></tr>
              <tr><td style="padding: 2px 0; color: #475569;">Cash Advance / Vale</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.cash_advance)}</td></tr>
              <tr><td style="padding: 2px 0; color: #475569;">Professional License Fee</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.license_fee)}</td></tr>
              <tr><td style="padding: 2px 0; color: #475569;">Other Demerits / Deductions</td><td style="text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${fmt(payslip.other_deductions)}</td></tr>
              <tr style="color: #dc2626; font-weight: bold;"><td style="padding: 2px 0;">BIR Withholding Tax</td><td style="text-align: right; font-family: monospace;">${fmt(payslip.tax_withheld)}</td></tr>
              <tr style="border-top: 2px solid #fdba74; font-weight: 900;">
                <td style="padding: 8px 0 2px 0; color: #7c2d12;">TOTAL DEDUCTIONS</td>
                <td style="padding: 8px 0 2px 0; text-align: right; font-family: monospace; font-size: 11.5px; color: #c2410c;">${fmt(totalDeductionsWithTax)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- NET TAKE HOME PAY -->
      <div style="background-color: #E9FAFA; border: 2px solid #1B9387; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #1B9387; letter-spacing: 0.5px; display: block;">Net Take-Home Pay</span>
          <span style="font-size: 9px; color: #64748b;">Credited to Employee Payroll Account</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 20px; font-weight: 900; font-family: monospace; color: #1B9387; letter-spacing: -0.5px;">${fmt(payslip.net_pay)}</span>
        </div>
      </div>

      <!-- SIGNATURE SECTION -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
        <tr>
          <td style="width: 45%; vertical-align: bottom; text-align: center; padding-top: 35px;">
            <div style="border-bottom: 1px solid #475569; width: 85%; margin: 0 auto 4px auto;"></div>
            <span style="font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Certified Correct By (HR / Payroll Officer)</span>
          </td>
          <td style="width: 10%;"></td>
          <td style="width: 45%; vertical-align: bottom; text-align: center; padding-top: 35px;">
            <div style="border-bottom: 1px solid #475569; width: 85%; margin: 0 auto 4px auto;"></div>
            <span style="font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Received & Acknowledged By Employee</span>
          </td>
        </tr>
      </table>
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
  static async exportTrialBalanceToExcel(year?: number, month?: number, quarter?: string) {
    const dateRange = resolvePeriodDateRange(year, month, quarter)
    const suffix = quarter ? `${quarter}_${year || new Date().getFullYear()}` : year && month ? `${year}_${month}` : 'All_Time'

    const data = await ReportsService.getTrialBalance(undefined, dateRange.endDate)

    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Trial Balance',
      defaultPath: `Trial_Balance_${suffix}.xlsx`,
      filters: [{ name: 'Excel Worksheets', extensions: ['xlsx'] }]
    })

    if (!filePath) return { success: false, error: 'Export cancelled by user.' }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Trial Balance')

    // Title Header
    worksheet.mergeCells('A1:D1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'SmartGuys Community Healthcare Inc.'
    titleCell.font = { name: 'Arial', size: 14, bold: true }
    titleCell.alignment = { horizontal: 'center' }

    // Subtitle Header
    worksheet.mergeCells('A2:D2')
    const subtitleCell = worksheet.getCell('A2')
    subtitleCell.value = `Trial Balance Report - As of ${dateRange.label}`
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

  /**
   * Generates an Excel spreadsheet for the Income Statement
   */
  static async exportIncomeStatementToExcel(year?: number, month?: number, quarter?: string) {
    const dateRange = resolvePeriodDateRange(year, month, quarter)
    const suffix = quarter ? `${quarter}_${year || new Date().getFullYear()}` : year && month ? `${year}_${month}` : 'All_Time'

    const data = await ReportsService.getIncomeStatement(year, month, quarter)

    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Income Statement',
      defaultPath: `Income_Statement_${suffix}.xlsx`,
      filters: [{ name: 'Excel Worksheets', extensions: ['xlsx'] }]
    })

    if (!filePath) return { success: false, error: 'Export cancelled by user.' }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Income Statement')

    // Title Header
    worksheet.mergeCells('A1:B1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'SmartGuys Community Healthcare Inc.'
    titleCell.font = { name: 'Arial', size: 14, bold: true }
    titleCell.alignment = { horizontal: 'center' }

    // Subtitle Header
    worksheet.mergeCells('A2:B2')
    const subtitleCell = worksheet.getCell('A2')
    subtitleCell.value = `Income Statement - For the period: ${dateRange.label}`
    subtitleCell.font = { name: 'Arial', size: 11, italic: true }
    subtitleCell.alignment = { horizontal: 'center' }

    worksheet.addRow([])

    // Revenues Section
    const revHeader = worksheet.addRow(['REVENUES', ''])
    revHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1B9387' } }

    if (data.revenue.length === 0) {
      worksheet.addRow(['No revenue recorded', 0])
    } else {
      data.revenue.forEach((rev: any) => {
        worksheet.addRow([`   ${rev.name}`, rev.amount])
      })
    }

    const totalRevRow = worksheet.addRow(['Total Revenue', data.totalRevenue])
    totalRevRow.font = { name: 'Arial', size: 11, bold: true }
    totalRevRow.getCell(2).border = { top: { style: 'thin' } }

    worksheet.addRow([])

    // Expenses Section
    const expHeader = worksheet.addRow(['OPERATING EXPENSES', ''])
    expHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1B9387' } }

    if (data.expenses.length === 0) {
      worksheet.addRow(['No operating expenses recorded', 0])
    } else {
      data.expenses.forEach((exp: any) => {
        worksheet.addRow([`   ${exp.name}`, exp.amount])
      })
    }

    const totalExpRow = worksheet.addRow(['Total Operating Expenses', data.totalExpenses])
    totalExpRow.font = { name: 'Arial', size: 11, bold: true }
    totalExpRow.getCell(2).border = { top: { style: 'thin' } }

    worksheet.addRow([])

    // Net Income Row
    const netIncomeRow = worksheet.addRow(['NET INCOME (LOSS)', data.netIncome])
    netIncomeRow.font = { name: 'Arial', size: 12, bold: true }
    netIncomeRow.getCell(1).border = { top: { style: 'thin' }, bottom: { style: 'double' } }
    netIncomeRow.getCell(2).border = { top: { style: 'thin' }, bottom: { style: 'double' } }

    worksheet.getColumn(2).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)'
    worksheet.getColumn(1).width = 45
    worksheet.getColumn(2).width = 25

    const buffer = await workbook.xlsx.writeBuffer()
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { success: true, filePath }
  }

  /**
   * Generates an Excel spreadsheet for the Balance Sheet
   */
  static async exportBalanceSheetToExcel(year?: number, month?: number, quarter?: string) {
    const dateRange = resolvePeriodDateRange(year, month, quarter)
    const suffix = quarter ? `${quarter}_${year || new Date().getFullYear()}` : year && month ? `${year}_${month}` : 'All_Time'

    const data = await ReportsService.getBalanceSheet(year, month, quarter)

    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Balance Sheet',
      defaultPath: `Balance_Sheet_${suffix}.xlsx`,
      filters: [{ name: 'Excel Worksheets', extensions: ['xlsx'] }]
    })

    if (!filePath) return { success: false, error: 'Export cancelled by user.' }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Balance Sheet')

    // Title Header
    worksheet.mergeCells('A1:B1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'SmartGuys Community Healthcare Inc.'
    titleCell.font = { name: 'Arial', size: 14, bold: true }
    titleCell.alignment = { horizontal: 'center' }

    // Subtitle Header
    worksheet.mergeCells('A2:B2')
    const subtitleCell = worksheet.getCell('A2')
    subtitleCell.value = `Balance Sheet - As of ${dateRange.label}`
    subtitleCell.font = { name: 'Arial', size: 11, italic: true }
    subtitleCell.alignment = { horizontal: 'center' }

    worksheet.addRow([])

    // Assets Section
    const assetsHeader = worksheet.addRow(['ASSETS', ''])
    assetsHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1B9387' } }

    if (data.assets.length === 0) {
      worksheet.addRow(['No assets recorded', 0])
    } else {
      data.assets.forEach((asset: any) => {
        worksheet.addRow([`   ${asset.name}`, asset.amount])
      })
    }

    const totalAssetsRow = worksheet.addRow(['Total Assets', data.totalAssets])
    totalAssetsRow.font = { name: 'Arial', size: 11, bold: true }
    totalAssetsRow.getCell(2).border = { top: { style: 'thin' }, bottom: { style: 'double' } }

    worksheet.addRow([])

    // Liabilities Section
    const liabHeader = worksheet.addRow(['LIABILITIES', ''])
    liabHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1B9387' } }

    if (data.liabilities.length === 0) {
      worksheet.addRow(['No liabilities recorded', 0])
    } else {
      data.liabilities.forEach((lia: any) => {
        worksheet.addRow([`   ${lia.name}`, lia.amount])
      })
    }

    const totalLiabRow = worksheet.addRow(['Total Liabilities', data.totalLiabilities])
    totalLiabRow.font = { name: 'Arial', size: 11, bold: true }
    totalLiabRow.getCell(2).border = { top: { style: 'thin' } }

    worksheet.addRow([])

    // Equity Section
    const equityHeader = worksheet.addRow(['EQUITY', ''])
    equityHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1B9387' } }

    data.equity.forEach((eq: any) => {
      worksheet.addRow([`   ${eq.name}`, eq.amount])
    })
    worksheet.addRow(['   Accumulated Net Income / Loss', data.netIncome])

    const totalEquityRow = worksheet.addRow(['Total Equity', data.totalEquity + data.netIncome])
    totalEquityRow.font = { name: 'Arial', size: 11, bold: true }
    totalEquityRow.getCell(2).border = { top: { style: 'thin' } }

    worksheet.addRow([])

    // Total Liabilities & Equity Row
    const totalLiabEquityRow = worksheet.addRow(['TOTAL LIABILITIES & EQUITY', data.totalLiabilitiesAndEquity])
    totalLiabEquityRow.font = { name: 'Arial', size: 12, bold: true }
    totalLiabEquityRow.getCell(1).border = { top: { style: 'thin' }, bottom: { style: 'double' } }
    totalLiabEquityRow.getCell(2).border = { top: { style: 'thin' }, bottom: { style: 'double' } }

    worksheet.getColumn(2).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)'
    worksheet.getColumn(1).width = 45
    worksheet.getColumn(2).width = 25

    const buffer = await workbook.xlsx.writeBuffer()
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { success: true, filePath }
  }

  /**
   * Generates an Excel spreadsheet for the Statement of Cash Flows
   */
  static async exportCashFlowToExcel(year?: number, month?: number, quarter?: string) {
    const dateRange = resolvePeriodDateRange(year, month, quarter)
    const suffix = quarter ? `${quarter}_${year || new Date().getFullYear()}` : year && month ? `${year}_${month}` : 'All_Time'

    const data = await ReportsService.getCashFlowStatement(year, month, quarter)

    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Cash Flow Statement',
      defaultPath: `Cash_Flow_Statement_${suffix}.xlsx`,
      filters: [{ name: 'Excel Worksheets', extensions: ['xlsx'] }]
    })

    if (!filePath) return { success: false, error: 'Export cancelled by user.' }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Cash Flow Statement')

    // Title Header
    worksheet.mergeCells('A1:B1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'SmartGuys Community Healthcare Inc.'
    titleCell.font = { name: 'Arial', size: 14, bold: true }
    titleCell.alignment = { horizontal: 'center' }

    // Subtitle Header
    worksheet.mergeCells('A2:B2')
    const subtitleCell = worksheet.getCell('A2')
    subtitleCell.value = `Statement of Cash Flows - For the period: ${dateRange.label}`
    subtitleCell.font = { name: 'Arial', size: 11, italic: true }
    subtitleCell.alignment = { horizontal: 'center' }

    worksheet.addRow([])

    // Operating Section
    const opHeader = worksheet.addRow(['CASH FLOWS FROM OPERATING ACTIVITIES', ''])
    opHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1B9387' } }

    if (data.operating?.details?.length === 0) {
      worksheet.addRow(['No operating activities in this period', 0])
    } else {
      data.operating?.details?.forEach((item: any) => {
        worksheet.addRow([`   ${item.description}`, item.amount])
      })
    }

    const netOpRow = worksheet.addRow(['Net Cash from Operating Activities', data.operating?.net || 0])
    netOpRow.font = { name: 'Arial', size: 11, bold: true }
    netOpRow.getCell(2).border = { top: { style: 'thin' } }

    worksheet.addRow([])

    // Investing Section
    const invHeader = worksheet.addRow(['CASH FLOWS FROM INVESTING ACTIVITIES', ''])
    invHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1B9387' } }

    if (data.investing?.details?.length === 0) {
      worksheet.addRow(['No investing activities in this period', 0])
    } else {
      data.investing?.details?.forEach((item: any) => {
        worksheet.addRow([`   ${item.description}`, item.amount])
      })
    }

    const netInvRow = worksheet.addRow(['Net Cash from Investing Activities', data.investing?.net || 0])
    netInvRow.font = { name: 'Arial', size: 11, bold: true }
    netInvRow.getCell(2).border = { top: { style: 'thin' } }

    worksheet.addRow([])

    // Financing Section
    const finHeader = worksheet.addRow(['CASH FLOWS FROM FINANCING ACTIVITIES', ''])
    finHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1B9387' } }

    if (data.financing?.details?.length === 0) {
      worksheet.addRow(['No financing activities in this period', 0])
    } else {
      data.financing?.details?.forEach((item: any) => {
        worksheet.addRow([`   ${item.description}`, item.amount])
      })
    }

    const netFinRow = worksheet.addRow(['Net Cash from Financing Activities', data.financing?.net || 0])
    netFinRow.font = { name: 'Arial', size: 11, bold: true }
    netFinRow.getCell(2).border = { top: { style: 'thin' } }

    worksheet.addRow([])

    // Net Increase in Cash Row
    const netCashRow = worksheet.addRow(['NET INCREASE (DECREASE) IN CASH', data.netIncreaseInCash || 0])
    netCashRow.font = { name: 'Arial', size: 12, bold: true }
    netCashRow.getCell(1).border = { top: { style: 'thin' }, bottom: { style: 'double' } }
    netCashRow.getCell(2).border = { top: { style: 'thin' }, bottom: { style: 'double' } }

    worksheet.getColumn(2).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)'
    worksheet.getColumn(1).width = 45
    worksheet.getColumn(2).width = 25

    const buffer = await workbook.xlsx.writeBuffer()
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { success: true, filePath }
  }

  /**
   * Unified dispatcher for financial statement Excel exports
   */
  static async exportFinancialStatementToExcel(
    statementType: 'trial' | 'income' | 'balance' | 'cash-flow',
    year?: number,
    month?: number,
    quarter?: string
  ) {
    if (statementType === 'trial') {
      return await this.exportTrialBalanceToExcel(year, month, quarter)
    } else if (statementType === 'income') {
      return await this.exportIncomeStatementToExcel(year, month, quarter)
    } else if (statementType === 'balance') {
      return await this.exportBalanceSheetToExcel(year, month, quarter)
    } else if (statementType === 'cash-flow') {
      return await this.exportCashFlowToExcel(year, month, quarter)
    }
    return { success: false, error: `Unknown statement type: ${statementType}` }
  }

  /**
   * Export Master Employee Directory to Excel (.xlsx)
   */
  static async exportEmployeesToExcel(employees?: any[]) {
    const defaultFilename = `Employee_Directory_${new Date().toISOString().split('T')[0]}.xlsx`
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Employee Directory to Excel',
      defaultPath: defaultFilename,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) return { success: false, canceled: true }

    let empList = employees
    if (!empList || empList.length === 0) {
      empList = await prisma.employee.findMany({
        orderBy: [{ is_active: 'desc' }, { last_name: 'asc' }]
      })
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'SmartGuys Accounting System'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet('Employees', {
      views: [{ showGridLines: true }]
    })

    // Title Block
    worksheet.mergeCells('A1:L1')
    worksheet.getCell('A1').value = 'SMARTGUYS COMMUNITY HEALTHCARE INC.'
    worksheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1B9387' } }
    worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' }

    worksheet.mergeCells('A2:L2')
    worksheet.getCell('A2').value = `MASTER EMPLOYEE DIRECTORY — Exported on ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`
    worksheet.getCell('A2').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF666666' } }
    worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' }

    worksheet.addRow([])

    const headers = [
      'ID',
      'First Name',
      'Last Name',
      'Position',
      'Status',
      'Monthly Salary',
      'Daily Rate (26d)',
      'Hourly Rate (8h)',
      'TIN',
      'SSS Number',
      'PhilHealth Number',
      'Pag-IBIG Number'
    ]

    const headerRow = worksheet.addRow(headers)
    headerRow.height = 26
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1B9387' }
      }
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFB0DCDA' } },
        bottom: { style: 'medium', color: { argb: 'FF0D6158' } },
        left: { style: 'thin', color: { argb: 'FFB0DCDA' } },
        right: { style: 'thin', color: { argb: 'FFB0DCDA' } }
      }
    })

    const currencyFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)'

    empList.forEach((emp: any) => {
      const salary = Number(emp.monthly_salary || 0)
      const daily = salary / 26
      const hourly = daily / 8
      const isActive = emp.is_active !== false

      const r = worksheet.addRow([
        emp.id,
        emp.first_name,
        emp.last_name,
        emp.position,
        isActive ? 'Active' : 'Archived',
        salary,
        daily,
        hourly,
        emp.tin || '',
        emp.sss_no || '',
        emp.philhealth_no || '',
        emp.pagibig_no || ''
      ])

      r.height = 20
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(6).numFmt = currencyFmt
      r.getCell(7).numFmt = currencyFmt
      r.getCell(8).numFmt = currencyFmt

      r.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9 }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        }
      })
    })

    const colWidths = [8, 18, 18, 24, 12, 18, 16, 16, 18, 16, 18, 18]
    colWidths.forEach((w, i) => {
      worksheet.getColumn(i + 1).width = w
    })

    const buffer = await workbook.xlsx.writeBuffer()
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { success: true, filePath }
  }

  /**
   * Save ready-to-fill Employee Import Template
   */
  static async downloadEmployeeTemplate() {
    const defaultFilename = `Employee_Import_Template.xlsx`
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Employee Import Template',
      defaultPath: defaultFilename,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) return { success: false, canceled: true }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'SmartGuys Accounting System'
    const worksheet = workbook.addWorksheet('Employee Template', {
      views: [{ showGridLines: true }]
    })

    const headers = [
      'First Name',
      'Last Name',
      'Position',
      'Monthly Salary',
      'TIN',
      'SSS Number',
      'PhilHealth Number',
      'Pag-IBIG Number'
    ]
    const headerRow = worksheet.addRow(headers)
    headerRow.height = 26
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1B9387' }
      }
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    const sample1 = worksheet.addRow([
      'Juan',
      'Dela Cruz',
      'Staff Nurse',
      25000,
      '123-456-789-000',
      '34-1234567-8',
      '12-345678901-2',
      '1234-5678-9012'
    ])
    const sample2 = worksheet.addRow([
      'Maria',
      'Santos',
      'Medical Technologist',
      28000,
      '987-654-321-000',
      '09-8765432-1',
      '98-765432109-8',
      '9876-5432-1098'
    ])

    const currencyFmt = '#,##0.00'
    sample1.getCell(4).numFmt = currencyFmt
    sample2.getCell(4).numFmt = currencyFmt

    const colWidths = [18, 18, 24, 18, 18, 16, 18, 18]
    colWidths.forEach((w, i) => {
      worksheet.getColumn(i + 1).width = w
    })

    const buffer = await workbook.xlsx.writeBuffer()
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { success: true, filePath }
  }
}

