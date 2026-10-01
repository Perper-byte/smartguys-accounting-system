// src/renderer/src/components/ContactDirectoryView.tsx
import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { NewContactModal } from './NewContactModal'
import * as XLSX from 'xlsx'
import {
  Search,
  Download,
  Upload,
  Plus,
  User,
  Stethoscope,
  Building2,
  Building,
  Package,
  Key,
  Eye,
  Edit2,
  Receipt,
  Archive,
  CheckCircle,
  Users,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react'

export function ContactDirectoryView({
  onNavigate
}: {
  onNavigate?: (tab: string, data?: any) => void
}) {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // TOAST STATE
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const [hmoList, setHmoList] = useState<any[]>([])
  const [editingContact, setEditingContact] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'PATIENT',
    email: '',
    phone: '',
    tin: '',
    address: '',
    hmo: '',
    hmoCardNo: '',
    hmoExpiryDate: ''
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<
    'ALL' | 'PATIENT' | 'DOCTOR' | 'HMO_CORP' | 'SUPPLIER' | 'OTHER' | 'ARCHIVED'
  >('ALL')
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewContactMenuOpen, setIsNewContactMenuOpen] = useState(false)
  const [newContactType, setNewContactType] = useState('PATIENT')

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const data = await api.getContactsWithBalances()
      const enrichedData = (data || []).map((c: any) => ({
        ...c,
        status: c.is_active === false ? 'ARCHIVED' : c.status || 'ACTIVE'
      }))
      setContacts(enrichedData)
    } catch (error) {
      console.error('Failed to fetch contacts', error)
      showToast('Failed to load contacts from the database.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchHMOs = async () => {
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api && api.getPayees) {
        const data = await api.getPayees('HMO,CORPORATE')
        setHmoList(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch HMO list', error)
    }
  }

  useEffect(() => {
    fetchContacts()
    fetchHMOs()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterType])

  const counts = useMemo(() => {
    const activeContacts = contacts.filter((c) => c.status !== 'ARCHIVED')
    const archivedContacts = contacts.filter((c) => c.status === 'ARCHIVED')

    return {
      ALL: activeContacts.length,
      PATIENT: activeContacts.filter((c) => c.type === 'PATIENT').length,
      DOCTOR: activeContacts.filter((c) => c.type === 'DOCTOR').length,
      HMO_CORP: activeContacts.filter((c) => c.type === 'HMO' || c.type === 'CORPORATE').length,
      SUPPLIER: activeContacts.filter((c) => c.type === 'SUPPLIER').length,
      OTHER: activeContacts.filter(
        (c) => !['PATIENT', 'DOCTOR', 'HMO', 'CORPORATE', 'SUPPLIER'].includes(c.type)
      ).length,
      ARCHIVED: archivedContacts.length
    }
  }, [contacts])

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.tin && c.tin.includes(searchQuery)) ||
        ((c.hmo_affiliation || c.hmoAffiliation) &&
          (c.hmo_affiliation || c.hmoAffiliation).toLowerCase().includes(searchQuery.toLowerCase()))

      if (filterType === 'ARCHIVED') {
        return c.status === 'ARCHIVED' && matchesSearch
      }
      if (c.status === 'ARCHIVED') return false

      const matchesType =
        filterType === 'ALL' ||
        (filterType === 'HMO_CORP'
          ? c.type === 'HMO' || c.type === 'CORPORATE'
          : filterType === 'OTHER'
            ? !['PATIENT', 'DOCTOR', 'HMO', 'CORPORATE', 'SUPPLIER'].includes(c.type)
            : c.type === filterType)

      return matchesSearch && matchesType
    })
  }, [contacts, searchQuery, filterType])

  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredContacts.slice(start, start + itemsPerPage)
  }, [filteredContacts, currentPage])

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'SUPPLIER':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'DOCTOR':
        return 'text-rose-600 bg-rose-50 border-rose-200'
      case 'PATIENT':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'HMO':
      case 'CORPORATE':
        return 'text-[#1B9387] bg-[#E9FAFA] border-[#B0DCDA]'
      case 'LANDLORD':
        return 'text-amber-600 bg-amber-50 border-amber-200'
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  const formatCurrency = (amount: number) => {
    if (!amount || amount === 0) return '—'
    return `₱ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const openNewContactModal = (type: string) => {
    setNewContactType(type)
    setIsNewContactMenuOpen(false)
    setIsModalOpen(true)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.csv'

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      showToast('Reading file, please wait...', 'info')
      setTimeout(async () => {
        try {
          const buffer = await file.arrayBuffer()
          const workbook = XLSX.read(buffer, { type: 'array' })
          if (workbook.SheetNames.length === 0)
            throw new Error('The selected workbook has no worksheets.')

          const contactsSheetName = workbook.SheetNames.find(
            (sheetName) =>
              sheetName.trim().toLowerCase() === 'contacts' ||
              sheetName.trim().toLowerCase() === 'contact directory'
          )
          const selectedSheetName = contactsSheetName || workbook.SheetNames[0]
          const worksheet = workbook.Sheets[selectedSheetName]

          const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '', raw: false })
          if (rows.length === 0) throw new Error('The selected file contains no contacts.')

          const allowedTypes = ['PATIENT', 'DOCTOR', 'HMO', 'CORPORATE', 'SUPPLIER', 'LANDLORD']
          const importedContacts: any[] = []

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const name = String(row['Contact Name'] ?? row.Name ?? row.name ?? '').trim()
            const type = String(row['Entity Type'] ?? row.Type ?? row.type ?? '')
              .trim()
              .toUpperCase()
            const email = String(row['Email Address'] ?? row.Email ?? row.email ?? '').trim()
            const phone = String(row['Phone Number'] ?? row.Phone ?? row.phone ?? '').trim()
            const tin = String(row.TIN ?? row.tin ?? '').trim()
            const address = String(row.Address ?? row.address ?? '').trim()
            const excelRow = i + 2

            if (!name && !type && !email && !phone && !tin && !address) continue
            if (!name) throw new Error(`Row ${excelRow}: Name is required.`)
            if (!type) throw new Error(`Row ${excelRow}: Type is required.`)

            if (!allowedTypes.includes(type)) {
              throw new Error(
                `Row ${excelRow}: Invalid Type "${type}".\nAllowed values:\nPATIENT\nDOCTOR\nHMO\nCORPORATE\nSUPPLIER\nLANDLORD`
              )
            }

            importedContacts.push({ name, type, email, phone, tin, address })
          }

          if (importedContacts.length === 0) throw new Error('No valid contact rows were found.')

          const api = (window as any).api || (window as any).electronAPI
          if (!api || !api.importPayees) throw new Error('Import API is unavailable.')

          const result = await api.importPayees(importedContacts)
          if (!result || result.success === false)
            throw new Error(result?.error || 'Failed to import contacts.')

          const importedCount = Number(result.count || 0)
          const skippedCount = importedContacts.length - importedCount

          await fetchContacts()

          if (importedCount === 0 && skippedCount > 0) {
            showToast(
              `No new contacts were imported.\nAll ${skippedCount} contact(s) already exist in the system.`,
              'info'
            )
          } else if (skippedCount > 0) {
            showToast(
              `Import completed successfully.\nNew contacts: ${importedCount}\nDuplicates skipped: ${skippedCount}`,
              'success'
            )
          } else {
            showToast(
              `Import completed successfully.\n${importedCount} contact(s) imported.`,
              'success'
            )
          }
        } catch (error: any) {
          console.error('Contact Import Error:', error)
          showToast(error?.message || 'Failed to import contacts.', 'error')
        }
      }, 150)

      input.value = ''
    }
    input.click()
  }

  const handleExport = () => {
    if (contacts.length === 0) {
      showToast('There are no contacts to export.', 'error')
      return
    }

    showToast('Preparing Excel file...', 'info')

    setTimeout(async () => {
      try {
        const exportData = contacts.map((c: any) => ({
          'Contact Name': c.name || '',
          'Entity Type': c.type || '',
          'Email Address': c.email || '',
          'Phone Number': c.phone ? String(c.phone) : '',
          TIN: c.tin ? String(c.tin) : '',
          Address: c.address || '',
          Status: c.status || 'ACTIVE',
          'Payable (Clinic Owes)': Number(c.youOwe || 0),
          'Receivable (They Owe)': Number(c.theyOwe || 0)
        }))

        const worksheet = XLSX.utils.json_to_sheet(exportData)

        worksheet['!cols'] = [
          { wch: 35 },
          { wch: 15 },
          { wch: 30 },
          { wch: 20 },
          { wch: 20 },
          { wch: 45 },
          { wch: 15 },
          { wch: 22 },
          { wch: 22 }
        ]

        worksheet['!autofilter'] = { ref: `A1:I${exportData.length + 1}` }

        for (let row = 2; row <= exportData.length + 1; row++) {
          const payableCell = worksheet[`H${row}`]
          if (payableCell) {
            payableCell.t = 'n'
            payableCell.z = '"₱"#,##0.00'
          }
          const receivableCell = worksheet[`I${row}`]
          if (receivableCell) {
            receivableCell.t = 'n'
            receivableCell.z = '"₱"#,##0.00'
          }
        }

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Contact Directory')
        const today = new Date().toISOString().slice(0, 10)
        const filename = `SmartGuys_Contacts_${today}.xlsx`

        if ('showSaveFilePicker' in window) {
          try {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: filename,
              types: [
                {
                  description: 'Excel Workbook',
                  accept: {
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                  }
                }
              ]
            })
            const writable = await handle.createWritable()
            const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
            await writable.write(buffer)
            await writable.close()

            showToast(`Exported successfully!\nSaved to: ${handle.name}`, 'success')
          } catch (err: any) {
            if (err.name !== 'AbortError') {
              console.error('File Save Error:', err)
              showToast('Failed to save the Excel file.', 'error')
            } else setToast(null)
          }
        } else {
          XLSX.writeFile(workbook, filename)
          setTimeout(() => {
            showToast(
              `Export initiated.\nSaved as: ${filename}\n(Please check your Downloads folder)`,
              'success'
            )
          }, 500)
        }
      } catch (error) {
        console.error('Contact Export Error:', error)
        showToast('Failed to generate Excel export.', 'error')
      }
    }, 150)
  }

  // --- ACTION MENU HANDLERS ---
  const handleViewDetails = (id: string) => {
    setExpandedContactId(expandedContactId === id ? null : id)
    setActionMenuId(null)
  }

  // 🔥 RESTORED THIS TO POINT TO 'history' INSTEAD OF 'journal-entry'
  const handleTransactions = (contact: any) => {
    setActionMenuId(null)
    if (onNavigate) {
      // 🔥 Send multiple possible variations so CashierHistoryView catches it regardless of what state it uses
      onNavigate('history', {
        searchQuery: contact.name,
        searchTerm: contact.name,
        patientName: contact.name
      })
    }
  }

  const handleArchive = async (contact: any) => {
    setActionMenuId(null)
    const confirmed = window.confirm(
      `Are you sure you want to archive ${contact.name}?\n\nThey will be hidden from the active contacts list, but their historical transactions will remain intact.`
    )
    if (confirmed) {
      try {
        const api = (window as any).api || (window as any).electronAPI
        const result = await api.archivePayee(contact.id)
        if (result.success) {
          fetchContacts()
          showToast(`${contact.name} was successfully archived.`, 'success')
        } else showToast('Failed to archive contact: ' + result.error, 'error')
      } catch (err) {
        console.error('Archive error', err)
        showToast('System error while archiving contact.', 'error')
      }
    }
  }

  const handleRestore = async (contact: any) => {
    setActionMenuId(null)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const result = await api.restorePayee(contact.id)
      if (result.success) {
        fetchContacts()
        showToast(`${contact.name} was successfully restored.`, 'success')
      } else showToast('Failed to restore contact: ' + result.error, 'error')
    } catch (err) {
      console.error('Restore error', err)
      showToast('System error while restoring contact.', 'error')
    }
  }

  const openEditContact = (contact: any) => {
    setActionMenuId(null)
    setEditingContact(contact)

    try {
      let safeExpiryDate = ''
      const rawExpiry = contact.hmo_expiry_date || contact.hmoExpiryDate

      if (rawExpiry) {
        const d = new Date(rawExpiry)
        if (!isNaN(d.getTime())) {
          safeExpiryDate = d.toISOString().split('T')[0]
        }
      }

      setEditForm({
        name: contact.name || '',
        type: contact.type || 'PATIENT',
        email: contact.email || '',
        phone: contact.phone_number || contact.phone || '',
        tin: contact.tin || '',
        address: contact.address || '',
        hmo: contact.hmo_affiliation || contact.hmoAffiliation || '',
        hmoCardNo: contact.hmo_card_no || contact.hmoCardNo || '',
        hmoExpiryDate: safeExpiryDate
      })
    } catch (err) {
      console.error('Failed to parse contact for editing:', err)
      setEditForm({
        name: contact.name || '',
        type: contact.type || 'PATIENT',
        email: contact.email || '',
        phone: contact.phone_number || contact.phone || '',
        tin: contact.tin || '',
        address: contact.address || '',
        hmo: '',
        hmoCardNo: '',
        hmoExpiryDate: ''
      })
    }
  }

  const submitEditContact = async () => {
    if (!editingContact) return
    try {
      const api = (window as any).api || (window as any).electronAPI
      const updateFn = api.updatePayee || api.updateContact || api.editPayee || api.editContact

      if (!updateFn) {
        showToast('Update feature is missing in backend API!', 'error')
        return
      }

      let parsedDate: string | null = null
      if (editForm.type === 'PATIENT' && editForm.hmoExpiryDate) {
        try {
          const d = new Date(editForm.hmoExpiryDate)
          if (!isNaN(d.getTime())) {
            parsedDate = d.toISOString()
          }
        } catch (e) {}
      }

      const safeUpdatePayload = {
        name: editForm.name,
        type: editForm.type,
        tin: editForm.tin || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        phone_number: editForm.phone || null,
        address: editForm.address || null,
        hmo: editForm.type === 'PATIENT' ? editForm.hmo || null : null, // 🔥 Missing key the backend expects!
        hmo_affiliation: editForm.type === 'PATIENT' ? editForm.hmo || null : null,
        hmo_card_no: editForm.type === 'PATIENT' ? editForm.hmoCardNo || null : null,
        hmo_expiry_date: parsedDate,
        hmoAffiliation: editForm.type === 'PATIENT' ? editForm.hmo || null : null,
        hmoCardNo: editForm.type === 'PATIENT' ? editForm.hmoCardNo || null : null,
        hmoExpiryDate: parsedDate
      }

      const result = await updateFn(editingContact.id, safeUpdatePayload)

      if (result && !result.error && result.success !== false) {
        fetchContacts()
        setEditingContact(null)
        showToast(`${editForm.name} updated successfully.`, 'success')
      } else {
        showToast('Failed to update: ' + (result?.error || 'Unknown error'), 'error')
      }
    } catch (error: any) {
      console.error('Failed to update contact:', error)
      showToast(`System error: ${error.message || 'Failed to update contact.'}`, 'error')
    }
  }

  return (
    <div className="w-full h-full flex flex-col p-4 lg:p-6 bg-gray-50/50 min-h-0 relative animate-in fade-in duration-300">
      {toast &&
        createPortal(
          <div
            className={`fixed bottom-8 right-8 px-5 py-4 rounded-xl shadow-2xl text-white z-[999999] flex items-start space-x-3 transition-all duration-300 animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-[#1B9387]' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}
            style={{ maxWidth: '420px' }}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'error' && <AlertTriangle size={20} />}
              {toast.type === 'success' && <CheckCircle2 size={20} />}
              {toast.type === 'info' && <Info size={20} />}
            </div>
            <span className="whitespace-pre-line text-sm font-semibold leading-relaxed">
              {toast.message}
            </span>
          </div>,
          document.body
        )}

      {(actionMenuId || isNewContactMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setActionMenuId(null)
            setIsNewContactMenuOpen(false)
          }}
        ></div>
      )}

      <div className="w-full h-full bg-white border border-[#B0DCDA] rounded-xl shadow-sm flex flex-col overflow-hidden min-h-0">
        <div className="flex flex-col gap-6 p-6 pb-4 border-b border-[#B0DCDA] shrink-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide flex items-center gap-2">
              <Users size={24} className="text-[#1B9387]" /> Contacts & Entities
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Manage patients, doctors, HMOs, and outstanding balances.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: 'All Contacts', type: 'ALL', count: counts.ALL },
              { label: 'Patients', type: 'PATIENT', count: counts.PATIENT },
              { label: 'Doctors', type: 'DOCTOR', count: counts.DOCTOR },
              { label: 'HMOs / Corp', type: 'HMO_CORP', count: counts.HMO_CORP },
              { label: 'Suppliers', type: 'SUPPLIER', count: counts.SUPPLIER },
              { label: 'Others', type: 'OTHER', count: counts.OTHER },
              { label: 'Archived', type: 'ARCHIVED', count: counts.ARCHIVED }
            ].map((card) => (
              <div
                key={card.type}
                onClick={() => setFilterType(card.type as any)}
                className={`p-3 rounded-lg border cursor-pointer transition shadow-sm text-center flex flex-col justify-center ${
                  filterType === card.type
                    ? card.type === 'ARCHIVED'
                      ? 'bg-gray-600 border-gray-600 text-white'
                      : 'bg-[#1B9387] border-[#1B9387] text-white'
                    : 'bg-[#FBF8F8] border-[#B0DCDA] hover:bg-[#E9FAFA] text-gray-600'
                }`}
              >
                <p
                  className={`text-[10px] font-extrabold uppercase tracking-wider mb-1 ${filterType === card.type ? (card.type === 'ARCHIVED' ? 'text-gray-200' : 'text-[#E9FAFA]') : 'text-gray-500'}`}
                >
                  {card.label}
                </p>
                <p className="text-xl font-black">{card.count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 p-4 border-b border-[#B0DCDA] shrink-0 bg-[#FBF8F8] relative z-50">
          <div className="relative w-full lg:w-96">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, TIN, HMO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#B0DCDA] rounded-md pl-9 pr-4 py-2 h-10 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 shadow-sm"
            />
          </div>

          <div className="flex items-center space-x-3 w-full lg:w-auto">
            <button
              onClick={handleImport}
              className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] h-10 px-4 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition flex items-center space-x-2 cursor-pointer"
            >
              <Download size={16} /> <span>Import</span>
            </button>
            <button
              onClick={handleExport}
              className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] h-10 px-4 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition flex items-center space-x-2 cursor-pointer"
            >
              <Upload size={16} /> <span>Export</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setIsNewContactMenuOpen(!isNewContactMenuOpen)}
                className="bg-[#1B9387] hover:bg-[#157A70] border border-transparent text-white h-10 px-4 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition flex items-center space-x-2 cursor-pointer"
              >
                <Plus size={16} /> <span>New Contact ▾</span>
              </button>

              {isNewContactMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-[#B0DCDA] rounded-lg shadow-xl overflow-y-auto max-h-[300px] py-1 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                    What Type?
                  </div>
                  <button
                    onClick={() => openNewContactModal('PATIENT')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition cursor-pointer"
                  >
                    <User size={16} /> Patient
                  </button>
                  <button
                    onClick={() => openNewContactModal('DOCTOR')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition cursor-pointer"
                  >
                    <Stethoscope size={16} /> Doctor
                  </button>
                  <button
                    onClick={() => openNewContactModal('HMO')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition cursor-pointer"
                  >
                    <Building2 size={16} /> HMO
                  </button>
                  <button
                    onClick={() => openNewContactModal('CORPORATE')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition cursor-pointer"
                  >
                    <Building size={16} /> Corporate
                  </button>
                  <button
                    onClick={() => openNewContactModal('SUPPLIER')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition cursor-pointer"
                  >
                    <Package size={16} /> Supplier
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={() => openNewContactModal('LANDLORD')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition cursor-pointer"
                  >
                    <Key size={16} /> Landlord
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                <th className="p-4 pl-6 border-b border-gray-200">Contact</th>
                <th className="p-4 border-b border-gray-200">Type</th>
                <th className="p-4 border-b border-gray-200">Phone / Email</th>
                <th className="p-4 border-b border-gray-200 text-center">Status</th>
                <th className="p-4 border-b border-gray-200 text-right text-orange-500">Payable</th>
                <th className="p-4 border-b border-gray-200 text-right text-[#1B9387]">
                  Receivable
                </th>
                <th className="p-4 border-b border-gray-200 w-12 text-center">⋮</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B9387] mx-auto"></div>
                  </td>
                </tr>
              ) : paginatedContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-gray-400">
                    <Search size={48} className="mx-auto mb-4 opacity-30 text-[#1B9387]" />
                    <span className="italic font-medium text-sm">
                      No contacts match your filters.
                    </span>
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((c, index) => {
                  const isNearBottom =
                    index >= paginatedContacts.length - 2 && paginatedContacts.length > 2

                  return (
                    <React.Fragment key={c.id}>
                      <tr
                        onClick={() =>
                          setExpandedContactId(expandedContactId === c.id ? null : c.id)
                        }
                        className={`cursor-pointer transition-colors group ${expandedContactId === c.id ? 'bg-[#E9FAFA]' : 'hover:bg-gray-50 even:bg-gray-50/40'}`}
                      >
                        <td className="p-4 flex items-center space-x-4 pl-6">
                          <div className="h-9 w-9 rounded-full bg-white text-[#1B9387] flex items-center justify-center font-extrabold text-sm border border-[#B0DCDA] shadow-sm shrink-0">
                            {getInitials(c.name)}
                          </div>
                          <div className="flex flex-col">
                            <span
                              className="font-extrabold text-gray-800 text-base group-hover:text-[#1B9387] transition truncate max-w-[150px] sm:max-w-[250px] xl:max-w-[400px]"
                              title={c.name}
                            >
                              {c.name}
                            </span>
                            {c.type === 'PATIENT' && (c.hmo_affiliation || c.hmoAffiliation) && (
                              <span
                                className="text-[10px] font-bold text-[#1B9387] mt-0.5 truncate max-w-[150px] sm:max-w-[250px] xl:max-w-[400px]"
                                title={`${c.hmo_affiliation || c.hmoAffiliation} ${c.hmo_card_no || c.hmoCardNo ? `• #${c.hmo_card_no || c.hmoCardNo}` : ''}`}
                              >
                                {c.hmo_affiliation || c.hmoAffiliation}{' '}
                                {c.hmo_card_no || c.hmoCardNo
                                  ? `• #${c.hmo_card_no || c.hmoCardNo}`
                                  : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border shadow-sm whitespace-nowrap ${getTypeStyle(c.type)}`}
                          >
                            {c.type}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-gray-500 font-medium">
                          {c.email ? (
                            c.email
                          ) : c.phone || c.phone_number ? (
                            c.phone || c.phone_number
                          ) : (
                            <span className="italic text-gray-400">Missing info</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-orange-500 tabular-nums">
                          {formatCurrency(c.youOwe)}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-[#1B9387] tabular-nums">
                          {formatCurrency(c.theyOwe)}
                        </td>

                        <td
                          className={`p-4 text-center relative ${actionMenuId === c.id ? 'z-50' : 'z-10'}`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setActionMenuId(actionMenuId === c.id ? null : c.id)
                            }}
                            className="text-gray-400 hover:text-[#1B9387] p-1 rounded hover:bg-[#E9FAFA] transition cursor-pointer"
                          >
                            <MoreVertical size={20} />
                          </button>

                          {actionMenuId === c.id && (
                            <div
                              className={`absolute right-8 w-44 bg-white border border-[#B0DCDA] rounded-md shadow-2xl overflow-hidden py-1 text-left z-[9999] animate-in fade-in zoom-in-95 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewDetails(c.id)
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer"
                              >
                                <Eye size={16} /> View Details
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditContact(c)
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer"
                              >
                                <Edit2 size={16} /> Edit Contact
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTransactions(c)
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer"
                              >
                                <Receipt size={16} /> Transactions
                              </button>
                              <div className="border-t border-gray-100 my-1"></div>
                              {c.status === 'ACTIVE' ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleArchive(c)
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 cursor-pointer"
                                >
                                  <Archive size={16} /> Archive
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRestore(c)
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-500 hover:bg-emerald-50 cursor-pointer"
                                >
                                  <CheckCircle size={16} /> Restore
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>

                      {expandedContactId === c.id && (
                        <tr className="bg-[#FBF8F8] border-b border-[#B0DCDA] shadow-inner">
                          <td colSpan={7} className="p-6 border-l-4 border-l-[#1B9387]">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                              <div className="md:col-span-2">
                                <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">
                                  Contact Information
                                </p>
                                <div className="space-y-1.5 mt-2">
                                  <p className="text-sm text-gray-800 font-medium">
                                    <span className="text-gray-400 mr-2 inline-block w-16 font-bold">
                                      Email:
                                    </span>{' '}
                                    {c.email || (
                                      <span className="italic text-gray-400 font-normal">
                                        Missing info
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-sm text-gray-800 font-medium">
                                    <span className="text-gray-400 mr-2 inline-block w-16 font-bold">
                                      Phone:
                                    </span>{' '}
                                    {c.phone || c.phone_number || (
                                      <span className="italic text-gray-400 font-normal">
                                        Missing info
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-sm text-gray-800 font-medium">
                                    <span className="text-gray-400 mr-2 inline-block w-16 font-bold">
                                      TIN:
                                    </span>{' '}
                                    <span className="font-mono font-bold">
                                      {c.tin || (
                                        <span className="italic text-gray-400 font-sans font-normal">
                                          Not provided
                                        </span>
                                      )}
                                    </span>
                                  </p>
                                  <p className="text-sm text-gray-800 font-medium">
                                    <span className="text-gray-400 mr-2 inline-block w-16 font-bold">
                                      Address:
                                    </span>{' '}
                                    {c.address || (
                                      <span className="italic text-gray-400 font-normal">
                                        Not provided
                                      </span>
                                    )}
                                  </p>
                                </div>

                                {c.type === 'PATIENT' && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <p className="text-[10px] text-[#1B9387] font-extrabold uppercase tracking-wider mb-2">
                                      HMO / Corporate Guarantor
                                    </p>
                                    {c.hmo_affiliation || c.hmoAffiliation ? (
                                      <div className="space-y-1.5">
                                        <p className="text-sm text-gray-800 font-medium">
                                          <span className="text-gray-400 mr-2 inline-block w-24 font-bold">
                                            Provider:
                                          </span>{' '}
                                          <span className="font-bold">
                                            {c.hmo_affiliation || c.hmoAffiliation}
                                          </span>
                                        </p>
                                        <p className="text-sm text-gray-800 font-medium">
                                          <span className="text-gray-400 mr-2 inline-block w-24 font-bold">
                                            Card/Policy:
                                          </span>{' '}
                                          <span className="font-mono">
                                            {c.hmo_card_no || c.hmoCardNo || 'N/A'}
                                          </span>
                                        </p>
                                        {(c.hmo_expiry_date || c.hmoExpiryDate) && (
                                          <p className="text-sm text-gray-800 font-medium">
                                            <span className="text-gray-400 mr-2 inline-block w-24 font-bold">
                                              Expiry Date:
                                            </span>{' '}
                                            <span
                                              className={`font-mono ${new Date(c.hmo_expiry_date || c.hmoExpiryDate) < new Date() ? 'text-red-500 font-bold' : ''}`}
                                            >
                                              {new Date(
                                                c.hmo_expiry_date || c.hmoExpiryDate
                                              ).toLocaleDateString('en-US', {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                              })}
                                              {new Date(c.hmo_expiry_date || c.hmoExpiryDate) <
                                                new Date() && ' (EXPIRED)'}
                                            </span>
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400 italic">
                                        No HMO / Corporate Guarantor assigned.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm flex flex-col justify-center text-center h-full">
                                <p className="text-[10px] text-orange-500 font-extrabold uppercase tracking-wider mb-1">
                                  Payable (Clinic Owes)
                                </p>
                                <p className="text-2xl font-mono font-black text-orange-500 mt-1">
                                  {formatCurrency(c.youOwe)}
                                </p>
                              </div>
                              <div className="bg-white p-4 rounded-lg border border-[#B0DCDA] shadow-sm flex flex-col justify-center text-center h-full">
                                <p className="text-[10px] text-[#1B9387] font-extrabold uppercase tracking-wider mb-1">
                                  Receivable (They Owe)
                                </p>
                                <p className="text-2xl font-mono font-black text-[#1B9387] mt-1">
                                  {formatCurrency(c.theyOwe)}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredContacts.length > 0 && (
          <div className="p-4 border-t border-[#B0DCDA] bg-[#FBF8F8] flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 shrink-0">
            <div className="mb-4 sm:mb-0">
              Showing{' '}
              <span className="font-bold text-gray-800">
                {(currentPage - 1) * itemsPerPage + 1}–
                {Math.min(currentPage * itemsPerPage, filteredContacts.length)}
              </span>{' '}
              of <span className="font-bold text-gray-800">{filteredContacts.length}</span> contacts
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border rounded-md text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed enabled:bg-white enabled:hover:bg-[#E9FAFA] enabled:text-[#1B9387] enabled:border-[#B0DCDA] cursor-pointer"
              >
                &larr; Prev
              </button>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage * itemsPerPage >= filteredContacts.length}
                className="px-4 py-2 border rounded-md text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed enabled:bg-white enabled:hover:bg-[#E9FAFA] enabled:text-[#1B9387] enabled:border-[#B0DCDA] cursor-pointer"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      <NewContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaveSuccess={(id, name) => {
          fetchContacts()
          showToast(`Successfully created ${name}.`, 'success')
        }}
        defaultType={newContactType}
      />

      {/* FULL EDIT CONTACT MODAL */}
      {editingContact && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-full">
            <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-gray-800">Edit Contact Details</h3>
                <p className="text-xs text-gray-500">Updating {editingContact.name}</p>
              </div>
              <button
                onClick={() => setEditingContact(null)}
                className="text-gray-400 hover:text-red-500 font-bold text-2xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                    Full Name / Company Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                    Entity Type
                  </label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 font-medium cursor-pointer"
                  >
                    <option value="PATIENT">Patient</option>
                    <option value="DOCTOR">Doctor</option>
                    <option value="HMO">HMO</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="SUPPLIER">Supplier</option>
                    <option value="LANDLORD">Landlord</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                    Tax Identification Number (TIN)
                  </label>
                  <input
                    type="text"
                    value={editForm.tin}
                    onChange={(e) => setEditForm({ ...editForm, tin: e.target.value })}
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 font-medium"
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                    Physical Address
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 font-medium"
                  ></textarea>
                </div>
              </div>

              {editForm.type === 'PATIENT' && (
                <div className="mt-4 pt-4 border-t border-[#B0DCDA]">
                  <h4 className="text-[10px] font-extrabold text-[#1B9387] uppercase tracking-wider mb-3">
                    HMO / Insurance Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                        Provider Name
                      </label>
                      <select
                        value={editForm.hmo}
                        onChange={(e) => {
                          setEditForm({ ...editForm, hmo: e.target.value })
                          if (!e.target.value)
                            setEditForm((prev) => ({ ...prev, hmoCardNo: '', hmoExpiryDate: '' }))
                        }}
                        className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 font-medium cursor-pointer"
                      >
                        <option value="">-- No HMO / Private Pay --</option>
                        {hmoList.map((hmo) => (
                          <option key={hmo.id} value={hmo.name}>
                            {hmo.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                        Card / Policy Number
                      </label>
                      <input
                        type="text"
                        value={editForm.hmoCardNo}
                        onChange={(e) => setEditForm({ ...editForm, hmoCardNo: e.target.value })}
                        disabled={!editForm.hmo}
                        className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 font-medium disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={editForm.hmoExpiryDate}
                        onChange={(e) =>
                          setEditForm({ ...editForm, hmoExpiryDate: e.target.value })
                        }
                        disabled={!editForm.hmo}
                        className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 font-medium disabled:opacity-50 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#FBF8F8] flex justify-end space-x-3 border-t border-[#B0DCDA]">
              <button
                onClick={() => setEditingContact(null)}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitEditContact}
                disabled={!editForm.name}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#1B9387] hover:bg-[#157A70] rounded-md transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
