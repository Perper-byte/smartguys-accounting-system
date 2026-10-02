import * as React from 'react'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Download,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Save,
  FolderOpen,
  Trash2,
  Calendar,
  X
} from 'lucide-react'
import { exportPayrollGridToExcel, PayrollRowExportData } from '../../utils/excel-payroll-export'
import {
  ALL_DOLE_RATES,
  getActiveDoleRateKeys,
  getDoleMultipliers,
  DOLERateDef
} from '../../utils/dole-rates'
import {
  MONTH_NAMES,
  isLeapYear,
  getDaysInMonth,
  getPayrollCutoffDetails,
  CutoffType,
  PayrollDraft,
  getPayrollDrafts,
  findDraftForCutoff,
  savePayrollDraft,
  deletePayrollDraft
} from '../../utils/payroll-periods'
import {
  calculateTRAINWithholdingTax,
  getStatutoryEnabledConfig,
  StatutoryEnabledConfig,
  calculateSSS2026,
  calculatePhilHealth2026,
  calculatePagIbig2026
} from '../../utils/statutory-rates'

export interface DOLEHourRates {
  reg: number
  ot: number
  nd: number
  nd_ot: number
  sun_reg: number
  sun_ot: number
  sun_nd: number
  sun_nd_ot: number
  leg_reg: number
  leg_ot: number
  leg_nd: number
  leg_nd_ot: number
  spcl_reg: number
  spcl_ot: number
  spcl_nd: number
  spcl_nd_ot: number
  [key: string]: number
}

