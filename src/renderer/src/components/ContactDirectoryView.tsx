import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { NewContactModal } from './NewContactModal'
import * as XLSX from 'xlsx'

export function ContactDirectoryView({
  onNavigate
}: {
  onNavigate?: (tab: string, data?: any) => void
}) {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 🔥 NEW EDIT CONTACT STATE
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
    'ALL' | 'PATIENT' | 'DOCTOR' | 'HMO_CORP' | 'SUPPLIER'
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
        status: c.status || 'ACTIVE'
      }))

      setContacts(enrichedData)
    } catch (error) {
      console.error('Failed to fetch contacts', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterType])

  const counts = useMemo(
    () => ({
      ALL: contacts.length,
      PATIENT: contacts.filter((c) => c.type === 'PATIENT').length,
      DOCTOR: contacts.filter((c) => c.type === 'DOCTOR').length,
      HMO_CORP: contacts.filter((c) => c.type === 'HMO' || c.type === 'CORPORATE').length,
      SUPPLIER: contacts.filter((c) => c.type === 'SUPPLIER').length
    }),
    [contacts]
  )

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.tin && c.tin.includes(searchQuery)) ||
        (c.hmo_affiliation && c.hmo_affiliation.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesType =
        filterType === 'ALL' ||
        (filterType === 'HMO_CORP'
          ? c.type === 'HMO' || c.type === 'CORPORATE'
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

  // --- IMPORT / EXPORT LOGIC ---
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.csv'

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      try {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })

        if (workbook.SheetNames.length === 0)
          throw new Error('The selected workbook has no worksheets.')

        const contactsSheetName = workbook.SheetNames.find(
          (sheetName) => sheetName.trim().toLowerCase() === 'contacts'
        )
        const selectedSheetName = contactsSheetName || workbook.SheetNames[0]
        const worksheet = workbook.Sheets[selectedSheetName]

        const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '', raw: false })
        if (rows.length === 0) throw new Error('The selected file contains no contacts.')

        const allowedTypes = ['PATIENT', 'DOCTOR', 'HMO', 'CORPORATE', 'SUPPLIER']
        const importedContacts: any[] = []

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const name = String(row.Name ?? row.name ?? '').trim()
          const type = String(row.Type ?? row.type ?? '')
            .trim()
            .toUpperCase()
          const email = String(row.Email ?? row.email ?? '').trim()
          const phone = String(row.Phone ?? row.phone ?? row['Phone Number'] ?? '').trim()
          const tin = String(row.TIN ?? row.tin ?? '').trim()
          const address = String(row.Address ?? row.address ?? '').trim()
          const excelRow = i + 2

          if (!name && !type && !email && !phone && !tin && !address) continue
          if (!name) throw new Error(`Row ${excelRow}: Name is required.`)
          if (!type) throw new Error(`Row ${excelRow}: Type is required.`)

          if (!allowedTypes.includes(type)) {
            throw new Error(
              `Row ${excelRow}: Invalid Type "${type}".\nAllowed values:\nPATIENT\nDOCTOR\nHMO\nCORPORATE\nSUPPLIER`
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
          alert(`No new contacts were imported.\nAll ${skippedCount} contact(s) already exist.`)
        } else if (skippedCount > 0) {
          alert(
            `Import completed successfully.\nNew contacts: ${importedCount}\nDuplicates skipped: ${skippedCount}`
          )
        } else {
          alert(`Import completed successfully.\n${importedCount} contact(s) imported.`)
        }
      } catch (error: any) {
        console.error('Contact Import Error:', error)
        alert(error?.message || 'Failed to import contacts.')
      }
      input.value = ''
    }
    input.click()
  }

  const handleExport = () => {
    if (contacts.length === 0) {
      alert('There are no contacts to export.')
      return
    }

    try {
      const exportData = contacts.map((c: any) => ({
        ID: String(c.id || ''),
        Name: c.name || '',
        Type: c.type || '',
        Email: c.email || '',
        Phone: c.phone ? String(c.phone) : '',
        TIN: c.tin ? String(c.tin) : '',
        Address: c.address || '',
        Status: c.status || 'ACTIVE',
        Payable: Number(c.youOwe || 0),
        Receivable: Number(c.theyOwe || 0)
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      worksheet['!cols'] = [
        { wch: 38 },
        { wch: 28 },
        { wch: 14 },
        { wch: 32 },
        { wch: 18 },
        { wch: 22 },
        { wch: 45 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 }
      ]
      worksheet['!autofilter'] = { ref: `A1:J${exportData.length + 1}` }

      for (let row = 2; row <= exportData.length + 1; row++) {
        const idCell = worksheet[`A${row}`]
        if (idCell) idCell.t = 's'
        const phoneCell = worksheet[`E${row}`]
        if (phoneCell) phoneCell.t = 's'
        const tinCell = worksheet[`F${row}`]
        if (tinCell) tinCell.t = 's'
        const payableCell = worksheet[`I${row}`]
        if (payableCell) {
          payableCell.t = 'n'
          payableCell.z = '₱#,##0.00'
        }
        const receivableCell = worksheet[`J${row}`]
        if (receivableCell) {
          receivableCell.t = 'n'
          receivableCell.z = '₱#,##0.00'
        }
      }

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `SmartGuys_Contacts_${today}.xlsx`)
    } catch (error) {
      console.error('Contact Export Error:', error)
      alert('Failed to export contacts.')
    }
  }

  // --- ACTION MENU HANDLERS ---
  const handleViewDetails = (id: string) => {
    setExpandedContactId(expandedContactId === id ? null : id)
    setActionMenuId(null)
  }

  const handleTransactions = (contact: any) => {
    setActionMenuId(null)
    if (onNavigate) {
      onNavigate('history', { searchQuery: contact.name })
    }
  }

  const handleArchive = (contact: any) => {
    setActionMenuId(null)
    const confirmed = window.confirm(
      `Are you sure you want to archive ${contact.name}?\n\nThey will be hidden from the directory but historical transactions will remain intact.`
    )

    if (confirmed) {
      setContacts((prev) => prev.filter((c) => c.id !== contact.id))
    }
  }

  // 🔥 NEW FULL EDIT HANDLERS
  const openEditContact = (contact: any) => {
    setActionMenuId(null)
    setEditingContact(contact)
    setEditForm({
      name: contact.name || '',
      type: contact.type || 'PATIENT',
      email: contact.email || '',
      phone: contact.phone || '',
      tin: contact.tin || '',
      address: contact.address || '',
      hmo: contact.hmo_affiliation || '',
      hmoCardNo: contact.hmo_card_no || '',
      hmoExpiryDate: contact.hmo_expiry_date ? contact.hmo_expiry_date.split('T')[0] : ''
    })
  }

  const submitEditContact = async () => {
    if (!editingContact) return
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (!api.updatePayee) {
        alert('Update feature is missing in backend!')
        return
      }

      const result = await api.updatePayee(editingContact.id, editForm)
      if (result.success) {
        fetchContacts()
        setEditingContact(null)
      } else {
        alert('Failed to update: ' + result.error)
      }
    } catch (error) {
      console.error('Failed to update contact:', error)
      alert('System error while updating contact.')
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col font-sans text-gray-800 relative animate-in fade-in duration-300">
      {(actionMenuId || isNewContactMenuOpen) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setActionMenuId(null)
            setIsNewContactMenuOpen(false)
          }}
        ></div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Contacts & Entities</h2>
        <p className="text-sm text-gray-500 mt-1 font-medium">
          Manage patients, doctors, HMOs, and outstanding balances.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'All Contacts', type: 'ALL', count: counts.ALL },
          { label: 'Patients', type: 'PATIENT', count: counts.PATIENT },
          { label: 'Doctors', type: 'DOCTOR', count: counts.DOCTOR },
          { label: 'HMOs / Corp', type: 'HMO_CORP', count: counts.HMO_CORP },
          { label: 'Suppliers', type: 'SUPPLIER', count: counts.SUPPLIER }
        ].map((card) => (
          <div
            key={card.type}
            onClick={() => setFilterType(card.type as any)}
            className={`p-4 rounded-xl border cursor-pointer transition shadow-sm text-center ${filterType === card.type ? 'bg-[#1B9387] border-[#1B9387] text-white' : 'bg-white border-[#B0DCDA] hover:bg-[#E9FAFA] text-gray-600'}`}
          >
            <p
              className={`text-[10px] font-extrabold uppercase tracking-wider mb-1 ${filterType === card.type ? 'text-[#E9FAFA]' : 'text-gray-500'}`}
            >
              {card.label}
            </p>
            <p className="text-2xl font-black">{card.count}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-4">
        <div className="relative w-full lg:w-96">
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search name, TIN, HMO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#B0DCDA] rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] text-gray-800 shadow-sm"
          />
        </div>

        <div className="flex items-center space-x-3 w-full lg:w-auto">
          <button
            onClick={handleImport}
            className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-4 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2"
          >
            <span>📥</span>
            <span>Import</span>
          </button>
          <button
            onClick={handleExport}
            className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-4 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2"
          >
            <span>📤</span>
            <span>Export</span>
          </button>

          <div className="relative z-50">
            <button
              onClick={() => setIsNewContactMenuOpen(!isNewContactMenuOpen)}
              className="bg-[#1B9387] hover:bg-[#28958B] border border-transparent text-white px-5 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2"
            >
              <span>+ New Contact ▾</span>
            </button>

            {isNewContactMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-[#B0DCDA] rounded-lg shadow-xl overflow-hidden py-1 z-50">
                <div className="px-3 py-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                  What Type?
                </div>
                <button
                  onClick={() => openNewContactModal('PATIENT')}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition"
                >
                  👤 Patient
                </button>
                <button
                  onClick={() => openNewContactModal('DOCTOR')}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition"
                >
                  🩺 Doctor
                </button>
                <button
                  onClick={() => openNewContactModal('HMO')}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition"
                >
                  🏥 HMO
                </button>
                <button
                  onClick={() => openNewContactModal('CORPORATE')}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition"
                >
                  🏢 Corporate
                </button>
                <button
                  onClick={() => openNewContactModal('SUPPLIER')}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] transition"
                >
                  📦 Supplier
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden mb-4">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA]">
            <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
              <th className="p-4 pl-6">Contact</th>
              <th className="p-4">Type</th>
              <th className="p-4">Phone / Email</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right text-orange-500">Payable</th>
              <th className="p-4 text-right text-[#1B9387]">Receivable</th>
              <th className="p-4 w-12 text-center">⋮</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B9387] mx-auto"></div>
                </td>
              </tr>
            ) : paginatedContacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-gray-500 italic font-medium">
                  No contacts match your filters.
                </td>
              </tr>
            ) : (
              paginatedContacts.map((c) => (
                <React.Fragment key={c.id}>
                  <tr
                    onClick={() => setExpandedContactId(expandedContactId === c.id ? null : c.id)}
                    className={`cursor-pointer transition-colors group ${expandedContactId === c.id ? 'bg-[#E9FAFA]' : 'hover:bg-gray-50 even:bg-gray-50/50 odd:bg-white'}`}
                  >
                    <td className="p-4 flex items-center space-x-4 pl-6">
                      <div className="h-8 w-8 rounded-full bg-white text-[#1B9387] flex items-center justify-center font-extrabold text-xs border border-[#B0DCDA] shadow-sm shrink-0">
                        {getInitials(c.name)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-gray-800 text-base group-hover:text-[#1B9387] transition truncate max-w-[200px]">
                          {c.name}
                        </span>
                        {c.type === 'PATIENT' && c.hmo_affiliation && (
                          <span className="text-[10px] font-bold text-[#1B9387] mt-0.5 truncate max-w-[200px]">
                            {c.hmo_affiliation} {c.hmo_card_no ? `• #${c.hmo_card_no}` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${getTypeStyle(c.type)}`}
                      >
                        {c.type}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-500 font-medium">
                      {c.email ? (
                        c.email
                      ) : c.phone ? (
                        c.phone
                      ) : (
                        <span className="italic text-gray-400">Missing info</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-orange-500">
                      {formatCurrency(c.youOwe)}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-[#1B9387]">
                      {formatCurrency(c.theyOwe)}
                    </td>

                    <td
                      className={`p-4 text-center relative ${actionMenuId === c.id ? 'z-30' : 'z-10'}`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActionMenuId(actionMenuId === c.id ? null : c.id)
                        }}
                        className="text-gray-400 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-200 transition text-lg font-bold"
                      >
                        ⋮
                      </button>
                      {actionMenuId === c.id && (
                        <div className="absolute right-8 top-10 w-40 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden py-1 text-left z-20">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewDetails(c.id)
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387]"
                          >
                            👁️ View Details
                          </button>

                          {/* 🔥 NEW EDIT BUTTON */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditContact(c)
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387]"
                          >
                            ✏️ Edit Contact
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTransactions(c)
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387]"
                          >
                            🧾 Transactions
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleArchive(c)
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50"
                          >
                            🗑️ Archive
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
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
                                {c.phone || (
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
                                {c.hmo_affiliation ? (
                                  <div className="space-y-1.5">
                                    <p className="text-sm text-gray-800 font-medium">
                                      <span className="text-gray-400 mr-2 inline-block w-24 font-bold">
                                        Provider:
                                      </span>{' '}
                                      <span className="font-bold">{c.hmo_affiliation}</span>
                                    </p>
                                    <p className="text-sm text-gray-800 font-medium">
                                      <span className="text-gray-400 mr-2 inline-block w-24 font-bold">
                                        Card/Policy:
                                      </span>{' '}
                                      <span className="font-mono">{c.hmo_card_no || 'N/A'}</span>
                                    </p>
                                    {c.hmo_expiry_date && (
                                      <p className="text-sm text-gray-800 font-medium">
                                        <span className="text-gray-400 mr-2 inline-block w-24 font-bold">
                                          Expiry Date:
                                        </span>
                                        <span
                                          className={`font-mono ${new Date(c.hmo_expiry_date) < new Date() ? 'text-red-500 font-bold' : ''}`}
                                        >
                                          {new Date(c.hmo_expiry_date).toLocaleDateString('en-US', {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                          })}
                                          {new Date(c.hmo_expiry_date) < new Date() && ' (EXPIRED)'}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredContacts.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 pt-2">
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
              className="px-4 py-2 border rounded-md text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed enabled:bg-[#FBF8F8] enabled:hover:bg-[#E9FAFA] enabled:text-gray-700 enabled:border-[#B0DCDA]"
            >
              &larr; Prev
            </button>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * itemsPerPage >= filteredContacts.length}
              className="px-4 py-2 border rounded-md text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed enabled:bg-[#FBF8F8] enabled:hover:bg-[#E9FAFA] enabled:text-gray-700 enabled:border-[#B0DCDA]"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}

      <NewContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaveSuccess={() => fetchContacts()}
        defaultType={newContactType}
      />

      {/* 🔥 FULL EDIT CONTACT MODAL */}
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
                className="text-gray-400 hover:text-red-500 font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Full Name / Company Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Entity Type</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] bg-white"
                  >
                    <option value="PATIENT">Patient</option>
                    <option value="DOCTOR">Doctor</option>
                    <option value="HMO">HMO</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="SUPPLIER">Supplier</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Tax Identification Number (TIN)
                  </label>
                  <input
                    type="text"
                    value={editForm.tin}
                    onChange={(e) => setEditForm({ ...editForm, tin: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387]"
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Physical Address
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387]"
                  ></textarea>
                </div>
              </div>

              {/* ONLY SHOW HMO FIELDS FOR PATIENTS */}
              {editForm.type === 'PATIENT' && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-extrabold text-[#1B9387] uppercase tracking-wider mb-3">
                    HMO / Insurance Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Provider Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Maxicare"
                        value={editForm.hmo}
                        onChange={(e) => setEditForm({ ...editForm, hmo: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#1B9387]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Card / Policy Number
                      </label>
                      <input
                        type="text"
                        value={editForm.hmoCardNo}
                        onChange={(e) => setEditForm({ ...editForm, hmoCardNo: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#1B9387]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={editForm.hmoExpiryDate}
                        onChange={(e) =>
                          setEditForm({ ...editForm, hmoExpiryDate: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#1B9387]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
              <button
                onClick={() => setEditingContact(null)}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-md transition"
              >
                Cancel
              </button>
              <button
                onClick={submitEditContact}
                disabled={!editForm.name}
                className="px-5 py-2 text-sm font-bold text-white bg-[#1B9387] hover:bg-[#28958B] rounded-md transition shadow-sm disabled:opacity-50"
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
