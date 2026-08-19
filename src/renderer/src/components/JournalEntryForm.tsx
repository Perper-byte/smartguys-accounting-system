// src/renderer/src/components/JournalEntryForm.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { AddPatientForm } from './AddPatientForm';

export const JournalEntryForm: React.FC<{ userId: string; isAdjusting?: boolean }> = ({ userId, isAdjusting = false }) => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [pastEntries, setPastEntries] = useState<any[]>([]); // 🔥 NEW: Store past entries for correction

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [refNo, setRefNo] = useState(isAdjusting ? 'ADJ-' : '');
    const [description, setDescription] = useState(isAdjusting ? 'Adjusting Entry: ' : '');

    const [vatType, setVatType] = useState(isAdjusting ? 'EXEMPT' : 'VATABLE');
    const [payees, setPayees] = useState<any[]>([]);
    const [payeeId, setPayeeId] = useState('');
    const [showAddPatient, setShowAddPatient] = useState(false);

    // Dropdown States
    const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
    const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
    const [isRefDropdownOpen, setIsRefDropdownOpen] = useState(false); // 🔥 NEW: Ref Search State
    const [activeAccountRow, setActiveAccountRow] = useState<number | null>(null); // Restored Account Search State
    const [accountSearchQuery, setAccountSearchQuery] = useState('');

    const [payeeBalance, setPayeeBalance] = useState<{ receivable: number, payable: number } | null>(null);
    const [lines, setLines] = useState([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }]);
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const api = (window as any).electronAPI;
        if (api) {
            if (api.getAccounts) api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
            if (api.getPayees) api.getPayees().then(setPayees).catch(() => setPayees([]));
            // 🔥 Fetch past entries for the Ref search
            if (api.getAllJournalEntries) api.getAllJournalEntries().then(setPastEntries).catch(() => setPastEntries([]));
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

    const groupedAccounts = useMemo(() => {
        return accounts.reduce((groups: any, acc: any) => {
            const categoryName = acc.account_type?.name || 'Other';
            if (!groups[categoryName]) {
                groups[categoryName] = [];
            }
            groups[categoryName].push(acc);
            return groups;
        }, {});
    }, [accounts]);

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
                description: isAdjusting ? description : `[${vatType}] ${description}`,
                payeeId: payeeId === '' ? undefined : payeeId,
                userId,
                lines: validLines
            });

            if (result.success) {
                setStatus({ type: 'success', msg: `Entry ${result.referenceNo} posted successfully!` });
                setRefNo(isAdjusting ? 'ADJ-' : '');
                setDescription(isAdjusting ? 'Adjusting Entry: ' : '');
                setVatType(isAdjusting ? 'EXEMPT' : 'VATABLE');
                setPayeeId('');
                setPayeeSearchQuery('');
                setLines([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }]);

                // Refresh past entries list
                if (api.getAllJournalEntries) api.getAllJournalEntries().then(setPastEntries);
            } else {
                setStatus({ type: 'error', msg: result.error });
            }
        } catch (err: any) {
            setStatus({ type: 'error', msg: "Connection Error: Failed to submit to database." });
        } finally {
            setLoading(false);
        }
    };

    const filteredPayees = payees.filter(p => p.name.toLowerCase().includes(payeeSearchQuery.toLowerCase()));
    const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '-- No Patient Tagged --';

    return (
        <div className="w-full bg-white border border-[#B0DCDA] rounded-xl p-8 shadow-sm">

            {/* HEADER */}
            <div className="flex justify-between items-center mb-6 border-b border-[#B0DCDA] pb-4">
                <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">
                    {isAdjusting ? 'Record Adjusting Entry' : 'New Journal Entry'}
                </h2>
                <span className="bg-[#E9FAFA] text-[#1B9387] text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-widest border border-[#B0DCDA]">
                    {isAdjusting ? 'Adjusting Journal' : 'General Journal'}
                </span>
            </div>

            {/* STATUS MESSAGE */}
            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            {/* TOP ROW: Date, Ref, VAT */}
            <div className={`grid gap-6 mb-6 ${isAdjusting ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                </div>

                {/* 🔥 SEARCHABLE REFERENCE NO. WITH BUTTON */}
                <div className="relative">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        {isAdjusting ? 'Reference No. (Correction)' : 'Reference No.'}
                    </label>
                    <div className="flex bg-[#FBF8F8] border border-[#B0DCDA] rounded-md focus-within:border-[#1B9387] focus-within:ring-2 focus-within:ring-[#E9FAFA] transition">
                        <input
                            type="text"
                            value={refNo}
                            onChange={e => { setRefNo(e.target.value); setIsRefDropdownOpen(true); }}
                            onFocus={() => setIsRefDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setIsRefDropdownOpen(false), 200)}
                            placeholder={isAdjusting ? "e.g. ADJ-OR-1001" : "e.g. OR-1001"}
                            className="w-full bg-transparent p-3 text-sm text-gray-800 font-bold outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setIsRefDropdownOpen(!isRefDropdownOpen)}
                            className="px-4 text-gray-400 hover:text-[#1B9387] bg-white border-l border-[#B0DCDA] rounded-r-md transition"
                            title="Search Past Transactions"
                        >
                            🔍
                        </button>
                    </div>

                    {/* Past Transactions Dropdown */}
                    {isRefDropdownOpen && (
                        <ul className="absolute z-50 w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl max-h-48 overflow-y-auto">
                            <li className="p-2 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider sticky top-0">Recent Database Entries</li>
                            {pastEntries
                                .filter(e => e.reference_no.toLowerCase().includes(refNo.replace('ADJ-', '').toLowerCase()))
                                .map(entry => (
                                    <li
                                        key={entry.id}
                                        onMouseDown={() => {
                                            // Automatically prefix with ADJ- if adjusting
                                            setRefNo(isAdjusting && !entry.reference_no.startsWith('ADJ') ? `ADJ-${entry.reference_no}` : entry.reference_no);
                                            // Optionally auto-fill description
                                            if (isAdjusting && description === 'Adjusting Entry: ') {
                                                setDescription(`Adjusting Entry to correct ${entry.reference_no}: ${entry.description}`);
                                            }
                                        }}
                                        className="p-3 text-sm text-gray-800 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-b border-gray-50 last:border-0"
                                    >
                                        <span className="font-mono font-bold text-[#1B9387] mr-2">{entry.reference_no}</span>
                                        <span className="text-gray-500 truncate">{entry.description}</span>
                                    </li>
                                ))}
                        </ul>
                    )}
                </div>

                {!isAdjusting && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">VAT Type</label>
                        <div className="relative">
                            <select value={vatType} onChange={e => setVatType(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 pr-10 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition appearance-none cursor-pointer">
                                <option value="VATABLE">Vatable (12%)</option>
                                <option value="EXEMPT">VAT-Exempt</option>
                                <option value="ZERO_RATED">Zero-Rated (0%)</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* PAYEE & DESCRIPTION */}
            <div className="mb-6 border-b border-[#B0DCDA] pb-6 relative">
                {!isAdjusting && (
                    <div className="mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Patient / Payee (For AR/AP)</label>
                            <button type="button" onClick={() => setShowAddPatient(!showAddPatient)} className="text-xs font-bold text-[#1B9387] hover:text-[#28958B] transition hover:underline">
                                {showAddPatient ? 'Cancel' : '+ Add New Patient'}
                            </button>
                        </div>

                        {showAddPatient && <AddPatientForm onPatientAdded={handlePatientAdded} />}

                        <div className="relative mt-2">
                            <div
                                onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)}
                                className={`w-full bg-[#FBF8F8] border ${isPayeeDropdownOpen ? 'border-[#1B9387] ring-2 ring-[#E9FAFA]' : 'border-[#B0DCDA]'} rounded-md p-3 text-sm text-gray-800 transition cursor-pointer flex justify-between items-center`}
                            >
                                <span className={payeeId ? 'text-gray-800 font-medium' : 'text-gray-400'}>{selectedPayeeName}</span>
                                <svg className="w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>

                            {isPayeeDropdownOpen && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden">
                                    <div className="p-2 border-b border-[#B0DCDA] bg-gray-50">
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="🔍 Search patient name..."
                                            value={payeeSearchQuery}
                                            onChange={(e) => setPayeeSearchQuery(e.target.value)}
                                            className="w-full bg-transparent p-2 text-sm text-gray-800 outline-none placeholder-gray-400"
                                        />
                                    </div>

                                    <ul className="max-h-48 overflow-y-auto">
                                        <li
                                            onClick={() => { setPayeeId(''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }}
                                            className="p-3 text-sm text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition font-medium"
                                        >
                                            -- No Patient Tagged --
                                        </li>
                                        {filteredPayees.length > 0 ? (
                                            filteredPayees.map(p => (
                                                <li
                                                    key={p.id}
                                                    onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }}
                                                    className="p-3 text-sm text-gray-800 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-t border-gray-100 font-medium"
                                                >
                                                    {p.name}
                                                </li>
                                            ))
                                        ) : (
                                            <li className="p-3 text-sm text-red-500 text-center border-t border-gray-100">
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
                                    <span className="text-red-600 font-bold bg-red-50 px-3 py-1.5 rounded border border-red-200 flex items-center shadow-sm">
                                        ⚠️ Patient owes you: ₱{payeeBalance.receivable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                )}
                                {payeeBalance.payable > 0 && (
                                    <span className="text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded border border-amber-200 flex items-center shadow-sm">
                                        ⚠️ You owe supplier: ₱{payeeBalance.payable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                )}
                                {payeeBalance.receivable <= 0 && payeeBalance.payable <= 0 && (
                                    <span className="text-[#1B9387] font-bold bg-[#E9FAFA] px-3 py-1.5 rounded border border-[#B0DCDA] flex items-center shadow-sm">
                                        ✅ Cleared / No outstanding balance
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description / Memo</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Type transaction details here..." className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 h-20 resize-none font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                </div>
            </div>

            {/* 🔥 RESTORED: SEARCHABLE ACCOUNT TABLE */}
            <div className="border border-[#B0DCDA] rounded-md bg-white overflow-hidden mb-6 shadow-sm">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-[#B0DCDA]">
                        <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                            <th className="p-3.5 pl-5 font-extrabold border-r border-[#B0DCDA] w-1/2">Account</th>
                            <th className="p-3.5 w-1/4 text-right font-extrabold border-r border-[#B0DCDA]">Debit</th>
                            <th className="p-3.5 w-1/4 text-right font-extrabold border-r border-[#B0DCDA]">Credit</th>
                            <th className="p-3.5 w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {lines.map((line, idx) => (
                            <tr key={idx} className="even:bg-gray-50 odd:bg-white hover:bg-[#E9FAFA]/50 transition">

                                {/* SEARCHABLE ACCOUNT CELL */}
                                <td className="p-0 border-r border-[#B0DCDA] relative">
                                    {activeAccountRow === idx ? (
                                        <div className="absolute z-50 left-0 top-0 w-full min-w-[350px] bg-white border border-[#1B9387] shadow-xl rounded-md overflow-hidden">
                                            <div className="p-2 bg-[#FBF8F8] border-b border-[#B0DCDA]">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="🔍 Type account code or name..."
                                                    value={accountSearchQuery}
                                                    onChange={(e) => setAccountSearchQuery(e.target.value)}
                                                    onBlur={() => setTimeout(() => setActiveAccountRow(null), 200)}
                                                    className="w-full bg-transparent p-1.5 text-sm text-gray-800 outline-none font-medium"
                                                />
                                            </div>
                                            <ul className="max-h-48 overflow-y-auto bg-white">
                                                {accounts
                                                    .filter(a => `${a.code} ${a.name}`.toLowerCase().includes(accountSearchQuery.toLowerCase()))
                                                    .map(acc => (
                                                        <li
                                                            key={acc.code}
                                                            onMouseDown={() => {
                                                                updateLine(idx, 'accountId', acc.code);
                                                                setActiveAccountRow(null);
                                                            }}
                                                            className="p-3 text-sm text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-b border-gray-50 last:border-0 flex items-center"
                                                        >
                                                            <span className="font-mono font-bold text-[#1B9387] w-14 inline-block">{acc.code}</span>
                                                            <span className="font-medium">{acc.name}</span>
                                                        </li>
                                                    ))
                                                }
                                                {accounts.filter(a => `${a.code} ${a.name}`.toLowerCase().includes(accountSearchQuery.toLowerCase())).length === 0 && (
                                                    <li className="p-3 text-sm text-red-500 text-center font-medium">No accounts found.</li>
                                                )}
                                            </ul>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => {
                                                setActiveAccountRow(idx);
                                                setAccountSearchQuery('');
                                            }}
                                            className="w-full h-full p-3.5 pl-5 text-sm text-gray-800 cursor-text flex justify-between items-center group"
                                        >
                                            {line.accountId ? (
                                                <span>
                                                    <span className="font-mono font-extrabold text-[#1B9387] mr-3">{line.accountId}</span>
                                                    <span className="font-medium text-gray-800">{accounts.find(a => a.code === line.accountId)?.name}</span>
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic font-medium">Type to search account...</span>
                                            )}
                                            <span className="text-gray-300 group-hover:text-[#1B9387] transition">🔍</span>
                                        </div>
                                    )}
                                </td>

                                <td className="p-2 border-r border-[#B0DCDA]">
                                    <div className="relative flex items-center">
                                        <span className="absolute left-3 text-gray-400 font-mono text-xs">₱</span>
                                        <input type="number" min="0" step="0.01" value={line.debit === 0 ? '' : line.debit} placeholder="0.00" onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)} className="w-full bg-transparent pl-8 pr-2 py-1.5 text-sm text-right text-gray-800 font-mono font-bold outline-none placeholder-gray-400 focus:ring-2 focus:ring-[#1B9387]/30 focus:border-[#1B9387] focus:bg-white rounded transition-all" />
                                    </div>
                                </td>
                                <td className="p-2 border-r border-[#B0DCDA]">
                                    <div className="relative flex items-center">
                                        <span className="absolute left-3 text-gray-400 font-mono text-xs">₱</span>
                                        <input type="number" min="0" step="0.01" value={line.credit === 0 ? '' : line.credit} placeholder="0.00" onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)} className="w-full bg-transparent pl-8 pr-2 py-1.5 text-sm text-right text-gray-800 font-mono font-bold outline-none placeholder-gray-400 focus:ring-2 focus:ring-[#1B9387]/30 focus:border-[#1B9387] focus:bg-white rounded transition-all" />
                                    </div>
                                </td>
                                <td className="p-2 text-center">
                                    <button onClick={() => removeLine(idx)} disabled={lines.length <= 2} className="text-red-400 hover:text-red-600 disabled:opacity-20 transition" title="Remove Line">✕</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* FOOTER & MATH VALIDATION */}
            <div className="flex justify-between items-end mt-6">
                <button onClick={addLine} className="text-[#1B9387] text-sm font-bold hover:bg-[#E9FAFA] px-5 py-2.5 rounded-md transition border border-transparent hover:border-[#B0DCDA] shadow-sm">
                    + Add Line
                </button>

                <div className="text-right bg-[#E9FAFA] p-5 rounded-md border border-[#B0DCDA] min-w-[300px] shadow-sm">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500 font-extrabold uppercase tracking-wider">Total Debits:</span>
                        <span className="text-gray-800 font-mono font-bold">₱ {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-extrabold uppercase tracking-wider">Total Credits:</span>
                        <span className="text-gray-800 font-mono font-bold">₱ {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#B0DCDA]">
                        {isBalanced ? (
                            <span className="text-[#1B9387] text-sm font-extrabold uppercase tracking-widest flex items-center justify-end">✓ Balanced</span>
                        ) : (
                            <span className="text-red-500 text-sm font-extrabold uppercase tracking-widest flex items-center justify-end">Out of Balance</span>
                        )}
                    </div>
                </div>
            </div>

            <button
                disabled={!isBalanced || !refNo || loading}
                onClick={handleSubmit}
                className="w-full mt-8 bg-[#1B9387] disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none text-white font-bold py-4 rounded-md transition hover:bg-[#28958B] uppercase tracking-widest shadow-md flex justify-center items-center"
            >
                {loading ? 'Processing...' : (isAdjusting ? 'Post Adjusting Entry' : 'Post Journal Entry')}
            </button>
        </div>
    );
};