export function PayrollGridTab({
  employees,
  userId,
  setStatus,
  dtrUpdates,
  onClearDtr
}: {
  employees: any[]
  userId: string
  setStatus: (status: { type: 'success' | 'error'; msg: string } | null) => void
  dtrUpdates?: any[]
  onClearDtr?: () => void
}) {
  const now = new Date()
  const initialCutoff: CutoffType = now.getDate() <= 15 ? '1ST_HALF' : '2ND_HALF'
  const initialDetails = getPayrollCutoffDetails(now.getFullYear(), now.getMonth() + 1, initialCutoff)

  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [cutoffType, setCutoffType] = useState<CutoffType>(initialCutoff)

  const [date, setDate] = useState(initialDetails.payrollDate)
  const [refSequence, setRefSequence] = useState('')
  const [description, setDescription] = useState(initialDetails.defaultMemo)
  const [loading, setLoading] = useState(false)

  // Check for existing draft for the initial period
  const initialDraft = findDraftForCutoff(now.getFullYear(), now.getMonth() + 1, initialCutoff)

  // Drafts management
  const [draftsList, setDraftsList] = useState<PayrollDraft[]>(getPayrollDrafts())
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [draftSavedStatus, setDraftSavedStatus] = useState<string | null>(
    initialDraft
      ? `Draft loaded (${new Date(initialDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
      : null
  )
  const autoSaveTimerRef = useRef<any>(null)

  // Active DOLE rates & multipliers
  const [activeRateKeys, setActiveRateKeys] = useState<string[]>(getActiveDoleRateKeys())
  const [doleMultipliers, setDoleMultipliers] = useState<Record<string, number>>(getDoleMultipliers())
  const [statutoryEnabled, setStatutoryEnabled] = useState<StatutoryEnabledConfig>(getStatutoryEnabledConfig())

  // Period lock management
  const [lockDate, setLockDate] = useState<string | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [overridePin, setOverridePin] = useState('')
  const [pinError, setPinError] = useState('')
  const isLocked = lockDate ? date <= lockDate : false

  // Employee row in-cell state
  // key: emp.id -> { hours: DOLEHourRates, absentDays: number, deductions: { sss, philhealth, hdmf, tax }, adjustments: { meal, license, adj, sil } }
  const [rowInputs, setRowInputs] = useState<Record<number, any>>(initialDraft?.rowInputs || {})
  const [overrides, setOverrides] = useState<Record<number, Record<string, boolean>>>({})

  // Listen for DOLE settings updates from Settings tab
  useEffect(() => {
    const handleRatesUpdate = (e: any) => {
      if (e.detail) setActiveRateKeys(e.detail)
    }
    const handleMultUpdate = (e: any) => {
      if (e.detail) setDoleMultipliers(e.detail)
    }
    window.addEventListener('smartguys:dole-rates-updated', handleRatesUpdate)
    window.addEventListener('smartguys:dole-multipliers-updated', handleMultUpdate)

    const handleDraftsUpdate = (e: any) => {
      if (e.detail) setDraftsList(e.detail)
    }
    window.addEventListener('smartguys:payroll-drafts-updated', handleDraftsUpdate)

    const handleStatutoryUpdate = () => {
      setStatutoryEnabled(getStatutoryEnabledConfig())
      // Trigger state bump so calculatedRows re-runs with new statutory settings/brackets
      setRowInputs((prev) => ({ ...prev }))
    }
    window.addEventListener('smartguys:statutory-rates-updated', handleStatutoryUpdate)

    return () => {
      window.removeEventListener('smartguys:dole-rates-updated', handleRatesUpdate)
      window.removeEventListener('smartguys:dole-multipliers-updated', handleMultUpdate)
      window.removeEventListener('smartguys:payroll-drafts-updated', handleDraftsUpdate)
      window.removeEventListener('smartguys:statutory-rates-updated', handleStatutoryUpdate)
    }
  }, [])

  // Cutoff change handler
  const handleCutoffChange = (
    newCutoff: CutoffType,
    yr: number = selectedYear,
    mo: number = selectedMonth
  ) => {
    setCutoffType(newCutoff)
    if (newCutoff !== 'CUSTOM') {
      const details = getPayrollCutoffDetails(yr, mo, newCutoff)
      setDate(details.payrollDate)
      setDescription(details.defaultMemo)

      // Look up existing draft for this period
      const existingDraft = findDraftForCutoff(yr, mo, newCutoff)
      if (existingDraft && Object.keys(existingDraft.rowInputs || {}).length > 0) {
        setRowInputs(existingDraft.rowInputs)
        const timeStr = new Date(existingDraft.savedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
        setDraftSavedStatus(`Draft loaded (${timeStr})`)
      }
    }
  }

  // Save Draft (Manual or Autosave)
  const handleSaveDraft = (manual = true) => {
    if (Object.keys(rowInputs).length === 0) return
    const draftId = `draft-${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${cutoffType}`
    const details = getPayrollCutoffDetails(selectedYear, selectedMonth, cutoffType)
    const draft: PayrollDraft = {
      id: draftId,
      cutoff: cutoffType,
      year: selectedYear,
      month: selectedMonth,
      startDate: details.startDate,
      endDate: details.endDate,
      payrollDate: date,
      refSequence,
      description,
      rowInputs,
      savedAt: new Date().toISOString(),
      totalEmployees: calculatedRows.length,
      totalNet: summaryTotals?.netTotal || 0
    }
    savePayrollDraft(draft)
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setDraftSavedStatus(`Draft saved at ${timeStr}`)
    if (manual) {
      setStatus({
        type: 'success',
        msg: `Payroll draft for ${details.label} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}) saved successfully!`
      })
      setTimeout(() => setStatus(null), 3000)
    }
  }

  // Resume Draft from Saved Drafts modal
  const handleResumeDraft = (draft: PayrollDraft) => {
    setSelectedYear(draft.year)
    setSelectedMonth(draft.month)
    setCutoffType(draft.cutoff)
    setDate(draft.payrollDate)
    setRefSequence(draft.refSequence || refSequence)
    setDescription(draft.description)
    setRowInputs(draft.rowInputs || {})
    setShowDraftsModal(false)
    const timeStr = new Date(draft.savedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
    setDraftSavedStatus(`Resumed draft from ${timeStr}`)
    setStatus({
      type: 'success',
      msg: `Resumed draft for ${draft.description}!`
    })
    setTimeout(() => setStatus(null), 3500)
  }

  // Delete Draft
  const handleDeleteDraft = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    deletePayrollDraft(id)
  }

  // Debounced auto-save effect
  useEffect(() => {
    if (Object.keys(rowInputs).length === 0) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveDraft(false) // background autosave
    }, 2000)
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        // Immediately persist current state to draft storage
        handleSaveDraft(false)
      }
    }
  }, [rowInputs, date, description, refSequence, cutoffType, selectedYear, selectedMonth])

  const fetchNextSeq = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api?.getNextSequence) {
        const nextSeq = await api.getNextSequence('PY-')
        setRefSequence(nextSeq)
      } else {
        setRefSequence('001')
      }
    } catch {
      setRefSequence('001')
    }
  }

  useEffect(() => {
    fetchNextSeq()
    const fetchLock = async () => {
      try {
        const api = (window as any).api || (window as any).electronAPI
        if (api?.getLockDate) {
          const res = await api.getLockDate()
          if (res?.lockDate) setLockDate(res.lockDate.split('T')[0])
        }
      } catch (err) {
        console.error('Failed to get lock date', err)
      }
    }
    fetchLock()
  }, [])

  // Initialize row data from active employees
  useEffect(() => {
    const active = employees.filter((e) => e.is_active !== false)
    const newInputs = { ...rowInputs }
    let changed = false

    active.forEach((emp) => {
      if (!newInputs[emp.id]) {
        // Standard clinic daily rate: (Monthly * 12) / 313
        const monthly = Number(emp.monthly_salary) || 0
        const dailyRate = Math.round(((monthly * 12) / 313) * 100) / 100
        const hourlyRate = Math.round((dailyRate / 8) * 100) / 100

        // Default recurring allowance
        const mealAllowance =
          emp.allowances?.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0) || 500

        // Dynamic statutory deductions based on employee monthly salary & cutoff
        const divisor = cutoffType === 'CUSTOM' ? 1 : 2
        const sssCalc = calculateSSS2026(monthly)
        const phCalc = calculatePhilHealth2026(monthly)
        const piCalc = calculatePagIbig2026(monthly)

        const defaultSss = statutoryEnabled.sss ? Math.round((sssCalc.totalEE / divisor) * 100) / 100 : 0
        const defaultPh = statutoryEnabled.philhealth ? Math.round((phCalc.eeShare / divisor) * 100) / 100 : 0
        const defaultHdmf = statutoryEnabled.pagibig ? Math.round((piCalc.eeShare / divisor) * 100) / 100 : 0

        newInputs[emp.id] = {
          monthlySalary: monthly,
          dailyRate,
          hourlyRate,
          hours: {
            reg: 0,
            ot: 0,
            nd: 0,
            nd_ot: 0,
            sun_reg: 0,
            sun_ot: 0,
            sun_nd: 0,
            sun_nd_ot: 0,
            leg_reg: 0,
            leg_ot: 0,
            leg_nd: 0,
            leg_nd_ot: 0,
            spcl_reg: 0,
            spcl_ot: 0,
            spcl_nd: 0,
            spcl_nd_ot: 0
          },
          absentDays: 0,
          deductions: {
            sss: 0,
            philhealth: 0,
            hdmf: 0,
            tax: 0
          },
          adjustments: {
            meal: mealAllowance,
            license: 0,
            adj: 0,
            sil: 0
          }
        }
        changed = true
      }
    })

    if (changed) setRowInputs(newInputs)
  }, [employees, cutoffType, statutoryEnabled])

  // Apply DTR import updates if received
  const [dtrAppliedBanner, setDtrAppliedBanner] = useState<number | null>(null)

  useEffect(() => {
    if (!dtrUpdates || dtrUpdates.length === 0) return
    setRowInputs((prev) => {
      const next = { ...prev }
      let appliedCount = 0
      dtrUpdates.forEach((u) => {
        const empId = Number(u.id)
        if (next[empId]) {
          appliedCount++
          next[empId] = {
            ...next[empId],
            hours: {
              ...next[empId].hours,
              reg: u.regHours ?? u.baseHours ?? next[empId].hours.reg,
              ot: u.otHours ?? u.overtimeHours?.regular_ot ?? next[empId].hours.ot,
              nd: u.ndHours ?? u.overtimeHours?.regular_night ?? next[empId].hours.nd,
              nd_ot: u.ndOtHours ?? u.overtimeHours?.regular_night_ot ?? next[empId].hours.nd_ot,
              sun_reg: u.sunRegHours ?? u.sunHours ?? u.overtimeHours?.rest_day ?? next[empId].hours.sun_reg,
              sun_ot: u.sunOtHours ?? u.overtimeHours?.rest_day_ot ?? next[empId].hours.sun_ot,
              sun_nd: u.sunNdHours ?? u.overtimeHours?.rest_day_night ?? next[empId].hours.sun_nd,
              sun_nd_ot: u.sunNdOtHours ?? u.overtimeHours?.rest_day_night_ot ?? next[empId].hours.sun_nd_ot,
              leg_reg: u.legRegHours ?? u.legHours ?? u.overtimeHours?.legal_holiday ?? next[empId].hours.leg_reg,
              leg_ot: u.legOtHours ?? u.overtimeHours?.legal_holiday_ot ?? next[empId].hours.leg_ot,
              leg_nd: u.legNdHours ?? u.overtimeHours?.legal_holiday_night ?? next[empId].hours.leg_nd,
              leg_nd_ot: u.legNdOtHours ?? u.overtimeHours?.legal_holiday_night_ot ?? next[empId].hours.leg_nd_ot,
              spcl_reg: u.spclRegHours ?? u.spclHours ?? u.overtimeHours?.special_holiday ?? next[empId].hours.spcl_reg,
              spcl_ot: u.spclOtHours ?? u.overtimeHours?.special_holiday_ot ?? next[empId].hours.spcl_ot,
              spcl_nd: u.spclNdHours ?? u.overtimeHours?.special_holiday_night ?? next[empId].hours.spcl_nd,
              spcl_nd_ot: u.spclNdOtHours ?? u.overtimeHours?.special_holiday_night_ot ?? next[empId].hours.spcl_nd_ot
            },
            absentDays: u.absentDays ?? u.demerits?.absences_days ?? next[empId].absentDays
          }
        }
      })
      if (appliedCount > 0) {
        setDtrAppliedBanner(appliedCount)
      }
      return next
    })
  }, [dtrUpdates])

  // Active rate definitions and group counts
  const activeRateDefs = useMemo(() => {
    return ALL_DOLE_RATES.filter((r) => activeRateKeys.includes(r.key))
  }, [activeRateKeys])

  const regularCount = activeRateDefs.filter((r) => r.group === 'REGULAR').length
  const sundayCount = activeRateDefs.filter((r) => r.group === 'SUNDAY').length
  const legalCount = activeRateDefs.filter((r) => r.group === 'LEGAL').length
  const specialCount = activeRateDefs.filter((r) => r.group === 'SPECIAL').length

  // Editable columns metadata mapping for 2D cell coordinate tracking
  interface EditableColumnMeta {
    index: number
    category: 'hours' | 'absent' | 'deductions' | 'adjustments'
    field: string
    label: string
  }

  const editableColumns = useMemo<EditableColumnMeta[]>(() => {
    const cols: EditableColumnMeta[] = []
    let idx = 0
    activeRateDefs.forEach((def) => {
      cols.push({ index: idx++, category: 'hours', field: def.key, label: def.label })
    })
    cols.push({ index: idx++, category: 'absent', field: 'absentDays', label: 'Absent Days' })
    cols.push({ index: idx++, category: 'deductions', field: 'sss', label: 'SSS' })
    cols.push({ index: idx++, category: 'deductions', field: 'philhealth', label: 'PhilHealth' })
    cols.push({ index: idx++, category: 'deductions', field: 'hdmf', label: 'HDMF' })
    cols.push({ index: idx++, category: 'deductions', field: 'tax', label: 'Withholding Tax' })
    cols.push({ index: idx++, category: 'adjustments', field: 'meal', label: 'Meal Allowance' })
    cols.push({ index: idx++, category: 'adjustments', field: 'license', label: 'License Fee' })
    cols.push({ index: idx++, category: 'adjustments', field: 'adj', label: 'Adjustment' })
    cols.push({ index: idx++, category: 'adjustments', field: 'sil', label: 'SIL' })
    return cols
  }, [activeRateDefs])

  // Multi-cell selection state
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

  // Cell change handler
  const handleCellChange = (empId: number, category: string, field: string, val: string) => {
    const num = parseFloat(val) || 0
    setRowInputs((prev) => {
      const current = prev[empId] || {}
      if (category === 'hours') {
        return {
          ...prev,
          [empId]: {
            ...current,
            hours: {
              ...(current.hours || {}),
              [field]: num
            }
          }
        }
      }
      if (category === 'absent') {
        return {
          ...prev,
          [empId]: {
            ...current,
            absentDays: num
          }
        }
      }
      if (category === 'deductions') {
        setOverrides((o) => ({
          ...o,
          [empId]: { ...(o[empId] || {}), [field]: true }
        }))
        return {
          ...prev,
          [empId]: {
            ...current,
            deductions: {
              ...(current.deductions || {}),
              [field]: num
            }
          }
        }
      }
      if (category === 'adjustments') {
        return {
          ...prev,
          [empId]: {
            ...current,
            adjustments: {
              ...(current.adjustments || {}),
              [field]: num
            }
          }
        }
      }
      return prev
    })
  }

  // Calculate row results in real time
  const calculatedRows = useMemo(() => {
    const active = employees.filter((e) => e.is_active !== false)
    return active.map((emp) => {
      const inp = rowInputs[emp.id] || {}
      const monthly = Number(emp.monthly_salary) || 0
      const dailyRate = Math.round(((monthly * 12) / 313) * 100) / 100
      const hourlyRate = Math.round((dailyRate / 8) * 100) / 100
      const hours = inp.hours || {}

      // Calculate Gross Pay = SUM(Hours x Hourly Rate x Multiplier)
      let grossPay = 0
      let totalDaysWorked = 0

      // Regular days
      const regHrs = Number(hours.reg) || 0
      const sunRegHrs = Number(hours.sun_reg) || 0
      const legRegHrs = Number(hours.leg_reg) || 0
      const spclRegHrs = Number(hours.spcl_reg) || 0

      totalDaysWorked = Math.round(((regHrs + sunRegHrs + legRegHrs + spclRegHrs) / 8) * 100) / 100

      Object.entries(doleMultipliers).forEach(([k, mult]) => {
        const h = Number(hours[k]) || 0
        if (h > 0) {
          grossPay += Math.round(h * hourlyRate * mult * 100) / 100
        }
      })
      grossPay = Math.round(grossPay * 100) / 100

      // Absent deduction
      const absentDays = Number(inp.absentDays) || 0
      const absentDeduction = Math.round(absentDays * dailyRate * 100) / 100
      const totalAfterAbsent = Math.round((grossPay - absentDeduction) * 100) / 100

      // Total hours worked across all DOLE categories
      const totalHoursWorked = Object.values(hours).reduce((sum, h) => sum + (Number(h) || 0), 0)
      const hasHoursOrPay = totalHoursWorked > 0 || grossPay > 0

      // Deductions
      const ded = inp.deductions || {}
      // Check if user has explicitly typed an override, or if enabled in statutory settings
      const isSssOverridden = Boolean(overrides[emp.id]?.sss)
      const isPhOverridden = Boolean(overrides[emp.id]?.philhealth)
      const isHdmfOverridden = Boolean(overrides[emp.id]?.hdmf)

      const divisor = cutoffType === 'CUSTOM' ? 1 : 2
      const sssCalc = calculateSSS2026(monthly)
      const phCalc = calculatePhilHealth2026(monthly)
      const hdmfCalc = calculatePagIbig2026(monthly)

      const sssComputed = hasHoursOrPay ? Math.round((sssCalc.totalEE / divisor) * 100) / 100 : 0
      const phComputed = hasHoursOrPay ? Math.round((phCalc.eeShare / divisor) * 100) / 100 : 0
      const hdmfComputed = hasHoursOrPay ? Math.round((hdmfCalc.eeShare / divisor) * 100) / 100 : 0

      // Exact statutory employer shares (counterparts) for semi-monthly / monthly
      const sssErComputed = hasHoursOrPay ? Math.round((sssCalc.totalER / divisor) * 100) / 100 : 0
      const phErComputed = hasHoursOrPay ? Math.round((phCalc.erShare / divisor) * 100) / 100 : 0
      const hdmfErComputed = hasHoursOrPay ? Math.round((hdmfCalc.erShare / divisor) * 100) / 100 : 0

      const sss = !statutoryEnabled.sss
        ? (isSssOverridden ? Number(ded.sss) || 0 : 0)
        : (isSssOverridden ? Number(ded.sss) || 0 : (hasHoursOrPay ? sssComputed : (Number(ded.sss) || 0)))

      const philhealth = !statutoryEnabled.philhealth
        ? (isPhOverridden ? Number(ded.philhealth) || 0 : 0)
        : (isPhOverridden ? Number(ded.philhealth) || 0 : (hasHoursOrPay ? phComputed : (Number(ded.philhealth) || 0)))

      const hdmf = !statutoryEnabled.pagibig
        ? (isHdmfOverridden ? Number(ded.hdmf) || 0 : 0)
        : (isHdmfOverridden ? Number(ded.hdmf) || 0 : (hasHoursOrPay ? hdmfComputed : (Number(ded.hdmf) || 0)))

      const sss_er = !statutoryEnabled.sss ? 0 : sssErComputed
      const philhealth_er = !statutoryEnabled.philhealth ? 0 : phErComputed
      const pagibig_er = !statutoryEnabled.pagibig ? 0 : hdmfErComputed

      // Auto-compute BIR Withholding Tax unless manually overridden by user or disabled
      const isTaxOverridden = Boolean(overrides[emp.id]?.tax)
      let tax = Number(ded.tax) || 0
      if (!isTaxOverridden) {
        if (!statutoryEnabled.withholdingTax || !hasHoursOrPay) {
          tax = 0
        } else {
          // Taxable income = Gross Earnings (after absent) - mandatory statutory contributions
          const taxableIncome = Math.max(0, totalAfterAbsent - (sss + philhealth + hdmf))
          const taxPeriod = cutoffType === 'CUSTOM' ? 'MONTHLY' : 'SEMI_MONTHLY'
          tax = calculateTRAINWithholdingTax(taxableIncome, taxPeriod).totalTax
        }
      }

      const totalPrimaryDeductions = Math.round((sss + philhealth + hdmf + tax) * 100) / 100
      const netPrimaryDeductions = Math.round((totalAfterAbsent - totalPrimaryDeductions) * 100) / 100
      const totalNetDeductions = netPrimaryDeductions

      // Adjustments
      const adj = inp.adjustments || {}
      const meal = Number(adj.meal) || 0
      const license = Number(adj.license) || 0
      const adjustmentVal = Number(adj.adj) || 0
      const sil = Number(adj.sil) || 0

      const netTotal =
        Math.round((totalNetDeductions + meal - license + adjustmentVal + sil) * 100) / 100

      return {
        emp,
        monthlySalary: monthly,
        dailyRate,
        hourlyRate,
        hours,
        totalDaysWorked,
        grossPay,
        absentDays,
        absentDeduction,
        totalAfterAbsent,
        sss,
        philhealth,
        hdmf,
        sss_er,
        philhealth_er,
        pagibig_er,
        tax,
        isTaxOverridden,
        totalPrimaryDeductions,
        netPrimaryDeductions,
        totalNetDeductions,
        meal,
        license,
        adjustmentVal,
        sil,
        netTotal
      }
    })
  }, [employees, rowInputs, overrides, doleMultipliers, cutoffType, statutoryEnabled])

  // Summary Totals across all rows
  const summaryTotals = useMemo(() => {
    const init: any = {
      monthlySalary: 0,
      grossPay: 0,
      absentDays: 0,
      absentDeduction: 0,
      totalAfterAbsent: 0,
      sss: 0,
      philhealth: 0,
      hdmf: 0,
      tax: 0,
      totalPrimaryDeductions: 0,
      netPrimaryDeductions: 0,
      meal: 0,
      license: 0,
      adjustmentVal: 0,
      sil: 0,
      netTotal: 0,
      hours: {
        reg: 0,
        ot: 0,
        nd: 0,
        nd_ot: 0,
        sun_reg: 0,
        sun_ot: 0,
        sun_nd: 0,
        sun_nd_ot: 0,
        leg_reg: 0,
        leg_ot: 0,
        leg_nd: 0,
        leg_nd_ot: 0,
        spcl_reg: 0,
        spcl_ot: 0,
        spcl_nd: 0,
        spcl_nd_ot: 0
      }
    }

    calculatedRows.forEach((r) => {
      init.monthlySalary += r.monthlySalary
      init.grossPay += r.grossPay
      init.absentDays += r.absentDays
      init.absentDeduction += r.absentDeduction
      init.totalAfterAbsent += r.totalAfterAbsent
      init.sss += r.sss
      init.philhealth += r.philhealth
      init.hdmf += r.hdmf
      init.tax += r.tax
      init.totalPrimaryDeductions += r.totalPrimaryDeductions
      init.netPrimaryDeductions += r.netPrimaryDeductions
      init.meal += r.meal
      init.license += r.license
      init.adjustmentVal += r.adjustmentVal
      init.sil += r.sil
      init.netTotal += r.netTotal

      Object.keys(doleMultipliers).forEach((k) => {
        init.hours[k] = (init.hours[k] || 0) + (Number(r.hours[k]) || 0)
      })
    })

    return init
  }, [calculatedRows, doleMultipliers])

  const formatCurrency = (val: number) => {
    if (!val || val === 0) return '-'
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatHour = (val: number) => {
    if (!val || val === 0) return '-'
    return val % 1 === 0 ? `${val}.` : val.toString()
  }

  // Live Excel Selection Statistics (Average, Count, Sum)
  const selectionStats = useMemo(() => {
    if (!selectionBounds) return null
    const { minRow, maxRow, minCol, maxCol } = selectionBounds
    const count = (maxRow - minRow + 1) * (maxCol - minCol + 1)
    if (count < 2) return null

    let sum = 0
    for (let r = minRow; r <= maxRow; r++) {
      const rowData = calculatedRows[r]
      if (!rowData) continue
      for (let c = minCol; c <= maxCol; c++) {
        const colMeta = editableColumns[c]
        if (!colMeta) continue
        let val = 0
        if (colMeta.category === 'hours') val = Number(rowData.hours[colMeta.field]) || 0
        else if (colMeta.category === 'absent') val = Number(rowData.absentDays) || 0
        else if (colMeta.category === 'deductions') val = Number((rowData as any)[colMeta.field]) || 0
        else if (colMeta.category === 'adjustments') {
          if (colMeta.field === 'adj') val = Number(rowData.adjustmentVal) || 0
          else val = Number((rowData as any)[colMeta.field]) || 0
        }
        sum += val
      }
    }

    const avg = count > 0 ? sum / count : 0
    return { count, sum, avg }
  }, [selectionBounds, calculatedRows, editableColumns])

  // Multi-cell keyboard shortcuts: Delete/Backspace (Bulk clear), Ctrl+C (Copy), Ctrl+V (Paste)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectionBounds) return

      const { minRow, maxRow, minCol, maxCol } = selectionBounds
      const cellCount = (maxRow - minRow + 1) * (maxCol - minCol + 1)

      // 1. Delete / Backspace: Zero out all selected cells
      if (e.key === 'Delete' || (e.key === 'Backspace' && cellCount > 1)) {
        e.preventDefault()
        setRowInputs((prev) => {
          const next = { ...prev }
          for (let r = minRow; r <= maxRow; r++) {
            const rowData = calculatedRows[r]
            if (!rowData) continue
            const empId = rowData.emp.id
            const empRow = { ...(next[empId] || {}) }

            for (let c = minCol; c <= maxCol; c++) {
              const colMeta = editableColumns[c]
              if (!colMeta) continue
              if (colMeta.category === 'hours') {
                empRow.hours = { ...(empRow.hours || {}), [colMeta.field]: 0 }
              } else if (colMeta.category === 'absent') {
                empRow.absentDays = 0
              } else if (colMeta.category === 'deductions') {
                empRow.deductions = { ...(empRow.deductions || {}), [colMeta.field]: 0 }
                setOverrides((o) => ({ ...o, [empId]: { ...(o[empId] || {}), [colMeta.field]: true } }))
              } else if (colMeta.category === 'adjustments') {
                empRow.adjustments = { ...(empRow.adjustments || {}), [colMeta.field]: 0 }
              }
            }
            next[empId] = empRow
          }
          return next
        })
        return
      }

      // 2. Escape: Clear selection
      if (e.key === 'Escape') {
        setSelection(null)
        return
      }

      // 3. Copy: Ctrl+C / Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const rowsText: string[] = []
        for (let r = minRow; r <= maxRow; r++) {
          const rowData = calculatedRows[r]
          if (!rowData) continue
          const colsText: string[] = []
          for (let c = minCol; c <= maxCol; c++) {
            const colMeta = editableColumns[c]
            if (!colMeta) continue
            let val = 0
            if (colMeta.category === 'hours') val = Number(rowData.hours[colMeta.field]) || 0
            else if (colMeta.category === 'absent') val = Number(rowData.absentDays) || 0
            else if (colMeta.category === 'deductions') val = Number((rowData as any)[colMeta.field]) || 0
            else if (colMeta.category === 'adjustments') {
              if (colMeta.field === 'adj') val = Number(rowData.adjustmentVal) || 0
              else val = Number((rowData as any)[colMeta.field]) || 0
            }
            colsText.push(val === 0 ? '' : String(val))
          }
          rowsText.push(colsText.join('\t'))
        }
        navigator.clipboard.writeText(rowsText.join('\n'))
        return
      }

      // 4. Paste: Ctrl+V / Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        navigator.clipboard.readText().then((clipText) => {
          if (!clipText) return
          const lines = clipText.split(/\r?\n/).filter((l) => l.length > 0)
          if (lines.length === 0) return

          setRowInputs((prev) => {
            const next = { ...prev }
            lines.forEach((line, lineOffset) => {
              const targetRowIdx = minRow + lineOffset
              if (targetRowIdx >= calculatedRows.length) return
              const rowData = calculatedRows[targetRowIdx]
              const empId = rowData.emp.id
              const empRow = { ...(next[empId] || {}) }

              const cells = line.split('\t')
              cells.forEach((cellVal, colOffset) => {
                const targetColIdx = minCol + colOffset
                if (targetColIdx >= editableColumns.length) return
                const colMeta = editableColumns[targetColIdx]
                const num = parseFloat(cellVal.trim()) || 0

                if (colMeta.category === 'hours') {
                  empRow.hours = { ...(empRow.hours || {}), [colMeta.field]: num }
                } else if (colMeta.category === 'absent') {
                  empRow.absentDays = num
                } else if (colMeta.category === 'deductions') {
                  empRow.deductions = { ...(empRow.deductions || {}), [colMeta.field]: num }
                  setOverrides((o) => ({ ...o, [empId]: { ...(o[empId] || {}), [colMeta.field]: true } }))
                } else if (colMeta.category === 'adjustments') {
                  empRow.adjustments = { ...(empRow.adjustments || {}), [colMeta.field]: num }
                }
              })
              next[empId] = empRow
            })
            return next
          })
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectionBounds, calculatedRows, editableColumns])

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const exportRows: PayrollRowExportData[] = calculatedRows.map((r) => ({
      name: `${r.emp.first_name} ${r.emp.last_name}`,
      position: r.emp.position || r.emp.department || 'Staff',
      monthlySalary: r.monthlySalary,
      dailyRate: r.dailyRate,
      regHours: r.hours.reg || 0,
      otHours: r.hours.ot || 0,
      ndHours: r.hours.nd || 0,
      ndOtHours: r.hours.nd_ot || 0,
      sunRegHours: r.hours.sun_reg || 0,
      sunOtHours: r.hours.sun_ot || 0,
      sunNdHours: r.hours.sun_nd || 0,
      sunNdOtHours: r.hours.sun_nd_ot || 0,
      legRegHours: r.hours.leg_reg || 0,
      legOtHours: r.hours.leg_ot || 0,
      legNdHours: r.hours.leg_nd || 0,
      legNdOtHours: r.hours.leg_nd_ot || 0,
      spclRegHours: r.hours.spcl_reg || 0,
      spclOtHours: r.hours.spcl_ot || 0,
      spclNdHours: r.hours.spcl_nd || 0,
      spclNdOtHours: r.hours.spcl_nd_ot || 0,
      totalDays: r.totalDaysWorked,
      hourlyRate: r.hourlyRate,
      grossPay: r.grossPay,
      absentDays: r.absentDays,
      absentDeduction: r.absentDeduction,
      totalAfterAbsent: r.totalAfterAbsent,
      sss: r.sss,
      philhealth: r.philhealth,
      hdmf: r.hdmf,
      withholdingTax: r.tax,
      totalPrimaryDeductions: r.totalPrimaryDeductions,
      netPrimaryDeductions: r.netPrimaryDeductions,
      totalNetDeduction: r.totalNetDeductions,
      mealTranspoAllowance: r.meal,
      licenseFee: r.license,
      adjustment: r.adjustmentVal,
      sil: r.sil,
      netTotal: r.netTotal
    }))

    const voucherStr = `PY-${refSequence.padStart(3, '0')}`
    exportPayrollGridToExcel(
      exportRows,
      date,
      voucherStr,
      description,
      activeRateKeys,
      doleMultipliers
    )
  }

  // Save & Post Payroll to General Ledger
  const handlePostPayroll = async (pin?: string) => {
    setStatus(null)
    setPinError('')
    if (!refSequence) return setStatus({ type: 'error', msg: 'Sequence number required.' })
    if (calculatedRows.length === 0)
      return setStatus({ type: 'error', msg: 'No active employees to pay.' })

    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const payrollItems = calculatedRows.map((r) => ({
        id: r.emp.id,
        basePay: r.totalAfterAbsent,
        gross: r.totalAfterAbsent,
        gross_pay: r.totalAfterAbsent,
        raw_gross_pay: r.grossPay,
        absent_deduction: r.absentDeduction,
        sss: r.sss,
        philhealth: r.philhealth,
        pagibig: r.hdmf,
        sss_er: r.sss_er,
        philhealth_er: r.philhealth_er,
        pagibig_er: r.pagibig_er,
        tax: r.tax,
        tax_withheld: r.tax,
        cash_advance: 0,
        license_fee: r.license,
        other_deductions: 0,
        otherEarnings: r.meal + r.adjustmentVal + r.sil,
        other_earnings: r.meal + r.adjustmentVal + r.sil,
        allowances: r.meal + r.adjustmentVal + r.sil,
        net: r.netTotal,
        net_pay: r.netTotal,
        processedLoans: []
      }))

      const payload = {
        date,
        referenceNo: `PY-${refSequence.padStart(3, '0')}`,
        description,
        userId,
        employees: payrollItems,
        overridePin: pin
      }

      const res = await api.processPayroll(payload)
      if (res?.success) {
        setStatus({
          type: 'success',
          msg: `Payroll ${payload.referenceNo} successfully posted to General Ledger!`
        })
        fetchNextSeq()
        setShowPinModal(false)
        setOverridePin('')
        // Clear draft for this cutoff
        const draftId = `draft-${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${cutoffType}`
        deletePayrollDraft(draftId)
        setDraftSavedStatus(null)
      } else {
        if (res?.error && res.error.includes('PERIOD LOCKED')) {
          setShowPinModal(true)
        } else {
          setStatus({ type: 'error', msg: res?.error || 'Failed to process payroll.' })
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('PERIOD LOCKED')) {
        setShowPinModal(true)
      } else {
        setStatus({ type: 'error', msg: err.message || 'System error processing payroll.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0 relative select-none">
      {/* PERIOD LOCK WARNING */}
      {isLocked && (
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              Payroll cutoff date falls in a locked accounting period (on or before {lockDate}).
              Manager Override PIN required to post.
            </span>
          </div>
          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-black uppercase tracking-wider">
            Period Locked
          </span>
        </div>
      )}

      {/* DTR APPLIED NOTIFICATION BANNER */}
      {dtrAppliedBanner !== null && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-emerald-600 shrink-0" />
            <span>
              Applied DTR timesheet logs for {dtrAppliedBanner} employee(s) into editable grid cells.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDtrAppliedBanner(null)
              if (onClearDtr) onClearDtr()
            }}
            className="text-xs text-emerald-700 hover:text-emerald-950 font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* PAYROLL PERIOD CUTOFF & DRAFTS TOOLBAR */}
      <div className="px-6 py-3 bg-gray-50/90 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* YEAR & MONTH SELECTORS */}
          <div className="flex items-center gap-1.5">
            <Calendar size={15} className="text-gray-500" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
              Period:
            </span>
            <select
              value={selectedYear}
              onChange={(e) => {
                const yr = Number(e.target.value)
                setSelectedYear(yr)
                handleCutoffChange(cutoffType, yr, selectedMonth)
              }}
              className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs font-bold text-gray-800 outline-none focus:border-[#1B9387] cursor-pointer shadow-xs"
            >
              {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => {
                const mo = Number(e.target.value)
                setSelectedMonth(mo)
                handleCutoffChange(cutoffType, selectedYear, mo)
              }}
              className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs font-bold text-gray-800 outline-none focus:border-[#1B9387] cursor-pointer shadow-xs"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-gray-300 mx-0.5" />

          {/* CUTOFF TOGGLE BUTTONS */}
          <div className="inline-flex rounded-lg shadow-xs bg-gray-200/80 p-0.5">
            <button
              type="button"
              onClick={() => handleCutoffChange('1ST_HALF')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                cutoffType === '1ST_HALF'
                  ? 'bg-[#1B9387] text-white shadow-xs'
                  : 'text-gray-700 hover:text-[#1B9387] hover:bg-white/60'
              }`}
              title="1st to 15th of the month"
            >
              1st Half (1st–15th)
            </button>
            <button
              type="button"
              onClick={() => handleCutoffChange('2ND_HALF')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                cutoffType === '2ND_HALF'
                  ? 'bg-[#1B9387] text-white shadow-xs'
                  : 'text-gray-700 hover:text-[#1B9387] hover:bg-white/60'
              }`}
              title="16th to end of month (30th, 31st, or 28th/29th for Feb)"
            >
              <span>2nd Half (16th–{getDaysInMonth(selectedYear, selectedMonth)}th)</span>
              {selectedMonth === 2 && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-tight ${
                    isLeapYear(selectedYear)
                      ? 'bg-amber-400 text-amber-950 animate-pulse'
                      : 'bg-gray-300 text-gray-800'
                  }`}
                >
                  {isLeapYear(selectedYear) ? 'Leap Year 29d' : '28d'}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleCutoffChange('CUSTOM')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                cutoffType === 'CUSTOM'
                  ? 'bg-[#1B9387] text-white shadow-xs'
                  : 'text-gray-700 hover:text-[#1B9387] hover:bg-white/60'
              }`}
            >
              Custom
            </button>
          </div>

          {/* ACTIVE CUTOFF BADGE */}
          {cutoffType !== 'CUSTOM' && (
            <span className="text-[11px] font-bold text-gray-600 bg-white border border-gray-300 px-2 py-0.5 rounded shadow-2xs">
              {getPayrollCutoffDetails(selectedYear, selectedMonth, cutoffType).badgeText}
            </span>
          )}
        </div>

        {/* DRAFT CONTROLS */}
        <div className="flex items-center gap-3">
          {draftSavedStatus && (
            <span className="text-[11px] text-gray-500 font-mono italic">
              {draftSavedStatus}
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSaveDraft(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            title="Save current grid hours and deductions as draft"
          >
            <Save size={13} className="text-[#1B9387]" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDraftsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            title="View and resume saved payroll drafts"
          >
            <FolderOpen size={13} className="text-amber-600" />
            <span>Saved Drafts</span>
            {draftsList.length > 0 && (
              <span className="bg-[#1B9387] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {draftsList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TOP CONTROLS & EXCEL ACTIONS TOOLBAR */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
              Payroll Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs font-bold text-gray-800 outline-none focus:border-[#1B9387] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
              Voucher No.
            </label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-gray-300 border-r-0 rounded-l px-2.5 py-1.5 text-xs font-mono font-bold text-gray-600">
                PY-
              </span>
              <input
                type="text"
                value={refSequence}
                onChange={(e) => setRefSequence(e.target.value)}
                placeholder="001"
                className="w-16 bg-gray-50 border border-gray-300 rounded-r px-2 py-1.5 text-xs font-mono font-bold text-gray-800 outline-none focus:border-[#1B9387] focus:bg-white"
              />
            </div>
          </div>

          <div className="w-64">
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
              Description / Memo
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs font-bold text-gray-800 outline-none focus:border-[#1B9387] focus:bg-white"
            />
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
            title="Export exact clinic spreadsheet to Microsoft Excel (.xlsx)"
          >
            <Download size={14} />
            <span>Export to Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handlePostPayroll()}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#1B9387] hover:bg-[#15796f] disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
          >
            <CheckCircle size={14} />
            <span>{loading ? 'Posting...' : 'Post to General Ledger'}</span>
          </button>
        </div>
      </div>

      {/* SPREADSHEET CONTAINER */}
      <div className="flex-1 overflow-auto bg-gray-100 relative">
        <table className={`border-collapse text-[11px] whitespace-nowrap bg-white border border-gray-400 ${isDragging ? 'select-none' : ''}`}>
          <thead>
            {/* ROW 1: DOLE CATEGORY GROUP HEADERS */}
            <tr className="bg-[#B8CCE4] text-center font-black uppercase tracking-wider text-gray-800 border-b border-gray-400">
              <th
                colSpan={4}
                className="p-1.5 border-r border-gray-400 sticky left-0 z-30 bg-[#B8CCE4]"
              >
                Employee Profile
              </th>
              {regularCount > 0 && (
                <th colSpan={regularCount} className="p-1.5 border-r border-gray-400 bg-[#B8CCE4]">
                  REGULAR (hours)
                </th>
              )}
              {sundayCount > 0 && (
                <th colSpan={sundayCount} className="p-1.5 border-r border-gray-400 bg-[#B8CCE4]">
                  SUNDAY/SATURDAY (hours)
                </th>
              )}
              {legalCount > 0 && (
                <th colSpan={legalCount} className="p-1.5 border-r border-gray-400 bg-[#B8CCE4]">
                  LEGAL HOLIDAY (hours)
                </th>
              )}
              {specialCount > 0 && (
                <th colSpan={specialCount} className="p-1.5 border-r border-gray-400 bg-[#B8CCE4]">
                  SPECIAL HOLIDAY (hours)
                </th>
              )}
              <th colSpan={3} className="p-1.5 border-r border-gray-400 bg-[#DCE6F1]">
                Earnings Summary
              </th>
              <th colSpan={3} className="p-1.5 border-r border-gray-400 bg-[#F2DCDB]">
                Demerits
              </th>
              <th colSpan={7} className="p-1.5 border-r border-gray-400 bg-[#B8CCE4]">
                PRIMARY DEDUCTIONS
              </th>
              <th colSpan={5} className="p-1.5 bg-[#B8CCE4]">
                ADJUSTMENTS
              </th>
            </tr>

            {/* ROW 2: YELLOW MULTIPLIER ROW (MATCHING CLINIC EXCEL EXACTLY) */}
            <tr className="bg-[#FFFF00] text-center font-bold text-gray-900 border-b border-gray-400 text-[10px]">
              <th className="p-1 border-r border-gray-400 sticky left-0 z-30 bg-gray-100"></th>
              <th className="p-1 border-r border-gray-400 sticky left-[140px] z-30 bg-gray-100"></th>
              <th className="p-1 border-r border-gray-400 sticky left-[240px] z-30 bg-gray-100"></th>
              <th className="p-1 border-r border-gray-400 text-right pr-2 sticky left-[330px] z-30 bg-gray-100 font-black">
                Multiplier:
              </th>

              {/* ACTIVE DOLE MULTIPLIERS */}
              {activeRateDefs.map((r) => {
                const mult = doleMultipliers[r.key] ?? r.defaultMultiplier
                return (
                  <th
                    key={r.key}
                    className="p-1 border-r border-gray-400 bg-[#FFFF00] min-w-[50px] font-mono"
                    title={`${r.label}: ${mult}x`}
                  >
                    {mult.toFixed(3)}
                  </th>
                )
              })}

              {/* Blank fillers for non-multiplier columns */}
              <th colSpan={18} className="p-1 bg-gray-100 border-r border-gray-400"></th>
            </tr>

            {/* ROW 3: DETAILED COLUMN HEADERS */}
            <tr className="bg-[#DCE6F1] font-black text-gray-700 uppercase tracking-tight text-[10px] border-b-2 border-gray-500">
              <th className="p-2 border-r border-gray-400 sticky left-0 z-30 bg-[#DCE6F1] min-w-[140px] text-left">
                NAME
              </th>
              <th className="p-2 border-r border-gray-400 sticky left-[140px] z-30 bg-[#DCE6F1] min-w-[100px] text-left">
                POSITION
              </th>
              <th className="p-2 border-r border-gray-400 sticky left-[240px] z-30 bg-[#DCE6F1] min-w-[90px] text-right">
                SALARY (Monthly)
              </th>
              <th className="p-2 border-r border-gray-400 sticky left-[330px] z-30 bg-[#DCE6F1] min-w-[90px] text-right shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                DAILY RATE
              </th>

              {/* ACTIVE DOLE Columns */}
              {activeRateDefs.map((r) => (
                <th
                  key={r.key}
                  className="p-2 border-r border-gray-400 text-center min-w-[50px]"
                  title={r.label}
                >
                  {r.shortLabel}
                </th>
              ))}

              {/* Earnings */}
              <th className="p-2 border-r border-gray-400 text-right min-w-[70px]">Total # of Days</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[80px]">REGULAR HOURLY RATE</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[100px] bg-blue-50/70 font-black">
                GROSS PAY (Hours x Rate x Multiplier)
              </th>

              {/* Demerits */}
              <th className="p-2 border-r border-gray-400 text-center min-w-[60px]">Absent (days)</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[80px]">Absent Deduction</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[90px] font-black">TOTAL</th>

              {/* Primary Deductions */}
              <th className="p-2 border-r border-gray-400 text-right min-w-[70px]">SSS</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[75px]">PHILHEALTH</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[65px]">HDMF</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[80px]">WITHHOLDING</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[95px] font-black bg-gray-50">
                TOTAL OF PRIMARY DEDUCTIONS
              </th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[95px] font-black">
                NET TOTAL OF PRIMARY DEDUCTION
              </th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[95px] font-black">
                TOTAL NET OF DEDUCTION
              </th>

              {/* Adjustments */}
              <th className="p-2 border-r border-gray-400 text-right min-w-[100px]">Meal & Transpo Allowance</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[75px]">License Fee</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[75px]">ADJUSTMENT</th>
              <th className="p-2 border-r border-gray-400 text-right min-w-[60px]">SIL</th>
              <th className="p-2 text-right min-w-[110px] font-black bg-emerald-50 text-emerald-800">
                NET TOTAL
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-300">
            {calculatedRows.length === 0 ? (
              <tr>
                <td colSpan={4 + activeRateDefs.length + 18} className="p-12 text-center text-gray-400 italic">
                  No active employees found.
                </td>
              </tr>
            ) : (
              calculatedRows.map((r, rowIdx) => {
                const isEven = rowIdx % 2 === 0
                const rowBg = isEven ? 'bg-white' : 'bg-gray-50/50'

                return (
                  <tr key={r.emp.id} className={`${rowBg} hover:bg-sky-50/40 transition`}>
                    {/* FROZEN LEFT COLUMNS */}
                    <td className={`p-2 border-r border-gray-300 font-bold text-blue-800 sticky left-0 z-20 ${rowBg}`}>
                      {r.emp.first_name} {r.emp.last_name}
                    </td>
                    <td className={`p-2 border-r border-gray-300 text-blue-700 sticky left-[140px] z-20 ${rowBg}`}>
                      {r.emp.position || r.emp.department || 'Nurse'}
                    </td>
                    <td className={`p-2 border-r border-gray-300 text-right font-mono text-blue-700 sticky left-[240px] z-20 ${rowBg}`}>
                      {formatCurrency(r.monthlySalary)}
                    </td>
                    <td className={`p-2 border-r border-gray-300 text-right font-mono text-gray-800 sticky left-[330px] z-20 ${rowBg} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]`}>
                      {formatCurrency(r.dailyRate)}
                    </td>

                    {/* ACTIVE EDITABLE DOLE HOURS */}
                    {activeRateDefs.map((def, defIdx) => {
                      const colIdx = defIdx
                      const selStyle = getCellSelectionStyle(rowIdx, colIdx)
                      return (
                        <td
                          key={def.key}
                          onMouseDown={(e) => handleCellMouseDown(rowIdx, colIdx, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                          className={`p-0 border-r border-gray-300 text-center min-w-[50px] relative transition-colors ${selStyle}`}
                        >
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={r.hours[def.key] === 0 ? '' : r.hours[def.key] ?? ''}
                            placeholder="-"
                            onChange={(e) => handleCellChange(r.emp.id, 'hours', def.key, e.target.value)}
                            onFocus={() => {
                              if (!isDragging) {
                                setSelection({ start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } })
                              }
                            }}
                            className="w-full h-8 text-center bg-transparent text-blue-700 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                          />
                        </td>
                      )
                    })}

                    {/* EARNINGS */}
                    <td className="p-2 border-r border-gray-300 text-right font-mono text-gray-700">
                      {formatCurrency(r.totalDaysWorked)}
                    </td>
                    <td className="p-2 border-r border-gray-300 text-right font-mono text-gray-800">
                      {formatCurrency(r.hourlyRate)}
                    </td>
                    <td className="p-2 border-r border-gray-300 text-right font-mono font-bold text-gray-900 bg-blue-50/30">
                      {formatCurrency(r.grossPay)}
                    </td>

                    {/* DEMERITS */}
                    {(() => {
                      const absentColIdx = activeRateDefs.length
                      const selStyle = getCellSelectionStyle(rowIdx, absentColIdx)
                      return (
                        <td
                          onMouseDown={(e) => handleCellMouseDown(rowIdx, absentColIdx, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIdx, absentColIdx)}
                          className={`p-0 border-r border-gray-300 text-center w-16 relative transition-colors ${selStyle}`}
                        >
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={r.absentDays === 0 ? '' : r.absentDays ?? ''}
                            placeholder="-"
                            onChange={(e) => handleCellChange(r.emp.id, 'absent', 'absentDays', e.target.value)}
                            onFocus={() => {
                              if (!isDragging) {
                                setSelection({ start: { row: rowIdx, col: absentColIdx }, end: { row: rowIdx, col: absentColIdx } })
                              }
                            }}
                            className="w-full h-8 text-center bg-transparent text-red-600 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                          />
                        </td>
                      )
                    })()}
                    <td className="p-2 border-r border-gray-300 text-right font-mono text-red-600">
                      {formatCurrency(r.absentDeduction)}
                    </td>
                    <td className="p-2 border-r border-gray-300 text-right font-mono font-bold text-gray-900">
                      {formatCurrency(r.totalAfterAbsent)}
                    </td>

                    {/* PRIMARY DEDUCTIONS (EDITABLE/OVERRIDABLE) */}
                    {(() => {
                      const sssColIdx = activeRateDefs.length + 1
                      const phColIdx = activeRateDefs.length + 2
                      const hdmfColIdx = activeRateDefs.length + 3
                      const taxColIdx = activeRateDefs.length + 4
                      return (
                        <>
                          <td
                            onMouseDown={(e) => handleCellMouseDown(rowIdx, sssColIdx, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, sssColIdx)}
                            className={`p-0 border-r border-gray-300 text-right relative transition-colors ${getCellSelectionStyle(rowIdx, sssColIdx)}`}
                          >
                            <input
                              type="number"
                              step="1"
                              value={r.sss === 0 ? '' : r.sss ?? ''}
                              placeholder="-"
                              onChange={(e) => handleCellChange(r.emp.id, 'deductions', 'sss', e.target.value)}
                              onFocus={() => {
                                if (!isDragging) {
                                  setSelection({ start: { row: rowIdx, col: sssColIdx }, end: { row: rowIdx, col: sssColIdx } })
                                }
                              }}
                              className="w-full h-8 text-right pr-2 bg-transparent text-blue-700 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                            />
                          </td>
                          <td
                            onMouseDown={(e) => handleCellMouseDown(rowIdx, phColIdx, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, phColIdx)}
                            className={`p-0 border-r border-gray-300 text-right relative transition-colors ${getCellSelectionStyle(rowIdx, phColIdx)}`}
                          >
                            <input
                              type="number"
                              step="1"
                              value={r.philhealth === 0 ? '' : r.philhealth ?? ''}
                              placeholder="-"
                              onChange={(e) => handleCellChange(r.emp.id, 'deductions', 'philhealth', e.target.value)}
                              onFocus={() => {
                                if (!isDragging) {
                                  setSelection({ start: { row: rowIdx, col: phColIdx }, end: { row: rowIdx, col: phColIdx } })
                                }
                              }}
                              className="w-full h-8 text-right pr-2 bg-transparent text-blue-700 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                            />
                          </td>
                          <td
                            onMouseDown={(e) => handleCellMouseDown(rowIdx, hdmfColIdx, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, hdmfColIdx)}
                            className={`p-0 border-r border-gray-300 text-right relative transition-colors ${getCellSelectionStyle(rowIdx, hdmfColIdx)}`}
                          >
                            <input
                              type="number"
                              step="1"
                              value={r.hdmf === 0 ? '' : r.hdmf ?? ''}
                              placeholder="-"
                              onChange={(e) => handleCellChange(r.emp.id, 'deductions', 'hdmf', e.target.value)}
                              onFocus={() => {
                                if (!isDragging) {
                                  setSelection({ start: { row: rowIdx, col: hdmfColIdx }, end: { row: rowIdx, col: hdmfColIdx } })
                                }
                              }}
                              className="w-full h-8 text-right pr-2 bg-transparent text-blue-700 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                            />
                          </td>
                          <td
                            onMouseDown={(e) => handleCellMouseDown(rowIdx, taxColIdx, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, taxColIdx)}
                            className={`p-0 border-r border-gray-300 text-right relative transition-colors ${getCellSelectionStyle(rowIdx, taxColIdx)}`}
                          >
                            <input
                              type="number"
                              step="1"
                              value={r.tax === 0 ? '' : r.tax ?? ''}
                              placeholder="-"
                              onChange={(e) => handleCellChange(r.emp.id, 'deductions', 'tax', e.target.value)}
                              onFocus={() => {
                                if (!isDragging) {
                                  setSelection({ start: { row: rowIdx, col: taxColIdx }, end: { row: rowIdx, col: taxColIdx } })
                                }
                              }}
                              className="w-full h-8 text-right pr-2 bg-transparent text-blue-700 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                            />
                          </td>
                        </>
                      )
                    })()}
                    <td className="p-2 border-r border-gray-300 text-right font-mono text-gray-800 bg-gray-50/50">
                      {formatCurrency(r.totalPrimaryDeductions)}
                    </td>
                    <td className="p-2 border-r border-gray-300 text-right font-mono text-gray-800">
                      {formatCurrency(r.netPrimaryDeductions)}
                    </td>
                    <td className="p-2 border-r border-gray-300 text-right font-mono text-gray-800">
                      {formatCurrency(r.totalNetDeductions)}
                    </td>

                    {/* ADJUSTMENTS */}
                    {(() => {
                      const mealColIdx = activeRateDefs.length + 5
                      const licColIdx = activeRateDefs.length + 6
                      const adjColIdx = activeRateDefs.length + 7
                      const silColIdx = activeRateDefs.length + 8
                      return (
                        <>
                          <td
                            onMouseDown={(e) => handleCellMouseDown(rowIdx, mealColIdx, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, mealColIdx)}
                            className={`p-0 border-r border-gray-300 text-right relative transition-colors ${getCellSelectionStyle(rowIdx, mealColIdx)}`}
                          >
                            <input
                              type="number"
                              step="1"
                              value={r.meal === 0 ? '' : r.meal ?? ''}
                              placeholder="-"
                              onChange={(e) => handleCellChange(r.emp.id, 'adjustments', 'meal', e.target.value)}
                              onFocus={() => {
                                if (!isDragging) {
                                  setSelection({ start: { row: rowIdx, col: mealColIdx }, end: { row: rowIdx, col: mealColIdx } })
                                }
                              }}
                              className="w-full h-8 text-right pr-2 bg-transparent text-blue-700 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                            />
                          </td>
                          <td
                            onMouseDown={(e) => handleCellMouseDown(rowIdx, licColIdx, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, licColIdx)}
                            className={`p-0 border-r border-gray-300 text-right relative transition-colors ${getCellSelectionStyle(rowIdx, licColIdx)}`}
                          >
                            <input
                              type="number"
                              step="1"
                              value={r.license === 0 ? '' : r.license ?? ''}
                              placeholder="-"
                              onChange={(e) => handleCellChange(r.emp.id, 'adjustments', 'license', e.target.value)}
                              onFocus={() => {
                                if (!isDragging) {
                                  setSelection({ start: { row: rowIdx, col: licColIdx }, end: { row: rowIdx, col: licColIdx } })
                                }
                              }}
                              className="w-full h-8 text-right pr-2 bg-transparent text-blue-700 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                            />
                          </td>
                          <td
                            onMouseDown={(e) => handleCellMouseDown(rowIdx, adjColIdx, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, adjColIdx)}
                            className={`p-0 border-r border-gray-300 text-right relative transition-colors ${getCellSelectionStyle(rowIdx, adjColIdx)}`}
                          >
                            <input
                              type="number"
                              step="1"
                              value={r.adjustmentVal === 0 ? '' : r.adjustmentVal ?? ''}
                              placeholder="-"
                              onChange={(e) => handleCellChange(r.emp.id, 'adjustments', 'adj', e.target.value)}
                              onFocus={() => {
                                if (!isDragging) {
                                  setSelection({ start: { row: rowIdx, col: adjColIdx }, end: { row: rowIdx, col: adjColIdx } })
                                }
                              }}
                              className="w-full h-8 text-right pr-2 bg-transparent text-blue-700 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                            />
                          </td>
                          <td
                            onMouseDown={(e) => handleCellMouseDown(rowIdx, silColIdx, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, silColIdx)}
                            className={`p-0 border-r border-gray-300 text-right relative transition-colors ${getCellSelectionStyle(rowIdx, silColIdx)}`}
                          >
                            <input
                              type="number"
                              step="1"
                              value={r.sil === 0 ? '' : r.sil ?? ''}
                              placeholder="-"
                              onChange={(e) => handleCellChange(r.emp.id, 'adjustments', 'sil', e.target.value)}
                              onFocus={() => {
                                if (!isDragging) {
                                  setSelection({ start: { row: rowIdx, col: silColIdx }, end: { row: rowIdx, col: silColIdx } })
                                }
                              }}
                              className="w-full h-8 text-right pr-2 bg-transparent text-blue-700 font-mono font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#1B9387] placeholder:text-gray-400 cursor-cell"
                            />
                          </td>
                        </>
                      )
                    })()}
                    <td className="p-2 text-right font-mono font-black text-gray-900 bg-emerald-50/50">
                      {formatCurrency(r.netTotal)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>

          {/* SPREADSHEET FOOTER (TOTALS ROW) */}
          <tfoot>
            <tr className="bg-[#B8CCE4] font-black text-gray-900 border-t-2 border-gray-500 text-[11px]">
              <td className="p-2 border-r border-gray-400 sticky left-0 z-30 bg-[#B8CCE4]">
                TOTALS
              </td>
              <td className="p-2 border-r border-gray-400 sticky left-[140px] z-30 bg-[#B8CCE4]">
                {calculatedRows.length} Employee(s)
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono sticky left-[240px] z-30 bg-[#B8CCE4]">
                {formatCurrency(summaryTotals.monthlySalary)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono sticky left-[330px] z-30 bg-[#B8CCE4] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                —
              </td>

              {/* Active Hours Totals */}
              {activeRateDefs.map((def) => (
                <td key={def.key} className="p-1 border-r border-gray-400 text-center font-mono font-bold">
                  {formatHour(summaryTotals.hours[def.key])}
                </td>
              ))}

              <td className="p-2 border-r border-gray-400 text-right font-mono">—</td>
              <td className="p-2 border-r border-gray-400 text-right font-mono">—</td>
              <td className="p-2 border-r border-gray-400 text-right font-mono font-black">
                {formatCurrency(summaryTotals.grossPay)}
              </td>

              <td className="p-2 border-r border-gray-400 text-center font-mono">
                {formatHour(summaryTotals.absentDays)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono">
                {formatCurrency(summaryTotals.absentDeduction)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono font-black">
                {formatCurrency(summaryTotals.totalAfterAbsent)}
              </td>

              <td className="p-2 border-r border-gray-400 text-right font-mono">
                {formatCurrency(summaryTotals.sss)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono">
                {formatCurrency(summaryTotals.philhealth)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono">
                {formatCurrency(summaryTotals.hdmf)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono">
                {formatCurrency(summaryTotals.tax)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono font-black">
                {formatCurrency(summaryTotals.totalPrimaryDeductions)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono font-black">
                {formatCurrency(summaryTotals.netPrimaryDeductions)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono font-black">
                {formatCurrency(summaryTotals.netPrimaryDeductions)}
              </td>

              <td className="p-2 border-r border-gray-400 text-right font-mono">
                {formatCurrency(summaryTotals.meal)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono">
                {formatCurrency(summaryTotals.license)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono">
                {formatCurrency(summaryTotals.adjustmentVal)}
              </td>
              <td className="p-2 border-r border-gray-400 text-right font-mono">
                {formatCurrency(summaryTotals.sil)}
              </td>
              <td className="p-2 text-right font-mono font-black bg-emerald-100 text-emerald-950 text-sm">
                {formatCurrency(summaryTotals.netTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* MANAGER OVERRIDE PIN MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-amber-300">
            <div className="bg-amber-500 p-4 text-white flex items-center gap-2">
              <ShieldCheck size={20} />
              <h3 className="font-bold text-sm tracking-wide uppercase">Period Lock Override</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 font-medium">
                The selected payroll cutoff date falls within a locked period (on or before {lockDate}).
                Enter Manager Override PIN to post.
              </p>
              {pinError && <p className="text-xs text-red-600 font-bold">{pinError}</p>}
              <input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="Enter 6-digit PIN"
                value={overridePin}
                onChange={(e) => setOverridePin(e.target.value)}
                className="w-full text-center tracking-[0.5em] font-mono font-bold text-lg p-2.5 border border-gray-300 rounded-md focus:border-amber-500 outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handlePostPayroll(overridePin)}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded cursor-pointer"
                >
                  Authorize & Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Drafts Modal */}
      {showDraftsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Saved Payroll Drafts</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                  {draftsList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {draftsList.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <FolderOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-medium">No saved drafts found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click &quot;Save Draft&quot; in the payroll cutoff bar to save your work in progress.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {draftsList.map((draft) => {
                    const cutoffLabel =
                      draft.cutoff === '1ST_HALF'
                        ? '1st Half (1st–15th)'
                        : draft.cutoff === '2ND_HALF'
                          ? `2nd Half (16th–${getDaysInMonth(draft.year, draft.month)}th)`
                          : 'Custom Range'
                    const savedDateFormatted = new Date(draft.savedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })

                    return (
                      <div
                        key={draft.id}
                        className="p-3.5 border border-slate-200 hover:border-indigo-300 rounded-lg bg-slate-50/50 hover:bg-indigo-50/20 transition-colors flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-800">
                              {MONTH_NAMES[draft.month - 1]} {draft.year}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                              {cutoffLabel}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              Ref: {draft.refSequence}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 truncate">{draft.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                            <span>
                              Employees:{' '}
                              <strong className="text-slate-700">
                                {Object.keys(draft.rowInputs || {}).length}
                              </strong>
                            </span>
                            <span>
                              Date:{' '}
                              <strong className="text-slate-700">{draft.payrollDate}</strong>
                            </span>
                            <span>
                              Saved:{' '}
                              <strong className="text-slate-700">{savedDateFormatted}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleResumeDraft(draft)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm transition-colors cursor-pointer"
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteDraft(draft.id, e)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Delete Draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs text-gray-500">
              <span>Auto-saves changes when working in a period cutoff.</span>
              <button
                type="button"
                onClick={() => setShowDraftsModal(false)}
                className="px-3 py-1.5 font-medium text-slate-700 bg-white border border-gray-300 rounded hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL SELECTION FLOATING STATUS BAR */}
      {selectionStats && (
        <div className="fixed bottom-6 right-8 bg-gray-900/95 text-white text-xs px-5 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-5 z-40 border border-gray-700 font-mono animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-bold uppercase text-[10px]">Average:</span>
            <span className="text-emerald-400 font-extrabold">{selectionStats.avg.toFixed(2)}</span>
          </div>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-bold uppercase text-[10px]">Count:</span>
            <span className="text-sky-400 font-extrabold">{selectionStats.count}</span>
          </div>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-bold uppercase text-[10px]">Sum:</span>
            <span className="text-amber-400 font-extrabold">
              {selectionStats.sum.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

