import React, { useState, useMemo, useEffect } from 'react'
import { X, Search, CheckCircle, Percent, ShieldCheck } from 'lucide-react'

export function LabTestsModal({
  isOpen,
  onClose,
  availableTests,
  onAddTests,
  defaultHmoCovered = false
}: {
  isOpen: boolean
  onClose: () => void
  availableTests: any[]
  onAddTests: (tests: any[]) => void
  defaultHmoCovered?: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [vatableIds, setVatableIds] = useState<Set<number>>(new Set())
  const [hmoCoveredIds, setHmoCoveredIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set())
      setVatableIds(new Set())
      setHmoCoveredIds(new Set())
      setSearchQuery('')
    }
  }, [isOpen])

  const filteredTests = useMemo(() => {
    return availableTests.filter((t) => {
      const q = searchQuery.toLowerCase()
      return (
        String(t.name || '').toLowerCase().includes(q) ||
        String(t.category || '').toLowerCase().includes(q)
      )
    })
  }, [availableTests, searchQuery])

  const toggleTest = (id: number) => {
    const newSelected = new Set(selectedIds)
    const newVatable = new Set(vatableIds)
    const newHmo = new Set(hmoCoveredIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
      newVatable.delete(id)
      newHmo.delete(id)
    } else {
      newSelected.add(id)
      if (defaultHmoCovered) {
        newHmo.add(id)
      }
    }
    setSelectedIds(newSelected)
    setVatableIds(newVatable)
    setHmoCoveredIds(newHmo)
  }

  const toggleVatable = (id: number) => {
    const newVatable = new Set(vatableIds)
    if (newVatable.has(id)) {
      newVatable.delete(id)
    } else {
      newVatable.add(id)
    }
    setVatableIds(newVatable)
  }

  const toggleHmo = (id: number) => {
    const newHmo = new Set(hmoCoveredIds)
    if (newHmo.has(id)) {
      newHmo.delete(id)
    } else {
      newHmo.add(id)
    }
    setHmoCoveredIds(newHmo)
  }

  const setAllSelectedVatable = (vatable: boolean) => {
    if (vatable) {
      setVatableIds(new Set(selectedIds))
    } else {
      setVatableIds(new Set())
    }
  }

  const setAllSelectedHmo = (covered: boolean) => {
    if (covered) {
      setHmoCoveredIds(new Set(selectedIds))
    } else {
      setHmoCoveredIds(new Set())
    }
  }

  const handleConfirm = () => {
    const selected = availableTests
      .filter((t) => selectedIds.has(t.id))
      .map((t) => ({
        ...t,
        isVatable: vatableIds.has(t.id),
        isHmoCovered: hmoCoveredIds.has(t.id)
      }))

    onAddTests(selected)
    setSelectedIds(new Set())
    setVatableIds(new Set())
    setHmoCoveredIds(new Set())
    setSearchQuery('')
    onClose()
  }

  if (!isOpen) return null

  const vatableCount = Array.from(selectedIds).filter((id) => vatableIds.has(id)).length
  const hmoCount = Array.from(selectedIds).filter((id) => hmoCoveredIds.has(id)).length

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-[#B0DCDA] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 bg-[#FBF8F8]">
          <div>
            <h3 className="text-2xl font-extrabold text-[#1B9387] flex items-center gap-2">
              Laboratory & Diagnostics
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Select multiple tests and specify VAT & HMO/Corporate coverage for billing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-100 p-2 rounded-full transition border border-gray-200 shadow-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Bulk VAT / HMO Controls */}
        <div className="p-5 border-b border-gray-100 bg-white space-y-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by test name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-12 pr-4 text-sm font-medium text-gray-800 focus:outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#1B9387] shadow-inner transition-colors"
            />
          </div>

          {/* Bulk VAT & HMO Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#E9FAFA]/70 border border-[#B0DCDA] rounded-xl px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              {/* VAT Controls */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-[#1B9387]" />
                  VAT:
                </span>
                <button
                  type="button"
                  onClick={() => setAllSelectedVatable(true)}
                  disabled={selectedIds.size === 0}
                  className="text-xs font-bold px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
                >
                  Mark All Vatable
                </button>
                <button
                  type="button"
                  onClick={() => setAllSelectedVatable(false)}
                  disabled={selectedIds.size === 0}
                  className="text-xs font-bold px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
                >
                  Mark All Non-VAT
                </button>
              </div>

              <div className="hidden sm:block h-5 w-px bg-[#B0DCDA]" />

              {/* HMO / Corp Controls */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  HMO / Corp:
                </span>
                <button
                  type="button"
                  onClick={() => setAllSelectedHmo(true)}
                  disabled={selectedIds.size === 0}
                  className="text-xs font-bold px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
                >
                  Cover All
                </button>
                <button
                  type="button"
                  onClick={() => setAllSelectedHmo(false)}
                  disabled={selectedIds.size === 0}
                  className="text-xs font-bold px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
                >
                  Self-Pay All
                </button>
              </div>
            </div>

            <div className="text-xs font-semibold flex items-center gap-2">
              {selectedIds.size === 0 ? (
                <span className="text-gray-400">Select tests to configure</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300 text-[11px]">
                    {vatableCount} VATABLE
                  </span>
                  <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded border border-indigo-300 text-[11px]">
                    {hmoCount} HMO/CORP
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tests Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/40">
          {filteredTests.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-medium">No tests match your search.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTests.map((test) => {
                const isSelected = selectedIds.has(test.id)
                const isVatable = vatableIds.has(test.id)
                const isHmo = hmoCoveredIds.has(test.id)

                return (
                  <div
                    key={test.id}
                    onClick={() => toggleTest(test.id)}
                    className={`cursor-pointer border rounded-2xl p-4 transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-white border-[#1B9387] ring-1 ring-[#1B9387] shadow-md'
                        : 'bg-white border-gray-200 hover:border-[#1B9387]/60 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by container onClick
                        className="w-5 h-5 mt-0.5 text-[#1B9387] border-gray-300 rounded focus:ring-[#1B9387] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-bold truncate ${
                            isSelected ? 'text-[#1B9387]' : 'text-gray-800'
                          }`}
                        >
                          {test.name}
                        </div>
                        <div className="text-[11px] font-semibold text-gray-400 mt-0.5">
                          ₱{Number(test.price).toLocaleString()} • {test.category}
                        </div>
                      </div>
                    </div>

                    {/* Individual VAT & HMO Coverage Controls when selected */}
                    {isSelected && (
                      <div
                        className="mt-3 pt-2.5 border-t border-teal-50 flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Tax Type */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            Tax:
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleVatable(test.id)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold uppercase transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                              isVatable
                                ? 'bg-amber-500 text-white hover:bg-amber-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isVatable ? 'bg-white' : 'bg-gray-400'
                              }`}
                            />
                            {isVatable ? 'VAT (12%)' : 'NON-VAT'}
                          </button>
                        </div>

                        {/* HMO / Corporate Coverage Toggle */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            Coverage:
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleHmo(test.id)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold uppercase transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                              isHmo
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isHmo ? 'bg-white' : 'bg-gray-400'
                              }`}
                            />
                            {isHmo ? 'HMO / CORP' : 'SELF-PAY'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-white border-t border-gray-100 flex justify-between items-center">
          <div className="text-sm font-bold text-gray-600">
            {selectedIds.size} test(s) selected
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className={`px-8 py-3 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center gap-2 transition-all ${
              selectedIds.size > 0
                ? 'bg-[#1B9387] hover:bg-[#15796f] text-white shadow-lg shadow-[#1B9387]/30 cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            Add to Bill
          </button>
        </div>
      </div>
    </div>
  )
}
