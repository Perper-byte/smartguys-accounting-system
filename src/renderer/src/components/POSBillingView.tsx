import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NewContactModal } from './NewContactModal'
import { EndOfDaySummaryView } from './EndOfDaySummaryView'
import { PatientHistoryModal } from './PatientHistoryModal'
import { LabTestsModal } from './LabTestsModal'
import { CashierDisbursementView } from './CashierDisbursementView'
import {
  Search,
  Printer,
  Minus,
  Plus,
  Trash2,
  Info,
  CheckCircle,
  Wallet,
  Smartphone,
  CreditCard,
  Tag,
  SplitSquareHorizontal,
  Receipt,
  UploadCloud,
  Image as ImageIcon,
  FileText,
  X,
  Paperclip,
  Eye,
  ShieldCheck,
  Download,
  Coins
} from 'lucide-react'

const CATEGORIES = {
  '4010': { label: '👨‍⚕️ Consultation', isVatable: false },
  '4020': { label: '🔬 Laboratory / X-Ray', isVatable: false },
  '4040': { label: '📄 Medical Certificate', isVatable: false }
}

export function POSBillingView({ userId }: { userId: string }) {
  const [patients, setPatients] = useState<any[]>([])
  const [patientId, setPatientId] = useState('')
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false)
  const [patientSearchQuery, setPatientSearchQuery] = useState('')

  const [payees, setPayees] = useState<any[]>([])
  const [payeeId, setPayeeId] = useState('')
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false)
  const [payeeSearchQuery, setPayeeSearchQuery] = useState('')

  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [modalDefaultType, setModalDefaultType] = useState('PATIENT')

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH' | 'SPLIT' | ''>('')
  const [amountTendered, setAmountTendered] = useState<number | ''>('')
  const [gcashAmount, setGcashAmount] = useState<number | ''>('')
  const [referenceNo, setReferenceNo] = useState('')

  const [loaNumber, setLoaNumber] = useState('')

  // 🔥 UPDATED: Locked to INV- only
  const [refPrefix] = useState('INV-')
  const [invoiceSequence, setInvoiceSequence] = useState('')

  const [isSCPWD, setIsSCPWD] = useState(false)
  const [discountType, setDiscountType] = useState('Senior Citizen')
  const [scPwdId, setScPwdId] = useState('')

  const [labTests, setLabTests] = useState<any[]>([])
  const [revenueAccounts, setRevenueAccounts] = useState<any[]>([])

  const [items, setItems] = useState([
    {
      id: 1,
      accountCode: '4010',
      description: '',
      quantity: 1,
      price: 500,
      isVatable: false,
      isHmoCovered: false,
      hmoCoverage: '' as number | ''
    }
  ])

  const [activeLabRow, setActiveLabRow] = useState<number | null>(null)
  const [labDropdownPosition, setLabDropdownPosition] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const labInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [successData, setSuccessData] = useState<any | null>(null)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [isDisbursementModalOpen, setIsDisbursementModalOpen] = useState(false)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [editingOriginalDate, setEditingOriginalDate] = useState<string | null>(null)
  const [managerPinUsed, setManagerPinUsed] = useState<string>('')

  const [clientType, setClientType] = useState<'OPD' | 'WALKIN'>('WALKIN')
  const [examType, setExamType] = useState<'STANDARD' | 'PRE-EMP' | 'APE'>('STANDARD')

  const [isLabModalOpen, setIsLabModalOpen] = useState(false)
  const [isPatientHistoryModalOpen, setIsPatientHistoryModalOpen] = useState(false)

  const [remarks, setRemarks] = useState('')
  const [originalSnapshot, setOriginalSnapshot] = useState<{
    patientName: string
    clientType: string
    examType: string
    payeeName: string
    loaNumber: string
    paymentMethod: string
    referenceNo: string
    grandTotal: number
    patientShare: number
    hmoShare: number
    userRemarks: string
    existingInitialRemarks: string
    existingEditedRemarks: string
    items: Array<{
      description: string
      quantity: number
      price: number
      accountCode: string
      isHmoCovered: boolean
      hmoCoverage: number | string
    }>
  } | null>(null)
  const [attachments, setAttachments] = useState<
    Array<{ name: string; type: string; size?: number; data: string; preview?: string }>
  >([])
  const [isDragging, setIsDragging] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<{
    name: string
    data: string
    type: string
  } | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFilesAdded(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) handleFilesAdded(Array.from(e.dataTransfer.files))
  }

  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const isImg = file.type.startsWith('image/') || Boolean(file.name.match(/\.(jpg|jpeg|png|webp)$/i))
      if (!isImg) {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string) || '')
        reader.onerror = () => resolve('')
        reader.readAsDataURL(file)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          let width = img.width
          let height = img.height
          const maxDim = 1600
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', 0.8))
          } else {
            resolve((e.target?.result as string) || '')
          }
        }
        img.onerror = () => resolve((e.target?.result as string) || '')
        img.src = (e.target?.result as string) || ''
      }
      reader.onerror = () => resolve('')
      reader.readAsDataURL(file)
    })
  }

  const handleFilesAdded = async (files: File[]) => {
    const validFiles = files.filter((file) => {
      const isValidType =
        [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'application/pdf'
        ].includes(file.type) || Boolean(file.name.match(/\.(jpg|jpeg|png|webp|gif|pdf)$/i))
      const isValidSize = file.size <= 10 * 1024 * 1024
      if (!isValidType) alert(`${file.name} is not a supported file type (Images and PDF only).`)
      if (!isValidSize) alert(`${file.name} exceeds the 10MB limit.`)
      return isValidType && isValidSize
    })

    if (attachments.length + validFiles.length > 10) {
      alert('You can only upload a maximum of 10 attachments per transaction.')
      return
    }

    for (const file of validFiles) {
      const dataUrl = await compressImageFile(file)
      if (!dataUrl) continue
      const isImg = file.type.startsWith('image/') || Boolean(file.name.match(/\.(jpg|jpeg|png|webp)$/i))
      setAttachments((prev) => [
        ...prev,
        {
          name: file.name,
          type: isImg ? 'image/jpeg' : (file.type || 'application/octet-stream'),
          size: Math.round(dataUrl.length * 0.75),
          data: dataUrl,
          preview: dataUrl
        }
      ])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleEditTransaction = (row: any) => {
    setIsSummaryOpen(false)
    setEditingTransactionId(row.id)
    setEditingOriginalDate(row.rawDate || row.date || null)
    setManagerPinUsed(row.managerOverridePin || '')

    // Restore remarks
    let parsedRemarks = row.remarks || ''
    if (!parsedRemarks) {
      const remarksMatch = (row.rawDescription || row.particular || '').match(/\nRemarks:\s*([\s\S]*?)(?=\nDiagnostic Test|$)/)
      if (remarksMatch) parsedRemarks = remarksMatch[1].trim()
    }

    let userOwnRemarks = ''
    let existingInitial = ''
    let existingEdited = ''

    if (parsedRemarks) {
      const userMatch = parsedRemarks.match(/\[User own remarks\]\s*([\s\S]*?)(?=\n\s*\[Initial generated Remarks\]|$)/i)
      const initialMatch = parsedRemarks.match(/\[Initial generated Remarks\]\s*([\s\S]*?)(?=\n\s*\[Edited Remarks\]|$)/i)
      const editedMatch = parsedRemarks.match(/\[Edited Remarks\]\s*([\s\S]*)$/i)

      if (userMatch) {
        userOwnRemarks = userMatch[1].trim()
        if (userOwnRemarks === 'None') userOwnRemarks = ''
      } else if (!parsedRemarks.includes('[Initial generated Remarks]')) {
        userOwnRemarks = parsedRemarks
      }

      if (initialMatch) {
        existingInitial = initialMatch[1].trim()
      }

      if (editedMatch) {
        existingEdited = editedMatch[1].trim()
        if (existingEdited === 'None') existingEdited = ''
      }
    }
    setRemarks(userOwnRemarks)

    // Restore attachments
    if (row.attachments && Array.isArray(row.attachments)) {
      setAttachments(
        row.attachments.map((a: any) => ({
          name: a.name || a.fileName || 'Attachment',
          type: a.type || a.fileType || 'image/jpeg',
          size: a.size || 0,
          data: a.data || a.fileData || '',
          preview: a.data || a.fileData || ''
        }))
      )
    } else {
      setAttachments([])
    }

    // Set invoice sequence correctly (e.g. INV-006 -> 006)
    const seq = row.orNo ? row.orNo.replace(/^INV-|^OR-/, '') : ''
    setInvoiceSequence(seq)

    // Parse GCash reference number if present in description
    const gcashRefMatch = (row.rawDescription || row.particular || '').match(/\(Ref:\s*([^)]+)\)/)
    setReferenceNo(gcashRefMatch ? gcashRefMatch[1].trim() : '')

    // Set payment method
    setPaymentMethod(row.method === 'CHARGE' ? '' : row.method)

    setClientType(row.clientType || 'WALKIN')
    setExamType(row.examType || 'STANDARD')

    // Resolve HMO / Corporate Payee vs Patient
    let resolvedHmoId = ''
    const isHmoOrCorp =
      row.billedEntityType === 'HMO' ||
      row.billedEntityType === 'CORPORATE' ||
      Boolean(row.company) ||
      Boolean(row.client) ||
      Boolean(row.billedEntity) ||
      payees.some((p) => p.id === row.payeeId)

    if (isHmoOrCorp) {
      const targetEntityName = (row.billedEntity || row.company || row.client || '').toLowerCase().trim()
      const matchedHmo = payees.find(
        (p) =>
          p.id === row.payeeId ||
          (targetEntityName && p.name && p.name.toLowerCase().trim() === targetEntityName)
      )
      if (matchedHmo) {
        resolvedHmoId = matchedHmo.id
      } else if (row.payeeId) {
        resolvedHmoId = row.payeeId
      }
      setPayeeId(resolvedHmoId)

      // Find patient by name
      const patientNameClean = (row.name || '').toLowerCase().trim()
      const matchedPatient = patients.find(
        (p) => p.name && p.name.toLowerCase().trim() === patientNameClean
      )
      if (matchedPatient) {
        setPatientId(matchedPatient.id)
      } else {
        setPatientId('')
        setPatientSearchQuery(row.name || '')
      }
    } else {
      setPatientId(row.payeeId || '')
      setPayeeId('')
    }

    // Extract LOA if present
    const loaMatch = (row.rawDescription || row.particular || '').match(/LOA:\s*([^)]+)/)
    setLoaNumber(loaMatch ? loaMatch[1].trim() : '')

    // Check if HMO / AR covered
    const rawLines = row.rawLines || []
    const arLine = rawLines.find((l: any) => l.accountCode === '1200' || l.accountCode === '1210')
    const hasArCoverage =
      Boolean(arLine && Number(arLine.debit) > 0) ||
      row.method === 'CHARGE' ||
      Boolean(row.charge > 0) ||
      Boolean(resolvedHmoId)

    // Reconstruct items
    let loadedItems: any[] = []
    if (row.items && Array.isArray(row.items) && row.items.length > 0) {
      loadedItems = row.items.map((it: any, idx: number) => ({
        id: Date.now() + idx,
        accountCode: it.accountCode || '4010',
        description: it.description || '',
        quantity: Number(it.quantity) || 1,
        price: Number(it.price) || 0,
        isVatable: Boolean(it.isVatable),
        isHmoCovered: Boolean(it.isHmoCovered),
        hmoCoverage:
          it.hmoCoverage !== undefined && it.hmoCoverage !== ''
            ? it.hmoCoverage
            : it.isHmoCovered
              ? Number(it.price)
              : ''
      }))
      setItems(loadedItems)
    } else if (rawLines.length > 0) {
      // Legacy diagnostic tests parsing from description
      const diagMatch = (row.rawDescription || row.particular || '').match(
        /Diagnostic Test\s*\((.*?)(?:\s*-\s*[^)]*)?\)/
      )
      let parsedLegacyTests: string[] = []
      if (diagMatch && diagMatch[1]) {
        parsedLegacyTests = diagMatch[1]
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      }

      const revLines = rawLines.filter(
        (l: any) => l.credit > 0 && l.accountCode !== '2130' && l.accountCode !== '2020'
      )
      let legacyTestCounter = 0

      loadedItems = revLines.map((l: any, idx: number) => {
        const isVat = row.vatType === 'VATABLE'
        const originalGross = isVat ? Math.round(l.credit * 1.12 * 100) / 100 : l.credit

        let itemDesc = l.description || ''
        if (!itemDesc && l.accountCode === '4020' && legacyTestCounter < parsedLegacyTests.length) {
          itemDesc = parsedLegacyTests[legacyTestCounter++]
        }
        if (!itemDesc && l.accountCode === '4020' && labTests.length > 0) {
          const matchedTest = labTests.find((t: any) => Number(t.price) === originalGross)
          if (matchedTest) itemDesc = matchedTest.name
        }

        const isCovered = hasArCoverage
        return {
          id: Date.now() + idx,
          accountCode: l.accountCode,
          description: itemDesc,
          quantity: 1,
          price: originalGross,
          isVatable: isVat,
          isHmoCovered: isCovered,
          hmoCoverage: isCovered ? originalGross : ('' as number | '')
        }
      })
      if (loadedItems.length > 0) setItems(loadedItems)
    }

    // Capture original snapshot for audit diff
    const snapshotItems = loadedItems.map((it) => ({
      description: (it.description || '').trim(),
      quantity: Number(it.quantity) || 1,
      price: Number(it.price) || 0,
      accountCode: it.accountCode || '4010',
      isHmoCovered: Boolean(it.isHmoCovered),
      hmoCoverage: it.hmoCoverage !== undefined && it.hmoCoverage !== '' ? Number(it.hmoCoverage) : (it.isHmoCovered ? Number(it.price) : '')
    }))

    const resolvedPayeeObj = payees.find((p) => p.id === resolvedHmoId)
    const resolvedPayeeTitle = resolvedPayeeObj?.name || row.billedEntity || row.company || row.client || ''

    if (!existingInitial) {
      const origDateStr = (row.rawDate || row.date)
        ? new Date(row.rawDate || row.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Original Date'
      const patientTitle = row.name || 'Walk-in'
      const clientExam = `${row.clientType || 'WALKIN'} / ${row.examType || 'STANDARD'}`
      const hmoTitle = resolvedPayeeTitle
        ? `\n• Guarantor/HMO: ${resolvedPayeeTitle}${loaMatch ? ` (LOA: ${loaMatch[1].trim()})` : ''}`
        : ''
      const itemsListFormatted = snapshotItems
        .map((i: any) => `  - ${i.description || 'Item'} (Qty: ${i.quantity}, Price: ₱${Number(i.price).toFixed(2)})${i.isHmoCovered ? ` [HMO Covered: ₱${Number(i.hmoCoverage || i.price).toFixed(2)}]` : ''}`)
        .join('\n')
      const totalTitle = Number(row.amount || 0).toFixed(2)

      existingInitial = `Created: ${origDateStr}
• Patient: ${patientTitle} (${clientExam})${hmoTitle}
• Items:
${itemsListFormatted || '  - None'}
• Total: ₱${totalTitle}
• Payment: ${row.method || 'CASH'}`
    }

    setOriginalSnapshot({
      patientName: row.name || '',
      clientType: row.clientType || 'WALKIN',
      examType: row.examType || 'STANDARD',
      payeeName: resolvedPayeeTitle,
      loaNumber: loaMatch ? loaMatch[1].trim() : '',
      paymentMethod: row.method === 'CHARGE' ? '' : row.method,
      referenceNo: gcashRefMatch ? gcashRefMatch[1].trim() : '',
      grandTotal: Number(row.amount) || 0,
      patientShare: (Number(row.cash) || 0) + (Number(row.gcash) || 0),
      hmoShare: Number(row.charge) || 0,
      userRemarks: userOwnRemarks,
      existingInitialRemarks: existingInitial,
      existingEditedRemarks: existingEdited,
      items: snapshotItems
    })
  }

  const loadInitialData = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (!api) return console.error('Electron API is unavailable.')

      const payeeData = await api.getPayees('HMO,CORPORATE')
      setPayees(payeeData || [])

      const patientData = await api.getPayees('PATIENT')
      setPatients(patientData || [])

      if (api.getServiceItems) setLabTests((await api.getServiceItems()) || [])

      if (api.getAccounts) {
        const accData = await api.getAccounts()
        const revAccounts = accData.filter((a: any) => a.account_type?.name === 'Revenue')
        setRevenueAccounts(revAccounts)

        if (revAccounts.length > 0 && items[0].accountCode === '') {
          const defaultAccount =
            revAccounts.find((a: any) => a.code === '4010')?.code || revAccounts[0].code
          setItems([
            {
              id: 1,
              accountCode: defaultAccount,
              description: '',
              quantity: 1,
              price: 500,
              isVatable: false,
              isHmoCovered: false,
              hmoCoverage: ''
            }
          ])
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  // Automatically fetch the next sequence number (e.g. 001) for the POS
  useEffect(() => {
    const fetchNextSeq = async () => {
      try {
        const api = (window as any).api || (window as any).electronAPI
        const nextSeq = await api.getNextSequence(refPrefix)
        setInvoiceSequence(nextSeq)
      } catch (error) {
        console.error(error)
      }
    }
    if (!successData && !editingTransactionId) fetchNextSeq()
  }, [refPrefix, successData, editingTransactionId])

  // ============================================================
  // AUTO-FILL HMO / GUARANTOR WHEN PATIENT IS SELECTED
  // ============================================================
  useEffect(() => {
    if (editingTransactionId) return

    if (!patientId) {
      setPayeeId('')
      return
    }

    const selectedPatient = patients.find((p) => p.id === patientId)

    if (selectedPatient) {
      const hmoName =
        selectedPatient.hmo_affiliation || selectedPatient.hmo_name || selectedPatient.hmoName

      if (hmoName && String(hmoName).trim() !== '') {
        const hmoSearchStr = String(hmoName).toLowerCase().trim()
        const match = payees.find((p) =>
          p.name ? String(p.name).toLowerCase().trim() === hmoSearchStr : false
        )

        if (match) {
          setPayeeId(match.id)
        } else {
          setPayeeId('')
        }
      } else {
        setPayeeId('')
      }
    }
  }, [patientId, patients, payees, editingTransactionId])

  const onContactSaved = (newId?: string, _newName?: string) => {
    loadInitialData()
    if (newId) {
      if (modalDefaultType === 'PATIENT') setPatientId(newId)
      else setPayeeId(newId)
    }
    setIsContactModalOpen(false)
  }

  const handleAddLabTests = (tests: any[]) => {
    if (tests.length === 0) return

    const newItems = tests.map((t, idx) => {
      const price = Number(t.price) || 0
      const isHmo = Boolean(t.isHmoCovered)
      return {
        id: Date.now() + idx,
        accountCode: '4020', // Assuming 4020 is Laboratory / Diagnostic Income
        description: t.name,
        quantity: 1,
        price: price,
        isVatable: Boolean(t.isVatable),
        isHmoCovered: isHmo,
        hmoCoverage: isHmo ? price : ('' as number | '')
      }
    })

    setItems([...items, ...newItems])
  }

  const handleAddItem = () => {
    const defaultCode =
      revenueAccounts.find((a) => a.code === '4010')?.code ||
      (revenueAccounts.length > 0 ? revenueAccounts[0].code : '')
    setItems([
      ...items,
      {
        id: Date.now(),
        accountCode: defaultCode,
        description: '',
        quantity: 1,
        price: 500,
        isVatable: false,
        isHmoCovered: false,
        hmoCoverage: ''
      }
    ])
  }

  const handleRemoveItem = (id: number) => {
    setItems(items.filter((item) => item.id !== id))
    if (activeLabRow === id) {
      setActiveLabRow(null)
      setLabDropdownPosition(null)
    }
  }

  const updateItemQty = (id: number, delta: number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    )
  }

  const updateItem = (id: number, field: string, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }
          if (field === 'accountCode') {
            updatedItem.description = ''
            updatedItem.price = value === '4010' ? 500 : 0
            updatedItem.isHmoCovered = false
            updatedItem.hmoCoverage = ''
            setActiveLabRow(null)
            setLabDropdownPosition(null)
          }
          return updatedItem
        }
        return item
      })
    )
  }

  const toggleHmoCover = (id: number, isCovered: boolean, rowTotal: number) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            isHmoCovered: isCovered,
            hmoCoverage: isCovered ? rowTotal : ''
          }
        }
        return item
      })
    )
  }

  const calculateLabDropdownPosition = (element: HTMLInputElement) => {
    const rect = element.getBoundingClientRect()
    const dropdownWidth = Math.max(rect.width, 400)
    let left = rect.left
    if (left + dropdownWidth > window.innerWidth - 16) left = window.innerWidth - dropdownWidth - 16
    let top = rect.bottom + 6
    if (window.innerHeight - rect.bottom < 180 && rect.top > 290) top = rect.top - 290 - 6
    return { top, left: Math.max(16, left), width: dropdownWidth }
  }

  useEffect(() => {
    const syncLabDropdown = () => {
      if (activeLabRow === null || !labInputRef.current) return
      const rect = labInputRef.current.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setActiveLabRow(null)
        setLabDropdownPosition(null)
        labInputRef.current = null
        return
      }
      setLabDropdownPosition(calculateLabDropdownPosition(labInputRef.current))
    }
    window.addEventListener('scroll', syncLabDropdown, true)
    window.addEventListener('resize', syncLabDropdown)
    return () => {
      window.removeEventListener('scroll', syncLabDropdown, true)
      window.removeEventListener('resize', syncLabDropdown)
    }
  }, [activeLabRow])

  const openLabDropdown = (rowId: number, element: HTMLInputElement) => {
    labInputRef.current = element
    setLabDropdownPosition(calculateLabDropdownPosition(element))
    setActiveLabRow(rowId)
  }

  const closePayeeDropdown = () => {
    setIsPayeeDropdownOpen(false)
    setPayeeSearchQuery('')
  }

  const resetForm = () => {
    setSuccessData(null)
    setEditingTransactionId(null)
    setEditingOriginalDate(null)
    setManagerPinUsed('')
    setOriginalSnapshot(null)
    setRemarks('')
    setAttachments([])
    setPreviewAttachment(null)
    setClientType('WALKIN')
    setExamType('STANDARD')
    setPatientId('')
    setPayeeId('')
    setPaymentMethod('')
    setLoaNumber('')
    setReferenceNo('')
    setIsSCPWD(false)
    setScPwdId('')
    setAmountTendered('')
    setGcashAmount('')
    setPatientSearchQuery('')
    setPayeeSearchQuery('')
    setIsPatientDropdownOpen(false)
    setIsPayeeDropdownOpen(false)
    setActiveLabRow(null)
    setLabDropdownPosition(null)
    const defaultCode =
      revenueAccounts.find((a) => a.code === '4010')?.code ||
      (revenueAccounts.length > 0 ? revenueAccounts[0].code : '')
    setItems([
      {
        id: Date.now(),
        accountCode: defaultCode,
        description: '',
        quantity: 1,
        price: 500,
        isVatable: false,
        isHmoCovered: false,
        hmoCoverage: ''
      }
    ])
    const api = (window as any).api || (window as any).electronAPI
    if (api && api.getNextSequence) {
      api.getNextSequence(refPrefix).then((seq: string) => {
        if (seq) setInvoiceSequence(seq)
      }).catch(() => {})
    }
  }

  // ============================================================
  // SPLIT BILLING CALCULATIONS
  // ============================================================
  let grossAmount = 0
  let vatableSales = 0
  let vatExemptSales = 0
  let vatAmount = 0
  let totalDiscount = 0
  let grandTotal = 0

  let hmoShare = 0
  let patientShare = 0

  items.forEach((item) => {
    const lineTotal = item.quantity * item.price
    grossAmount += lineTotal
    let itemFinalPrice = lineTotal

    if (isSCPWD) {
      const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal
      const discountAmount = netOfVat * 0.2
      itemFinalPrice = netOfVat - discountAmount
      vatExemptSales += itemFinalPrice
      totalDiscount += lineTotal - itemFinalPrice
    } else {
      if (item.isVatable) {
        const net = lineTotal / 1.12
        vatableSales += net
        vatAmount += lineTotal - net
      } else {
        vatExemptSales += lineTotal
      }
    }

    grandTotal += itemFinalPrice

    if (item.isHmoCovered) {
      let safeCoverage = Number(item.hmoCoverage) || 0
      if (safeCoverage > itemFinalPrice) safeCoverage = itemFinalPrice
      hmoShare += safeCoverage
      patientShare += itemFinalPrice - safeCoverage
    } else {
      patientShare += itemFinalPrice
    }
  })

  const tendered = Number(amountTendered) || 0
  const splitGcash = Number(gcashAmount) || 0
  const cashNeeded = paymentMethod === 'SPLIT' ? patientShare - splitGcash : patientShare
  const change = tendered > cashNeeded ? tendered - cashNeeded : 0
  const hasHmoCoveredItem = items.some((i) => i.isHmoCovered)

  let isPaid = false
  if (patientShare === 0) isPaid = true
  else if (paymentMethod === 'CASH') isPaid = tendered >= patientShare
  else if (paymentMethod === 'GCASH') isPaid = true
  else if (paymentMethod === 'SPLIT') isPaid = splitGcash > 0 && tendered >= cashNeeded

  const selectedPatientName = patients.find((p) => p.id === patientId)?.name || ''

  const filteredPatients = patients.filter((p) => {
    if (!p || !p.name) return false
    return String(p.name).toLowerCase().includes(patientSearchQuery.toLowerCase())
  })

  const selectedPayee = payees.find((p) => p.id === payeeId)
  const selectedPayeeName = selectedPayee?.name || ''

  const filteredPayees = payees.filter((p) => {
    if (!p || !p.name) return false
    const matchesSearch = String(p.name).toLowerCase().includes(payeeSearchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (hasHmoCoveredItem) return p.type === 'HMO' || p.type === 'CORPORATE'
    return true
  })

  // ============================================================
  // SUBMIT VALIDATION
  // ============================================================
  const handleCheckoutClick = (e: React.FormEvent) => {
    e.preventDefault()

    if (!patientId) return alert('Please select a Patient.')
    if (items.length === 0 || grandTotal === 0) return alert('Please add items to bill.')

    if (patientShare > 0 && !paymentMethod)
      return alert('Please select a Payment Method for the patient balance!')
    if (isSCPWD && !scPwdId.trim()) return alert('SC/PWD ID is required.')

    if (hasHmoCoveredItem) {
      if (!payeeId) return alert('A Guarantor / HMO must be selected for covered items.')
      if (selectedPayee?.type === 'HMO' && !loaNumber.trim())
        return alert('LOA Number is required for HMO claims.')
    }

    if (patientShare > 0) {
      if (paymentMethod === 'CASH' && tendered < patientShare)
        return alert('Amount tendered is insufficient.')
      if (paymentMethod === 'GCASH' && !referenceNo.trim())
        return alert('GCash Reference Number is required.')
      if (paymentMethod === 'SPLIT') {
        if (splitGcash <= 0 || splitGcash >= patientShare)
          return alert(
            `GCash split amount must be between ₱0.01 and ₱${(patientShare - 0.01).toFixed(2)}.`
          )
        if (!referenceNo.trim()) return alert('GCash Reference Number is required for the split.')
        if (tendered < cashNeeded)
          return alert(
            `Insufficient cash. ₱${cashNeeded.toFixed(2)} cash is required for this split.`
          )
      }
    }

    setIsConfirmOpen(true)
  }

  // ============================================================
  // MULTI-DEBIT JOURNAL ENTRY
  // ============================================================
  const handleConfirmSubmit = async () => {
    try {
      setLoading(true)
      const lines: any[] = []

      // DEBIT 1: HMO SHARE (A/R)
      if (hasHmoCoveredItem) {
        lines.push({ accountId: '1200', debit: hmoShare, credit: 0 })
      }

      // DEBIT 2: PATIENT SHARE (CASH/GCASH)
      if (patientShare > 0) {
        if (paymentMethod === 'CASH') {
          lines.push({ accountId: '1030', debit: patientShare, credit: 0 }) // Cash in Hand
        } else if (paymentMethod === 'GCASH') {
          lines.push({ accountId: '1010', debit: patientShare, credit: 0 })
        } else if (paymentMethod === 'SPLIT') {
          lines.push({ accountId: '1010', debit: splitGcash, credit: 0 })
          lines.push({ accountId: '1030', debit: patientShare - splitGcash, credit: 0 }) // Cash in Hand
        }
      }

      // CREDITS: Revenue
      items.forEach((item) => {
        const lineTotal = item.quantity * item.price
        let revenueAmount = lineTotal
        if (isSCPWD) {
          const netOfVat = item.isVatable ? lineTotal / 1.12 : lineTotal
          revenueAmount = netOfVat * 0.8
        } else if (item.isVatable) {
          revenueAmount = lineTotal / 1.12
        }
        lines.push({ accountId: item.accountCode, debit: 0, credit: revenueAmount })
      })

      // CREDITS: VAT Payable
      if (vatAmount > 0 && !isSCPWD) {
        lines.push({ accountId: '2020', debit: 0, credit: vatAmount })
      }

      const finalPayeeId = payeeId || patientId

      let paymentDesc = ''
      if (patientShare > 0) {
        paymentDesc = `| Pt. Paid: ${paymentMethod}`
        if (paymentMethod === 'GCASH' || paymentMethod === 'SPLIT')
          paymentDesc += ` (Ref: ${referenceNo})`
      }

      const hmoDesc = hasHmoCoveredItem
        ? `| A/R: ${selectedPayeeName}${selectedPayee?.type === 'HMO' ? ` (LOA: ${loaNumber})` : ''}`
        : ''
      
      const labTestsBilled = items.filter(i => i.accountCode === '4020' && i.description.trim())
      let testsDesc = ''
      if (labTestsBilled.length > 0) {
        const testNames = labTestsBilled.map(i => i.description.trim()).join(', ')
        const now = new Date()
        const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        testsDesc = `\nDiagnostic Test (${testNames} - ${dateStr} ${timeStr})`
      }

      const itemsMeta = JSON.stringify(
        items.map((i) => ({
          accountCode: i.accountCode,
          description: i.description,
          quantity: i.quantity,
          price: i.price,
          isVatable: i.isVatable,
          isHmoCovered: i.isHmoCovered,
          hmoCoverage: i.hmoCoverage
        }))
      )

      // Format structured remarks:
      // [User own remarks]
      // [Initial generated Remarks]
      // [Edited Remarks]

      const finalUserRemarks = remarks.trim() ? remarks.trim() : 'None'
      let finalInitialRemarks = ''
      let finalEditedRemarks = 'None'

      if (editingTransactionId && originalSnapshot) {
        // PRESERVE initial remarks
        finalInitialRemarks = originalSnapshot.existingInitialRemarks || ''

        // COMPUTE diff between originalSnapshot and current state
        const diffs: string[] = []

        // Deleted items (in snapshot but not in current)
        originalSnapshot.items.forEach((orig) => {
          const stillExists = items.some(
            (curr) => (curr.description || '').trim().toLowerCase() === orig.description.trim().toLowerCase()
          )
          if (!stillExists) {
            diffs.push(`Deleted Item: "${orig.description || 'Item'}" (₱${Number(orig.price).toFixed(2)} x${orig.quantity})`)
          }
        })

        // Added items (in current but not in snapshot)
        items.forEach((curr) => {
          const wasInOrig = originalSnapshot.items.some(
            (orig) => orig.description.trim().toLowerCase() === (curr.description || '').trim().toLowerCase()
          )
          if (!wasInOrig) {
            diffs.push(`Added Item: "${curr.description || 'Item'}" (₱${Number(curr.price).toFixed(2)} x${curr.quantity})`)
          }
        })

        // Modified items (quantity, price, HMO coverage)
        items.forEach((curr) => {
          const matchedOrig = originalSnapshot.items.find(
            (orig) => orig.description.trim().toLowerCase() === (curr.description || '').trim().toLowerCase()
          )
          if (matchedOrig) {
            if (matchedOrig.quantity !== curr.quantity) {
              diffs.push(`Modified "${curr.description}": Qty changed from ${matchedOrig.quantity} to ${curr.quantity}`)
            }
            if (Math.abs(Number(matchedOrig.price) - Number(curr.price)) > 0.01) {
              diffs.push(`Modified "${curr.description}": Price changed from ₱${Number(matchedOrig.price).toFixed(2)} to ₱${Number(curr.price).toFixed(2)}`)
            }
            if (Boolean(matchedOrig.isHmoCovered) !== Boolean(curr.isHmoCovered)) {
              diffs.push(`Modified "${curr.description}": HMO Coverage changed from ${matchedOrig.isHmoCovered ? 'Yes' : 'No'} to ${curr.isHmoCovered ? 'Yes' : 'No'}`)
            } else if (curr.isHmoCovered && Math.abs(Number(matchedOrig.hmoCoverage || 0) - Number(curr.hmoCoverage || 0)) > 0.01) {
              diffs.push(`Modified "${curr.description}": HMO Coverage changed from ₱${Number(matchedOrig.hmoCoverage || 0).toFixed(2)} to ₱${Number(curr.hmoCoverage || 0).toFixed(2)}`)
            }
          }
        })

        // Patient changed
        if (selectedPatientName && originalSnapshot.patientName && selectedPatientName !== originalSnapshot.patientName) {
          diffs.push(`Patient changed from "${originalSnapshot.patientName}" to "${selectedPatientName}"`)
        }

        // Client/Exam Type changed
        if (clientType !== originalSnapshot.clientType) {
          diffs.push(`Client Type changed from "${originalSnapshot.clientType}" to "${clientType}"`)
        }
        if (examType !== originalSnapshot.examType) {
          diffs.push(`Exam Type changed from "${originalSnapshot.examType}" to "${examType}"`)
        }

        // HMO / Guarantor changed
        const currentPayeeName = selectedPayeeName || ''
        if (currentPayeeName !== originalSnapshot.payeeName) {
          diffs.push(`Guarantor/HMO changed from "${originalSnapshot.payeeName || 'None'}" to "${currentPayeeName || 'None'}"`)
        }
        if (loaNumber.trim() !== originalSnapshot.loaNumber.trim()) {
          diffs.push(`LOA changed from "${originalSnapshot.loaNumber || 'None'}" to "${loaNumber.trim() || 'None'}"`)
        }

        // Payment method changed
        if (paymentMethod !== originalSnapshot.paymentMethod) {
          diffs.push(`Payment Method changed from "${originalSnapshot.paymentMethod || 'CHARGE'}" to "${paymentMethod || 'CHARGE'}"`)
        }
        if (referenceNo.trim() !== originalSnapshot.referenceNo.trim()) {
          diffs.push(`Reference No changed from "${originalSnapshot.referenceNo || 'None'}" to "${referenceNo.trim() || 'None'}"`)
        }

        // Total changed
        if (Math.abs(grandTotal - originalSnapshot.grandTotal) > 0.01) {
          diffs.push(`Total Amount changed from ₱${originalSnapshot.grandTotal.toFixed(2)} to ₱${grandTotal.toFixed(2)}`)
        }

        // User remarks changed
        if (remarks.trim() !== originalSnapshot.userRemarks.trim()) {
          diffs.push(`User remarks updated`)
        }

        const now = new Date()
        const editTimeStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        
        const isPastAuthorized = Boolean(managerPinUsed)
        const authBadge = isPastAuthorized ? ' (Authorized by Manager PIN)' : ''

        let thisEditSummary = ''
        if (diffs.length > 0) {
          thisEditSummary = `• Edited on ${editTimeStr}${authBadge}:\n${diffs.map((d) => `  - ${d}`).join('\n')}`
        } else {
          thisEditSummary = `• Edited on ${editTimeStr}${authBadge}:\n  - Re-saved with no changes`
        }

        const prevEdits = originalSnapshot.existingEditedRemarks && originalSnapshot.existingEditedRemarks !== 'None'
          ? originalSnapshot.existingEditedRemarks
          : ''
        finalEditedRemarks = prevEdits ? `${prevEdits}\n\n${thisEditSummary}` : thisEditSummary
      } else {
        // NEW TRANSACTION CREATION
        const now = new Date()
        const createTimeStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        
        const itemsSummary = items
          .map((i) => `  - ${i.description || 'Item'} (Qty: ${i.quantity}, Price: ₱${Number(i.price).toFixed(2)})${i.isHmoCovered ? ` [HMO Covered: ₱${Number(i.hmoCoverage || i.price).toFixed(2)}]` : ''}`)
          .join('\n')
        
        const hmoSummary = hasHmoCoveredItem
          ? `\n• Guarantor/HMO: ${selectedPayeeName}${selectedPayee?.type === 'HMO' ? ` (LOA: ${loaNumber})` : ''}`
          : ''

        let paymentSummary = patientShare === 0
          ? 'Fully covered by A/R / HMO'
          : `${paymentMethod}${referenceNo ? ` (Ref: ${referenceNo})` : ''}`
        if (patientShare > 0 && paymentMethod === 'CASH') {
          paymentSummary += ` (Tendered: ₱${tendered.toFixed(2)}, Change: ₱${change.toFixed(2)})`
        } else if (paymentMethod === 'SPLIT') {
          paymentSummary += ` (GCash: ₱${splitGcash.toFixed(2)}, Cash: ₱${(patientShare - splitGcash).toFixed(2)}, Tendered: ₱${tendered.toFixed(2)}, Change: ₱${change.toFixed(2)})`
        }

        finalInitialRemarks = `Created: ${createTimeStr}
• Patient: ${selectedPatientName} (${clientType} / ${examType})${hmoSummary}
• Items:
${itemsSummary}
• Total: ₱${grandTotal.toFixed(2)} (Patient: ₱${patientShare.toFixed(2)}, HMO: ₱${hmoShare.toFixed(2)})
• Payment: ${paymentSummary}`

        finalEditedRemarks = 'None'
      }

      const formattedRemarks = `[User own remarks]\n${finalUserRemarks}\n\n[Initial generated Remarks]\n${finalInitialRemarks}\n\n[Edited Remarks]\n${finalEditedRemarks}`

      const remarksDesc = `\nRemarks:\n${formattedRemarks.trim()}`
      const description = `[META:${clientType}:${examType}] [ITEMS:${encodeURIComponent(itemsMeta)}] Patient: ${selectedPatientName} ${hmoDesc} ${paymentDesc}${remarksDesc}${testsDesc}`

      const finalReferenceNo = `${refPrefix}${invoiceSequence.trim().padStart(3, '0')}`

      const processedAttachments = await Promise.all(
        attachments.map(async (att) => {
          let dataUrl = att.data || ''
          if (dataUrl && dataUrl.startsWith('data:image/') && dataUrl.length > 250 * 1024) {
            try {
              dataUrl = await new Promise<string>((resolve) => {
                const img = new Image()
                img.onload = () => {
                  let width = img.width
                  let height = img.height
                  const maxDim = 1600
                  if (width > maxDim || height > maxDim) {
                    if (width > height) {
                      height = Math.round((height * maxDim) / width)
                      width = maxDim
                    } else {
                      width = Math.round((width * maxDim) / height)
                      height = maxDim
                    }
                  }
                  const canvas = document.createElement('canvas')
                  canvas.width = width
                  canvas.height = height
                  const ctx = canvas.getContext('2d')
                  if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height)
                    resolve(canvas.toDataURL('image/jpeg', 0.8))
                  } else {
                    resolve(dataUrl)
                  }
                }
                img.onerror = () => resolve(dataUrl)
                img.src = dataUrl
              })
            } catch {
              // fallback
            }
          }
          return {
            name: att.name,
            type: att.type,
            size: att.size || 0,
            data: dataUrl
          }
        })
      )

      const entryData = {
        id: editingTransactionId,
        date: editingTransactionId && editingOriginalDate ? editingOriginalDate : new Date().toISOString(),
        referenceNo: finalReferenceNo,
        description: description.trim(),
        vatType: vatAmount > 0 ? 'VATABLE' : 'EXEMPT',
        userId: userId,
        payeeId: finalPayeeId,
        lines: lines,
        attachments: processedAttachments,
        overridePin: managerPinUsed || undefined
      }

      const api = (window as any).api || (window as any).electronAPI
      
      let response
      if (editingTransactionId) {
        response = await api.updatePosTransaction(entryData)
      } else {
        response = await api.submitJournalEntry(entryData)
      }

      if (response && response.success === false) {
        alert('Database Error: ' + response.error)
        setIsConfirmOpen(false)
        return
      }

      setSuccessData({
        invoiceNo: entryData.referenceNo,
        patientName: selectedPatientName,
        total: grandTotal,
        hmoShare: hmoShare,
        patientShare: patientShare,
        method: patientShare === 0 ? 'COVERED BY A/R' : paymentMethod,
        tendered: tendered,
        change: change
      })
      setIsConfirmOpen(false)
    } catch (error: any) {
      console.error('Billing Error:', error)
      alert('System Error: Could not connect to database.')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // SUCCESS SCREEN
  // ============================================================
  if (successData) {
    return (
      <div className="w-full flex justify-center items-center min-h-[calc(100vh-64px)] bg-[#f9fafb] animate-in zoom-in-95 duration-300 p-8">
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-[#B0DCDA] flex flex-col items-center max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-8">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3 uppercase">
            Transaction Complete
          </h1>
          <div className="text-5xl font-black font-mono tracking-tighter text-[#1B9387] mb-8">
            <span className="text-3xl mr-1">₱</span>
            {successData.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="w-full space-y-4 text-base border-t border-b border-gray-100 py-8 mb-8 text-left">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Patient</span>
              <span className="font-bold text-gray-900">{successData.patientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Invoice No.</span>
              <span className="font-bold font-mono text-gray-900">{successData.invoiceNo}</span>
            </div>

            {successData.hmoShare > 0 && (
              <div className="flex justify-between text-indigo-600">
                <span className="font-medium">A/R Covered</span>
                <span className="font-bold font-mono">
                  ₱ {successData.hmoShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {successData.patientShare > 0 && (
              <div className="flex justify-between border-t border-gray-100 pt-3">
                <span className="text-gray-500 font-medium">
                  Pt. Payment ({successData.method})
                </span>
                <span className="font-bold text-gray-900 font-mono">
                  ₱ {successData.patientShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {(successData.method === 'CASH' || successData.method === 'SPLIT') &&
              successData.patientShare > 0 && (
                <div className="flex justify-between pt-1">
                  <span className="text-gray-500 font-medium">Change Due</span>
                  <span className="font-bold font-mono text-emerald-600">
                    ₱ {successData.change.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
          </div>
          <div className="flex w-full gap-5">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-lg"
            >
              <Printer className="w-5 h-5" /> Print Receipt
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-4 bg-[#1B9387] hover:bg-[#15796f] text-white font-bold rounded-xl shadow-lg shadow-[#1B9387]/20 transition-all uppercase tracking-wider text-lg"
            >
              New Transaction
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-[calc(100vh-64px)] flex justify-center items-start bg-[#f9fafb] p-6 lg:p-10">
      <div className="w-full max-w-[1600px] flex flex-col text-gray-800 font-sans relative animate-in fade-in duration-300">
        <div className="mb-8 border-b border-[#B0DCDA] pb-6 flex justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-[#E9FAFA] p-3 rounded-xl border border-[#B0DCDA]">
              <Receipt className="w-8 h-8 text-[#1B9387]" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                {editingTransactionId ? 'Edit Transaction' : 'Patient Billing'}
                <span className="bg-[#E9FAFA] text-[#1B9387] border border-[#1B9387]/30 px-2.5 py-1 rounded text-xs tracking-widest uppercase shadow-sm">
                  POS
                </span>
                {editingTransactionId && managerPinUsed && (
                  <span className="bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded text-xs font-bold tracking-wider uppercase shadow-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    Manager Authorized
                  </span>
                )}
              </h1>
              <p className="text-base text-slate-500 font-medium mt-1">
                {editingTransactionId
                  ? 'Update EOPT-Compliant invoices and process modifications.'
                  : 'Generate EOPT-Compliant invoices and process split transactions.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {editingTransactionId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-white border border-red-200 hover:bg-red-50 text-red-500 px-6 py-3 rounded-xl text-sm font-extrabold shadow-sm transition cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsDisbursementModalOpen(true)}
              className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-5 py-3 rounded-xl text-sm font-extrabold shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Coins className="w-4 h-4 text-[#1B9387]" />
              <span>Petty Cash / Cash Out</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSummaryOpen(true)}
              className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-6 py-3 rounded-xl text-sm font-extrabold shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>End of Day Summary</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleCheckoutClick}
          className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 pb-10"
        >
          <div className="xl:col-span-4 space-y-8">
            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-sm">
              <div className="px-8 py-5 border-b border-gray-100 bg-[#FBF8F8] rounded-t-2xl flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#1B9387] text-white flex items-center justify-center text-sm font-black">
                  1
                </div>
                <h2 className="text-sm font-black text-[#1B9387] uppercase tracking-wider">
                  Patient Details
                </h2>
              </div>
              <div className="p-8 space-y-8">
                {/* CLIENT & EXAM TYPE FLAGS */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Client Type
                    </label>
                    <div className="flex gap-2">
                      {['WALKIN', 'OPD'].map(type => (
                        <label key={type} className={`flex-1 cursor-pointer flex items-center justify-center py-2 px-3 rounded-lg border text-xs font-bold transition-colors ${clientType === type ? 'bg-[#1B9387] border-[#1B9387] text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                          <input
                            type="radio"
                            className="hidden"
                            checked={clientType === type}
                            onChange={() => setClientType(type as any)}
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Exam Type
                    </label>
                    <div className="flex gap-2">
                      {['STANDARD', 'PRE-EMP', 'APE'].map(type => (
                        <label key={type} className={`flex-1 cursor-pointer flex items-center justify-center py-2 px-1 rounded-lg border text-[10px] font-bold transition-colors ${examType === type ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                          <input
                            type="radio"
                            className="hidden"
                            checked={examType === type}
                            onChange={() => setExamType(type as any)}
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Select Patient
                    </label>
                    <div className="flex gap-2">
                      {(patientId || (selectedPatientName && selectedPatientName.trim())) && (
                        <button
                          type="button"
                          onClick={() => setIsPatientHistoryModalOpen(true)}
                          className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 transition uppercase tracking-wider cursor-pointer bg-white px-2 py-1 rounded border border-indigo-200 shadow-sm"
                        >
                          View History
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setModalDefaultType('PATIENT')
                          setIsContactModalOpen(true)
                        }}
                        className="text-[10px] font-bold text-[#1B9387] hover:bg-[#E9FAFA] transition uppercase tracking-wider cursor-pointer bg-white px-2 py-1 rounded border border-[#B0DCDA] shadow-sm"
                      >
                        + New Patient
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <div
                      onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)}
                      className={`w-full bg-white border ${isPatientDropdownOpen ? 'border-[#1B9387] ring-2 ring-[#E9FAFA]' : 'border-gray-300 hover:border-gray-400'} rounded-xl px-4 py-3.5 text-base transition cursor-pointer flex justify-between items-center shadow-sm`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Search className="w-5 h-5 text-gray-400 shrink-0" />
                        <span
                          className={
                            patientId
                              ? 'text-gray-900 font-bold truncate'
                              : 'text-gray-400 font-medium'
                          }
                        >
                          {patientId ? selectedPatientName : 'Search or select patient...'}
                        </span>
                      </div>
                    </div>
                    {isPatientDropdownOpen && (
                      <div className="absolute z-[100] w-full mt-2 bg-white border border-[#B0DCDA] rounded-xl shadow-xl overflow-hidden">
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Type to search..."
                            value={patientSearchQuery}
                            onChange={(e) => setPatientSearchQuery(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-md p-3 text-sm text-gray-800 outline-none focus:border-[#1B9387] shadow-inner"
                          />
                        </div>
                        <ul className="max-h-64 overflow-y-auto">
                          <li
                            onClick={() => {
                              setPatientId('')
                              setIsPatientDropdownOpen(false)
                              setPatientSearchQuery('')
                            }}
                            className="p-4 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer font-bold uppercase tracking-wider border-b border-gray-100"
                          >
                            -- Clear Selection --
                          </li>
                          {filteredPatients.map((p) => (
                            <li
                              key={p.id}
                              onClick={() => {
                                setPatientId(p.id)
                                setIsPatientDropdownOpen(false)
                                setPatientSearchQuery('')
                              }}
                              className="px-5 py-4 text-sm text-gray-800 font-bold hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-b border-gray-50 last:border-0"
                            >
                              {p.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl transition-all bg-gray-50/50">
                  <div
                    className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-100 transition-colors rounded-xl"
                    onClick={() => setIsSCPWD(!isSCPWD)}
                  >
                    <input
                      type="checkbox"
                      checked={isSCPWD}
                      readOnly
                      className="w-5 h-5 text-[#1B9387] rounded border-gray-300 focus:ring-[#1B9387]"
                    />
                    <div className="flex items-center gap-2">
                      <Tag className="w-5 h-5 text-slate-500" />
                      <span className="text-base font-bold text-gray-700">
                        Apply SC / PWD Discount
                      </span>
                    </div>
                  </div>
                  {isSCPWD && (
                    <div className="p-5 border-t border-gray-200 bg-white space-y-5 rounded-b-xl animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center text-sm pb-3 border-b border-gray-100">
                        <span className="font-medium text-gray-500">Subtotal</span>
                        <span className="font-mono font-bold">₱{grossAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-amber-600 font-bold pb-3 border-b border-gray-100">
                        <span>Discount (20%)</span>
                        <span className="font-mono">- ₱{totalDiscount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-base font-black pt-1">
                        <span>Net Total</span>
                        <span className="font-mono text-[#1B9387]">₱{grandTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <label className="flex-[1.5]">
                          <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            Discount Type
                          </span>
                          <select
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none"
                            value={discountType}
                            onChange={(e) => setDiscountType(e.target.value)}
                          >
                            <option value="Senior Citizen">Senior Citizen</option>
                            <option value="PWD">PWD</option>
                          </select>
                        </label>
                        <label className="flex-[2]">
                          <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            ID Number
                          </span>
                          <input
                            type="text"
                            required
                            placeholder="Required for BIR"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] outline-none"
                            value={scPwdId}
                            onChange={(e) => setScPwdId(e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>


              </div>
            </div>

            {/* REMARKS & ATTACHMENTS SECTION */}
            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-100 bg-[#FBF8F8] rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1B9387] text-white flex items-center justify-center text-xs font-black">
                    <Paperclip className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-sm font-black text-[#1B9387] uppercase tracking-wider">
                    Remarks & Attachments
                  </h2>
                </div>
                {attachments.length > 0 && (
                  <span className="text-[11px] bg-[#E9FAFA] border border-[#B0DCDA] text-[#1B9387] px-2.5 py-0.5 rounded-full font-bold">
                    {attachments.length} file{attachments.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="p-8 space-y-6">
                {/* Remarks Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Transaction Remarks / Clinical Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter additional remarks, doctor's notes, or patient instructions (optional)..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#1B9387] focus:bg-white rounded-xl p-3.5 text-sm font-medium text-gray-800 outline-none transition resize-y min-h-[76px] placeholder:text-gray-400"
                  />
                  {editingTransactionId && (originalSnapshot?.existingInitialRemarks || (originalSnapshot?.existingEditedRemarks && originalSnapshot.existingEditedRemarks !== 'None')) && (
                    <div className="mt-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                          Remarks History & Audit Trail
                        </span>
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                          Edit Mode
                        </span>
                      </div>
                      {originalSnapshot?.existingInitialRemarks && (
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                            [Initial generated Remarks]
                          </span>
                          <div className="text-xs text-gray-600 whitespace-pre-wrap font-sans bg-white p-2.5 rounded-lg border border-gray-200/80 leading-relaxed text-[11px]">
                            {originalSnapshot.existingInitialRemarks}
                          </div>
                        </div>
                      )}
                      {originalSnapshot?.existingEditedRemarks && originalSnapshot.existingEditedRemarks !== 'None' && (
                        <div>
                          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-1">
                            [Edited Remarks]
                          </span>
                          <div className="text-xs text-gray-600 whitespace-pre-wrap font-sans bg-white p-2.5 rounded-lg border border-amber-200/80 leading-relaxed text-[11px] max-h-40 overflow-y-auto">
                            {originalSnapshot.existingEditedRemarks}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Attachments Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Attach Images / Documents
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setIsDragging(false)
                    }}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center transition-all ${
                      isDragging
                        ? 'bg-[#E9FAFA] border-[#1B9387]'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <UploadCloud
                      className={`mb-2 ${isDragging ? 'text-[#1B9387]' : 'text-gray-400'}`}
                      size={28}
                    />
                    <p className="text-xs font-bold text-gray-700 text-center">
                      Drag & drop images here or{' '}
                      <label
                        htmlFor="pos-file-upload"
                        className="text-[#1B9387] hover:underline cursor-pointer"
                      >
                        browse files
                      </label>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      JPG, PNG, WEBP, or PDF. Max 10MB each.
                    </p>
                    <input
                      type="file"
                      multiple
                      id="pos-file-upload"
                      className="hidden"
                      onChange={handleFileSelect}
                      accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
                    />
                  </div>

                  {/* Attachment Items List */}
                  {attachments.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
                      {attachments.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:border-[#B0DCDA] transition"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                            {file.type.includes('image') && file.preview ? (
                              <img
                                src={file.preview}
                                alt={file.name}
                                className="w-10 h-10 object-cover rounded-lg border border-gray-200 shrink-0 cursor-pointer hover:opacity-80 transition"
                                onClick={() => setPreviewAttachment(file)}
                                title="Click to view image"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[#E9FAFA] flex items-center justify-center shrink-0 text-[#1B9387]">
                                <FileText size={20} />
                              </div>
                            )}
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-xs font-bold text-gray-800 truncate" title={file.name}>
                                {file.name}
                              </span>
                              {file.size ? (
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {(file.size / 1024).toFixed(0)} KB
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {file.data && (
                              <button
                                type="button"
                                onClick={() => {
                                  const link = document.createElement('a')
                                  link.href = file.data
                                  link.download = file.name || 'attachment'
                                  document.body.appendChild(link)
                                  link.click()
                                  document.body.removeChild(link)
                                }}
                                className="p-1.5 text-gray-400 hover:text-[#1B9387] hover:bg-[#E9FAFA] rounded-md transition cursor-pointer"
                                title="Download attachment to PC"
                              >
                                <Download size={15} />
                              </button>
                            )}
                            {file.type.includes('image') && file.data && (
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(file)}
                                className="p-1.5 text-gray-400 hover:text-[#1B9387] hover:bg-[#E9FAFA] rounded-md transition cursor-pointer"
                                title="Preview image"
                              >
                                <Eye size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeAttachment(i)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition cursor-pointer"
                              title="Remove attachment"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 flex flex-col gap-8 xl:gap-10">
            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-sm flex flex-col overflow-hidden min-h-[300px]">
              <div className="px-8 py-5 border-b border-gray-100 bg-[#FBF8F8] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1B9387] text-white flex items-center justify-center text-sm font-black">
                    2
                  </div>
                  <h2 className="text-sm font-black text-[#1B9387] uppercase tracking-wider">
                    Services & Medicines
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLabModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Lab Test
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Custom Item
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead className="bg-white sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 w-48">
                        Category
                      </th>
                      <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                        Description
                      </th>
                      <th className="px-2 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-center">
                        VAT
                      </th>
                      <th className="px-4 py-4 text-[10px] font-black text-indigo-500 uppercase tracking-wider border-b border-indigo-100 text-center bg-indigo-50/50 w-36">
                        HMO / Corp Cover
                      </th>
                      <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-right">
                        Price
                      </th>
                      <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-right">
                        Total
                      </th>
                      <th className="px-2 py-4 border-b border-gray-200 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => {
                      const rowTotal = item.quantity * item.price
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-4 py-3 w-48">
                            <select
                              className="w-full bg-transparent text-sm font-bold text-[#1B9387] focus:outline-none cursor-pointer text-ellipsis overflow-hidden"
                              value={item.accountCode}
                              onChange={(e) => updateItem(item.id, 'accountCode', e.target.value)}
                            >
                              {revenueAccounts.map((acc) => (
                                <option
                                  key={acc.code}
                                  value={acc.code}
                                  className="text-gray-800 font-medium"
                                >
                                  {acc.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 min-w-[200px] relative border-l border-gray-100">
                            <input
                              type="text"
                              required
                              placeholder={
                                item.accountCode === '4020' ? 'Search test...' : 'Item name'
                              }
                              className={`w-full bg-transparent text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1B9387]/30 rounded-lg px-3 py-2 ${item.accountCode === '4020' ? 'text-[#1B9387] placeholder-[#1B9387]/50' : 'text-gray-900'}`}
                              value={item.description}
                              onChange={(e) => {
                                updateItem(item.id, 'description', e.target.value)
                                if (item.accountCode === '4020') {
                                  openLabDropdown(item.id, e.currentTarget)
                                }
                              }}
                              onFocus={(e) => {
                                if (item.accountCode === '4020') {
                                  openLabDropdown(item.id, e.currentTarget)
                                }
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  setActiveLabRow(null)
                                  setLabDropdownPosition(null)
                                }, 200)
                              }}
                            />
                            {activeLabRow === item.id &&
                              item.accountCode === '4020' &&
                              labDropdownPosition &&
                              createPortal(
                                <div
                                  className="fixed z-[9999] bg-white border border-[#1B9387] rounded-xl shadow-2xl overflow-hidden"
                                  style={{
                                    top: `${labDropdownPosition.top}px`,
                                    left: `${labDropdownPosition.left}px`,
                                    width: `${labDropdownPosition.width}px`
                                  }}
                                >
                                  <div className="px-4 py-3 bg-[#E9FAFA] border-b border-[#B0DCDA] text-xs font-extrabold text-[#1B9387] uppercase tracking-wider">
                                    Clinic Master List
                                  </div>
                                  <ul className="max-h-72 overflow-y-auto">
                                    {labTests
                                      .filter((test) => {
                                        const query = String(item.description || '').toLowerCase()
                                        return (
                                          String(test.name || '')
                                            .toLowerCase()
                                            .includes(query) ||
                                          String(test.category || '')
                                            .toLowerCase()
                                            .includes(query)
                                        )
                                      })
                                      .map((test, index) => (
                                        <li
                                          key={test.id || index}
                                          onMouseDown={(e) => {
                                            e.preventDefault()
                                            const newItems = [...items]
                                            const targetIndex = newItems.findIndex(
                                              (line) => line.id === item.id
                                            )
                                            if (targetIndex === -1) return
                                            newItems[targetIndex] = {
                                              ...newItems[targetIndex],
                                              description: test.name,
                                              price:
                                                Number(test.price) > 0
                                                  ? Number(test.price)
                                                  : newItems[targetIndex].price
                                            }
                                            setItems(newItems)
                                            setActiveLabRow(null)
                                            setLabDropdownPosition(null)
                                          }}
                                          className="px-4 py-3 text-sm text-gray-800 hover:bg-[#E9FAFA] cursor-pointer transition border-b border-gray-100 last:border-b-0 flex justify-between items-center gap-4 group"
                                        >
                                          <div className="min-w-0">
                                            <span className="font-bold text-sm block truncate group-hover:text-[#1B9387]">
                                              {test.name}
                                            </span>
                                            <span className="block text-[10px] text-gray-400 uppercase font-bold mt-0.5 truncate">
                                              {test.category}
                                            </span>
                                          </div>
                                          {Number(test.price) > 0 && (
                                            <span className="font-mono text-[#1B9387] font-bold text-sm whitespace-nowrap">
                                              ₱
                                              {Number(test.price).toLocaleString('en-US', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                              })}
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                  </ul>
                                </div>,
                                document.body
                              )}
                          </td>
                          <td className="px-2 py-3 text-center border-l border-gray-100">
                            <input
                              type="checkbox"
                              className="w-5 h-5 text-[#1B9387] bg-white border-gray-300 rounded cursor-pointer focus:ring-[#1B9387]"
                              checked={item.isVatable}
                              disabled={isSCPWD}
                              onChange={(e) => updateItem(item.id, 'isVatable', e.target.checked)}
                              title="Subject to VAT?"
                            />
                          </td>

                          <td className="px-3 py-3 bg-indigo-50/30 border-l border-indigo-100 align-middle min-w-[140px]">
                            {!item.isHmoCovered ? (
                              <div className="flex justify-center items-center h-full">
                                <input
                                  type="checkbox"
                                  className="w-5 h-5 text-indigo-600 bg-white border-indigo-300 rounded cursor-pointer focus:ring-indigo-500"
                                  checked={false}
                                  onChange={() => toggleHmoCover(item.id, true, rowTotal)}
                                  title="Cover with HMO or Corporate Account"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="flex items-center gap-2 w-full justify-center">
                                  <input
                                    type="checkbox"
                                    className="w-5 h-5 text-indigo-600 bg-white border-indigo-300 rounded cursor-pointer focus:ring-indigo-500 shrink-0"
                                    checked={true}
                                    onChange={() => toggleHmoCover(item.id, false, rowTotal)}
                                  />
                                  <div className="relative flex items-center w-24 shrink-0">
                                    <span className="absolute left-2 text-indigo-400 font-mono text-xs font-bold">
                                      ₱
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="w-full text-right bg-white border border-indigo-200 text-sm font-bold font-mono text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 rounded py-1.5 pr-2 pl-5 shadow-sm"
                                      value={item.hmoCoverage === 0 ? '' : item.hmoCoverage}
                                      onChange={(e) =>
                                        updateItem(
                                          item.id,
                                          'hmoCoverage',
                                          parseFloat(e.target.value) || ''
                                        )
                                      }
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>
                                {Number(item.hmoCoverage) !== rowTotal && (
                                  <button
                                    type="button"
                                    onClick={() => updateItem(item.id, 'hmoCoverage', rowTotal)}
                                    className="text-[9px] font-extrabold text-indigo-600 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded uppercase tracking-widest transition-colors shadow-sm cursor-pointer"
                                  >
                                    Set Full (₱
                                    {rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    )
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 w-32 border-l border-gray-100">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              className="w-full text-right bg-transparent text-base font-bold font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B9387]/30 rounded-lg px-2 py-1.5"
                              value={item.price === 0 ? '' : item.price}
                              onChange={(e) =>
                                updateItem(item.id, 'price', parseFloat(e.target.value) || 0)
                              }
                            />
                          </td>
                          <td
                            className={`px-4 py-3 w-32 text-right text-sm font-bold font-mono border-l border-gray-100 bg-[#FBF8F8]/50 ${item.isHmoCovered ? 'text-indigo-600' : 'text-gray-900'}`}
                          >
                            ₱{rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-3 text-center w-12 border-l border-gray-100">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-200 cursor-pointer"
                              title="Remove Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#B0DCDA] shadow-lg p-8 relative overflow-visible">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1B9387]"></div>
              <div className="flex flex-col 2xl:flex-row justify-between gap-12">
                <div className="flex-1 max-w-sm space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                    <Info className="w-5 h-5 text-gray-400" />
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
                      VAT Breakdown
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between font-medium text-gray-500">
                      <span>Vatable Sales</span>
                      <span className="font-mono tabular-nums text-right w-28">
                        ₱ {vatableSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-700">
                      <span>VAT Amount (12%)</span>
                      <span className="font-mono tabular-nums text-right w-28 text-[#1B9387]">
                        ₱ {vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium text-gray-500 pt-2.5 border-t border-gray-50">
                      <span>VAT Exempt Sales</span>
                      <span className="font-mono tabular-nums text-right w-28">
                        ₱ {vatExemptSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium text-gray-500">
                      <span>Zero Rated Sales</span>
                      <span className="font-mono tabular-nums text-right w-28">₱ 0.00</span>
                    </div>
                  </div>

                  {hasHmoCoveredItem && (
                    <div className="mt-8 p-5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-4 shadow-inner animate-in fade-in slide-in-from-bottom-2">
                      <div className="relative z-50">
                        <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
                          Billed To (A/R Guarantor)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsPayeeDropdownOpen(!isPayeeDropdownOpen)
                            if (isPayeeDropdownOpen) setPayeeSearchQuery('')
                          }}
                          className={`w-full bg-white border rounded-lg px-4 py-3 text-sm transition cursor-pointer flex justify-between items-center shadow-sm text-left ${isPayeeDropdownOpen ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-indigo-200 hover:border-indigo-300'}`}
                        >
                          <span
                            className={
                              payeeId
                                ? 'text-indigo-900 font-bold truncate'
                                : 'text-indigo-400 font-medium truncate'
                            }
                          >
                            {payeeId ? selectedPayeeName : 'Select Provider / Corporate...'}
                          </span>
                          <Search className="w-4 h-4 text-indigo-400 shrink-0" />
                        </button>
                        {isPayeeDropdownOpen && (
                          <div className="absolute z-[999] left-0 top-full mt-2 w-full min-w-[360px] bg-white border border-indigo-200 rounded-xl shadow-2xl overflow-hidden">
                            <div className="p-3 border-b border-indigo-100 bg-indigo-50">
                              <input
                                type="text"
                                autoFocus
                                placeholder="Search entity..."
                                value={payeeSearchQuery}
                                onChange={(e) => setPayeeSearchQuery(e.target.value)}
                                className="w-full bg-white px-3 py-2 border border-indigo-200 rounded-lg text-sm text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              />
                            </div>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setModalDefaultType('HMO')
                                setIsContactModalOpen(true)
                                closePayeeDropdown()
                              }}
                              className="w-full text-left px-4 py-3 text-xs text-indigo-600 hover:bg-indigo-50 font-bold uppercase tracking-wider border-b border-gray-100 transition cursor-pointer"
                            >
                              + Add New Entity
                            </button>
                            <ul className="max-h-56 overflow-y-auto">
                              {filteredPayees.map((p) => (
                                <li
                                  key={p.id}
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    setPayeeId(p.id)
                                    closePayeeDropdown()
                                  }}
                                  className="px-4 py-3 text-sm text-gray-800 font-bold hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer border-b border-gray-50 last:border-0 transition"
                                >
                                  <div className="flex justify-between items-center gap-3">
                                    <span className="truncate">{p.name}</span>
                                    <span className="shrink-0 px-2 py-1 bg-indigo-50 text-indigo-500 rounded-md text-[9px] font-extrabold uppercase tracking-wider">
                                      {p.type}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      {selectedPayee?.type === 'HMO' && (
                        <div>
                          <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
                            LOA / Auth Number
                          </label>
                          <input
                            type="text"
                            placeholder="Required for HMO"
                            className="w-full px-4 py-3 bg-white border border-indigo-200 text-indigo-900 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 shadow-sm"
                            value={loaNumber}
                            onChange={(e) => setLoaNumber(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-[1.5] flex flex-col space-y-8">
                  <div className="flex flex-col items-end border-b border-gray-200 pb-6">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                      Gross Total
                    </span>
                    <span className="text-5xl font-black text-gray-800 tracking-tighter font-mono tabular-nums leading-none">
                      <span className="text-3xl text-gray-400 mr-2 font-sans">₱</span>
                      {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {hasHmoCoveredItem && (
                    <div className="flex flex-col items-end bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                      <span className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">
                        A/R Covered Amount
                      </span>
                      <span className="text-3xl font-black text-indigo-600 tracking-tighter font-mono tabular-nums leading-none">
                        <span className="text-xl text-indigo-400 mr-2 font-sans">- ₱</span>
                        {hmoShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {patientShare > 0 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
                        <span className="text-sm font-black text-[#1B9387] uppercase tracking-wider block">
                          Patient Due
                        </span>
                        <span className="text-3xl font-black text-[#1B9387] font-mono tracking-tighter">
                          ₱ {patientShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'CASH', label: 'Cash', icon: Wallet },
                          { id: 'GCASH', label: 'E-Wallet', icon: Smartphone },
                          {
                            id: 'SPLIT',
                            label: 'Split (Cash+E-Wallet)',
                            icon: SplitSquareHorizontal
                          }
                        ].map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(method.id as any)
                              setAmountTendered('')
                              setReferenceNo('')
                              setGcashAmount('')
                            }}
                            className={`cursor-pointer flex flex-col items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold transition-all border ${paymentMethod === method.id ? 'bg-[#E9FAFA] border-[#1B9387] text-[#1B9387] shadow-sm ring-1 ring-[#1B9387]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'}`}
                          >
                            <method.icon
                              className={`w-6 h-6 ${paymentMethod === method.id ? 'text-[#1B9387]' : 'text-gray-400'}`}
                            />
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="min-h-[100px]">
                    {paymentMethod === 'CASH' && patientShare > 0 && (
                      <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-2">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            Amount Tendered
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">
                              ₱
                            </span>
                            <input
                              type="number"
                              autoFocus
                              placeholder="0.00"
                              className={`w-full pl-10 pr-4 py-4 bg-white border rounded-xl text-xl font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 shadow-sm transition-colors ${amountTendered !== '' && tendered < patientShare ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-[#1B9387] focus:ring-[#E9FAFA]'}`}
                              value={amountTendered === 0 ? '' : amountTendered}
                              onChange={(e) => setAmountTendered(parseFloat(e.target.value) || '')}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            Change
                          </label>
                          <div className="w-full py-4 px-5 bg-gray-50 border border-gray-200 rounded-xl text-xl font-mono font-black text-right">
                            <span className={change > 0 ? 'text-[#1B9387]' : 'text-gray-400'}>
                              ₱{' '}
                              {change > 0
                                ? change.toLocaleString('en-US', { minimumFractionDigits: 2 })
                                : '0.00'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'GCASH' && patientShare > 0 && (
                      <div className="animate-in fade-in slide-in-from-bottom-2">
                        <label className="block text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">
                          E-Wallet Reference No.
                        </label>
                        <input
                          type="text"
                          autoFocus
                          placeholder="e.g., 100012345678"
                          className="w-full px-5 py-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-sm"
                          value={referenceNo}
                          onChange={(e) => setReferenceNo(e.target.value)}
                        />
                      </div>
                    )}

                    {paymentMethod === 'SPLIT' && patientShare > 0 && (
                      <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="col-span-2 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                                E-Wallet Amount
                              </label>
                              <input
                                type="number"
                                autoFocus
                                placeholder="0.00"
                                className="w-full bg-white border border-blue-200 rounded-lg p-2.5 text-sm font-mono font-bold text-blue-900 focus:outline-none focus:border-blue-400"
                                value={gcashAmount === 0 ? '' : gcashAmount}
                                onChange={(e) => setGcashAmount(parseFloat(e.target.value) || '')}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                                E-Wallet Ref No.
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 1002939"
                                className="w-full bg-white border border-blue-200 rounded-lg p-2.5 text-sm font-mono font-bold text-blue-900 focus:outline-none focus:border-blue-400"
                                value={referenceNo}
                                onChange={(e) => setReferenceNo(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            Cash Tendered
                          </label>
                          <input
                            type="number"
                            placeholder={`For remaining ₱${cashNeeded.toLocaleString()}`}
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-base font-mono font-bold text-gray-900 focus:outline-none focus:border-[#1B9387] shadow-sm"
                            value={amountTendered === 0 ? '' : amountTendered}
                            onChange={(e) => setAmountTendered(parseFloat(e.target.value) || '')}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            Change
                          </label>
                          <div className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-base font-mono font-black text-right">
                            <span className={change > 0 ? 'text-[#1B9387]' : 'text-gray-400'}>
                              ₱{' '}
                              {change > 0
                                ? change.toLocaleString('en-US', { minimumFractionDigits: 2 })
                                : '0.00'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !isPaid ||
                      items.length === 0 ||
                      (patientShare > 0 && !paymentMethod)
                    }
                    className={`cursor-pointer w-full py-5 rounded-xl flex items-center justify-center gap-3 text-lg font-black tracking-widest uppercase transition-all shadow-lg ${(!paymentMethod && patientShare > 0) || loading || !isPaid || items.length === 0 ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none' : 'bg-[#1B9387] text-white hover:bg-[#15796f] shadow-[#1B9387]/30 hover:shadow-xl hover:-translate-y-0.5'}`}
                  >
                    {loading ? (
                      'Processing...'
                    ) : patientShare > 0 && !paymentMethod ? (
                      'SELECT PAYMENT METHOD'
                    ) : editingTransactionId ? (
                      'UPDATE TRANSACTION'
                    ) : patientShare === 0 ? (
                      'PROCESS A/R BILLING'
                    ) : (
                      <>
                        <CheckCircle className="w-6 h-6 mr-1" /> COMPLETE TRANSACTION
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* CONFIRMATION MODAL */}
        {isConfirmOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-[#B0DCDA] rounded-3xl shadow-2xl p-10 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-extrabold text-gray-800 mb-6 border-b border-gray-100 pb-4 flex items-center gap-3">
                <CheckCircle className="w-7 h-7 text-[#1B9387]" /> Confirm Payment
              </h3>
              <div className="space-y-6 text-base">
                <div className="grid grid-cols-2 gap-y-4 pb-5 border-b border-gray-100">
                  <span className="text-gray-500 font-bold uppercase text-xs tracking-wider">
                    Patient:
                  </span>
                  <span className="text-gray-900 font-bold text-right truncate">
                    {selectedPatientName}
                  </span>
                  {patientShare > 0 && (
                    <>
                      <span className="text-gray-500 font-bold uppercase text-xs tracking-wider">
                        Pt. Payment Method:
                      </span>
                      <span className="font-bold text-right uppercase text-[#1B9387]">
                        {paymentMethod}
                      </span>
                    </>
                  )}
                  {hasHmoCoveredItem && (
                    <>
                      <span className="text-indigo-500 font-bold uppercase text-xs tracking-wider mt-3">
                        Billed To (A/R):
                      </span>
                      <span className="text-indigo-700 font-bold text-right mt-3 truncate">
                        {selectedPayeeName}
                      </span>
                      {selectedPayee?.type === 'HMO' && (
                        <>
                          <span className="text-gray-500 font-bold uppercase text-xs tracking-wider">
                            LOA Number:
                          </span>
                          <span className="text-indigo-700 font-mono font-bold text-right">
                            {loaNumber}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-3">
                  <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                    Billed Items
                  </span>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 max-h-48 overflow-y-auto space-y-3 shadow-inner">
                    {items.map((item, index) => {
                      const rowCover = Number(item.hmoCoverage) || 0
                      return (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span
                            className={`font-medium truncate max-w-[280px] ${rowCover > 0 ? 'text-indigo-600' : 'text-gray-700'}`}
                          >
                            {rowCover > 0 && (
                              <span className="font-bold mr-1">
                                [A/R: ₱{rowCover.toLocaleString()}]
                              </span>
                            )}
                            {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.description || 'Medical Service'}
                          </span>
                          <span className="text-gray-900 font-mono font-bold">
                            ₱{((Number(item.quantity) || 1) * item.price).toFixed(2)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="bg-[#E9FAFA] border border-[#1B9387]/30 rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-center text-[#1B9387] font-extrabold mb-1">
                    <span className="uppercase tracking-wider text-sm">Total Invoice:</span>
                    <span className="text-2xl font-mono tracking-tighter">
                      ₱ {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {hasHmoCoveredItem && (
                    <div className="flex justify-between items-center text-indigo-600 font-bold text-xs mb-1">
                      <span className="uppercase tracking-wider">A/R Coverage:</span>
                      <span className="font-mono">
                        - ₱ {hmoShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-gray-800 font-black border-t border-[#1B9387]/20 pt-2 mt-2">
                    <span className="uppercase tracking-wider text-xs">Patient Due:</span>
                    <span className="text-xl font-mono">
                      ₱ {patientShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-4 mt-10 pt-5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(false)}
                  className="px-6 py-4 text-base font-bold text-gray-500 hover:text-gray-800 transition bg-white border border-gray-200 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={loading}
                  className="px-8 py-4 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-xl text-base font-black transition shadow-md disabled:opacity-50 cursor-pointer uppercase tracking-wider"
                >
                  {loading ? 'Saving...' : 'Confirm & Save'}
                </button>
              </div>
            </div>
          </div>
        )}
        <NewContactModal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          onSaveSuccess={onContactSaved}
          defaultType={modalDefaultType}
        />
        {isSummaryOpen && (
          <EndOfDaySummaryView
            isOpen={isSummaryOpen}
            onClose={() => setIsSummaryOpen(false)}
            onEditTransaction={handleEditTransaction}
            userId={userId}
          />
        )}

        {isDisbursementModalOpen && (
          <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[92vh] overflow-y-auto border border-gray-200 p-2 relative">
              <CashierDisbursementView
                userId={userId}
                onClose={() => setIsDisbursementModalOpen(false)}
              />
            </div>
          </div>
        )}

        <PatientHistoryModal
          isOpen={isPatientHistoryModalOpen}
          onClose={() => setIsPatientHistoryModalOpen(false)}
          patientId={patientId}
          patientName={selectedPatientName}
          onEditTransaction={(row) => {
            setIsPatientHistoryModalOpen(false)
            handleEditTransaction(row)
          }}
        />

        <LabTestsModal
          isOpen={isLabModalOpen}
          onClose={() => setIsLabModalOpen(false)}
          availableTests={labTests}
          onAddTests={handleAddLabTests}
          defaultHmoCovered={Boolean(payeeId && payeeId !== patientId)}
        />

        {/* ATTACHMENT PREVIEW MODAL */}
        {previewAttachment && (
          <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-[#FBF8F8]">
                <div className="flex items-center gap-2 overflow-hidden">
                  <ImageIcon className="w-5 h-5 text-[#1B9387] shrink-0" />
                  <span className="font-bold text-gray-800 text-sm truncate">
                    {previewAttachment.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = previewAttachment.data
                      link.download = previewAttachment.name || 'attachment'
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                    title="Download attachment to PC"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="p-4 flex items-center justify-center overflow-auto bg-gray-900/5 flex-1 min-h-[300px]">
                {previewAttachment.type.includes('image') ? (
                  <img
                    src={previewAttachment.data}
                    alt={previewAttachment.name}
                    className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
                  />
                ) : (
                  <iframe
                    src={previewAttachment.data}
                    title={previewAttachment.name}
                    className="w-full h-[70vh] border-0 rounded-lg bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
