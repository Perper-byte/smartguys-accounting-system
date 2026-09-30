import * as React from 'react'
import { useState, useEffect } from 'react'

interface NewContactModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveSuccess: (newId?: string, newName?: string) => void
  defaultType?: string
}

export function NewContactModal({
  isOpen,
  onClose,
  onSaveSuccess,
  defaultType = 'PATIENT'
}: NewContactModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: defaultType,
    tin: '',
    email: '',
    phone: '',
    address: ''
  })

  // 🔥 THE MISSING HMO STATES RESTORED
  const [hmoAffiliation, setHmoAffiliation] = useState('')
  const [hmoCardNo, setHmoCardNo] = useState('')
  const [hmoExpiry, setHmoExpiry] = useState('')
  const [hmoList, setHmoList] = useState<any[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const [error, setError] = useState<string | null>(null)

  /*
   * IMPORTANT:
   * Every time the modal opens, update the contact type
   * based on the type selected from Contact Directory.
   */
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        type: defaultType,
        tin: '',
        email: '',
        phone: '',
        address: ''
      })

      // Reset HMO fields
      setHmoAffiliation('')
      setHmoCardNo('')
      setHmoExpiry('')
      setIsSubmitting(false)

      // 🔥 Fetch the HMOs for the dropdown
      const fetchHMOs = async () => {
        const api = (window as any).api || (window as any).electronAPI
        if (api && api.getPayees) {
          const data = await api.getPayees('HMO,CORPORATE')
          setHmoList(data || [])
        }
      }
      fetchHMOs()
    }
  }, [isOpen, defaultType])

  if (!isOpen) return null

  /*
   * Get the proper name depending on the contact type.
   */
  const getTypeName = () => {
    switch (formData.type) {
      case 'PATIENT':
        return 'Patient'
      case 'DOCTOR':
        return 'Doctor'
      case 'HMO':
        return 'HMO'
      case 'SUPPLIER':
        return 'Supplier'
      case 'CORPORATE':
        return 'Corporate'
      case 'LANDLORD':
        return 'Landlord'
      case 'EMPLOYEE':
        return 'Employee'
      case 'GOVERNMENT':
        return 'Government Agency'
      default:
        return 'Contact'
    }
  }

  /*
   * Get the appropriate description.
   */
  const getTypeDescription = () => {
    switch (formData.type) {
      case 'PATIENT':
        return 'Patient information will be used for billing and receivable transactions.'
      case 'DOCTOR':
        return 'Doctor information will be used for professional fees and payout transactions.'
      case 'HMO':
        return 'HMO information will be used for insurance claims and receivable transactions.'
      case 'SUPPLIER':
        return 'Supplier information will be used for purchases and payable transactions.'
      case 'CORPORATE':
        return 'Corporate account information will be used for business transactions.'
      case 'LANDLORD':
        return 'Landlord information will be used for rent and lease payable transactions.'
      case 'EMPLOYEE':
        return 'Employee information will be used for payroll and cash advance transactions.'
      case 'GOVERNMENT':
        return 'Government agencies will be used for tax, SSS, PhilHealth, and Pag-IBIG remittances.'
      default:
        return 'Assigning the correct type ensures they appear in the right ledgers.'
    }
  }

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) return setError('Please enter a contact name.')

    if (formData.type === 'PATIENT' && hmoAffiliation && hmoExpiry) {
      // valid through the end of the expiry day
      if (new Date(`${hmoExpiry}T23:59:59`) < new Date())
        return setError('This HMO card has already expired. Check the expiry date.')
    }

    setIsSubmitting(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      if (!api) throw new Error('Electron API is not available.')

      const result = await api.createPayee(
        formData.name,
        formData.type,
        formData.tin,
        formData.email,
        formData.phone,
        formData.address,
        formData.type === 'PATIENT' ? hmoAffiliation : undefined,
        formData.type === 'PATIENT' ? hmoCardNo : undefined,
        formData.type === 'PATIENT' ? hmoExpiry : undefined
      )
      if (!result || result.success === false)
        throw new Error(result?.error || 'Failed to create contact.')

      // Prefer an id returned by createPayee; fall back to a name lookup.
      let newId: string | undefined = result.id ?? result.payee?.id
      let newName: string | undefined = formData.name.trim()
      if (!newId) {
        const updated = await api.getPayees()
        const match = (Array.isArray(updated) ? updated : []).find(
          (p: any) => p.name && p.name.toLowerCase() === formData.name.trim().toLowerCase()
        )
        newId = match?.id
        newName = match?.name ?? newName
      }

      onSaveSuccess(newId, newName) // callers already accept undefined
      onClose() // form resets itself on next open
    } catch (err: any) {
      console.error('Failed to save contact:', err)
      setError(err?.message || 'Failed to save contact.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
      <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl w-[700px] max-w-[95vw] overflow-hidden text-gray-800 font-sans flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-[#B0DCDA] shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800 tracking-wide">New {getTypeName()}</h2>
            <p className="text-xs text-gray-400 mt-1">
              Add a new {getTypeName().toLowerCase()} to the contact directory.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 cursor-pointer font-bold text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* TAB */}
        <div className="flex px-8 border-b border-[#B0DCDA] text-xs font-bold text-gray-500 uppercase tracking-widest bg-[#FBF8F8] shrink-0">
          <div className="py-4 text-[#157A6F] border-b-2 border-[#1B9387] mr-8">
            General Details
          </div>
        </div>

        <form onSubmit={handleSaveContact} className="flex flex-col overflow-hidden">
          <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
            {error && (
              <p
                role="alert"
                className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3"
              >
                {error}
              </p>
            )}
            {/* ENTITY TYPE */}
            <div className="bg-[#E9FAFA]/70 p-5 rounded-lg border border-[#B0DCDA] flex items-center justify-between gap-6">
              <div>
                <p className="font-bold text-gray-800 text-sm tracking-wide">
                  Entity Classification
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-[390px]">{getTypeDescription()}</p>
              </div>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="bg-white border border-[#B0DCDA] rounded-md px-4 py-2 text-sm font-bold text-[#157A6F] outline-none cursor-pointer shadow-sm transition focus:border-[#1B9387] min-w-[150px]"
              >
                <option value="PATIENT">👤 Patient</option>
                <option value="DOCTOR">🩺 Doctor</option>
                <option value="HMO">🏥 HMO</option>
                <option value="SUPPLIER">📦 Supplier</option>
                <option value="CORPORATE">🏢 Corporate</option>
                <option value="LANDLORD">🔑 Landlord</option>
                <option value="EMPLOYEE">💼 Employee</option>
                <option value="GOVERNMENT">🏛️ Government</option>
              </select>
            </div>

            {/* CONTACT NAME + TIN */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {formData.type === 'DOCTOR'
                    ? 'Doctor Name *'
                    : formData.type === 'HMO'
                      ? 'HMO Name *'
                      : formData.type === 'SUPPLIER'
                        ? 'Supplier Name *'
                        : 'Contact Name *'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={
                    formData.type === 'DOCTOR'
                      ? 'e.g. Dr. Jose Rizal'
                      : formData.type === 'HMO'
                        ? 'e.g. Maxicare'
                        : formData.type === 'SUPPLIER'
                          ? 'e.g. MedSupplies Corp'
                          : 'e.g. Juan Dela Cruz'
                  }
                  className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 focus:border-[#1B9387] outline-none transition placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  BIR Tax ID (TIN)
                </label>
                <input
                  type="text"
                  placeholder="000-000-000-000"
                  value={formData.tin}
                  onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                  className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-mono focus:border-[#1B9387] outline-none transition placeholder-gray-400"
                />
              </div>
            </div>

            {/* 🔥 THE MISSING HMO AFFILIATION BLOCK */}
            {formData.type === 'PATIENT' && (
              <div className="	bg-[#E9FAFA]/60 border border-[#B0DCDA] rounded-lg p-5">
                <label className="block text-xs font-bold 	text-[#157A6F] uppercase tracking-wider mb-2">
                  Primary HMO Carrier / Primary Corporate (Optional)
                </label>
                <select
                  value={hmoAffiliation}
                  onChange={(e) => {
                    setHmoAffiliation(e.target.value)
                    if (!e.target.value) {
                      setHmoCardNo('')
                      setHmoExpiry('')
                    }
                  }}
                  className="w-full bg-white border border-blue-200 rounded-md p-3 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm"
                >
                  <option value="">-- No HMO / Private Pay --</option>
                  {hmoList.map((hmo) => (
                    <option key={hmo.id} value={hmo.name}>
                      {hmo.name}
                    </option>
                  ))}
                </select>

                {hmoAffiliation && (
                  <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-[#B0DCDA] animate-in fade-in">
                    <div>
                      <label className="block text-xs font-bold 	text-[#157A6F] uppercase tracking-wider mb-2">
                        Card No. / Policy ID
                      </label>
                      <input
                        type="text"
                        value={hmoCardNo}
                        onChange={(e) => setHmoCardNo(e.target.value)}
                        placeholder="e.g. 10002939"
                        className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none transition shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold 	text-[#157A6F] uppercase tracking-wider mb-2">
                        Card Expiry Date
                      </label>
                      <input
                        type="date"
                        value={hmoExpiry}
                        onChange={(e) => setHmoExpiry(e.target.value)}
                        className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none transition shadow-sm cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EMAIL + PHONE */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. email@address.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 focus:border-[#1B9387] outline-none transition placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="0912 345 6789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 focus:border-[#1B9387] outline-none transition placeholder-gray-400"
                />
              </div>
            </div>

            {/* ADDRESS */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Registered Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full physical address..."
                className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 focus:border-[#1B9387] outline-none h-20 resize-none transition placeholder-gray-400"
              />
            </div>
          </div>

          {/* FOOTER */}
          <div className="bg-[#FBF8F8] px-8 py-5 border-t border-[#B0DCDA] flex justify-end space-x-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] text-gray-700 rounded-md text-sm font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold shadow-lg transition-colors disabled:opacity-50 cursor-pointer tracking-wide"
            >
              {isSubmitting ? 'Saving...' : `Save ${getTypeName()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
