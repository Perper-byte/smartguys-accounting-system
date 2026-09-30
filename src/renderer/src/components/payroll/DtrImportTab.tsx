import React, { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { aggregateDtrRecords, DailyPunchLog } from '../../utils/dtr-classifier'

export function DtrImportTab({
  employees,
  onApply
}: {
  employees: any[]
  onApply: (updates: any[]) => void
}) {
  const [parsedData, setParsedData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        processData(data)
      } catch (err) {
        setError('Failed to parse file. Please ensure it is a valid CSV or Excel file.')
      }
    }
    reader.readAsBinaryString(file)
  }

  const processData = (data: any[]) => {
    const employeeLogs: Record<string, DailyPunchLog[]> = {}
    
    // Group logs by employee name
    data.forEach(row => {
      const name = row['Employee Name'] || row['Name'] || row['employee']
      if (!name) return

      const dateStr = row['Date'] || row['date']
      const timeInStr = row['Time In'] || row['time_in']
      const timeOutStr = row['Time Out'] || row['time_out']
      const shiftType = row['Shift Type'] || row['shift_type'] || 'REGULAR'

      if (!employeeLogs[name]) employeeLogs[name] = []

      const date = new Date(dateStr)
      let timeIn = null
      let timeOut = null

      if (timeInStr) {
        timeIn = new Date(`${dateStr} ${timeInStr}`)
      }
      if (timeOutStr) {
        timeOut = new Date(`${dateStr} ${timeOutStr}`)
        if (timeOut < timeIn!) {
          timeOut.setDate(timeOut.getDate() + 1) // next day
        }
      }

      employeeLogs[name].push({
        date,
        timeIn,
        timeOut,
        shiftType: shiftType as any
      })
    })

    const results: any[] = []

    Object.entries(employeeLogs).forEach(([name, logs]) => {
      // Fuzzy match employee
      const matchedEmployee = employees.find(e => 
        `${e.first_name} ${e.last_name}`.toLowerCase() === name.toLowerCase() ||
        name.toLowerCase().includes(e.first_name.toLowerCase())
      )

      const aggregated = aggregateDtrRecords(logs)

      results.push({
        originalName: name,
        matchedEmployee,
        logs,
        aggregated
      })
    })

    setParsedData(results)
    setError(null)
  }

  const handleApply = () => {
    const updates = parsedData
      .filter(d => d.matchedEmployee)
      .map(d => ({
        id: d.matchedEmployee.id,
        baseHours: d.aggregated.totalBaseHours,
        overtimeHours: d.aggregated.totalHours,
        demerits: d.aggregated.totalDemerits
      }))
    onApply(updates)
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-auto print:hidden p-8">
      <div className="max-w-5xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">DTR Import</h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">Upload time logs to auto-compute payroll hours.</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-500 border border-red-200 rounded-md text-sm font-bold shadow-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="mb-8 p-8 border-2 border-dashed border-[#B0DCDA] bg-[#FBF8F8] rounded-xl flex flex-col items-center justify-center text-center">
          <p className="text-sm font-bold text-gray-600 mb-4">Drag and drop CSV or Excel file here, or click to select.</p>
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileUpload}
            className="block w-full max-w-sm text-sm text-gray-500
              file:mr-4 file:py-2.5 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-bold
              file:bg-[#1B9387] file:text-white
              hover:file:bg-[#28958B] file:cursor-pointer file:transition shadow-sm"
          />
        </div>

        {parsedData.length > 0 && (
          <div className="animate-in fade-in duration-300">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Preview & Verification</h3>
            <div className="overflow-auto border border-[#B0DCDA] rounded-xl bg-white shadow-sm mb-6">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA]">
                  <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                    <th className="p-4 border-r border-[#B0DCDA]">DTR Name</th>
                    <th className="p-4 border-r border-[#B0DCDA]">Matched Employee</th>
                    <th className="p-4 border-r border-[#B0DCDA] text-right">Base Hrs</th>
                    <th className="p-4 border-r border-[#B0DCDA] text-right">Reg OT</th>
                    <th className="p-4 border-r border-[#B0DCDA] text-right">Night Diff</th>
                    <th className="p-4 text-right">Demerits (Mins)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium text-gray-700 border-r border-[#B0DCDA]">{row.originalName}</td>
                      <td className="p-4 border-r border-[#B0DCDA]">
                        {row.matchedEmployee ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold shadow-sm">
                            ✅ {row.matchedEmployee.first_name} {row.matchedEmployee.last_name}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-xs font-bold shadow-sm">
                            ⚠️ Unmatched
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right border-r border-[#B0DCDA] font-mono font-bold text-gray-800">{row.aggregated.totalBaseHours.toFixed(2)}</td>
                      <td className="p-4 text-right border-r border-[#B0DCDA] font-mono text-gray-600">{row.aggregated.totalHours.regular_ot.toFixed(2)}</td>
                      <td className="p-4 text-right border-r border-[#B0DCDA] font-mono text-gray-600">{row.aggregated.totalHours.regular_night.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono text-red-500 font-medium">
                        {row.aggregated.totalDemerits.late_minutes + row.aggregated.totalDemerits.undertime_minutes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleApply}
                className="px-8 py-3 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-lg font-bold transition shadow-md tracking-wide uppercase text-sm flex items-center gap-2"
              >
                Apply to Payroll Grid
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
