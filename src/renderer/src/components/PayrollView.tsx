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

    // 🔥 NEW: State for the custom confirmation modal
    const [employeeToToggle, setEmployeeToToggle] = useState<{ id: string, name: string, isActive: boolean } | null>(null);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getEmployees();
            setEmployees(data || []);
            
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

    // 🔥 NEW: Confirm the status toggle from the modal
    const confirmToggleStatus = async () => {
        if (!employeeToToggle) return;
        setStatus(null);
        
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const newStatus = !employeeToToggle.isActive;
            const response = await api.toggleEmployeeStatus(employeeToToggle.id, newStatus);
            
            if (response.success) {
                setStatus({ type: 'success', msg: `${employeeToToggle.name} marked as ${newStatus ? 'Active' : 'Inactive'}.` });
                fetchEmployees();
                setTimeout(() => setStatus(null), 3000);
            } else {
                setStatus({ type: 'error', msg: "Failed to update status." });
            }
        } catch (error) {
            setStatus({ type: 'error', msg: "System Error." });
        } finally {
            setEmployeeToToggle(null); // Close the modal
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
        <div className="max-w-6xl mx-auto h-full flex flex-col font-sans text-gray-200">
            <div className="flex justify-between items-end mb-6 border-b border-[#29292e] pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">Human Resources & Payroll</h2>
                    <p className="text-sm text-gray-400 mt-1">Manage staff directory and process batch salary disbursements.</p>
                </div>
                <div className="flex bg-[#121214] p-1 rounded-md border border-[#29292e]">
                    <button onClick={() => { setView('RUN'); setStatus(null); }} className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'RUN' ? 'bg-[#4f46e5] text-white' : 'text-[#8d8d99] hover:text-white'}`}>Run Payroll</button>
                    <button onClick={() => { setView('DIRECTORY'); setStatus(null); }} className={`px-4 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'DIRECTORY' ? 'bg-[#4f46e5] text-white' : 'text-[#8d8d99] hover:text-white'}`}>Employee Directory</button>
                </div>
            </div>

            {status && <div className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>{status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}</div>}

            {view === 'RUN' && (
                <div className="flex-1 flex flex-col animate-in fade-in duration-300">
                    <div className="grid grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Payroll Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Voucher No.</label>
                            <div className="flex">
                                <span className="bg-[#2a2a2f] border border-[#29292e] border-r-0 rounded-l-md px-4 py-3 text-sm font-bold text-gray-400 select-none">PY-</span>
                                <input type="text" required value={refSequence} onChange={e => setRefSequence(e.target.value)} placeholder="001" className="w-full bg-[#121214] border border-[#29292e] rounded-r-md p-3 text-sm font-mono text-white focus:border-[#4f46e5] outline-none transition" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Description / Memo</label>
                            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                        </div>
                    </div>

                    <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-xl flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#121214] sticky top-0 z-10 shadow-md">
                                    <tr className="text-[#8d8d99] uppercase tracking-wider text-xs border-b border-[#29292e]">
                                        <th className="p-4 font-bold">Employee Name</th>
                                        <th className="p-4 font-bold text-right text-white">Gross Pay</th>
                                        <th className="p-4 font-bold text-right text-orange-400">Gov. Deductions (SSS/PH)</th>
                                        <th className="p-4 font-bold text-right text-red-400">Tax Withheld</th>
                                        <th className="p-4 font-bold text-right text-emerald-400">Net Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#29292e]/50">
                                    {payrollItems.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-500 italic">No active employees found. Go to the Directory tab to add them.</td></tr>
                                    ) : (
                                        payrollItems.map((emp) => (
                                            <tr key={emp.id} className="hover:bg-[#2a2a2f] transition-colors">
                                                <td className="p-4 font-bold text-white">{emp.name}</td>
                                                <td className="p-4"><input type="number" min="0" value={emp.gross || ''} onChange={e => handleUpdateItem(emp.id, 'gross', Number(e.target.value))} className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-1.5 text-right font-mono text-white outline-none focus:border-[#4f46e5]" /></td>
                                                <td className="p-4"><input type="number" min="0" value={emp.deductions || ''} onChange={e => handleUpdateItem(emp.id, 'deductions', Number(e.target.value))} className="w-full bg-[#121214] border border-orange-900/50 rounded px-3 py-1.5 text-right font-mono text-orange-400 outline-none focus:border-orange-500" /></td>
                                                <td className="p-4"><input type="number" min="0" value={emp.tax || ''} onChange={e => handleUpdateItem(emp.id, 'tax', Number(e.target.value))} className="w-full bg-[#121214] border border-red-900/50 rounded px-3 py-1.5 text-right font-mono text-red-400 outline-none focus:border-red-500" /></td>
                                                <td className="p-4 text-right font-bold font-mono text-emerald-400 text-base">{formatCurrency(emp.net)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-[#1a1a1e] border-t border-[#29292e] p-6 flex justify-between items-center shadow-inner">
                            <div className="grid grid-cols-4 gap-8 text-sm w-3/4">
                                <div><p className="text-gray-500 uppercase text-[10px] font-bold tracking-widest">Total Gross</p><p className="font-mono text-white font-bold">{formatCurrency(totalGross)}</p></div>
                                <div><p className="text-orange-500 uppercase text-[10px] font-bold tracking-widest">Total Deductions</p><p className="font-mono text-orange-400 font-bold">{formatCurrency(totalDeductions)}</p></div>
                                <div><p className="text-red-500 uppercase text-[10px] font-bold tracking-widest">Total Tax W/H</p><p className="font-mono text-red-400 font-bold">{formatCurrency(totalTax)}</p></div>
                                <div><p className="text-emerald-500 uppercase text-[10px] font-bold tracking-widest">Total Net Payout</p><p className="font-mono text-emerald-400 font-bold text-lg">{formatCurrency(totalNet)}</p></div>
                            </div>
                            <button onClick={handleProcessPayroll} disabled={loading || payrollItems.length === 0} className="px-8 py-3 bg-[#4f46e5] hover:bg-[#4338ca] disabled:bg-[#29292e] disabled:text-gray-500 text-white rounded-lg font-bold transition shadow-lg tracking-wide cursor-pointer">
                                {loading ? 'Processing...' : 'Post Payroll'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'DIRECTORY' && (
                <div className="flex-1 grid grid-cols-3 gap-8 animate-in fade-in duration-300">
                    
                    <div className="col-span-1 bg-[#202024] border border-[#29292e] rounded-lg p-6 shadow-lg h-fit">
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-[#29292e] pb-2">Add New Employee</h3>
                        <form onSubmit={handleCreateEmployee} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] uppercase text-gray-400 mb-1">First Name</label><input type="text" required value={newEmp.firstName} onChange={e => setNewEmp({...newEmp, firstName: e.target.value})} className="w-full bg-[#121214] border border-[#29292e] rounded p-2 text-sm text-white" /></div>
                                <div><label className="block text-[10px] uppercase text-gray-400 mb-1">Last Name</label><input type="text" required value={newEmp.lastName} onChange={e => setNewEmp({...newEmp, lastName: e.target.value})} className="w-full bg-[#121214] border border-[#29292e] rounded p-2 text-sm text-white" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] uppercase text-gray-400 mb-1">Position / Title</label><input type="text" required value={newEmp.position} onChange={e => setNewEmp({...newEmp, position: e.target.value})} placeholder="e.g. Head Nurse" className="w-full bg-[#121214] border border-[#29292e] rounded p-2 text-sm text-white" /></div>
                                <div><label className="block text-[10px] uppercase text-gray-400 mb-1">Monthly Base Salary</label><input type="number" required value={newEmp.monthlySalary} onChange={e => setNewEmp({...newEmp, monthlySalary: e.target.value})} placeholder="0.00" className="w-full bg-[#121214] border border-[#29292e] rounded p-2 text-sm font-mono text-white" /></div>
                            </div>
                            
                            <div className="pt-2 border-t border-[#29292e]"></div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] uppercase text-gray-400 mb-1">BIR TIN</label><input type="text" value={newEmp.tin} onChange={e => setNewEmp({...newEmp, tin: e.target.value})} className="w-full bg-[#121214] border border-[#29292e] rounded p-2 text-sm font-mono text-gray-300" /></div>
                                <div><label className="block text-[10px] uppercase text-gray-400 mb-1">SSS Number</label><input type="text" value={newEmp.sss} onChange={e => setNewEmp({...newEmp, sss: e.target.value})} className="w-full bg-[#121214] border border-[#29292e] rounded p-2 text-sm font-mono text-gray-300" /></div>
                                <div><label className="block text-[10px] uppercase text-gray-400 mb-1">PhilHealth No.</label><input type="text" value={newEmp.philhealth} onChange={e => setNewEmp({...newEmp, philhealth: e.target.value})} className="w-full bg-[#121214] border border-[#29292e] rounded p-2 text-sm font-mono text-gray-300" /></div>
                                <div><label className="block text-[10px] uppercase text-gray-400 mb-1">Pag-IBIG No.</label><input type="text" value={newEmp.pagibig} onChange={e => setNewEmp({...newEmp, pagibig: e.target.value})} className="w-full bg-[#121214] border border-[#29292e] rounded p-2 text-sm font-mono text-gray-300" /></div>
                            </div>
                            
                            <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded transition mt-4 cursor-pointer">Save Employee</button>
                        </form>
                    </div>

                    <div className="col-span-2 bg-[#202024] border border-[#29292e] rounded-lg shadow-xl overflow-hidden flex flex-col">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#121214] border-b border-[#29292e]">
                                <tr className="text-[#8d8d99] uppercase tracking-wider text-xs">
                                    <th className="p-4 font-bold text-center">Status</th>
                                    <th className="p-4 font-bold">Name & Position</th>
                                    <th className="p-4 font-bold">Base Salary</th>
                                    <th className="p-4 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#29292e]/50">
                                {employees.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-gray-500 italic">No employees found.</td></tr>
                                ) : (
                                    employees.map((emp) => {
                                        const isActive = emp.is_active !== false; 
                                        return (
                                            <tr key={emp.id} className={`transition-colors ${isActive ? 'hover:bg-[#2a2a2f]' : 'bg-[#1a1a1e] opacity-60'}`}>
                                                <td className="p-4 text-center">
                                                    {isActive ? (
                                                        <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-bold rounded uppercase">Active</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] font-bold rounded uppercase">Archived</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-bold text-white">{emp.first_name} {emp.last_name}</p>
                                                    <p className="text-xs text-[#4f46e5] font-bold uppercase tracking-wider">{emp.position}</p>
                                                </td>
                                                <td className="p-4 font-mono text-emerald-400 font-bold">{formatCurrency(Number(emp.monthly_salary))}</td>
                                                <td className="p-4 text-right">
                                                    <button 
                                                        onClick={() => setEmployeeToToggle({ id: emp.id, name: `${emp.first_name} ${emp.last_name}`, isActive })} 
                                                        className={`text-xs font-bold px-3 py-1.5 rounded transition cursor-pointer ${isActive ? 'bg-[#29292e] text-white hover:bg-gray-600' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/60'}`}
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

            {/* 🔥 NEW: CUSTOM CONFIRMATION MODAL */}
            {employeeToToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-[420px] animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">
                            {employeeToToggle.isActive ? 'Archive Employee?' : 'Restore Employee?'}
                        </h3>
                        <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                            {employeeToToggle.isActive 
                                ? <>Are you sure you want to archive <strong className="text-white">{employeeToToggle.name}</strong>? They will be hidden from the next payroll run.</>
                                : <>Are you sure you want to restore <strong className="text-white">{employeeToToggle.name}</strong>? They will be added back to the active payroll run.</>
                            }
                        </p>
                        <div className="flex justify-end gap-3 pt-4 border-t border-[#29292e]">
                            <button 
                                onClick={() => setEmployeeToToggle(null)} 
                                className="px-4 py-2 bg-[#29292e] hover:bg-[#3a3a42] text-gray-300 rounded text-sm font-bold transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmToggleStatus} 
                                className={`px-4 py-2 text-white rounded text-sm font-bold transition cursor-pointer ${employeeToToggle.isActive ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
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