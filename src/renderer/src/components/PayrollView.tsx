// src/renderer/src/components/PayrollView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export function PayrollView({ userId }: { userId: string }) {
    const [view, setView] = useState<'RUN' | 'DIRECTORY'>('RUN');
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Run Payroll States
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [refSequence, setRefSequence] = useState('');
    const [description, setDescription] = useState('Salary for August 15-30');
    const [payrollItems, setPayrollItems] = useState<any[]>([]);

    // New Employee Form States
    const [newEmp, setNewEmp] = useState({ firstName: '', lastName: '', position: '', monthlySalary: '', tin: '', sss: '', philhealth: '', pagibig: '' });

    // Custom confirmation modal state
    const [employeeToToggle, setEmployeeToToggle] = useState<{ id: string, name: string, isActive: boolean } | null>(null);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getEmployees();
            setEmployees(data || []);
            
            // 🔥 THE FIX: Check 'is_active' boolean
            const activeEmployees = (data || []).filter((emp: any) => emp.is_active !== false);

            const initialItems = activeEmployees.map((emp: any) => ({
                id: emp.id, 
                name: `${emp.first_name} ${emp.last_name}`,
                gross: emp.monthly_salary ? (Number(emp.monthly_salary) / 2) : 0, 
                deductions: 0, 
                tax: 0, 
                net: 0
            }));
            
            initialItems.forEach((item: any) => item.net = item.gross - item.deductions - item.tax);
            setPayrollItems(initialItems);
        } catch (error) { 
            console.error(error); 
        } finally {
            setLoading(false);
        }
    };

    const fetchNextSeq = async () => {
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const nextSeq = await api.getNextSequence('PY-'); 
            setRefSequence(nextSeq);
        } catch (error) { 
            console.error(error); 
        }
    };

    useEffect(() => {
        fetchEmployees();
        fetchNextSeq();
    }, [view]);

    const handleUpdateItem = (id: number, field: string, value: number) => {
        setPayrollItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                updated.net = updated.gross - updated.deductions - updated.tax;
                return updated;
            }
            return item;
        }));
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null); 
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const response = await api.createEmployee(newEmp);
            if (response.success) {
                setStatus({ type: 'success', msg: `Employee ${newEmp.firstName} added to directory!` });
                setNewEmp({ firstName: '', lastName: '', position: '', monthlySalary: '', tin: '', sss: '', philhealth: '', pagibig: '' });
                fetchEmployees();
                setTimeout(() => setStatus(null), 3000);
            } else {
                setStatus({ type: 'error', msg: "Failed: " + response.error });
            }
        } catch (error) { 
            setStatus({ type: 'error', msg: "System Error." }); 
        } finally {
            setLoading(false);
        }
    };

    const confirmToggleStatus = async () => {
        if (!employeeToToggle) return;
        setStatus(null);
        
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const newStatus = !employeeToToggle.isActive;
            const response = await api.toggleEmployeeStatus(employeeToToggle.id, newStatus);
            
            if (response.success) {
                setStatus({ type: 'success', msg: `${employeeToToggle.name} marked as ${newStatus ? 'Active' : 'Archived'}.` });
                fetchEmployees();
                setTimeout(() => setStatus(null), 3000);
            } else {
                setStatus({ type: 'error', msg: "Failed to update status in database." });
            }
        } catch (error) {
            setStatus({ type: 'error', msg: "System Error." });
        } finally {
            setEmployeeToToggle(null); 
        }
    };

    const handleProcessPayroll = async () => {
        setStatus(null);
        if (!refSequence) return setStatus({ type: 'error', msg: "Sequence number required." });
        if (payrollItems.length === 0) return setStatus({ type: 'error', msg: "No active employees to pay." });

        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const payload = {
                date,
                referenceNo: `PY-${refSequence.padStart(3, '0')}`,
                description,
                userId,
                employees: payrollItems
            };

            const response = await api.processPayroll(payload);
            if (response.success) {
                setStatus({ type: 'success', msg: `Payroll ${payload.referenceNo} processed and posted to the General Ledger!` });
                fetchNextSeq();
                fetchEmployees(); 
            } else {
                setStatus({ type: 'error', msg: "Database Error: " + response.error });
            }
        } catch (error) { 
            setStatus({ type: 'error', msg: "System Error." }); 
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const totalGross = payrollItems.reduce((sum, item) => sum + item.gross, 0);
    const totalDeductions = payrollItems.reduce((sum, item) => sum + item.deductions, 0);
    const totalTax = payrollItems.reduce((sum, item) => sum + item.tax, 0);
    const totalNet = payrollItems.reduce((sum, item) => sum + item.net, 0);

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col font-sans text-gray-800">
            
            {/* HEADER */}
            <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Human Resources & Payroll</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Manage staff directory and process batch salary disbursements.</p>
                </div>
                <div className="flex bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner">
                    <button onClick={() => { setView('RUN'); setStatus(null); }} className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'RUN' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}>
                        Run Payroll
                    </button>
                    <button onClick={() => { setView('DIRECTORY'); setStatus(null); }} className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'DIRECTORY' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}>
                        Employee Directory
                    </button>
                </div>
            </div>

            {/* STATUS MESSAGE */}
            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            {/* ========================================== */}
            {/* RUN PAYROLL TAB                            */}
            {/* ========================================== */}
            {view === 'RUN' && (
                <div className="flex-1 flex flex-col animate-in fade-in duration-300">
                    <div className="grid grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Payroll Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Voucher No.</label>
                            <div className="flex">
                                <span className="bg-gray-50 border border-[#B0DCDA] border-r-0 rounded-l-md px-4 py-3 text-sm font-extrabold text-gray-500 select-none">PY-</span>
                                <input type="text" required value={refSequence} onChange={e => setRefSequence(e.target.value)} placeholder="001" className="w-full bg-white border border-[#B0DCDA] rounded-r-md p-3 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Description / Memo</label>
                            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                        </div>
                    </div>

                    <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#FBF8F8] sticky top-0 z-10 shadow-sm">
                                    <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold border-b border-[#B0DCDA]">
                                        <th className="p-4 border-r border-[#B0DCDA]">Employee Name</th>
                                        <th className="p-4 text-right border-r border-[#B0DCDA]">Gross Pay</th>
                                        <th className="p-4 text-right text-orange-500 border-r border-[#B0DCDA]">Gov. Deductions (SSS/PH)</th>
                                        <th className="p-4 text-right text-red-500 border-r border-[#B0DCDA]">Tax Withheld</th>
                                        <th className="p-4 text-right text-[#1B9387]">Net Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {payrollItems.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-500 italic font-medium">No active employees found. Go to the Directory tab to add them.</td></tr>
                                    ) : (
                                        payrollItems.map((emp) => (
                                            <tr key={emp.id} className="hover:bg-[#E9FAFA]/50 transition-colors even:bg-gray-50 odd:bg-white">
                                                <td className="p-4 font-bold text-gray-800 border-r border-[#B0DCDA]">{emp.name}</td>
                                                <td className="p-0 border-r border-[#B0DCDA]">
                                                    <input type="number" min="0" value={emp.gross === 0 ? '' : emp.gross} placeholder="0.00" onChange={e => handleUpdateItem(emp.id, 'gross', Number(e.target.value))} className="w-full h-full min-h-[50px] bg-transparent px-4 py-2 text-right font-mono font-bold text-gray-800 outline-none focus:bg-[#E9FAFA]" />
                                                </td>
                                                <td className="p-0 border-r border-[#B0DCDA]">
                                                    <input type="number" min="0" value={emp.deductions === 0 ? '' : emp.deductions} placeholder="0.00" onChange={e => handleUpdateItem(emp.id, 'deductions', Number(e.target.value))} className="w-full h-full min-h-[50px] bg-transparent px-4 py-2 text-right font-mono font-bold text-orange-500 outline-none focus:bg-orange-50" />
                                                </td>
                                                <td className="p-0 border-r border-[#B0DCDA]">
                                                    <input type="number" min="0" value={emp.tax === 0 ? '' : emp.tax} placeholder="0.00" onChange={e => handleUpdateItem(emp.id, 'tax', Number(e.target.value))} className="w-full h-full min-h-[50px] bg-transparent px-4 py-2 text-right font-mono font-bold text-red-500 outline-none focus:bg-red-50" />
                                                </td>
                                                <td className="p-4 text-right font-black font-mono text-[#1B9387] text-base bg-[#FBF8F8]/50">
                                                    {formatCurrency(emp.net)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-[#FBF8F8] border-t border-[#B0DCDA] p-6 flex justify-between items-center shadow-inner">
                            <div className="grid grid-cols-4 gap-8 text-sm w-3/4">
                                <div><p className="text-gray-500 uppercase text-[10px] font-extrabold tracking-widest">Total Gross</p><p className="font-mono text-gray-800 font-bold text-lg mt-1">{formatCurrency(totalGross)}</p></div>
                                <div><p className="text-orange-500 uppercase text-[10px] font-extrabold tracking-widest">Total Deductions</p><p className="font-mono text-orange-500 font-bold text-lg mt-1">{formatCurrency(totalDeductions)}</p></div>
                                <div><p className="text-red-500 uppercase text-[10px] font-extrabold tracking-widest">Total Tax W/H</p><p className="font-mono text-red-500 font-bold text-lg mt-1">{formatCurrency(totalTax)}</p></div>
                                <div><p className="text-[#1B9387] uppercase text-[10px] font-extrabold tracking-widest">Total Net Payout</p><p className="font-mono text-[#1B9387] font-black text-xl mt-1">{formatCurrency(totalNet)}</p></div>
                            </div>
                            <button onClick={handleProcessPayroll} disabled={loading || payrollItems.length === 0} className="px-8 py-3.5 bg-[#1B9387] hover:bg-[#28958B] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg font-bold transition shadow-md tracking-wide cursor-pointer uppercase text-sm">
                                {loading ? 'Processing...' : 'Post Payroll'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* EMPLOYEE DIRECTORY TAB                     */}
            {/* ========================================== */}
            {view === 'DIRECTORY' && (
                <div className="flex-1 grid grid-cols-3 gap-8 animate-in fade-in duration-300">
                    
                    {/* ADD EMPLOYEE FORM */}
                    <div className="col-span-1 bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm h-fit">
                        <h3 className="text-lg font-extrabold text-gray-800 mb-5 border-b border-gray-100 pb-3">Add New Employee</h3>
                        <form onSubmit={handleCreateEmployee} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">First Name</label><input type="text" required value={newEmp.firstName} onChange={e => setNewEmp({...newEmp, firstName: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none" /></div>
                                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Last Name</label><input type="text" required value={newEmp.lastName} onChange={e => setNewEmp({...newEmp, lastName: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Position / Title</label><input type="text" required value={newEmp.position} onChange={e => setNewEmp({...newEmp, position: e.target.value})} placeholder="e.g. Head Nurse" className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none" /></div>
                                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Monthly Base Salary</label><input type="number" required value={newEmp.monthlySalary} onChange={e => setNewEmp({...newEmp, monthlySalary: e.target.value})} placeholder="0.00" className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none" /></div>
                            </div>
                            
                            <div className="pt-3 border-t border-gray-100"></div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">BIR TIN</label><input type="text" value={newEmp.tin} onChange={e => setNewEmp({...newEmp, tin: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm font-mono font-medium text-gray-800 focus:border-[#1B9387] outline-none" /></div>
                                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">SSS Number</label><input type="text" value={newEmp.sss} onChange={e => setNewEmp({...newEmp, sss: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm font-mono font-medium text-gray-800 focus:border-[#1B9387] outline-none" /></div>
                                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">PhilHealth No.</label><input type="text" value={newEmp.philhealth} onChange={e => setNewEmp({...newEmp, philhealth: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm font-mono font-medium text-gray-800 focus:border-[#1B9387] outline-none" /></div>
                                <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Pag-IBIG No.</label><input type="text" value={newEmp.pagibig} onChange={e => setNewEmp({...newEmp, pagibig: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm font-mono font-medium text-gray-800 focus:border-[#1B9387] outline-none" /></div>
                            </div>
                            
                            <button type="submit" disabled={loading} className="w-full bg-[#1B9387] hover:bg-[#28958B] text-white font-bold py-3 rounded-md transition mt-6 cursor-pointer shadow-sm uppercase tracking-wider text-sm">Save Employee</button>
                        </form>
                    </div>

                    {/* EMPLOYEE LIST TABLE */}
                    <div className="col-span-2 bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA]">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 text-center w-24">Status</th>
                                    <th className="p-4">Name & Position</th>
                                    <th className="p-4">Base Salary</th>
                                    <th className="p-4">Government IDs</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {employees.length === 0 ? (
                                    <tr><td colSpan={5} className="p-12 text-center text-gray-500 italic font-medium">No employees found.</td></tr>
                                ) : (
                                    employees.map((emp) => {
                                        // 🔥 THE FIX: Check 'is_active' boolean
                                        const isActive = emp.is_active !== false; 
                                        
                                        return (
                                            <tr key={emp.id} className={`transition-colors ${isActive ? 'hover:bg-gray-50 even:bg-gray-50/50 odd:bg-white' : 'bg-gray-100 opacity-60'}`}>
                                                <td className="p-4 text-center">
                                                    {isActive ? (
                                                        <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Active</span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-500 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Archived</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-extrabold text-gray-800 text-base">{emp.first_name} {emp.last_name}</p>
                                                    <p className="text-[10px] text-[#1B9387] font-extrabold uppercase tracking-wider mt-0.5">{emp.position}</p>
                                                </td>
                                                <td className="p-4 font-mono text-[#1B9387] font-bold">{formatCurrency(Number(emp.monthly_salary))}</td>
                                                <td className="p-4 text-xs text-gray-500 space-y-1 font-medium">
                                                    <p><span className="w-8 inline-block">TIN:</span> <span className="font-mono text-gray-800 font-bold">{emp.tin || '-'}</span></p>
                                                    <p><span className="w-8 inline-block">SSS:</span> <span className="font-mono text-gray-800 font-bold">{emp.sss_no || '-'}</span></p>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button 
                                                        onClick={() => setEmployeeToToggle({ id: emp.id, name: `${emp.first_name} ${emp.last_name}`, isActive })} 
                                                        className={`text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-2 rounded-md transition cursor-pointer shadow-sm ${
                                                            isActive 
                                                            ? 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-red-600' 
                                                            : 'bg-[#1B9387] border border-transparent text-white hover:bg-[#28958B]'
                                                        }`}
                                                    >
                                                        {isActive ? 'Archive' : 'Restore'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            )}

            {/* CUSTOM CONFIRMATION MODAL */}
            {employeeToToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-8 w-[420px] animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-extrabold text-gray-800 mb-2 uppercase tracking-wide">
                            {employeeToToggle.isActive ? 'Archive Employee?' : 'Restore Employee?'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-8 font-medium leading-relaxed">
                            {employeeToToggle.isActive 
                                ? <>Are you sure you want to archive <strong className="text-gray-800">{employeeToToggle.name}</strong>? They will be hidden from the active payroll run.</>
                                : <>Are you sure you want to restore <strong className="text-gray-800">{employeeToToggle.name}</strong>? They will be added back to the active payroll run.</>
                            }
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
                                className={`px-5 py-2.5 text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm ${
                                    employeeToToggle.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1B9387] hover:bg-[#28958B]'
                                }`}
                            >
                                {employeeToToggle.isActive ? 'Archive' : 'Restore'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}