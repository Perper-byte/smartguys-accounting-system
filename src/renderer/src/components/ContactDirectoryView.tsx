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

  const [editingTinContact, setEditingTinContact] = useState<any>(null)
  const [newTinValue, setNewTinValue] = useState('')

  // UI States
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'PATIENT' | 'DOCTOR' | 'HMO' | 'SUPPLIER'>(
    'ALL'
  )
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  // New Contact Flow
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewContactMenuOpen, setIsNewContactMenuOpen] = useState(false)
  const [newContactType, setNewContactType] = useState('PATIENT')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const data = await api.getContactsWithBalances()

      // Mocking a 'status' field for the UI if it doesn't exist in your DB yet
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

  // Reset pagination when searching or filtering
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterType])

  // Summary Card Calculations
  const counts = useMemo(
    () => ({
      ALL: contacts.length,
      PATIENT: contacts.filter((c) => c.type === 'PATIENT').length,
      DOCTOR: contacts.filter((c) => c.type === 'DOCTOR').length,
      HMO: contacts.filter((c) => c.type === 'HMO').length,
      SUPPLIER: contacts.filter((c) => c.type === 'SUPPLIER').length
    }),
    [contacts]
  )

  // Apply Filters & Search
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.tin && c.tin.includes(searchQuery))
      const matchesType = filterType === 'ALL' || c.type === filterType
      return matchesSearch && matchesType
    })
  }, [contacts, searchQuery, filterType])

  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredContacts.slice(start, start + itemsPerPage)
  }, [filteredContacts, currentPage])

  // 🔥 Systematized Colors: Warm (Money Out) vs Cool (Money In)
  const getTypeStyle = (type: string) => {
    switch (type) {
      // Money-Out (Payables -> Warm Colors)
      case 'SUPPLIER':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'DOCTOR':
        return 'text-rose-600 bg-rose-50 border-rose-200'
      // Money-In (Receivables -> Cool Colors)
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

  const handleImport = () => {
    const input = document.createElement('input')

    input.type = 'file'
    input.accept = '.xlsx,.xls,.csv'

    input.onchange = async () => {
      const file = input.files?.[0]

      if (!file) return

      try {
        const buffer = await file.arrayBuffer()

        const workbook = XLSX.read(buffer, {
          type: 'array'
        })

        if (workbook.SheetNames.length === 0) {
          throw new Error('The selected workbook has no worksheets.')
        }

        // --------------------------------------------
        // FIND CONTACTS SHEET
        // --------------------------------------------

        const contactsSheetName = workbook.SheetNames.find(
          (sheetName) => sheetName.trim().toLowerCase() === 'contacts'
        )

        const selectedSheetName = contactsSheetName || workbook.SheetNames[0]

        const worksheet = workbook.Sheets[selectedSheetName]

        // --------------------------------------------
        // READ ROWS
        // --------------------------------------------

        const rows = XLSX.utils.sheet_to_json<any>(worksheet, {
          defval: '',
          raw: false
        })

        if (rows.length === 0) {
          throw new Error('The selected file contains no contacts.')
        }

        const allowedTypes = ['PATIENT', 'DOCTOR', 'HMO', 'SUPPLIER']

        const importedContacts: any[] = []

        // --------------------------------------------
        // VALIDATE EACH ROW
        // --------------------------------------------

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

          // Ignore completely blank rows
          if (!name && !type && !email && !phone && !tin && !address) {
            continue
          }

          if (!name) {
            throw new Error(`Row ${excelRow}: Name is required.`)
          }

          if (!type) {
            throw new Error(`Row ${excelRow}: Type is required.`)
          }

          if (!allowedTypes.includes(type)) {
            throw new Error(
              `Row ${excelRow}: Invalid Type "${type}".\n\n` +
                `Allowed values:\n` +
                `PATIENT\nDOCTOR\nHMO\nSUPPLIER`
            )
          }

          importedContacts.push({
            name,
            type,
            email,
            phone,
            tin,
            address
          })
        }

        if (importedContacts.length === 0) {
          throw new Error('No valid contact rows were found.')
        }

        // --------------------------------------------
        // SEND TO ELECTRON BACKEND
        // --------------------------------------------

        const api = (window as any).api || (window as any).electronAPI

        if (!api || !api.importPayees) {
          throw new Error('Import API is unavailable. Please restart the application.')
        }

        const result = await api.importPayees(importedContacts)

        if (!result || result.success === false) {
          throw new Error(result?.error || 'Failed to import contacts.')
        }

        const importedCount = Number(result.count || 0)

        const skippedCount = importedContacts.length - importedCount

        // --------------------------------------------
        // REFRESH TABLE
        // --------------------------------------------

        await fetchContacts()

        // --------------------------------------------
        // USER-FRIENDLY RESULT MESSAGE
        // --------------------------------------------

        if (importedCount === 0 && skippedCount > 0) {
          alert(
            `No new contacts were imported.\n\n` +
              `All ${skippedCount} contact(s) already exist in the Contact Directory.`
          )
        } else if (skippedCount > 0) {
          alert(
            `Import completed successfully.\n\n` +
              `New contacts: ${importedCount}\n` +
              `Duplicates skipped: ${skippedCount}`
          )
        } else {
          alert(`Import completed successfully.\n\n` + `${importedCount} contact(s) imported.`)
        }
      } catch (error: any) {
        console.error('Contact Import Error:', error)

        alert(error?.message || 'Failed to import contacts.')
      }

      // Allows selecting the same file again
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

      /*
       * COLUMN WIDTHS
       */
      worksheet['!cols'] = [
        { wch: 38 }, // ID

        { wch: 28 }, // Name

        { wch: 14 }, // Type

        { wch: 32 }, // Email

        { wch: 18 }, // Phone

        { wch: 22 }, // TIN

        { wch: 45 }, // Address

        { wch: 14 }, // Status

        { wch: 18 }, // Payable

        { wch: 18 } // Receivable
      ]

      /*
       * EXCEL AUTO FILTER
       */
      worksheet['!autofilter'] = {
        ref: `A1:J${exportData.length + 1}`
      }

      /*
       * CELL FORMATTING
       */
      for (let row = 2; row <= exportData.length + 1; row++) {
        /*
         * ID
         */
        const idCell = worksheet[`A${row}`]

        if (idCell) {
          idCell.t = 's'
        }

        /*
         * PHONE
         *
         * Keep it as text so 0917...
         * doesn't lose the first zero.
         */
        const phoneCell = worksheet[`E${row}`]

        if (phoneCell) {
          phoneCell.t = 's'
        }

        /*
         * TIN
         */
        const tinCell = worksheet[`F${row}`]

        if (tinCell) {
          tinCell.t = 's'
        }

        /*
         * PAYABLE
         */
        const payableCell = worksheet[`I${row}`]

        if (payableCell) {
          payableCell.t = 'n'

          payableCell.z = '₱#,##0.00'
        }

        /*
         * RECEIVABLE
         */
        const receivableCell = worksheet[`J${row}`]

        if (receivableCell) {
          receivableCell.t = 'n'

          receivableCell.z = '₱#,##0.00'
        }
      }

      /*
       * CREATE WORKBOOK
       */
      const workbook = XLSX.utils.book_new()

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts')

      /*
       * FILE DATE
       */
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

  const handleEditTin = (contact: any) => {
    setActionMenuId(null)
    setEditingTinContact(contact)
    setNewTinValue(contact.tin || '')
  }

  const submitEditTin = async () => {
    if (!editingTinContact) return
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (api.updatePayeeTin) {
        await api.updatePayeeTin(editingTinContact.id, newTinValue)
        fetchContacts() // Refresh the table
      }
    } catch (error) {
      console.error('Failed to update TIN:', error)
      alert('Failed to update TIN.')
    } finally {
      setEditingTinContact(null)
    }
  }

  const handleTransactions = (contact: any) => {
    setActionMenuId(null)
    if (onNavigate) {
      // Navigates to the history tab and passes the contact's name!
      onNavigate('history', { searchQuery: contact.name })
    }
  }

  const handleArchive = (contact: any) => {
    setActionMenuId(null)
    const confirmed = window.confirm(
      `Are you sure you want to archive ${contact.name}?\n\nThey will be hidden from the directory but historical transactions will remain intact.`
    )

    if (confirmed) {
      // Optimistic UI Update (Hides it immediately on the frontend)
      setContacts((prev) => prev.filter((c) => c.id !== contact.id))

      // TODO: Add an api.archivePayee(contact.id) to your backend in the future to make this permanent!
      console.log(`Archived ${contact.name}`)
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col font-sans text-gray-800 relative animate-in fade-in duration-300">
      {/* Global Overlay to close dropdowns */}
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

      {/* Summary / Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'All Contacts', type: 'ALL', count: counts.ALL },
          { label: 'Patients', type: 'PATIENT', count: counts.PATIENT },
          { label: 'Doctors', type: 'DOCTOR', count: counts.DOCTOR },
          { label: 'HMOs', type: 'HMO', count: counts.HMO },
          { label: 'Suppliers', type: 'SUPPLIER', count: counts.SUPPLIER }
        ].map((card) => (
          <div
            key={card.type}
            onClick={() => setFilterType(card.type as any)}
            className={`p-4 rounded-xl border cursor-pointer transition shadow-sm text-center ${
              filterType === card.type
                ? 'bg-[#1B9387] border-[#1B9387] text-white'
                : 'bg-white border-[#B0DCDA] hover:bg-[#E9FAFA] text-gray-600'
            }`}
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

      {/* TOOLBAR */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-4">
        <div className="relative w-full lg:w-96">
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search name, TIN, ID..."
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

          {/* Improved New Contact Flow */}
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
              <th className="p-4">Contact</th>
              <th className="p-4">Type</th>
              <th className="p-4">Phone / Email</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right text-orange-500" title="Amount the clinic owes them">
                Payable
              </th>
              <th className="p-4 text-right text-[#1B9387]" title="Amount they owe the clinic">
                Receivable
              </th>
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
                  {/* Clickable Rows */}
                  <tr
                    onClick={() => setExpandedContactId(expandedContactId === c.id ? null : c.id)}
                    className={`cursor-pointer transition-colors group ${expandedContactId === c.id ? 'bg-[#E9FAFA]' : 'hover:bg-gray-50 even:bg-gray-50/50 odd:bg-white'}`}
                  >
                    <td className="p-4 flex items-center space-x-4">
                      <div className="h-8 w-8 rounded-full bg-white text-[#1B9387] flex items-center justify-center font-extrabold text-xs border border-[#B0DCDA] shadow-sm shrink-0">
                        {getInitials(c.name)}
                      </div>
                      <span className="font-extrabold text-gray-800 text-base group-hover:text-[#1B9387] transition">
                        {c.name}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${getTypeStyle(c.type)}`}
                      >
                        {c.type}
                      </span>
                    </td>

                    {/* 🔥 Flagging missing contact info */}
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
                        className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
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

                    {/* Actions (⋮) Menu */}
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

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditTin(c)
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387]"
                          >
                            ✏️ Edit TIN
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
                          </div>

                          {/* Financial Summary inside Expansion */}
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

      {/* Pagination Footer */}
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
            {/* 🔥 Visually distinct disabled states for pagination */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border rounded-md text-xs font-bold uppercase tracking-wider transition shadow-sm
                                       disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed
                                       enabled:bg-[#FBF8F8] enabled:hover:bg-[#E9FAFA] enabled:text-gray-700 enabled:border-[#B0DCDA]"
            >
              &larr; Prev
            </button>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * itemsPerPage >= filteredContacts.length}
              className="px-4 py-2 border rounded-md text-xs font-bold uppercase tracking-wider transition shadow-sm
                                       disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed
                                       enabled:bg-[#FBF8F8] enabled:hover:bg-[#E9FAFA] enabled:text-gray-700 enabled:border-[#B0DCDA]"
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

      {/* --- EDIT TIN MODAL --- */}
      {editingTinContact && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8]">
              <h3 className="font-extrabold text-gray-800">Update TIN</h3>
              <p className="text-xs text-gray-500">For {editingTinContact.name}</p>
            </div>

            <div className="p-4">
              <input
                type="text"
                value={newTinValue}
                onChange={(e) => setNewTinValue(e.target.value)}
                placeholder="Enter TIN (leave blank to clear)"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] shadow-inner"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && submitEditTin()}
              />
            </div>

            <div className="p-4 bg-gray-50 flex justify-end space-x-2 border-t border-gray-100">
              <button
                onClick={() => setEditingTinContact(null)}
                className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-md transition"
              >
                Cancel
              </button>
              <button
                onClick={submitEditTin}
                className="px-4 py-2 text-sm font-bold text-white bg-[#1B9387] hover:bg-[#28958B] rounded-md transition shadow-sm"
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
