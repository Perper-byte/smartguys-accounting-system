// src/main/services/export.service.ts
import { dialog } from 'electron';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { ReportsService } from './reports.service';

export class ExportService {
    /**
     * Generates an Excel spreadsheet for the Trial Balance and prompts user to save
     */
    static async exportTrialBalanceToExcel() {
        const data = await ReportsService.getTrialBalance();

        const { filePath } = await dialog.showSaveDialog({
            title: 'Export Trial Balance',
            defaultPath: `Trial_Balance_${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [{ name: 'Excel Worksheets', extensions: ['xlsx'] }]
        });

        if (!filePath) return { success: false, error: "Export cancelled by user." };

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Trial Balance');

        // Title Header
        worksheet.mergeCells('A1:D1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'SmartGuys Community Healthcare Inc.';
        titleCell.font = { name: 'Arial', size: 14, bold: true };
        titleCell.alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:D2');
        const subtitleCell = worksheet.getCell('A2');
        subtitleCell.value = 'Trial Balance Report';
        subtitleCell.font = { name: 'Arial', size: 11, italic: true };
        subtitleCell.alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['Account Code', 'Account Name', 'Debit', 'Credit']);
        headerRow.font = { name: 'Arial', size: 11, bold: true };

        data.lines.forEach((line: any) => {
            worksheet.addRow([
                Number(line.accountCode), // <-- Converts to number
                line.accountName,
                line.debit > 0 ? line.debit : null,
                line.credit > 0 ? line.credit : null
            ]);
        });

        const totalRow = worksheet.addRow(['', 'Total', data.totalDebits, data.totalCredits]);
        totalRow.font = { name: 'Arial', size: 11, bold: true };

        // Use Official Accounting Format in Excel (Aligns currency symbol left, numbers right)
        worksheet.getColumn(3).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)';
        worksheet.getColumn(4).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)';

        worksheet.columns.forEach(col => {
            col.width = 25;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));

        return { success: true, filePath };
    }
}