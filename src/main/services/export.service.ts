// src/main/services/export.service.ts
import { dialog } from 'electron';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { ReportsService } from './reports.service';

export class ExportService {
    /**
     * Generates an Excel spreadsheet for the Trial Balance and prompts user to save
     */
    static async exportTrialBalanceToExcel(year?: number, month?: number) {
        // 1. Setup the Date Filters and the Subtitle Text
        let endDate;
        let dateText = 'All-Time';
        let filenameSuffix = new Date().toISOString().split('T')[0];

        if (year && month) {
            endDate = new Date(year, month, 0, 23, 59, 59);
            const monthName = new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' });
            dateText = `As of ${monthName} ${year}`;
            filenameSuffix = `${year}_${month}`;
        }

        // 2. Fetch the filtered data!
        const data = await ReportsService.getTrialBalance(undefined, endDate);

        // 3. Prompt user where to save the file
        const { filePath } = await dialog.showSaveDialog({
            title: 'Export Trial Balance',
            defaultPath: `Trial_Balance_${filenameSuffix}.xlsx`,
            filters: [{ name: 'Excel Worksheets', extensions: ['xlsx'] }]
        });

        if (!filePath) return { success: false, error: "Export cancelled by user." };

        // 4. Build the Excel Workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Trial Balance');

        // Title Header
        worksheet.mergeCells('A1:D1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'SmartGuys Community Healthcare Inc.';
        titleCell.font = { name: 'Arial', size: 14, bold: true };
        titleCell.alignment = { horizontal: 'center' };

        // Subtitle Header with the Date!
        worksheet.mergeCells('A2:D2');
        const subtitleCell = worksheet.getCell('A2');
        subtitleCell.value = `Trial Balance Report - ${dateText}`; // 🔥 Added the Date Text here!
        subtitleCell.font = { name: 'Arial', size: 11, italic: true };
        subtitleCell.alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['Account Code', 'Account Name', 'Debit', 'Credit']);
        headerRow.font = { name: 'Arial', size: 11, bold: true };

        data.lines.forEach((line: any) => {
            worksheet.addRow([
                Number(line.accountCode),
                line.accountName,
                line.debit > 0 ? line.debit : null,
                line.credit > 0 ? line.credit : null
            ]);
        });

        const totalRow = worksheet.addRow(['', 'Total', data.totalDebits, data.totalCredits]);
        totalRow.font = { name: 'Arial', size: 11, bold: true };

        worksheet.getColumn(3).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)';
        worksheet.getColumn(4).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)';

        worksheet.getColumn(1).alignment = { horizontal: 'center' };

        worksheet.columns.forEach(col => {
            col.width = 25;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));

        return { success: true, filePath };
    }
    /**
     * Generates a beautifully formatted Excel spreadsheet for Aged Receivables
     */
    static async exportAgedReceivablesToExcel(data: any[], totals: any) {
        const { filePath } = await dialog.showSaveDialog({
            title: 'Export Aged Receivables',
            defaultPath: `Aged_Receivables_${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [{ name: 'Excel Worksheets', extensions: ['xlsx'] }]
        });

        if (!filePath) return { success: false, error: "Export cancelled by user." };

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Aged Receivables');

        // 1. Title Header
        worksheet.mergeCells('A1:F1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'SmartGuys Community Healthcare Inc.';
        titleCell.font = { name: 'Arial', size: 14, bold: true };
        titleCell.alignment = { horizontal: 'center' };

        // 2. Subtitle Header with Date
        worksheet.mergeCells('A2:F2');
        const subtitleCell = worksheet.getCell('A2');
        subtitleCell.value = `Aged Receivables (HMO Tracker) - As of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
        subtitleCell.font = { name: 'Arial', size: 11, italic: true };
        subtitleCell.alignment = { horizontal: 'center' };

        worksheet.addRow([]); // Blank spacer row

        // 3. Table Headers (Styled with Brand Color)
        const headerRow = worksheet.addRow([
            'Patient / HMO / Entity',
            'Current (0-30 Days)',
            '31-60 Days',
            '61-90 Days',
            '90+ Days',
            'Total Outstanding'
        ]);

        headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; // White text
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B9387' } }; // Teal Background
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // 4. Data Rows
        data.forEach(row => {
            const dataRow = worksheet.addRow([
                row.payeeName,
                row.current || 0,
                row.days30 || 0,
                row.days60 || 0,
                row.days90 || 0,
                row.total || 0
            ]);
            // Subtle borders for readability
            dataRow.eachCell(cell => {
                cell.border = { top: { style: 'hair' }, left: { style: 'hair' }, bottom: { style: 'hair' }, right: { style: 'hair' } };
            });
        });

        // 5. Grand Totals Row
        const totalRow = worksheet.addRow([
            'GRAND TOTALS',
            totals.totalCurrent,
            totals.total30,
            totals.total60,
            totals.total90,
            totals.grandTotal
        ]);
        totalRow.font = { name: 'Arial', size: 11, bold: true };
        totalRow.eachCell((cell, colNum) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }; // Light Gray
            cell.border = { top: { style: 'double' }, bottom: { style: 'thin' } };
            if (colNum === 1) cell.alignment = { horizontal: 'right' };
        });

        // 6. Format Columns to Philippine Peso Currency (Columns B through F)
        for (let i = 2; i <= 6; i++) {
            worksheet.getColumn(i).numFmt = '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)';
        }

        // 7. Auto-size Column Widths
        worksheet.getColumn(1).width = 45; // Name column extra wide
        for (let i = 2; i <= 6; i++) {
            worksheet.getColumn(i).width = 22; // Amount columns
        }

        // Save file
        const buffer = await workbook.xlsx.writeBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));

        return { success: true, filePath };
    }
}
