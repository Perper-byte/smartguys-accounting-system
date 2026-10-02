import React, { useState, useMemo, useEffect } from 'react'
import { X, Search, RotateCcw, ShieldCheck, Check, Calculator, Save, Edit3 } from 'lucide-react'
import {
  SSSBracket,
  getSSSBrackets,
  saveSSSBrackets,
  resetSSSBracketsTo2026,
  calculateSSS2026
} from '../../utils/statutory-rates'

export function SSSBracketTableModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [brackets, setBrackets] = useState<SSSBracket[]>(getSSSBrackets())
  const [searchSalary, setSearchSalary] = useState<string>('')
  const [hasChanges, setHasChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Excel-like Drag-and-Select multi-cell selection state
  interface CellCoord {
    row: number
    col: number
  }

  const [selection, setSelection] = useState<{ start: CellCoord; end: CellCoord } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const selectionBounds = useMemo(() => {
    if (!selection) return null
    const minRow = Math.min(selection.start.row, selection.end.row)
    const maxRow = Math.max(selection.start.row, selection.end.row)
    const minCol = Math.min(selection.start.col, selection.end.col)
    const maxCol = Math.max(selection.start.col, selection.end.col)
    return { minRow, maxRow, minCol, maxCol }
  }, [selection])

  const getCellSelectionStyle = (row: number, col: number) => {
    if (!selectionBounds) return ''
    const { minRow, maxRow, minCol, maxCol } = selectionBounds
    const isSelected = row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
    if (!isSelected) return ''

    let classes = 'bg-sky-100/70 '
    if (row === minRow) classes += 'border-t-2 !border-t-sky-600 '
    if (row === maxRow) classes += 'border-b-2 !border-b-sky-600 '
    if (col === minCol) classes += 'border-l-2 !border-l-sky-600 '
    if (col === maxCol) classes += 'border-r-2 !border-r-sky-600 '
    return classes
  }

  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (e.shiftKey && selection) {
      setSelection({ start: selection.start, end: { row, col } })
      return
    }
    setIsDragging(true)
    setSelection({ start: { row, col }, end: { row, col } })
  }

  const handleCellMouseEnter = (row: number, col: number) => {
    if (!isDragging || !selection) return
    setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null))
  }

  useEffect(() => {
    const onMouseUp = () => setIsDragging(false)
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  const parsedSalary = parseFloat(searchSalary) || 0
  const activeCalculation = useMemo(() => {
    if (parsedSalary <= 0) return null
    return calculateSSS2026(parsedSalary, brackets)
  }, [parsedSalary, brackets])

  if (!isOpen) return null

  // Handle cell edits for specific fields
  const handleCellChange = (
    bracketId: number,
    field: keyof SSSBracket,
    value: string | number
  ) => {
    setBrackets((prev) =>
      prev.map((b) => {
        if (b.id !== bracketId) return b

        const updated = { ...b }

        if (field === 'rangeLabel') {
          updated.rangeLabel = String(value)
        } else if (field === 'minComp' || field === 'maxComp') {
          const num = value === '' ? (field === 'maxComp' ? null : 0) : parseFloat(String(value))
          if (field === 'maxComp') updated.maxComp = isNaN(num as number) ? null : num
          else updated.minComp = isNaN(num as number) ? 0 : (num as number)
        } else if (field === 'regularMsc' || field === 'mpfMsc') {
          const num = parseFloat(String(value)) || 0
          if (field === 'regularMsc') {
            updated.regularMsc = num
            // Suggest default 10% ER / 5% EE shares
            updated.erRegular = Math.round(num * 0.10 * 100) / 100
            updated.eeRegular = Math.round(num * 0.05 * 100) / 100
          } else {
            updated.mpfMsc = num
            updated.erMpf = Math.round(num * 0.10 * 100) / 100
            updated.eeMpf = Math.round(num * 0.05 * 100) / 100
          }
          updated.totalMsc = updated.regularMsc + updated.mpfMsc
          updated.erTotal = updated.erRegular + updated.erMpf + updated.erEc
          updated.eeTotal = updated.eeRegular + updated.eeMpf
          updated.totalContribution = updated.eeTotal + updated.erTotal
        } else if (field === 'erRegular' || field === 'erMpf' || field === 'erEc') {
          const num = parseFloat(String(value)) || 0
          if (field === 'erRegular') updated.erRegular = num
          else if (field === 'erMpf') updated.erMpf = num
          else updated.erEc = num
          updated.erTotal = updated.erRegular + updated.erMpf + updated.erEc
          updated.totalContribution = updated.eeTotal + updated.erTotal
        } else if (field === 'eeRegular' || field === 'eeMpf') {
          const num = parseFloat(String(value)) || 0
          if (field === 'eeRegular') updated.eeRegular = num
          else updated.eeMpf = num
          updated.eeTotal = updated.eeRegular + updated.eeMpf
          updated.totalContribution = updated.eeTotal + updated.erTotal
        } else if (field === 'eeTotal') {
          const num = parseFloat(String(value)) || 0
          updated.eeTotal = num
          updated.totalContribution = updated.eeTotal + updated.erTotal
        } else if (field === 'erTotal') {
          const num = parseFloat(String(value)) || 0
          updated.erTotal = num
          updated.totalContribution = updated.eeTotal + updated.erTotal
        }

        return updated
      })
    )
    setHasChanges(true)
  }

  const handleSave = () => {
    saveSSSBrackets(brackets)
    setHasChanges(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  const handleReset = () => {
    if (
      window.confirm(
        'Are you sure you want to restore the official 2026 SSS Table (61 brackets)? Any custom changes will be overwritten.'
      )
    ) {
      const fresh = resetSSSBracketsTo2026()
      setBrackets(fresh)
      setHasChanges(false)
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 3000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden p-4">
      <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-[#0A3663] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-sky-300" />
            <div>
              <h3 className="text-lg font-black tracking-wide flex items-center gap-2">
                SSS Contribution Schedule (Employer &amp; Employee Shares)
                <span className="text-[10px] bg-sky-500/30 text-sky-200 px-2 py-0.5 rounded-full border border-sky-400/30 font-bold">
                  61 BRACKETS • FULL SCHEDULE
                </span>
              </h3>
              <p className="text-xs text-sky-100/80">
                Official RA 11199 matrix: Regular SS (10% ER / 5% EE), MPF / WISP (10% ER / 5% EE), and EC (₱10/₱30). Click any cell to edit.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTROLS & TEST CALCULATOR */}
        <div className="p-4 bg-sky-50/50 border-b border-sky-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Calculator className="w-4 h-4 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                placeholder="Test monthly salary (e.g. 25000)..."
                value={searchSalary}
                onChange={(e) => setSearchSalary(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-bold border border-sky-200 rounded-lg bg-white outline-none focus:border-sky-600 shadow-xs"
              />
            </div>
            {parsedSalary > 0 && (
              <button
                onClick={() => setSearchSalary('')}
                className="text-xs text-gray-400 hover:text-gray-600 font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition shadow-xs cursor-pointer ${
                hasChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {saveSuccess ? 'Changes Saved!' : 'Save Table Changes'}
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-sky-200 hover:bg-sky-100/50 text-sky-800 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
              {resetSuccess ? 'Reset Complete!' : 'Reset to Official Table'}
            </button>
          </div>
        </div>

        {/* LIVE CALCULATION RESULT CALLOUT */}
        {activeCalculation && (
          <div className="px-6 py-3 bg-[#EBF5FB] border-b border-sky-200 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shrink-0">
            <div className="flex items-center gap-2 font-bold text-gray-700">
              <span className="text-[11px] uppercase text-sky-800 font-black">Matched Bracket:</span>
              <span className="px-2 py-0.5 rounded bg-sky-200 text-sky-900 font-extrabold">
                {activeCalculation.bracket.rangeLabel}
              </span>
              <span>(Total MSC: ₱{activeCalculation.totalMsc.toLocaleString()})</span>
            </div>

            <div className="flex items-center gap-4 font-bold text-xs">
              <div>
                <span className="text-gray-500 mr-1">ER Share (10% + EC):</span>
                <strong className="text-indigo-700 font-black">
                  ₱{activeCalculation.totalER.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <span className="text-gray-300">|</span>
              <div>
                <span className="text-gray-500 mr-1">EE Share (5%):</span>
                <strong className="text-blue-700 font-black">
                  ₱{activeCalculation.totalEE.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <span className="text-gray-300">|</span>
              <div>
                <span className="text-gray-500 mr-1">Total Contribution:</span>
                <strong className="text-emerald-700 font-black text-sm">
                  ₱{activeCalculation.totalContribution.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* INSTRUCTIONS BANNER */}
        <div className="px-6 py-2 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between text-[11px] text-amber-800 shrink-0">
          <div className="flex items-center gap-1.5 font-medium">
            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
            <span>Click into any cell to update compensation ranges, MSCs, Employer contributions, or Employee deductions.</span>
          </div>
          {hasChanges && (
            <span className="font-black text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded text-[10px] animate-pulse">
              Unsaved Changes
            </span>
          )}
        </div>

        {/* SCROLLABLE 61-BRACKET MATRIX (FULL OFFICIAL SCHEDULE) */}
        <div className="flex-1 overflow-auto bg-gray-50">
          <table className="w-full border-collapse text-[11px] text-left font-mono whitespace-nowrap">
            <thead className="sticky top-0 z-20 shadow-xs">
              {/* LEVEL 1 HEADERS */}
              <tr className="bg-[#104C82] text-white uppercase font-black text-center border-b border-sky-800">
                <th rowSpan={2} className="p-2 border-r border-sky-800/80 min-w-[150px] bg-[#0A3663]">
                  RANGE OF COMPENSATION
                </th>
                <th colSpan={3} className="p-1.5 border-r border-sky-800/80 bg-[#145C9E]">
                  MONTHLY SALARY CREDIT (MSC)
                </th>
                <th colSpan={4} className="p-1.5 border-r border-sky-800/80 bg-[#1D6FA5]">
                  EMPLOYER (ER) SHARE
                </th>
                <th colSpan={3} className="p-1.5 border-r border-sky-800/80 bg-[#00828A]">
                  EMPLOYEE (EE) SHARE
                </th>
                <th rowSpan={2} className="p-2 bg-[#005B60] text-amber-300 min-w-[100px]">
                  TOTAL
                </th>
              </tr>

              {/* LEVEL 2 HEADERS */}
              <tr className="bg-[#E1ECF4] text-gray-800 font-black uppercase text-center border-b border-gray-300">
                <th className="p-1.5 border-r border-gray-300 min-w-[80px]">Regular SS</th>
                <th className="p-1.5 border-r border-gray-300 min-w-[75px]">MPF</th>
                <th className="p-1.5 border-r border-gray-300 min-w-[85px] bg-sky-200/60 font-black">Total MSC</th>

                <th className="p-1.5 border-r border-gray-300 min-w-[85px]">Regular SS</th>
                <th className="p-1.5 border-r border-gray-300 min-w-[75px]">MPF</th>
                <th className="p-1.5 border-r border-gray-300 min-w-[60px]">EC</th>
                <th className="p-1.5 border-r border-gray-300 min-w-[90px] bg-indigo-100 font-black text-indigo-900">Total ER</th>

                <th className="p-1.5 border-r border-gray-300 min-w-[85px]">Regular SS</th>
                <th className="p-1.5 border-r border-gray-300 min-w-[75px]">MPF</th>
                <th className="p-1.5 border-r border-gray-300 min-w-[95px] bg-teal-100 font-black text-teal-900">Total EE</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {brackets.map((b, rowIdx) => {
                const isMatch = activeCalculation?.bracket.id === b.id
                return (
                  <tr
                    key={b.id}
                    className={`transition-colors ${
                      isMatch
                        ? 'bg-amber-100/90 font-bold border-y-2 border-amber-500'
                        : b.id % 2 === 0
                          ? 'bg-gray-50/60 hover:bg-sky-50/50'
                          : 'bg-white hover:bg-sky-50/50'
                    }`}
                  >
                    {/* RANGE LABEL (Col 0) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 0, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 0)}
                      className={`p-1 pl-3 border-r border-gray-200 relative transition-colors ${getCellSelectionStyle(rowIdx, 0)} ${
                        isMatch ? 'text-amber-900 font-black' : 'text-gray-800 font-bold'
                      }`}
                    >
                      <input
                        type="text"
                        value={b.rangeLabel}
                        onChange={(e) => handleCellChange(b.id, 'rangeLabel', e.target.value)}
                        onFocus={() => {
                          if (!isDragging) {
                            setSelection({ start: { row: rowIdx, col: 0 }, end: { row: rowIdx, col: 0 } })
                          }
                        }}
                        className="w-full bg-transparent hover:bg-white focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-sky-500 outline-none text-xs cursor-cell"
                      />
                    </td>

                    {/* REGULAR MSC (Col 1) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 1, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 1)}
                      className={`p-1 text-right border-r border-gray-200 relative transition-colors ${getCellSelectionStyle(rowIdx, 1)}`}
                    >
                      <input
                        type="number"
                        step="500"
                        value={b.regularMsc === 0 ? '' : b.regularMsc}
                        onChange={(e) => handleCellChange(b.id, 'regularMsc', e.target.value)}
                        onFocus={() => {
                          if (!isDragging) {
                            setSelection({ start: { row: rowIdx, col: 1 }, end: { row: rowIdx, col: 1 } })
                          }
                        }}
                        className="w-full text-right bg-transparent hover:bg-white focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-sky-500 outline-none font-bold text-gray-700 cursor-cell"
                      />
                    </td>

                    {/* MPF MSC (Col 2) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 2, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 2)}
                      className={`p-1 text-right border-r border-gray-200 relative transition-colors ${getCellSelectionStyle(rowIdx, 2)}`}
                    >
                      <input
                        type="number"
                        step="500"
                        value={b.mpfMsc === 0 ? '' : b.mpfMsc}
                        onChange={(e) => handleCellChange(b.id, 'mpfMsc', e.target.value)}
                        onFocus={() => {
                          if (!isDragging) {
                            setSelection({ start: { row: rowIdx, col: 2 }, end: { row: rowIdx, col: 2 } })
                          }
                        }}
                        placeholder="-"
                        className="w-full text-right bg-transparent hover:bg-white focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-sky-500 outline-none text-gray-600 cursor-cell"
                      />
                    </td>

                    {/* TOTAL MSC (Col 3) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 3, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 3)}
                      className={`p-1.5 text-right border-r border-gray-200 font-bold text-sky-900 bg-sky-50/30 relative transition-colors cursor-cell select-none ${getCellSelectionStyle(
                        rowIdx,
                        3
                      )}`}
                    >
                      {b.totalMsc.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* ER REGULAR SHARE (Col 4) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 4, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 4)}
                      className={`p-1 text-right border-r border-gray-200 relative transition-colors ${getCellSelectionStyle(rowIdx, 4)}`}
                    >
                      <input
                        type="number"
                        step="0.01"
                        value={b.erRegular === 0 ? '' : b.erRegular}
                        onChange={(e) => handleCellChange(b.id, 'erRegular', e.target.value)}
                        onFocus={() => {
                          if (!isDragging) {
                            setSelection({ start: { row: rowIdx, col: 4 }, end: { row: rowIdx, col: 4 } })
                          }
                        }}
                        className="w-full text-right bg-transparent hover:bg-white focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-sky-500 outline-none font-bold text-indigo-700 cursor-cell"
                      />
                    </td>

                    {/* ER MPF SHARE (Col 5) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 5, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 5)}
                      className={`p-1 text-right border-r border-gray-200 relative transition-colors ${getCellSelectionStyle(rowIdx, 5)}`}
                    >
                      <input
                        type="number"
                        step="0.01"
                        value={b.erMpf === 0 ? '' : b.erMpf}
                        onChange={(e) => handleCellChange(b.id, 'erMpf', e.target.value)}
                        onFocus={() => {
                          if (!isDragging) {
                            setSelection({ start: { row: rowIdx, col: 5 }, end: { row: rowIdx, col: 5 } })
                          }
                        }}
                        placeholder="-"
                        className="w-full text-right bg-transparent hover:bg-white focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-sky-500 outline-none text-indigo-600 cursor-cell"
                      />
                    </td>

                    {/* ER EC SHARE (Col 6) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 6, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 6)}
                      className={`p-1 text-right border-r border-gray-200 relative transition-colors ${getCellSelectionStyle(rowIdx, 6)}`}
                    >
                      <input
                        type="number"
                        step="1"
                        value={b.erEc === 0 ? '' : b.erEc}
                        onChange={(e) => handleCellChange(b.id, 'erEc', e.target.value)}
                        onFocus={() => {
                          if (!isDragging) {
                            setSelection({ start: { row: rowIdx, col: 6 }, end: { row: rowIdx, col: 6 } })
                          }
                        }}
                        className="w-full text-right bg-transparent hover:bg-white focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-sky-500 outline-none font-bold text-amber-700 cursor-cell"
                      />
                    </td>

                    {/* ER TOTAL SHARE (Col 7) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 7, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 7)}
                      className={`p-1.5 text-right font-black text-indigo-900 bg-indigo-50/40 border-r border-gray-200 relative transition-colors cursor-cell select-none ${getCellSelectionStyle(
                        rowIdx,
                        7
                      )}`}
                    >
                      {b.erTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* EE REGULAR SHARE (Col 8) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 8, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 8)}
                      className={`p-1 text-right border-r border-gray-200 relative transition-colors ${getCellSelectionStyle(rowIdx, 8)}`}
                    >
                      <input
                        type="number"
                        step="0.01"
                        value={b.eeRegular === 0 ? '' : b.eeRegular}
                        onChange={(e) => handleCellChange(b.id, 'eeRegular', e.target.value)}
                        onFocus={() => {
                          if (!isDragging) {
                            setSelection({ start: { row: rowIdx, col: 8 }, end: { row: rowIdx, col: 8 } })
                          }
                        }}
                        className="w-full text-right bg-transparent hover:bg-white focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-sky-500 outline-none font-bold text-blue-700 cursor-cell"
                      />
                    </td>

                    {/* EE MPF SHARE (Col 9) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 9, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 9)}
                      className={`p-1 text-right border-r border-gray-200 relative transition-colors ${getCellSelectionStyle(rowIdx, 9)}`}
                    >
                      <input
                        type="number"
                        step="0.01"
                        value={b.eeMpf === 0 ? '' : b.eeMpf}
                        onChange={(e) => handleCellChange(b.id, 'eeMpf', e.target.value)}
                        onFocus={() => {
                          if (!isDragging) {
                            setSelection({ start: { row: rowIdx, col: 9 }, end: { row: rowIdx, col: 9 } })
                          }
                        }}
                        placeholder="-"
                        className="w-full text-right bg-transparent hover:bg-white focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-sky-500 outline-none text-blue-600 cursor-cell"
                      />
                    </td>

                    {/* EE TOTAL SHARE (Col 10) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 10, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 10)}
                      className={`p-1.5 text-right font-black text-teal-900 bg-teal-50/40 border-r border-gray-200 relative transition-colors cursor-cell select-none ${getCellSelectionStyle(
                        rowIdx,
                        10
                      )}`}
                    >
                      {b.eeTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* GRAND TOTAL CONTRIBUTION (Col 11) */}
                    <td
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, 11, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, 11)}
                      className={`p-1.5 text-right pr-4 font-black text-emerald-950 bg-emerald-100/50 relative transition-colors cursor-cell select-none ${getCellSelectionStyle(
                        rowIdx,
                        11
                      )}`}
                    >
                      {b.totalContribution.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 shrink-0">
          <div className="flex items-center gap-4">
            <span>Showing all <strong>61</strong> statutory brackets</span>
            <span className="text-gray-300">|</span>
            <span>Regular MSC Cap: <strong>₱20,000</strong></span>
            <span className="text-gray-300">|</span>
            <span>Total MSC Cap: <strong>₱35,000</strong></span>
          </div>

          <div className="flex items-center gap-3">
            {hasChanges && (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-[#0A3663] hover:bg-[#104C82] text-white rounded-lg font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
            >
              Close Table
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
