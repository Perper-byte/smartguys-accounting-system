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
    const [showDetailed, setShowDetailed] = useState(false);

    // Directory States
    const [dirSearch, setDirSearch] = useState('');
    const [dirFilter, setDirFilter] = useState<'ACTIVE' | 'INCOMPLETE' | 'ARCHIVED'>('ACTIVE');
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [newEmp, setNewEmp] = useState({ id: '', firstName: '', lastName: '', position: '', monthlySalary: '', tin: '', sss: '', philhealth: '', pagibig: '' });
    const [employeeToToggle, setEmployeeToToggle] = useState<{ id: string, name: string, isActive: boolean } | null>(null);

    // History States
    const [histSearch, setHistSearch] = useState('');
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
                    id: emp.id, name: `${emp.first_name} ${emp.last_name}`, hasIncompleteIds: (!emp.tin || !emp.sss_no),
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
                const uniqueHistory = Array.from(new Map((history || []).map((item: any) => [item.referenceNo, item])).values());
                uniqueHistory.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setPayrollHistory(uniqueHistory);
            }
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        if (view === 'RUN') { fetchEmployees(); fetchNextSeq(); }
        if (view === 'DIRECTORY') fetchEmployees();
        if (view === 'HISTORY') fetchHistory();
    }, [view]);

    // --- ID Formatting Masks (Philippines) ---
    const formatTIN = (v: string) => {
        const num = v.replace(/\D/g, '').substring(0, 12);
        return num.replace(/(\d{3})(\d{1,3})?(\d{1,3})?(\d{1,3})?/, (m, p1, p2, p3, p4) =>
            p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : '') + (p4 ? `-${p4}` : '')
        );
    };
    const formatSSS = (v: string) => {
        const num = v.replace(/\D/g, '').substring(0, 10);
        return num.replace(/(\d{2})(\d{1,7})?(\d{1})?/, (m, p1, p2, p3) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : ''));
    };
    const formatHDMF = (v: string) => {
        const num = v.replace(/\D/g, '').substring(0, 12);
        return num.replace(/(\d{4})(\d{1,4})?(\d{1,4})?/, (m, p1, p2, p3) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : ''));
    };
    const formatPHIC = (v: string) => {
        const num = v.replace(/\D/g, '').substring(0, 12);
        return num.replace(/(\d{2})(\d{1,9})?(\d{1})?/, (m, p1, p2, p3) => p1 + (p2 ? `-${p2}` : '') + (p3 ? `-${p3}` : ''));
    };

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

    const handleSaveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null); setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            // Support both Create and Update based on presence of newEmp.id
            const response = newEmp.id
                ? await api.updateEmployee(newEmp.id, newEmp) // Assuming backend has this
                : await api.createEmployee(newEmp);

            if (response.success) {
                setStatus({ type: 'success', msg: `Employee ${newEmp.id ? 'updated' : 'added'} successfully!` });
                setIsEmpModalOpen(false);
                fetchEmployees();
                setTimeout(() => setStatus(null), 4000);
            } else {
                setStatus({ type: 'error', msg: "Failed: " + response.error });
            }
        } catch (error) { setStatus({ type: 'error', msg: "System Error." }); }
        finally { setLoading(false); }
    };

    const openEditEmployee = (emp: any) => {
        setNewEmp({
            id: emp.id, firstName: emp.first_name, lastName: emp.last_name, position: emp.position,
            monthlySalary: emp.monthly_salary, tin: emp.tin || '', sss: emp.sss_no || '',
            philhealth: emp.philhealth_no || '', pagibig: emp.pagibig_no || ''
        });
        setIsEmpModalOpen(true);
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
            } else setStatus({ type: 'error', msg: "Database Update Failed." });
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
                setStatus({ type: 'success', msg: `Payroll ${payload.referenceNo} processed successfully!` });
                fetchNextSeq();
                fetchEmployees();
                setTimeout(() => setStatus(null), 5000);
            } else setStatus({ type: 'error', msg: "Database Error: " + response.error });
        } catch (error) { setStatus({ type: 'error', msg: "System Error." }); }
        finally { setLoading(false); }
    };

    // --- UI Helpers ---
    const formatCurrency = (val: number) => `₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // UX: Dim Zeros Helper
    const CellMoney = ({ val, colorClass = "text-gray-800", isBold = true }: { val: number, colorClass?: string, isBold?: boolean }) => (
        <span className={`tabular-nums block w-full text-right ${isBold ? 'font-bold' : 'font-medium'} ${val === 0 ? 'text-gray-300' : colorClass}`}>
            {val === 0 ? '0.00' : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
    );

    // UX: Dim Zeros in Input Field
    const renderInput = (id: number, value: number, field: string, defaultTextColor: string, focusBg: string) => (
        <td className="p-0 border-r border-gray-200 bg-white group-hover:bg-transparent transition-colors">
            <input
                type="number" min="0" step="0.01" value={value === 0 ? '' : value} placeholder="0.00"
                onChange={e => handleUpdateItem(id, field, Number(e.target.value))}
                className={`w-full h-full min-h-[48px] min-w-[90px] bg-transparent hover:bg-gray-100/50 px-3 text-right font-mono tabular-nums outline-none focus:${focusBg} border-2 border-transparent focus:border-gray-300 transition-colors ${value === 0 ? 'text-gray-300 font-medium' : `font-bold ${defaultTextColor}`}`}
            />
        </td>
    );

    const totalGross = payrollItems.reduce((sum, item) => sum + item.gross, 0);
    const totalDeductions = payrollItems.reduce((sum, item) => sum + item.deductions, 0);
    const totalTax = payrollItems.reduce((sum, item) => sum + item.tax, 0);
    const totalNet = payrollItems.reduce((sum, item) => sum + item.net, 0);

    // Filtered Data
    const filteredEmployees = employees.filter(emp => {
        const matchSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(dirSearch.toLowerCase());
        const isMissingInfo = !emp.tin || !emp.sss_no;
        const isActive = emp.is_active !== false;

        if (!matchSearch) return false;
        if (dirFilter === 'ACTIVE') return isActive;
        if (dirFilter === 'ARCHIVED') return !isActive;
        if (dirFilter === 'INCOMPLETE') return isActive && isMissingInfo;
        return true;
    });

    const filteredHistory = payrollHistory.filter(run =>
        run.referenceNo.toLowerCase().includes(histSearch.toLowerCase()) ||
        run.description.toLowerCase().includes(histSearch.toLowerCase())
    );

    return (
        <div className="w-full h-full flex items-center justify-center p-4 lg:p-8 bg-gray-50/30">
            <div className="w-full max-w-7xl h-full flex flex-col font-sans text-gray-800 bg-white shadow-sm border border-transparent rounded-xl overflow-hidden">

                {/* HEADER */}
                <div className="flex justify-between items-end mb-2 p-6 pb-4 border-b border-[#B0DCDA] shrink-0 print:hidden">
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
                    <div className={`mx-6 mb-4 p-4 rounded-md text-sm font-bold shadow-sm border shrink-0 print:hidden flex items-center justify-between animate-in fade-in ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                        <span>{status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}</span>
                        <button onClick={() => setStatus(null)} className="opacity-50 hover:opacity-100 cursor-pointer">✕</button>
                    </div>
                )}

                {/* ========================================== */}
                {/* RUN PAYROLL TAB                            */}
                {/* ========================================== */}
                {view === 'RUN' && (
                    <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0 relative print:hidden">
                        <div className="px-6 mb-4 shrink-0">
                            <div className="grid grid-cols-4 gap-6">
                                <div>
                                    <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">Payroll Date</label>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                                </div>
                                <div>
                                    <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">Voucher No.</label>
                                    <div className="flex">
                                        <span className="bg-gray-50 border border-[#B0DCDA] border-r-0 rounded-l-md px-4 py-3 text-sm font-extrabold text-gray-500 select-none">PY-</span>
                                        <input type="text" required value={refSequence} onChange={e => setRefSequence(e.target.value)} placeholder="001" className="w-full bg-white border border-[#B0DCDA] rounded-r-md p-3 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none transition" />
                                    </div>
                                </div>
                                <div className="col-span-2 flex items-end justify-between">
                                    <div className="flex-1 mr-4">
                                        <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">Description / Memo</label>
                                        <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowDetailed(!showDetailed)} className="px-4 py-3 h-[46px] bg-white hover:bg-gray-50 border border-gray-300 text-xs font-bold text-gray-600 rounded-md transition shadow-sm cursor-pointer">
                                            {showDetailed ? '📉 Compact View' : '📈 Detailed View'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ledger Table Container */}
                        <div className="flex-1 overflow-auto bg-white relative">
                            <table className="w-full text-left text-sm whitespace-nowrap min-w-max border-t border-[#B0DCDA]">
                                <thead className="bg-[#FBF8F8] sticky top-0 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                                    <tr className="border-b border-gray-200 text-center text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                        <th className="p-2 border-r border-[#B0DCDA] sticky left-0 z-40 bg-[#FBF8F8]"></th>
                                        <th colSpan={showDetailed ? 4 : 2} className="p-2 border-r border-[#B0DCDA] text-blue-600 bg-blue-50/50">Earnings (₱)</th>
                                        <th colSpan={showDetailed ? 7 : 3} className="p-2 border-r border-[#B0DCDA] text-orange-500 bg-orange-50/50">Deductions & Taxes (₱)</th>
                                        <th className="p-2 text-[#1B9387] bg-[#E9FAFA]/50">Payout (₱)</th>
                                    </tr>
                                    <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold border-b border-[#B0DCDA]">
                                        <th className="p-3 border-r border-[#B0DCDA] sticky left-0 z-40 bg-[#FBF8F8] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Employee Name</th>
                                        <th className="p-3 text-right border-r border-gray-200">Base Pay</th>
                                        <th className="p-3 text-right border-r border-gray-200">Overtime</th>
                                        {showDetailed && <th className="p-3 text-right border-r border-gray-200">Night Diff</th>}
                                        {showDetailed && <th className="p-3 text-right border-r border-gray-200">Other Earn.</th>}
                                        <th className="p-3 text-right border-r border-[#B0DCDA] text-blue-600 bg-blue-50/50">Total Gross</th>

                                        <th className="p-3 text-right border-r border-gray-200">SSS</th>
                                        {showDetailed && <th className="p-3 text-right border-r border-gray-200">PhilHealth</th>}
                                        {showDetailed && <th className="p-3 text-right border-r border-gray-200">Pag-IBIG</th>}
                                        {showDetailed && <th className="p-3 text-right border-r border-gray-200">Cash Adv.</th>}
                                        {showDetailed && <th className="p-3 text-right border-r border-gray-200">Lic. Fee</th>}
                                        {showDetailed && <th className="p-3 text-right border-r border-gray-200">Other Ded.</th>}
                                        {!showDetailed && <th className="p-3 text-right border-r border-gray-200 italic text-gray-400">Total Deductions</th>}

                                        <th className="p-3 text-right border-r border-[#B0DCDA] text-red-500 bg-red-50/50">Tax W/H</th>
                                        <th className="p-3 text-right text-[#1B9387] bg-[#E9FAFA]/50 pr-6">Net Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-gray-50/30">
                                    {payrollItems.length === 0 ? (
                                        <tr><td colSpan={14} className="p-12 text-center text-gray-400 italic">No active employees found.</td></tr>
                                    ) : (
                                        payrollItems.map((emp) => (
                                            <tr key={emp.id} className="hover:bg-[#E9FAFA]/30 transition-colors group">
                                                <td className="p-3 font-bold text-gray-800 border-r border-[#B0DCDA] sticky left-0 z-10 bg-white group-hover:bg-[#FBF8F8] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] flex items-center justify-between">
                                                    <span>{emp.name}</span>
                                                    {emp.hasIncompleteIds && <span title="Missing IDs" className="text-yellow-500 text-xs ml-2">⚠️</span>}
                                                </td>
                                                {renderInput(emp.id, emp.basePay, 'basePay', 'text-gray-800', 'bg-blue-50/50')}
                                                {renderInput(emp.id, emp.overtime, 'overtime', 'text-blue-600', 'bg-blue-50/50')}
                                                {showDetailed && renderInput(emp.id, emp.nightDiff, 'nightDiff', 'text-blue-600', 'bg-blue-50/50')}
                                                {showDetailed && renderInput(emp.id, emp.otherEarnings, 'otherEarnings', 'text-blue-600', 'bg-blue-50/50')}
                                                <td className="p-3 pr-4 border-r border-[#B0DCDA] bg-blue-50/30"><CellMoney val={emp.gross} colorClass="text-blue-600" /></td>

                                                {renderInput(emp.id, emp.sss, 'sss', 'text-orange-600', 'bg-orange-50/50')}
                                                {showDetailed && renderInput(emp.id, emp.philhealth, 'philhealth', 'text-orange-600', 'bg-orange-50/50')}
                                                {showDetailed && renderInput(emp.id, emp.pagibig, 'pagibig', 'text-orange-600', 'bg-orange-50/50')}
                                                {showDetailed && renderInput(emp.id, emp.cashAdvance, 'cashAdvance', 'text-red-500', 'bg-red-50/50')}
                                                {showDetailed && renderInput(emp.id, emp.licenseFee, 'licenseFee', 'text-red-500', 'bg-red-50/50')}
                                                {showDetailed && renderInput(emp.id, emp.otherDeductions, 'otherDeductions', 'text-red-500', 'bg-red-50/50')}
                                                {!showDetailed && <td className="p-3 pr-4 border-r border-gray-200 bg-white"><CellMoney val={emp.deductions} colorClass="text-orange-500" isBold={false} /></td>}

                                                {renderInput(emp.id, emp.tax, 'tax', 'text-red-600', 'bg-red-50/50')}
                                                <td className="p-3 pr-6 text-right bg-[#FBF8F8]/50 border-r border-transparent"><CellMoney val={emp.net} colorClass="text-[#1B9387]" /></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* UX FIX: Sticky Summary Bar */}
                        <div className="sticky bottom-0 bg-[#FBF8F8] border-t border-[#B0DCDA] p-5 px-6 flex justify-between items-center shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-40 shrink-0">
                            <div className="grid grid-cols-4 gap-8 text-sm w-2/3">
                                <div><p className="text-gray-500 uppercase text-[10px] font-extrabold tracking-widest">Total Gross</p><p className="font-mono text-gray-800 font-bold text-lg mt-1 tabular-nums">{formatCurrency(totalGross)}</p></div>
                                <div><p className="text-orange-500 uppercase text-[10px] font-extrabold tracking-widest">Total Deductions</p><p className="font-mono text-orange-500 font-bold text-lg mt-1 tabular-nums">{formatCurrency(totalDeductions)}</p></div>
                                <div><p className="text-red-500 uppercase text-[10px] font-extrabold tracking-widest">Total Tax W/H</p><p className="font-mono text-red-500 font-bold text-lg mt-1 tabular-nums">{formatCurrency(totalTax)}</p></div>
                                <div><p className="text-[#1B9387] uppercase text-[10px] font-extrabold tracking-widest">Total Net Payout</p><p className="font-mono text-[#1B9387] font-black text-2xl mt-0.5 tabular-nums">{formatCurrency(totalNet)}</p></div>
                            </div>
                            <button onClick={handleProcessPayroll} disabled={loading || payrollItems.length === 0} className="px-10 py-4 bg-[#1B9387] hover:bg-[#28958B] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg font-bold transition shadow-md tracking-wide cursor-pointer uppercase text-sm flex items-center gap-2">
                                {loading ? <><span className="animate-spin text-lg">↻</span> Processing...</> : 'Post Payroll'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ========================================== */}
                {/* PAYSLIP HISTORY TAB                        */}
                {/* ========================================== */}
                {view === 'HISTORY' && (
                    <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0 bg-[#FBF8F8] print:hidden">
                        <div className="p-6 border-b border-[#B0DCDA] flex justify-between items-center bg-white shrink-0">
                            <input
                                type="text" placeholder="Search voucher or memo..."
                                value={histSearch} onChange={e => setHistSearch(e.target.value)}
                                className="w-80 bg-gray-50 border border-gray-300 rounded-md p-2.5 text-sm outline-none focus:border-[#1B9387] transition"
                            />
                        </div>
                        <div className="flex-1 overflow-auto p-6 space-y-4">
                            {filteredHistory.length === 0 ? (
                                <div className="py-16 text-center text-gray-500">
                                    <span className="block text-4xl mb-3">🕰️</span>
                                    <span className="italic font-medium">No payroll history found matching your criteria.</span>
                                </div>
                            ) : (
                                filteredHistory.map((run) => {
                                    const isEmptyRun = run.payslips.length === 0;
                                    const isExpanded = expandedHistoryId === run.id;
                                    return (
                                        <div key={run.id || run.referenceNo} className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ${isExpanded ? 'border-[#1B9387] ring-1 ring-[#1B9387]' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <div
                                                onClick={() => setExpandedHistoryId(isExpanded ? null : run.id)}
                                                className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50/50"
                                            >
                                                <div className="flex items-center space-x-6 w-1/2">
                                                    <span className="font-extrabold font-mono text-gray-800 text-lg w-20">{run.referenceNo}</span>
                                                    <span className="text-gray-500 font-medium text-sm tabular-nums w-24">{new Date(run.date).toLocaleDateString()}</span>
                                                    <span className="text-gray-800 font-bold text-sm truncate">{run.description}</span>
                                                </div>
                                                <div className="flex items-center space-x-8">
                                                    <span className="text-sm font-bold text-gray-500">{run.payslips.length} Employees</span>
                                                    <span className="text-lg font-black text-gray-800 font-mono tabular-nums min-w-[120px] text-right">
                                                        {formatCurrency(run.payslips.reduce((sum: number, p: any) => sum + p.net_pay, 0))}
                                                    </span>

                                                    {/* UX FIX: Distinct Status Badges */}
                                                    {isEmptyRun ? (
                                                        <span className="px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm w-20 text-center">Draft</span>
                                                    ) : (
                                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm w-20 text-center">Posted</span>
                                                    )}

                                                    <span className="text-gray-400 w-4 text-center">{isExpanded ? '▲' : '▼'}</span>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="bg-gray-50/80 border-t border-gray-200 p-5 animate-in slide-in-from-top-2">
                                                    {isEmptyRun ? (
                                                        <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-lg">
                                                            <p className="text-sm text-gray-500 italic">This is an empty draft. No payslips generated.</p>
                                                            <button className="text-xs font-bold text-red-500 hover:bg-red-50 px-4 py-2 border border-red-200 rounded transition">Delete Draft</button>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {run.payslips.map((payslip: any) => (
                                                                <div key={payslip.id} className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm flex justify-between items-center hover:border-[#1B9387] transition group">
                                                                    <div>
                                                                        <p className="font-extrabold text-gray-800">{payslip.employee.first_name} {payslip.employee.last_name}</p>
                                                                        <p className="text-xs text-gray-500 font-medium mt-1">Net: <span className="font-bold text-[#1B9387] font-mono tabular-nums">{formatCurrency(payslip.net_pay)}</span></p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setSelectedPayslip(payslip)}
                                                                        className="px-4 py-2 bg-[#E9FAFA] text-[#1B9387] group-hover:bg-[#1B9387] group-hover:text-white border border-[#B0DCDA] group-hover:border-[#1B9387] text-[10px] font-extrabold uppercase tracking-wider rounded transition cursor-pointer shadow-sm"
                                                                    >
                                                                        View
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* ========================================== */}
                {/* EMPLOYEE DIRECTORY TAB (Overhauled UI)     */}
                {/* ========================================== */}
                {view === 'DIRECTORY' && (
                    <div className="flex-1 flex flex-col animate-in fade-in duration-300 min-h-0 bg-white print:hidden">

                        {/* Header Actions */}
                        <div className="p-6 border-b border-[#B0DCDA] flex justify-between items-center bg-[#FBF8F8] shrink-0">
                            <div className="flex items-center gap-4">
                                <input
                                    type="text" placeholder="Search employees..."
                                    value={dirSearch} onChange={e => setDirSearch(e.target.value)}
                                    className="w-64 bg-white border border-[#B0DCDA] rounded-md p-2.5 text-sm outline-none focus:border-[#1B9387] transition shadow-sm"
                                />
                                <div className="flex bg-white rounded-md border border-[#B0DCDA] shadow-sm p-1">
                                    {(['ACTIVE', 'INCOMPLETE', 'ARCHIVED'] as const).map(f => (
                                        <button
                                            key={f} onClick={() => setDirFilter(f)}
                                            className={`px-4 py-1.5 text-xs font-bold rounded uppercase tracking-wider transition ${dirFilter === f ? 'bg-[#E9FAFA] text-[#1B9387]' : 'text-gray-500 hover:text-gray-800'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={() => { setNewEmp({ id: '', firstName: '', lastName: '', position: '', monthlySalary: '', tin: '', sss: '', philhealth: '', pagibig: '' }); setIsEmpModalOpen(true); }}
                                className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold transition shadow-sm uppercase tracking-wider flex items-center gap-2"
                            >
                                <span>+</span> Add Employee
                            </button>
                        </div>

                        {/* Directory Table */}
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
                                        <tr><td colSpan={5} className="p-16 text-center text-gray-400 italic">No employees found matching criteria.</td></tr>
                                    ) : (
                                        filteredEmployees.map((emp) => {
                                            const isActive = emp.is_active !== false;
                                            const isMissingInfo = !emp.tin || !emp.sss_no;

                                            return (
                                                <tr key={emp.id} className={`transition-colors hover:bg-gray-50 ${!isActive ? 'opacity-60 bg-gray-50/50' : ''}`}>
                                                    <td className="p-4 pl-6">
                                                        <div className="flex flex-col items-start gap-1.5">
                                                            {isActive ? (
                                                                <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Active</span>
                                                            ) : (
                                                                <span className="px-2.5 py-1 bg-gray-100 border border-gray-300 text-gray-500 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Archived</span>
                                                            )}
                                                            {isActive && isMissingInfo && (
                                                                <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 border border-yellow-200 text-[9px] font-bold rounded-sm uppercase flex items-center shadow-sm" title="Missing TIN or SSS Number">
                                                                    ⚠️ Incomplete
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <p className="font-extrabold text-gray-800 text-base">{emp.first_name} {emp.last_name}</p>
                                                        <p className="text-xs text-[#1B9387] font-bold uppercase tracking-wider mt-0.5">{emp.position}</p>
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-gray-800 font-bold tabular-nums">
                                                        {Number(emp.monthly_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-4 text-xs space-y-1.5">
                                                        <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                            <span className="text-gray-500 font-bold text-[10px] uppercase">TIN</span>
                                                            <span className={`font-mono font-bold ${emp.tin ? 'text-gray-800' : 'text-red-400'}`}>{emp.tin || 'Missing'}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                            <span className="text-gray-500 font-bold text-[10px] uppercase">SSS</span>
                                                            <span className={`font-mono font-bold ${emp.sss_no ? 'text-gray-800' : 'text-red-400'}`}>{emp.sss_no || 'Missing'}</span>
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
                                                            onClick={() => setEmployeeToToggle({ id: emp.id, name: `${emp.first_name} ${emp.last_name}`, isActive })}
                                                            className={`text-xs font-bold px-3.5 py-2 rounded-md transition shadow-sm border ${isActive ? 'bg-white border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
                                                                    : 'bg-white border-gray-300 text-gray-500 hover:border-[#1B9387] hover:text-[#1B9387] hover:bg-[#E9FAFA]'
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

                {/* ========================================== */}
                {/* MODALS                                     */}
                {/* ========================================== */}

                {/* Add/Edit Employee Modal */}
                {isEmpModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
                        <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl w-[500px] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="px-6 py-4 bg-[#FBF8F8] border-b border-[#B0DCDA] flex justify-between items-center">
                                <h3 className="text-lg font-extrabold text-gray-800 uppercase tracking-wide">{newEmp.id ? 'Edit Employee' : 'Add New Employee'}</h3>
                                <button onClick={() => setIsEmpModalOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl font-bold">×</button>
                            </div>
                            <div className="p-6 overflow-y-auto">
                                <form id="empForm" onSubmit={handleSaveEmployee} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">First Name *</label><input type="text" required value={newEmp.firstName} onChange={e => setNewEmp({ ...newEmp, firstName: e.target.value })} className="w-full bg-white border border-gray-300 rounded p-2 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm" /></div>
                                        <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Last Name *</label><input type="text" required value={newEmp.lastName} onChange={e => setNewEmp({ ...newEmp, lastName: e.target.value })} className="w-full bg-white border border-gray-300 rounded p-2 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Position / Title *</label><input type="text" required value={newEmp.position} onChange={e => setNewEmp({ ...newEmp, position: e.target.value })} placeholder="e.g. Nurse" className="w-full bg-white border border-gray-300 rounded p-2 text-sm text-gray-800 font-bold focus:border-[#1B9387] outline-none shadow-sm" /></div>
                                        <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Monthly Salary (₱) *</label><input type="number" step="0.01" required value={newEmp.monthlySalary} onChange={e => setNewEmp({ ...newEmp, monthlySalary: e.target.value })} placeholder="0.00" className="w-full bg-white border border-gray-300 rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm" /></div>
                                    </div>

                                    <div className="pt-4 mt-4 border-t border-gray-200">
                                        <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest mb-4">Government IDs</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Masked Inputs */}
                                            <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 flex justify-between">BIR TIN {!newEmp.tin && <span className="text-red-400">Required</span>}</label><input type="text" value={newEmp.tin} onChange={e => setNewEmp({ ...newEmp, tin: formatTIN(e.target.value) })} placeholder="000-000-000-000" className={`w-full bg-white border rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm ${!newEmp.tin ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} /></div>
                                            <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 flex justify-between">SSS No. {!newEmp.sss && <span className="text-red-400">Required</span>}</label><input type="text" value={newEmp.sss} onChange={e => setNewEmp({ ...newEmp, sss: formatSSS(e.target.value) })} placeholder="00-0000000-0" className={`w-full bg-white border rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm ${!newEmp.sss ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} /></div>
                                            <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">PhilHealth No.</label><input type="text" value={newEmp.philhealth} onChange={e => setNewEmp({ ...newEmp, philhealth: formatPHIC(e.target.value) })} placeholder="00-000000000-0" className="w-full bg-white border border-gray-300 rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm" /></div>
                                            <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Pag-IBIG No.</label><input type="text" value={newEmp.pagibig} onChange={e => setNewEmp({ ...newEmp, pagibig: formatHDMF(e.target.value) })} placeholder="0000-0000-0000" className="w-full bg-white border border-gray-300 rounded p-2 text-sm font-mono font-bold text-gray-800 focus:border-[#1B9387] outline-none shadow-sm" /></div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsEmpModalOpen(false)} className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-md text-sm font-bold transition cursor-pointer shadow-sm">Cancel</button>
                                <button type="submit" form="empForm" disabled={loading} className="px-6 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white font-bold rounded-md transition cursor-pointer shadow-sm uppercase tracking-wider text-sm flex items-center gap-2">
                                    {loading ? <span className="animate-spin">↻</span> : 'Save Employee'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Archive/Restore Confirmation */}
                {employeeToToggle && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
                        <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-8 w-[420px] animate-in zoom-in-95 duration-200">
                            <h3 className="text-xl font-extrabold text-gray-800 mb-2 uppercase tracking-wide">
                                {employeeToToggle.isActive ? 'Archive Employee?' : 'Restore Employee?'}
                            </h3>
                            <p className="text-sm text-gray-600 mb-8 font-medium leading-relaxed">
                                {employeeToToggle.isActive
                                    ? <>Archive <strong className="text-gray-800">{employeeToToggle.name}</strong>? They will be hidden from the active payroll run.</>
                                    : <>Restore <strong className="text-gray-800">{employeeToToggle.name}</strong>? They will be added back to the active payroll run.</>
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
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm print:bg-white print:static print:block print:inset-auto">
                        <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-10 w-[600px] print:w-full print:border-none print:shadow-none print:p-0">
                            <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight">SMARTGUYS CLINIC</h2>
                                <h3 className="text-sm font-extrabold text-gray-500 uppercase tracking-widest mt-1">Employee Payslip</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-700 mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div><span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">Employee</span><span className="text-base font-extrabold text-gray-800">{selectedPayslip.employee.first_name} {selectedPayslip.employee.last_name}</span></div>
                                <div><span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">Position</span><span className="text-gray-800 font-bold">{selectedPayslip.employee.position}</span></div>
                                <div><span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">Payroll Period</span><span className="font-mono text-gray-800 font-bold">{new Date(selectedPayslip.date).toLocaleDateString()}</span></div>
                                <div><span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block">Reference No.</span><span className="font-mono text-gray-800 font-bold">{selectedPayslip.reference_no}</span></div>
                            </div>
                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div>
                                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2 border-b border-blue-200 pb-1">Earnings</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-gray-600">Base Pay</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.base_pay)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-600">Overtime</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.overtime)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-600">Night Diff</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.night_diff)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-600">Other Earn.</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.other_earnings)}</span></div>
                                    </div>
                                    <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 text-sm font-black text-blue-600">
                                        <span>GROSS PAY</span><span className="font-mono tabular-nums">{formatCurrency(selectedPayslip.gross_pay)}</span>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-wider mb-2 border-b border-orange-200 pb-1">Deductions</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-gray-600">SSS</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.sss)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-600">PhilHealth</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.philhealth)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-600">Pag-IBIG</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.pagibig)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-600">Cash Adv.</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.cash_advance)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-600">License Fee</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.license_fee)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-600">Other Ded.</span><span className="font-mono text-gray-800 font-bold tabular-nums">{formatCurrency(selectedPayslip.other_deductions)}</span></div>
                                        <div className="flex justify-between text-red-500 font-bold"><span className="uppercase text-xs tracking-wider">Tax W/H</span><span className="font-mono tabular-nums">{formatCurrency(selectedPayslip.tax_withheld)}</span></div>
                                    </div>
                                    <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 text-sm font-black text-orange-600">
                                        <span>TOTAL DEDUCT</span><span className="font-mono tabular-nums">{formatCurrency(selectedPayslip.total_deductions + selectedPayslip.tax_withheld)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#E9FAFA] border border-[#B0DCDA] rounded-lg p-5 flex justify-between items-center shadow-sm">
                                <span className="text-sm font-extrabold text-[#1B9387] uppercase tracking-wider">Net Take Home Pay</span>
                                <span className="text-2xl font-black font-mono text-[#1B9387] tabular-nums">{formatCurrency(selectedPayslip.net_pay)}</span>
                            </div>
                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100 print:hidden">
                                <button onClick={() => setSelectedPayslip(null)} className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer">Close</button>
                                <button onClick={() => window.print()} className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm flex items-center gap-2"><span>🖨️</span> <span>Print Payslip</span></button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}