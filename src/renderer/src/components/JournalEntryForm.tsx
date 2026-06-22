// src/renderer/src/components/JournalEntryForm.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export const JournalEntryForm: React.FC<{ userId: string }> = ({ userId }) => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [refNo, setRefNo] = useState('');
    const [description, setDescription] = useState('');
    // Start with 2 empty lines since Double-Entry requires at least 2
    const [lines, setLines] = useState([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }]);
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch Chart of Accounts from MySQL on load
        const api = (window as any).electronAPI;
        if (api && api.getAccounts) {
            api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
        }
    }, []);

    const addLine = () => setLines([...lines, { accountId: '', debit: 0, credit: 0 }]);

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index][field] = value;

        // Automatically zero out the opposite column to prevent user error
        if (field === 'debit' && value > 0) newLines[index].credit = 0;
        if (field === 'credit' && value > 0) newLines[index].debit = 0;

        setLines(newLines);
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) return; // Prevent removing below 2 lines
        const newLines = lines.filter((_, i) => i !== index);
        setLines(newLines);
    };

    const totalDebit = lines.reduce((sum, ln) => sum + (Number(ln.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, ln) => sum + (Number(ln.credit) || 0), 0);

    // Math must balance, and must not be zero
    const isBalanced = totalDebit > 0 && totalDebit.toFixed(2) === totalCredit.toFixed(2);

    const handleSubmit = async () => {
        setStatus(null);
        setLoading(true);

        try {
            // Filter out empty lines before submitting
            const validLines = lines.filter(l => l.accountId !== '' && (l.debit > 0 || l.credit > 0));

            const api = (window as any).electronAPI;
            const result = await (window as any).electronAPI.submitJournalEntry({
                date: new Date(date),
                referenceNo: refNo,
                description,
                userId,
                lines: validLines
            });

            if (result.success) {
                setStatus({ type: 'success', msg: `Entry ${result.referenceNo} posted successfully!` });
                // Reset form on success
                setRefNo('');
                setDescription('');
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

    return (
        <div className="max-w-4xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b border-[#29292e] pb-4">
                <h2 className="text-xl font-bold text-white tracking-wide">New Journal Entry</h2>
                <span className="bg-[#4f46e5]/20 text-[#4f46e5] text-xs px-3 py-1 rounded font-bold uppercase tracking-widest border border-[#4f46e5]/30">General Journal</span>
            </div>

            {status && (
                <div className={`mb-6 p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Reference No.</label>
                    <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="e.g. OR-1001" className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white focus:border-[#4f46e5] outline-none transition" />
                </div>
            </div>

            <div className="mb-6">
                <label className="block text-xs font-bold text-[#8d8d99] uppercase tracking-wider mb-2">Description / Memo</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Type transaction details here..." className="w-full bg-[#121214] border border-[#29292e] rounded-md p-3 text-sm text-white h-20 resize-none focus:border-[#4f46e5] outline-none transition" />
            </div>
            {/* TRANSACTION LINES TABLE */}
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
                                    <select
                                        value={line.accountId}
                                        onChange={e => updateLine(idx, 'accountId', e.target.value)}
                                        className="w-full bg-transparent text-sm text-white outline-none cursor-pointer"
                                    >
                                        <option value="" className="bg-[#121214] text-[#8d8d99]">Select Account...</option>
                                        {accounts.map(acc => (
                                            <option key={acc.code} value={acc.code} className="bg-[#202024] text-white">
                                                {acc.code} - {acc.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-2 border-r border-[#29292e]/50">
                                    <input type="number" min="0" step="0.01" value={line.debit === 0 ? '' : line.debit} placeholder="0.00" onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-sm text-right text-white outline-none placeholder-[#3f3f46]" />
                                </td>
                                <td className="p-2 border-r border-[#29292e]/50">
                                    <input type="number" min="0" step="0.01" value={line.credit === 0 ? '' : line.credit} placeholder="0.00" onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-sm text-right text-white outline-none placeholder-[#3f3f46]" />
                                </td>
                                <td className="p-2 text-center">
                                    <button onClick={() => removeLine(idx)} disabled={lines.length <= 2} className="text-[#f75a68] hover:text-red-400 disabled:opacity-20 transition" title="Remove Line">
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* FOOTER & MATH VALIDATION */}
            <div className="flex justify-between items-end mt-6">
                <button onClick={addLine} className="text-[#4f46e5] text-sm font-bold hover:underline bg-[#4f46e5]/10 px-4 py-2 rounded transition">
                    + Add Line
                </button>

                <div className="text-right bg-[#121214] p-4 rounded-md border border-[#29292e] min-w-[250px]">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#8d8d99] font-medium">Total Debits:</span>
                        <span className="text-white font-mono">₱ {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[#8d8d99] font-medium">Total Credits:</span>
                        <span className="text-white font-mono">₱ {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#29292e]">
                        {isBalanced ? (
                            <span className="text-emerald-500 text-xs font-bold uppercase tracking-widest flex items-center justify-end">✓ Balanced</span>
                        ) : (
                            <span className="text-[#f75a68] text-xs font-bold uppercase tracking-widest flex items-center justify-end">Out of Balance</span>
                        )}
                    </div>
                </div>
            </div>

            <button
                disabled={!isBalanced || !refNo || loading}
                onClick={handleSubmit}
                className="w-full mt-8 bg-[#4f46e5] disabled:bg-[#29292e] disabled:text-[#8d8d99] text-white font-bold py-4 rounded-md transition hover:bg-[#5b54f6] uppercase tracking-widest shadow-lg"
            >
                {loading ? 'Processing...' : 'Post Journal Entry'}
            </button>
        </div>
    );
};