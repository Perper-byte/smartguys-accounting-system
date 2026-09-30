import * as React from 'react'
import { useState } from 'react'

export function PayrollDirectoryTab({
  employees,
  fetchEmployees,
  setStatus
}: {
  employees: any[]
  fetchEmployees: () => void
  setStatus: (status: { type: 'success' | 'error'; msg: string } | null) => void
}) {
  const [dirSearch, setDirSearch] = useState('')
  const [dirFilter, setDirFilter] = useState<'ACTIVE' | 'INCOMPLETE' | 'ARCHIVED'>('ACTIVE')
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newEmp, setNewEmp] = useState({
    id: '',
    firstName: '',
    lastName: '',
    position: '',
    monthlySalary: '',
    tin: '',
    sss: '',
    philhealth: '',
    pagibig: ''
  })
  const [employeeToToggle, setEmployeeToToggle] = useState<{
    id: string
    name: string
    isActive: boolean
  } | null>(null)

  const formatTIN = (v: string) => {
    const num = v.replace(/\D/g, '').substring(0, 12)
    return num.replace(
      /(\d{3})(\d{1,3})?(\d{1,3})?(\d{1,3})?/,
      (m, p1, p2, p3, p4) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : '') + (p4 ? `-${p4}` : '')
    )
  }
  const formatSSS = (v: string) => {
    const num = v.replace(/\D/g, '').substring(0, 10)
    return num.replace(
      /(\d{2})(\d{1,7})?(\d{1})?/,
      (m, p1, p2, p3) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : '')
    )
  }
  const formatHDMF = (v: string) => {
    const num = v.replace(/\D/g, '').substring(0, 12)
    return num.replace(
      /(\d{4})(\d{1,4})?(\d{1,4})?/,
      (m, p1, p2, p3) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : '')
    )
  }
  const formatPHIC = (v: string) => {
    const num = v.replace(/\D/g, '').substring(0, 12)
    return num.replace(
      /(\d{2})(\d{1,9})?(\d{1})?/,
      (m, p1, p2, p3) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : '')
    )
  }

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const response = newEmp.id
        ? await api.updateEmployee(newEmp.id, newEmp)
        : await api.createEmployee(newEmp)

      if (response.success) {
        setStatus({
          type: 'success',
          msg: `Employee ${newEmp.id ? 'updated' : 'added'} successfully!`
        })
        setIsEmpModalOpen(false)
        fetchEmployees()
        setTimeout(() => setStatus(null), 4000)
      } else {
        setStatus({ type: 'error', msg: 'Failed: ' + response.error })
      }
    } catch (error) {
      setStatus({ type: 'error', msg: 'System Error.' })
    } finally {
      setLoading(false)
    }
  }

  const openEditEmployee = (emp: any) => {
    setNewEmp({
      id: emp.id,
      firstName: emp.first_name,
      lastName: emp.last_name,
      position: emp.position,
      monthlySalary: emp.monthly_salary,
      tin: emp.tin || '',
      sss: emp.sss_no || '',
      philhealth: emp.philhealth_no || '',
      pagibig: emp.pagibig_no || ''
    })
    setIsEmpModalOpen(true)
  }

  const confirmToggleStatus = async () => {
    if (!employeeToToggle) return
    setStatus(null)
    try {
      const api = (window as any).api || (window as any).electronAPI
      const newStatus = !employeeToToggle.isActive
      const response = await api.toggleEmployeeStatus(employeeToToggle.id, newStatus)
      if (response.success) {
        setStatus({
          type: 'success',
          msg: `${employeeToToggle.name} marked as ${newStatus ? 'Active' : 'Archived'}.`
        })
        fetchEmployees()
        setTimeout(() => setStatus(null), 3000)
      } else setStatus({ type: 'error', msg: 'Database Update Failed.' })
    } catch (error) {
      setStatus({ type: 'error', msg: 'System Error.' })
    } finally {
      setEmployeeToToggle(null)
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    const matchSearch = `${emp.first_name} ${emp.last_name}`
      .toLowerCase()
      .includes(dirSearch.toLowerCase())
    const isMissingInfo = !emp.tin || !emp.sss_no
    const isActive = emp.is_active !== false

    if (!matchSearch) return false
    if (dirFilter === 'ACTIVE') return isActive
    if (dirFilter === 'ARCHIVED') return !isActive
    if (dirFilter === 'INCOMPLETE') return isActive && isMissingInfo
    return true
  })

  return (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0 bg-white print:hidden">
      <div className="p-6 border-b border-[#B0DCDA] flex justify-between items-center bg-[#FBF8F8] shrink-0">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search employees..."
            value={dirSearch}
            onChange={(e) => setDirSearch(e.target.value)}
            className="w-64 bg-white border border-[#B0DCDA] rounded-md p-2.5 text-sm outline-none focus:border-[#1B9387] transition shadow-sm"
          />
          <div className="flex bg-white rounded-md border border-[#B0DCDA] shadow-sm p-1">
            {(['ACTIVE', 'INCOMPLETE', 'ARCHIVED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setDirFilter(f)}
                className={`px-4 py-1.5 text-xs font-bold rounded uppercase tracking-wider transition ${dirFilter === f ? 'bg-[#E9FAFA] text-[#1B9387]' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            setNewEmp({
              id: '',
              firstName: '',
              lastName: '',
              position: '',
              monthlySalary: '',
              tin: '',
              sss: '',
              philhealth: '',
              pagibig: ''
            })
            setIsEmpModalOpen(true)
          }}
          className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold transition shadow-sm uppercase tracking-wider flex items-center gap-2"
        >
          <span>+</span> Add Employee
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white border-b-2 border-gray-200 sticky top-0 z-10">
            <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
              <th className="p-4 pl-6 w-32">Status</th>
              <th className="p-4">Name & Position</th>
              <th className="p-4 text-right">Base Salary (₱)</th>
              <th className="p-4 w-64">Government IDs</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-16 text-center text-gray-400 italic">
                  No employees found matching criteria.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const isActive = emp.is_active !== false
                const isMissingInfo = !emp.tin || !emp.sss_no

                return (
                  <tr
                    key={emp.id}
                    className={`transition-colors hover:bg-gray-50 ${!isActive ? 'opacity-60 bg-gray-50/50' : ''}`}
                  >
                    <td className="p-4 pl-6">
                      <div className="flex flex-col items-start gap-1.5">
                        {isActive ? (
                          <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-gray-100 border border-gray-300 text-gray-500 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">
                            Archived
                          </span>
                        )}
                        {isActive && isMissingInfo && (
                          <span
                            className="px-2 py-0.5 bg-yellow-50 text-yellow-600 border border-yellow-200 text-[9px] font-bold rounded-sm uppercase flex items-center shadow-sm"
                            title="Missing TIN or SSS Number"
                          >
                            ⚠️ Incomplete
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-extrabold text-gray-800 text-base">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-xs text-[#1B9387] font-bold uppercase tracking-wider mt-0.5">
                        {emp.position}
                      </p>
                    </td>
                    <td className="p-4 text-right font-mono text-gray-800 font-bold tabular-nums">
                      {Number(emp.monthly_salary).toLocaleString('en-US', {
                        minimumFractionDigits: 2
                      })}
                    </td>
                    <td className="p-4 text-xs space-y-1.5">
                      <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                        <span className="text-gray-500 font-bold text-[10px] uppercase">
                          TIN
                        </span>
                        <span
                          className={`font-mono font-bold ${emp.tin ? 'text-gray-800' : 'text-red-400'}`}
                        >
                          {emp.tin || 'Missing'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                        <span className="text-gray-500 font-bold text-[10px] uppercase">
                          SSS
                        </span>
                        <span
                          className={`font-mono font-bold ${emp.sss_no ? 'text-gray-800' : 'text-red-400'}`}
                        >
                          {emp.sss_no || 'Missing'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right space-x-2">
                      <button
                        onClick={() => openEditEmployee(emp)}
                        className="text-xs font-bold text-gray-500 hover:text-[#1B9387] bg-white border border-gray-300 hover:border-[#1B9387] px-3.5 py-2 rounded-md transition shadow-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          setEmployeeToToggle({
                            id: emp.id,
                            name: `${emp.first_name} ${emp.last_name}`,
                            isActive
                          })
                        }
                        className={`text-xs font-bold px-3.5 py-2 rounded-md transition shadow-sm border ${
                          isActive
                            ? 'bg-white border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
                            : 'bg-white border-gray-300 text-gray-500 hover:border-[#1B9387] hover:text-[#1B9387] hover:bg-[#E9FAFA]'
                        }`}
                      >
                        {isActive ? 'Archive' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {isEmpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
          <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl w-[500px] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#FBF8F8] border-b border-[#B0DCDA] flex justify-between items-center">
              <h3 className="text-lg font-extrabold text-gray-800 uppercase tracking-wide">
                {newEmp.id ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <button
                onClick={() => setIsEmpModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="empForm" onSubmit={handleSaveEmployee} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newEmp.firstName}
                      onChange={(e) => setNewEmp({ ...newEmp, firstName: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded p-2 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newEmp.lastName}
                      onChange={(e) => setNewEmp({ ...newEmp, lastName: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded p-2 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                      Position / Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={newEmp.position}
                      onChange={(e) => setNewEmp({ ...newEmp, position: e.target.value })}
                      placeholder="e.g. Nurse"
                      className="w-full bg-white border border-gray-300 rounded p-2 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                      Monthly Salary (₱) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newEmp.monthlySalary}
                      onChange={(e) => setNewEmp({ ...newEmp, monthlySalary: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-white border border-gray-300 rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm"
                    />
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-200">
                  <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest mb-4">
                    Government IDs
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 flex justify-between">
                        BIR TIN {!newEmp.tin && <span className="text-red-400">Required</span>}
                      </label>
                      <input
                        type="text"
                        value={newEmp.tin}
                        onChange={(e) => setNewEmp({ ...newEmp, tin: formatTIN(e.target.value) })}
                        placeholder="000-000-000-000"
                        className={`w-full bg-white border rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm ${!newEmp.tin ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 flex justify-between">
                        SSS No. {!newEmp.sss && <span className="text-red-400">Required</span>}
                      </label>
                      <input
                        type="text"
                        value={newEmp.sss}
                        onChange={(e) => setNewEmp({ ...newEmp, sss: formatSSS(e.target.value) })}
                        placeholder="00-0000000-0"
                        className={`w-full bg-white border rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm ${!newEmp.sss ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                        PhilHealth No.
                      </label>
                      <input
                        type="text"
                        value={newEmp.philhealth}
                        onChange={(e) =>
                          setNewEmp({ ...newEmp, philhealth: formatPHIC(e.target.value) })
                        }
                        placeholder="00-000000000-0"
                        className="w-full bg-white border border-gray-300 rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                        Pag-IBIG No.
                      </label>
                      <input
                        type="text"
                        value={newEmp.pagibig}
                        onChange={(e) =>
                          setNewEmp({ ...newEmp, pagibig: formatHDMF(e.target.value) })
                        }
                        placeholder="0000-0000-0000"
                        className="w-full bg-white border border-gray-300 rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEmpModalOpen(false)}
                className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-md text-sm font-bold transition cursor-pointer shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="empForm"
                disabled={loading}
                className="px-6 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white font-bold rounded-md transition cursor-pointer shadow-sm uppercase tracking-wider text-sm flex items-center gap-2"
              >
                {loading ? <span className="animate-spin">↻</span> : 'Save Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {employeeToToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
          <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-8 w-[420px] animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-extrabold text-gray-800 mb-2 uppercase tracking-wide">
              {employeeToToggle.isActive ? 'Archive Employee?' : 'Restore Employee?'}
            </h3>
            <p className="text-sm text-gray-600 mb-8 font-medium leading-relaxed">
              {employeeToToggle.isActive ? (
                <>
                  Archive <strong className="text-gray-800">{employeeToToggle.name}</strong>? They
                  will be hidden from the active payroll run.
                </>
              ) : (
                <>
                  Restore <strong className="text-gray-800">{employeeToToggle.name}</strong>? They
                  will be added back to the active payroll run.
                </>
              )}
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setEmployeeToToggle(null)}
                className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmToggleStatus}
                className={`px-5 py-2.5 text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm ${employeeToToggle.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1B9387] hover:bg-[#28958B]'}`}
              >
                {employeeToToggle.isActive ? 'Archive' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
