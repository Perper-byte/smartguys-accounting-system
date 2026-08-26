import * as React from 'react';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export function PayrollView({ userId }: { userId: string }) {
    const [view, setView] = useState<'RUN' | 'DIRECTORY' | 'HISTORY'>('RUN');
    const [employees, setEmployees] = useState<any[]>([]);
    const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Run Payroll States
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [refSequence, setRefSequence] = useState('');
    const [description, setDescription] = useState('Salary for August 15-30');
    const [payrollItems, setPayrollItems] = useState<any[]>([]);

    // New Employee Form States
    const [newEmp, setNewEmp] = useState({ firstName: '', lastName: '', position: '', monthlySalary: '', tin: '', sss: '', philhealth: '', pagibig: '' });

    const [employeeToToggle, setEmployeeToToggle] = useState<{ id: string, name: string, isActive: boolean } | null>(null);
    
    // 🔥 NEW: Payslip Modal State
    const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getEmployees();
            setEmployees(data || []);
            
            const activeEmployees = (data || []).filter((emp: any) => emp.is_active !== false);

            const initialItems = activeEmployees.map((emp: any) => {
                const base = emp.monthly_salary ? (Number(emp.monthly_salary) / 2) : 0;
                return {
                    id: emp.id, name: `${emp.first_name} ${emp.last_name}`,
                    basePay: base, overtime: 0, nightDiff: 0, otherEarnings: 0, gross: base, 
                    sss: 0, philhealth: 0, pagibig: 0, cashAdvance: 0, licenseFee: 0, otherDeductions: 0, deductions: 0, 
                    tax: 0, net: base
                };
            });
            setPayrollItems(initialItems);
        } catch (error) { console.error(error); } 
        finally { setLoading(false); }
    };

    const fetchNextSeq = async () => {
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const nextSeq = await api.getNextSequence('PY-'); 
            setRefSequence(nextSeq);
        } catch (error) { console.error(error); }
    };

    const fetchHistory = async () => {
        try {
            const api = (window as any).api || (window as any).electronAPI;
            if (api.getPayrollHistory) {
                const history = await api.getPayrollHistory();
                setPayrollHistory(history || []);
            }
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        if (view === 'RUN') { fetchEmployees(); fetchNextSeq(); }
        if (view === 'DIRECTORY') fetchEmployees();
        if (view === 'HISTORY') fetchHistory();
    }, [view]);

    const handleUpdateItem = (id: number, field: string, value: number) => {
        setPayrollItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                updated.gross = (updated.basePay || 0) + (updated.overtime || 0) + (updated.nightDiff || 0) + (updated.otherEarnings || 0);
                updated.deductions = (updated.sss || 0) + (updated.philhealth || 0) + (updated.pagibig || 0) + (updated.cashAdvance || 0) + (updated.licenseFee || 0) + (updated.otherDeductions || 0);
                updated.net = updated.gross - updated.deductions - (updated.tax || 0);
                return updated;
            }
            return item;
        }));
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null); setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const response = await api.createEmployee(newEmp);
            if (response.success) {
                setStatus({ type: 'success', msg: `Employee added to directory!` });
                setNewEmp({ firstName: '', lastName: '', position: '', monthlySalary: '', tin: '', sss: '', philhealth: '', pagibig: '' });
                fetchEmployees();
                setTimeout(() => setStatus(null), 3000);
            } else setStatus({ type: 'error', msg: "Failed: " + response.error });
        } catch (error) { setStatus({ type: 'error', msg: "System Error." }); } 
        finally { setLoading(false); }
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
            } else setStatus({ type: 'error', msg: "Failed to update status in database." });
        } catch (error) { setStatus({ type: 'error', msg: "System Error." }); } 
        finally { setEmployeeToToggle(null); }
    };

    const handleProcessPayroll = async () => {
        setStatus(null);
        if (!refSequence) return setStatus({ type: 'error', msg: "Sequence number required." });
        if (payrollItems.length === 0) return setStatus({ type: 'error', msg: "No active employees to pay." });

        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const payload = {
                date, referenceNo: `PY-${refSequence.padStart(3, '0')}`, description, userId, employees: payrollItems 
            };

            const response = await api.processPayroll(payload);
            if (response.success) {
                setStatus({ type: 'success', msg: `Payroll ${payload.referenceNo} processed! Payslips securely stored.` });
                fetchNextSeq();
                fetchEmployees(); 
            } else setStatus({ type: 'error', msg: "Database Error: " + response.error });
        } catch (error) { setStatus({ type: 'error', msg: "System Error." }); } 
        finally { setLoading(false); }
    };

    const handleExportExcel = () => {
        if (payrollItems.length === 0) return alert("No active employees to export.");
        const exportData = payrollItems.map(emp => ({
            'Employee Name': emp.name, 'Base Pay': emp.basePay || 0, 'Overtime': emp.overtime || 0, 'Night Diff': emp.nightDiff || 0, 'Other Earnings': emp.otherEarnings || 0, 'Total Gross': emp.gross || 0,
            'SSS': emp.sss || 0, 'PhilHealth': emp.philhealth || 0, 'Pag-IBIG': emp.pagibig || 0, 'Cash Advance': emp.cashAdvance || 0, 'License Fee': emp.licenseFee || 0, 'Other Deductions': emp.otherDeductions || 0, 'Total Deductions': emp.deductions || 0,
            'Tax Withheld': emp.tax || 0, 'Net Pay': emp.net || 0
        }));
        exportData.push({ 'Employee Name': 'GRAND TOTALS', 'Base Pay': '', 'Overtime': '', 'Night Diff': '', 'Other Earnings': '', 'Total Gross': totalGross, 'SSS': '', 'PhilHealth': '', 'Pag-IBIG': '', 'Cash Advance': '', 'License Fee': '', 'Other Deductions': '', 'Total Deductions': totalDeductions, 'Tax Withheld': totalTax, 'Net Pay': totalNet });
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Run");
        XLSX.writeFile(workbook, `Payroll_Run_${date}.xlsx`);
    };

    const formatCurrency = (val: number) => `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const totalGross = payrollItems.reduce((sum, item) => sum + item.gross, 0);
    const totalDeductions = payrollItems.reduce((sum, item) => sum + item.deductions, 0);
    const totalTax = payrollItems.reduce((sum, item) => sum + item.tax, 0);
    const totalNet = payrollItems.reduce((sum, item) => sum + item.net, 0);

    const renderInput = (id: number, value: number, field: string, textColor: string, focusBg: string) => (
        <td className="p-0 border-r border-gray-200">
            <input type="number" min="0" step="0.01" value={value === 0 ? '' : value} placeholder="0.00" onChange={e => handleUpdateItem(id, field, Number(e.target.value))} className={`w-28 h-full min-h-[48px] bg-transparent px-3 text-right font-mono font-bold ${textColor} outline-none focus:${focusBg} transition-colors`} />
        </td>
    );

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col font-sans text-gray-800">
            
            {/* HEADER */}
            <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4 print:hidden">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Human Resources & Payroll</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Manage staff directory and process batch salary disbursements.</p>
                </div>
                <div className="flex bg-[#FBF8F8] p-1.5 rounded-lg border border-[#B0DCDA] shadow-inner">
                    <button onClick={() => { setView('RUN'); setStatus(null); }} className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'RUN' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}>Run Payroll</button>
                    <button onClick={() => { setView('HISTORY'); setStatus(null); }} className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'HISTORY' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}>Payslip History</button>
                    <button onClick={() => { setView('DIRECTORY'); setStatus(null); }} className={`px-5 py-2 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer ${view === 'DIRECTORY' ? 'bg-[#1B9387] text-white shadow-md' : 'text-gray-500 hover:text-[#1B9387] hover:bg-[#E9FAFA]'}`}>Employee Directory</button>
                </div>
            </div>

            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border print:hidden ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            {/* ========================================== */}
            {/* RUN PAYROLL TAB                            */}
            {/* ========================================== */}
            {view === 'RUN' && (
                <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0 print:hidden">
                    <div className="grid grid-cols-4 gap-6 mb-4">
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
                        <div className="col-span-2 flex items-end justify-between">
                            <div className="flex-1 mr-4">
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Description / Memo</label>
                                <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                            </div>
                            <button onClick={handleExportExcel} disabled={payrollItems.length === 0} className="px-5 py-3 h-12 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] text-xs font-extrabold text-[#1B9387] rounded-md tracking-wider uppercase transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50">
                                <span>📊</span> <span>Export to Bank</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto bg-white border border-[#B0DCDA] rounded-xl shadow-sm mb-6 relative">
                        <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                            <thead className="bg-[#FBF8F8] sticky top-0 z-30 shadow-sm">
                                <tr className="border-b border-gray-200 text-center text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                    <th className="p-2 border-r border-[#B0DCDA] sticky left-0 z-40 bg-[#FBF8F8]"></th>
                                    <th colSpan={4} className="p-2 border-r border-[#B0DCDA] text-blue-600 bg-blue-50/50">Earnings</th>
                                    <th colSpan={7} className="p-2 border-r border-[#B0DCDA] text-orange-500 bg-orange-50/50">Deductions & Taxes</th>
                                    <th className="p-2 text-[#1B9387] bg-[#E9FAFA]/50">Payout</th>
                                </tr>
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold border-b border-[#B0DCDA]">
                                    <th className="p-3 border-r border-[#B0DCDA] sticky left-0 z-40 bg-[#FBF8F8] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Employee Name</th>
                                    <th className="p-3 text-right border-r border-gray-200">Base Pay</th>
                                    <th className="p-3 text-right border-r border-gray-200">Overtime</th>
                                    <th className="p-3 text-right border-r border-gray-200">Night Diff</th>
                                    <th className="p-3 text-right border-r border-gray-200">Other Earn.</th>
                                    <th className="p-3 text-right border-r border-[#B0DCDA] text-blue-600 bg-blue-50/50">Total Gross</th>
                                    <th className="p-3 text-right border-r border-gray-200">SSS</th>
                                    <th className="p-3 text-right border-r border-gray-200">PhilHealth</th>
                                    <th className="p-3 text-right border-r border-gray-200">Pag-IBIG</th>
                                    <th className="p-3 text-right border-r border-gray-200">Cash Adv.</th>
                                    <th className="p-3 text-right border-r border-gray-200">Lic. Fee</th>
                                    <th className="p-3 text-right border-r border-gray-200">Other Ded.</th>
                                    <th className="p-3 text-right border-r border-[#B0DCDA] text-red-500 bg-red-50/50">Tax W/H</th>
                                    <th className="p-3 text-right text-[#1B9387] bg-[#E9FAFA]/50 pr-5">Net Pay</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {payrollItems.length === 0 ? (
                                    <tr><td colSpan={14} className="p-8 text-center text-gray-500 italic font-medium">No active employees found. Go to the Directory tab to add them.</td></tr>
                                ) : (
                                    payrollItems.map((emp) => (
                                        <tr key={emp.id} className="hover:bg-[#E9FAFA]/30 transition-colors group even:bg-gray-50 odd:bg-white">
                                            <td className="p-3 font-bold text-gray-800 border-r border-[#B0DCDA] sticky left-0 z-10 bg-white group-hover:bg-[#FBF8F8] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{emp.name}</td>
                                            {renderInput(emp.id, emp.basePay, 'basePay', 'text-gray-800', 'bg-blue-50')}
                                            {renderInput(emp.id, emp.overtime, 'overtime', 'text-blue-600', 'bg-blue-50')}
                                            {renderInput(emp.id, emp.nightDiff, 'nightDiff', 'text-blue-600', 'bg-blue-50')}
                                            {renderInput(emp.id, emp.otherEarnings, 'otherEarnings', 'text-blue-600', 'bg-blue-50')}
                                            <td className="p-3 text-right font-black font-mono text-blue-600 border-r border-[#B0DCDA] bg-blue-50/30">{formatCurrency(emp.gross)}</td>
                                            {renderInput(emp.id, emp.sss, 'sss', 'text-orange-500', 'bg-orange-50')}
                                            {renderInput(emp.id, emp.philhealth, 'philhealth', 'text-rose-500', 'bg-rose-50')}
                                            {renderInput(emp.id, emp.pagibig, 'pagibig', 'text-amber-500', 'bg-amber-50')}
                                            {renderInput(emp.id, emp.cashAdvance, 'cashAdvance', 'text-red-500', 'bg-red-50')}
                                            {renderInput(emp.id, emp.licenseFee, 'licenseFee', 'text-red-500', 'bg-red-50')}
                                            {renderInput(emp.id, emp.otherDeductions, 'otherDeductions', 'text-red-500', 'bg-red-50')}
                                            {renderInput(emp.id, emp.tax, 'tax', 'text-red-600', 'bg-red-50')}
                                            <td className="p-3 pr-5 text-right font-black font-mono text-[#1B9387] text-base bg-[#FBF8F8]/50">{formatCurrency(emp.net)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-[#FBF8F8] border border-[#B0DCDA] rounded-xl p-6 flex justify-between items-center shadow-sm shrink-0">
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
            )}

            {/* ========================================== */}
            {/* PAYSLIP HISTORY TAB                        */}
            {/* ========================================== */}
            {view === 'HISTORY' && (
                <div className="flex-1 bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300 print:hidden">
                    <div className="p-5 border-b border-[#B0DCDA] bg-[#FBF8F8]">
                        <h3 className="text-lg font-extrabold text-gray-800 tracking-wide">Historical Payroll Runs</h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">Select a past payroll run to view and print individual employee payslips.</p>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-4 bg-[#FBF8F8]">
                        {payrollHistory.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 italic font-medium">No payroll history found.</div>
                        ) : (
                            payrollHistory.map((run) => (
                                <div key={run.id} className="bg-white border border-[#B0DCDA] rounded-lg shadow-sm overflow-hidden">
                                    <div 
                                        onClick={() => setExpandedHistoryId(expandedHistoryId === run.id ? null : run.id)}
                                        className="p-4 flex justify-between items-center cursor-pointer hover:bg-[#E9FAFA] transition"
                                    >
                                        <div className="flex items-center space-x-6">
                                            <span className="font-extrabold text-[#1B9387] font-mono text-lg">{run.referenceNo}</span>
                                            <span className="text-gray-600 font-medium text-sm">{new Date(run.date).toLocaleDateString()}</span>
                                            <span className="text-gray-800 font-bold text-sm">{run.description}</span>
                                        </div>
                                        <div className="flex items-center space-x-6">
                                            <span className="text-sm font-bold text-gray-500">{run.payslips.length} Employees</span>
                                            <span className="text-lg font-black text-[#1B9387] font-mono">{formatCurrency(run.payslips.reduce((sum:number, p:any) => sum + p.net_pay, 0))}</span>
                                            <span className="text-gray-400">{expandedHistoryId === run.id ? '▲' : '▼'}</span>
                                        </div>
                                    </div>
                                    
                                    {expandedHistoryId === run.id && (
                                        <div className="bg-gray-50 border-t border-[#B0DCDA] p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {run.payslips.map((payslip: any) => (
                                                    <div key={payslip.id} className="bg-white border border-gray-200 p-4 rounded-md shadow-sm flex justify-between items-center hover:border-[#1B9387] transition">
                                                        <div>
                                                            <p className="font-extrabold text-gray-800">{payslip.employee.first_name} {payslip.employee.last_name}</p>
                                                            <p className="text-xs text-gray-500 font-medium mt-1">Net Pay: <span className="font-bold text-[#1B9387] font-mono">{formatCurrency(payslip.net_pay)}</span></p>
                                                        </div>
                                                        <button 
                                                            onClick={() => setSelectedPayslip(payslip)} 
                                                            className="px-3 py-1.5 bg-[#E9FAFA] text-[#1B9387] hover:bg-[#1B9387] hover:text-white border border-[#B0DCDA] text-[10px] font-extrabold uppercase tracking-wider rounded transition cursor-pointer"
                                                        >
                                                            View Payslip
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* EMPLOYEE DIRECTORY TAB                     */}
            {/* ========================================== */}
            {view === 'DIRECTORY' && (
                <div className="flex-1 grid grid-cols-3 gap-8 animate-in fade-in duration-300 print:hidden">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
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
                            <button onClick={() => setEmployeeToToggle(null)} className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer">Cancel</button>
                            <button onClick={confirmToggleStatus} className={`px-5 py-2.5 text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm ${employeeToToggle.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1B9387] hover:bg-[#28958B]'}`}>
                                {employeeToToggle.isActive ? 'Archive' : 'Restore'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔥 PRINTABLE PAYSLIP MODAL 🔥 */}
            {selectedPayslip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:bg-white print:static print:block print:inset-auto">
                    <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-10 w-[600px] print:w-full print:border-none print:shadow-none print:p-0">
                        
                        {/* Header */}
                        <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
                            <h2 className="text-2xl font-black text-gray-800 tracking-tight">SMARTGUYS CLINIC</h2>
                            <h3 className="text-sm font-extrabold text-gray-500 uppercase tracking-widest mt-1">Employee Payslip</h3>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-700 mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div><span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">Employee</span><span className="text-base font-extrabold text-gray-800">{selectedPayslip.employee.first_name} {selectedPayslip.employee.last_name}</span></div>
                            <div><span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">Position</span><span className="text-gray-800 font-bold">{selectedPayslip.employee.position}</span></div>
                            <div><span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">Payroll Period</span><span className="font-mono text-gray-800 font-bold">{new Date(selectedPayslip.date).toLocaleDateString()}</span></div>
                            <div><span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">Reference No.</span><span className="font-mono text-gray-800 font-bold">{selectedPayslip.reference_no}</span></div>
                        </div>

                        {/* Earnings & Deductions Tables */}
                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div>
                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2 border-b border-blue-200 pb-1">Earnings</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-600">Base Pay</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.base_pay)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Overtime</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.overtime)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Night Diff</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.night_diff)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Other Earn.</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.other_earnings)}</span></div>
                                </div>
                                <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 text-sm font-black text-blue-600">
                                    <span>GROSS PAY</span><span className="font-mono">{formatCurrency(selectedPayslip.gross_pay)}</span>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-wider mb-2 border-b border-orange-200 pb-1">Deductions</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-600">SSS</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.sss)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">PhilHealth</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.philhealth)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Pag-IBIG</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.pagibig)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Cash Adv.</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.cash_advance)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">License Fee</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.license_fee)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Other Ded.</span><span className="font-mono text-gray-800 font-bold">{formatCurrency(selectedPayslip.other_deductions)}</span></div>
                                    <div className="flex justify-between text-red-500 font-bold"><span className="uppercase text-xs tracking-wider">Tax W/H</span><span className="font-mono">{formatCurrency(selectedPayslip.tax_withheld)}</span></div>
                                </div>
                                <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 text-sm font-black text-orange-600">
                                    <span>TOTAL DEDUCT</span><span className="font-mono">{formatCurrency(selectedPayslip.total_deductions + selectedPayslip.tax_withheld)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Pay */}
                        <div className="bg-[#E9FAFA] border border-[#B0DCDA] rounded-lg p-5 flex justify-between items-center shadow-sm">
                            <span className="text-sm font-extrabold text-[#1B9387] uppercase tracking-wider">Net Take Home Pay</span>
                            <span className="text-2xl font-black font-mono text-[#1B9387]">{formatCurrency(selectedPayslip.net_pay)}</span>
                        </div>

                        {/* Action Buttons (Hidden on Print) */}
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100 print:hidden">
                            <button onClick={() => setSelectedPayslip(null)} className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer">
                                Close
                            </button>
                            <button onClick={() => window.print()} className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm flex items-center gap-2">
                                <span>🖨️</span> <span>Print Payslip</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}