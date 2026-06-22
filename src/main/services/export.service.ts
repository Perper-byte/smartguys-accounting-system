// src/main/services/export.service.ts
import { dialog } from 'electron';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { ReportsService } from './reports.service';

export class ExportService {
    /**
     * Generates a professional Excel sheet of the Trial Balance and prompts user to save it.
     */
    static async exportTrialBalanceToExcel() {
        const data = await ReportsService.getTrialBalance();

        // 1. Prompt user where to save the file
        const { filePath } = await dialog.showSaveDialog({
            title: 'Export Trial Balance',
            defaultPath: `Trial_Balance_${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [{ name: 'Excel Worksheets', extensions: ['xlsx'] }]
        });

        if (!filePath) return { success: false, error: "Export cancelled by user." };

        // 2. Build the Excel Workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Trial Balance');

        // Title Block styling
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

        // Header styling
        worksheet.addRow([]); // Blank spacer row
        const headerRow = worksheet.addRow(['Account Code', 'Account Name', 'Debit', 'Credit']);
        headerRow.font = { name: 'Arial', size: 11, bold: true };

        // Add data rows
        data.lines.forEach(line => {
            worksheet.addRow([
                line.accountCode,
                line.accountName,
                line.debit > 0 ? line.debit : null,
                line.credit > 0 ? line.credit : null
            ]);
        });

        // Total Summary Row
        const totalRow = worksheet.addRow(['', 'Total', data.totalDebits, data.totalCredits]);
        totalRow.font = { name: 'Arial', size: 11, bold: true };

        // Formatting currency columns (C and D)
        worksheet.getColumn(3).numFmt = '"₱"#,##0.00;("₱"#,##0.00);"-"';
        worksheet.getColumn(4).numFmt = '"₱"#,##0.00;("₱"#,##0.00);"-"';

        // Auto-fit columns for professional spacing
        worksheet.columns.forEach(col => {
            col.width = 20;
        });

        // Write to Disk
        const buffer = await workbook.xlsx.writeBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));

        return { success: true, filePath };
    }
}