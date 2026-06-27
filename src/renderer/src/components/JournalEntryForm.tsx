// src/renderer/src/components/JournalEntryForm.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { AddPatientForm } from './AddPatientForm'; 

export const JournalEntryForm: React.FC<{ userId: string; isAdjusting?: boolean }> = ({ userId, isAdjusting = false }) => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [refNo, setRefNo] = useState(isAdjusting ? 'ADJ-' : '');
    const [description, setDescription] = useState(isAdjusting ? 'Adjusting Entry: ' : '');
    
    const [vatType, setVatType] = useState('VATABLE'); 
    const [payees, setPayees] = useState<any[]>([]);
    const [payeeId, setPayeeId] = useState(''); 
    const [showAddPatient, setShowAddPatient] = useState(false);
    
    // NEW: Searchable Dropdown States
    const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
    const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
    
    const [payeeBalance, setPayeeBalance] = useState<{receivable: number, payable: number} | null>(null);
    const [lines, setLines] = useState([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }]);
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const api = (window as any).electronAPI;
        if (api) {
            if (api.getAccounts) api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
            if (api.getPayees) api.getPayees().then(setPayees).catch(() => setPayees([]));
        }
    }, []);

    useEffect(() => {
        if (!payeeId) {
            setPayeeBalance(null);
            return;
        }
        const fetchBalance = async () => {
            const api = (window as any).electronAPI;
            if (api && api.getPayeeBalance) {
                const bal = await api.getPayeeBalance(payeeId);
                setPayeeBalance(bal);
            }
        };
        fetchBalance();
    }, [payeeId]);

    const handlePatientAdded = () => {
        setShowAddPatient(false); 
        const api = (window as any).electronAPI;
        if (api && api.getPayees) api.getPayees().then(setPayees).catch(() => setPayees([]));
    };

    const addLine = () => setLines([...lines, { accountId: '', debit: 0, credit: 0 }]);

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index][field] = value;
        if (field === 'debit' && value > 0) newLines[index].credit = 0;
        if (field === 'credit' && value > 0) newLines[index].debit = 0;
        setLines(newLines);
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) return; 
        const newLines = lines.filter((_, i) => i !== index);
        setLines(newLines);
    };

    const totalDebit = lines.reduce((sum, ln) => sum + (Number(ln.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, ln) => sum + (Number(ln.credit) || 0), 0);
    const isBalanced = totalDebit > 0 && totalDebit.toFixed(2) === totalCredit.toFixed(2);

    const handleSubmit = async () => {
        setStatus(null);
        setLoading(true);

        try {
            const validLines = lines.filter(l => l.accountId !== '' && (l.debit > 0 || l.credit > 0));
            const api = (window as any).electronAPI;
            const result = await api.submitJournalEntry({
                date: new Date(date),
                referenceNo: refNo,
                description,
                vatType, 
                payeeId: payeeId === '' ? undefined : payeeId,
                userId,
                lines: validLines
            });

            if (result.success) {
                setStatus({ type: 'success', msg: `Entry ${result.referenceNo} posted successfully!` });
                setRefNo('');
                setDescription('');
                setVatType('VATABLE'); 
                setPayeeId(''); 
                setPayeeSearchQuery(''); // Reset search
                setLines([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }]);
            } else {
                setStatus({ type: 'error', msg: result.error });
            }
        } catch (err: any) {
            setStatus({ type: 'error', msg: "Connection Error: Failed to submit to database." });
        } finally {
            setLoading(false);
        }
    };

    // Filter the patients based on what the user types!
    const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));
    
    // Find the name of the currently selected patient to show on the button
    const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '-- No Patient Tagged --';

    return (
        <div className="max-w-4xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b border-[#29292e] pb-4">
                <h2 className="text-xl font-bold text-white tracking-wide">{isAdjusting ? 'Record Adjusting Entry' : 'New Journal Entry'}</h2>
                <span className="bg-[#4f46e5]/20 text-[#4f46e5] text-xs px-3 py-1 rounded font-bold uppercase tracking-widest border border-[#4f46e5]/30">{isAdjusting ? 'Adjusting Journal' : 'General Journal'}</span>
            </div>

            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Reference No.</label>
                    <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="e.g. OR-1001" className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">VAT Type</label>
                    <div className="relative">
                        <select value={vatType} onChange={e => setVatType(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 pr-10 text-sm text-white focus:border-[#4f46e5] outline-none transition appearance-none cursor-pointer">
                            <option value="VATABLE">Vatable (12%)</option>
                            <option value="EXEMPT">VAT-Exempt</option>
                            <option value="ZERO_RATED">Zero-Rated (0%)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#8d8d99]">
                            <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CUSTOM SEARCHABLE PATIENT DROPDOWN --- */}
            <div className="mb-6 relative">
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider">Patient / Payee (For Accounts Receivable/Payable)</label>
                    <button type="button" onClick={() => setShowAddPatient(!showAddPatient)} className="text-xs font-bold text-[#4f46e5] hover:text-[#5b54f6] transition hover:underline">
                        {showAddPatient ? 'Cancel' : '+ Add New Patient'}
                    </button>
                </div>

                {showAddPatient && <AddPatientForm onPatientAdded={handlePatientAdded} />}

                {/* The Custom Dropdown Trigger Button */}
                <div className="relative mt-2">
                    <div 
                        onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)}
                        className={`w-full bg-[#121214] border ${isPayeeDropdownOpen ? 'border-[#4f46e5]' : 'border-[#29292e]'} rounded-md p-3 text-sm text-white transition cursor-pointer flex justify-between items-center`}
                    >
                        <span className={payeeId ? 'text-white' : 'text-[#8d8d99]'}>{selectedPayeeName}</span>
                        <svg className="w-4 h-4 text-[#8d8d99]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </div>

                    {/* The Popup Search Menu */}
                    {isPayeeDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-[#202024] border border-[#29292e] rounded-md shadow-2xl overflow-hidden">
                            {/* Search Input Box */}
                            <div className="p-2 border-b border-[#29292e] bg-[#121214]">
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="🔍 Search patient name..." 
                                    value={payeeSearchQuery}
                                    onChange={(e) => setPayeeSearchQuery(e.target.value)}
                                    className="w-full bg-transparent p-2 text-sm text-white outline-none placeholder-[#3f3f46]"
                                />
                            </div>

                            {/* Filtered List of Patients */}
                            <ul className="max-h-48 overflow-y-auto">
                                <li 
                                    onClick={() => { setPayeeId(''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }}
                                    className="p-3 text-sm text-[#8d8d99] hover:bg-[#4f46e5] hover:text-white cursor-pointer transition"
                                >
                                    -- No Patient Tagged --
                                </li>
                                {filteredPayees.length > 0 ? (
                                    filteredPayees.map(p => (
                                        <li 
                                            key={p.id}
                                            onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }}
                                            className="p-3 text-sm text-white hover:bg-[#4f46e5] cursor-pointer transition border-t border-[#29292e]/50"
                                        >
                                            {p.name}
                                        </li>
                                    ))
                                ) : (
                                    <li className="p-3 text-sm text-[#f75a68] text-center border-t border-[#29292e]/50">
                                        No patients found. Click "+ Add New Patient".
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>

                {payeeBalance && (
                    <div className="mt-3 flex gap-3 text-xs">
                        {payeeBalance.receivable > 0 && (
                            <span className="text-[#f75a68] font-bold bg-[#f75a68]/10 px-3 py-1.5 rounded border border-[#f75a68]/20 flex items-center shadow-sm">
                                ⚠️ Patient owes you: ₱{payeeBalance.receivable.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        )}
                        {payeeBalance.payable > 0 && (
                            <span className="text-orange-400 font-bold bg-orange-400/10 px-3 py-1.5 rounded border border-orange-400/20 flex items-center shadow-sm">
                                ⚠️ You owe supplier: ₱{payeeBalance.payable.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        )}
                        {payeeBalance.receivable <= 0 && payeeBalance.payable <= 0 && (
                            <span className="text-emerald-500 font-bold bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/20 flex items-center shadow-sm">
                                ✅ Cleared / No outstanding balance
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="mb-6">
                <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Description / Memo</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Type transaction details here..." className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white h-20 resize-none focus:border-[#4f46e5] outline-none transition" />
            </div>

            <div className="border border-[#29292e] rounded-md bg-[#121214] overflow-hidden mb-4">
                <table className="w-full">
                    <thead className="bg-[#202024] border-b border-[#29292e]">
                        <tr className="text-left text-[#8d8d99] text-xs uppercase tracking-wider">
                            <th className="p-3 w-1/2">Account</th>
                            <th className="p-3 w-1/4 text-right">Debit</th>
                            <th className="p-3 w-1/4 text-right">Credit</th>
                            <th className="p-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line, idx) => (
                            <tr key={idx} className="border-b border-[#29292e]/50 last:border-0 hover:bg-[#202024]/50 transition">
                                <td className="p-2 border-r border-[#29292e]/50">
                                    <div className="relative">
                                        <select value={line.accountId} onChange={e => updateLine(idx, 'accountId', e.target.value)} className="w-full bg-transparent text-sm text-white outline-none cursor-pointer appearance-none pr-6">
                                            <option value="" className="bg-[#121214] text-[#8d8d99]">Select Account...</option>
                                            {accounts.map(acc => <option key={acc.code} value={acc.code} className="bg-[#202024] text-white">{acc.code} - {acc.name}</option>)}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-[#8d8d99]">
                                            <svg className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-2 border-r border-[#29292e]/50"><input type="number" min="0" step="0.01" value={line.debit === 0 ? '' : line.debit} placeholder="0.00" onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-sm text-right text-white outline-none placeholder-[#3f3f46]" /></td>
                                <td className="p-2 border-r border-[#29292e]/50"><input type="number" min="0" step="0.01" value={line.credit === 0 ? '' : line.credit} placeholder="0.00" onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-sm text-right text-white outline-none placeholder-[#3f3f46]" /></td>
                                <td className="p-2 text-center"><button onClick={() => removeLine(idx)} disabled={lines.length <= 2} className="text-[#f75a68] hover:text-red-400 disabled:opacity-20 transition" title="Remove Line">✕</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-end mt-6">
                <button onClick={addLine} className="text-[#4f46e5] text-sm font-bold hover:underline bg-[#4f46e5]/10 px-4 py-2 rounded transition">+ Add Line</button>
                <div className="text-right bg-[#121214] p-4 rounded-md border border-[#29292e] min-w-[250px]">
                    <div className="flex justify-between text-sm mb-1"><span className="text-[#8d8d99] font-medium">Total Debits:</span><span className="text-white font-mono">₱ {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-[#8d8d99] font-medium">Total Credits:</span><span className="text-white font-mono">₱ {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    <div className="mt-3 pt-2 border-t border-[#29292e]">
                        {isBalanced ? <span className="text-emerald-500 text-xs font-bold uppercase tracking-widest flex items-center justify-end">✓ Balanced</span> : <span className="text-[#f75a68] text-xs font-bold uppercase tracking-widest flex items-center justify-end">Out of Balance</span>}
                    </div>
                </div>
            </div>

            <button disabled={!isBalanced || !refNo || loading} onClick={handleSubmit} className="w-full mt-8 bg-[#4f46e5] disabled:bg-[#29292e] disabled:text-[#8d8d99] text-white font-bold py-4 rounded-md transition hover:bg-[#5b54f6] uppercase tracking-widest shadow-lg">
                {loading ? 'Processing...' : 'Post Journal Entry'}
            </button>
        </div>
    );
};