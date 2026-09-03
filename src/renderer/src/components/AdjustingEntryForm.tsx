// src/renderer/src/components/AdjustingEntryForm.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { NewContactModal } from './NewContactModal';
import { UploadCloud, File as FileIcon, X, Image as ImageIcon } from 'lucide-react';

const getLocalDateString = () => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

export const AdjustingEntryForm: React.FC<{ userId: string }> = ({ userId }) => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [pastEntries, setPastEntries] = useState<any[]>([]); 
    const [payees, setPayees] = useState<any[]>([]);

    const [date, setDate] = useState(getLocalDateString());
    
    // Hardcoded to ADJ-
    const [refPrefix] = useState('ADJ-');
    const [refSequence, setRefSequence] = useState('');
    const [description, setDescription] = useState('Adjusting Entry: ');

    const [vatType, setVatType] = useState('EXEMPT');
    const [payeeId, setPayeeId] = useState(''); 
    
    const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
    
    const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
    const [payeeSearchQuery, setPayeeSearchQuery] = useState('');
    const [isRefDropdownOpen, setIsRefDropdownOpen] = useState(false); 
    const [activeAccountRow, setActiveAccountRow] = useState<number | null>(null); 
    const [accountSearchQuery, setAccountSearchQuery] = useState(''); 
    
    const [payeeBalance, setPayeeBalance] = useState<{receivable: number, payable: number} | null>(null);
    const [lines, setLines] = useState([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }]);
    
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const api = (window as any).electronAPI || (window as any).api;
        if (api) {
            if (api.getAccounts) api.getAccounts().then((res: any) => setAccounts(Array.isArray(res) ? res : [])).catch(() => setAccounts([]));
            if (api.getPayees) api.getPayees().then((res: any) => setPayees(Array.isArray(res) ? res : [])).catch(() => setPayees([]));
            if (api.getAllJournalEntries) api.getAllJournalEntries().then((res: any) => setPastEntries(Array.isArray(res) ? res : [])).catch(() => setPastEntries([]));
        }
    }, []);

    useEffect(() => {
        const fetchNextSeq = async () => {
            try {
                const api = (window as any).api || (window as any).electronAPI;
                const nextSeq = await api.getNextSequence(refPrefix);
                setRefSequence(nextSeq);
            } catch (error) { console.error("Failed to fetch next sequence", error); }
        };
        fetchNextSeq();
    }, [refPrefix, status]); 

    useEffect(() => {
        if (!payeeId) {
            setPayeeBalance(null);
            return;
        }
        const fetchBalance = async () => {
            const api = (window as any).electronAPI || (window as any).api;
            if (api && api.getPayeeBalance) {
                const bal = await api.getPayeeBalance(payeeId);
                setPayeeBalance(bal);
            }
        };
        fetchBalance();
    }, [payeeId]);

    const handleContactSaved = async (newId: string, newName: string) => {
        const api = (window as any).electronAPI || (window as any).api;
        if (api?.getPayees) {
            const updatedPayees = await api.getPayees();
            setPayees(Array.isArray(updatedPayees) ? updatedPayees : []);
        }
        setPayeeId(newId);
        setIsNewContactModalOpen(false);
        setStatus({ type: 'success', msg: `${newName} was added and selected.` });
        setTimeout(() => setStatus(null), 3000);
    };

    const addLine = () => setLines([...lines, { accountId: '', debit: 0, credit: 0 }]);

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index][field as keyof typeof newLines[0]] = value;
        if (field === 'debit' && value > 0) newLines[index].credit = 0;
        if (field === 'credit' && value > 0) newLines[index].debit = 0;
        setLines(newLines);
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) return;
        const newLines = lines.filter((_, i) => i !== index);
        setLines(newLines);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) handleFilesAdded(Array.from(e.target.files));
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) handleFilesAdded(Array.from(e.dataTransfer.files));
    };

    const handleFilesAdded = (files: File[]) => {
        const validFiles = files.filter(file => {
            const isValidType = ['image/jpeg', 'image/png', 'application/pdf', 'application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type);
            const isValidSize = file.size <= 10 * 1024 * 1024;
            if (!isValidType) alert(`${file.name} is not a supported file type.`);
            if (!isValidSize) alert(`${file.name} exceeds the 10MB limit.`);
            return isValidType && isValidSize;
        });

        if (attachments.length + validFiles.length > 10) {
            alert('You can only upload a maximum of 10 attachments per entry.');
            return;
        }

        setAttachments(prev => [...prev, ...validFiles]);
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const processAttachments = async () => {
        return Promise.all(attachments.map(async (file) => {
            return new Promise<{ name: string, type: string, size: number, data: string | ArrayBuffer | null }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: reader.result });
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }));
    };

    const totalDebit = lines.reduce((sum, ln) => sum + (Number(ln.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, ln) => sum + (Number(ln.credit) || 0), 0);
    const isBalanced = totalDebit > 0 && totalDebit.toFixed(2) === totalCredit.toFixed(2);

    const handleSubmit = async () => {
        setStatus(null);
        setLoading(true);

        try {
            if (!refSequence.trim()) throw new Error("Please enter a Sequence Number for the Reference.");
            
            const validLines = lines.filter(l => l.accountId !== '' && (l.debit > 0 || l.credit > 0));
            const api = (window as any).electronAPI || (window as any).api;
            
            const paddedSequence = refSequence.padStart(3, '0');
            const fullReferenceNo = `${refPrefix}${paddedSequence}`;

            const processedAttachments = await processAttachments();

            const result = await api.submitJournalEntry({
                date: new Date(date),
                referenceNo: fullReferenceNo,
                description,
                vatType,
                payeeId: payeeId === '' ? undefined : payeeId,
                userId,
                lines: validLines,
                attachments: processedAttachments 
            });

            if (result.success) {
                setStatus({ type: 'success', msg: `Entry ${result.referenceNo} posted successfully!` });
                setDescription('Adjusting Entry: ');
                setVatType('EXEMPT'); 
                setPayeeId(''); 
                setPayeeSearchQuery(''); 
                setLines([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }]);
                setAttachments([]); 
                
                if (api.getAllJournalEntries) {
                    api.getAllJournalEntries().then((res: any) => setPastEntries(Array.isArray(res) ? res : []));
                }
            } else {
                setStatus({ type: 'error', msg: result.error });
            }
        } catch (err: any) {
            setStatus({ type: 'error', msg: err.message || "Failed to submit to database." });
        } finally {
            setLoading(false);
        }
    };

    const filteredPayees = payees.filter(p => {
        if (!p || !p.name) return false;
        return String(p.name).toLowerCase().includes(String(payeeSearchQuery || '').toLowerCase());
    });

    const selectedPayeeName = payees.find(p => p.id === payeeId)?.name || '-- No Sub-Account Tagged --';

    return (
        <div className="w-full min-h-[calc(100vh-64px)] p-6 md:p-10 bg-[#f9fafb] animate-in fade-in duration-300">
            <div className="max-w-5xl mx-auto bg-white border border-[#B0DCDA] rounded-xl p-8 shadow-sm">

                {/* HEADER */}
                <div className="flex justify-between items-center mb-6 border-b border-[#B0DCDA] pb-4">
                    <h2 className="text-xl font-extrabold text-gray-800 tracking-wide">Record Adjusting Entry</h2>
                    <span className="bg-[#E9FAFA] text-[#1B9387] text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-widest border border-[#B0DCDA]">
                        Adjusting Journal
                    </span>
                </div>

                {status && (
                    <div className={`mb-6 p-4 rounded-md text-sm font-bold ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border border-[#B0DCDA]' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                    </div>
                )}

                <div className="grid gap-6 mb-6 grid-cols-2">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition cursor-pointer" />
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reference No. (Correction)</label>
                        <div className="flex bg-[#FBF8F8] border border-[#B0DCDA] rounded-md focus-within:border-[#1B9387] focus-within:ring-2 focus-within:ring-[#E9FAFA] transition">
                            <span className="bg-gray-50 border-r border-[#B0DCDA] rounded-l-md px-4 py-3 text-xs font-bold text-gray-600 flex items-center justify-center pointer-events-none">
                                ADJ-
                            </span>
                            <input 
                                type="text" 
                                value={refSequence} 
                                onChange={e => { setRefSequence(e.target.value); setIsRefDropdownOpen(true); }} 
                                onFocus={() => setIsRefDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setIsRefDropdownOpen(false), 200)}
                                placeholder="Search (e.g. OR-1001)" 
                                className="w-full bg-transparent p-3 text-sm font-mono text-gray-800 font-bold outline-none" 
                            />
                            <button
                                type="button"
                                onClick={() => setIsRefDropdownOpen(!isRefDropdownOpen)}
                                className="px-4 text-gray-400 hover:text-[#1B9387] bg-white border-l border-[#B0DCDA] rounded-r-md transition cursor-pointer"
                                title="Search Past Transactions"
                            >
                                🔍
                            </button>
                        </div>

                        {isRefDropdownOpen && (
                            <ul className="absolute z-50 w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl max-h-48 overflow-y-auto">
                                <li className="p-2 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider sticky top-0">Recent Database Entries</li>
                                {pastEntries
                                    .filter(e => e && e.reference_no && String(e.reference_no).toLowerCase().includes(String(refSequence || '').toLowerCase()))
                                    .map(entry => (
                                        <li
                                            key={entry.id}
                                            onMouseDown={() => {
                                                const cleanRef = String(entry.reference_no).replace('ADJ-', '');
                                                setRefSequence(cleanRef);
                                                if (description === 'Adjusting Entry: ') {
                                                    setDescription(`Adjusting Entry to correct ${entry.reference_no}: ${entry.description || ''}`);
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
                </div>

                <div className="mb-6 border-b border-[#B0DCDA] pb-6 relative">
                    <div className="mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Contact / Subsidiary (For AR/AP)</label>
                            <button type="button" onClick={() => setIsNewContactModalOpen(true)} className="bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-bold px-4 py-2 rounded-md transition shadow-sm cursor-pointer">
                                + New Contact
                            </button>
                        </div>

                        <div className="relative mt-2">
                            <div onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)} className={`w-full bg-[#FBF8F8] border ${isPayeeDropdownOpen ? 'border-[#1B9387] ring-2 ring-[#E9FAFA]' : 'border-[#B0DCDA]'} rounded-md p-3 text-sm text-gray-800 transition cursor-pointer flex justify-between items-center`}>
                                <span className={payeeId ? 'text-gray-800 font-medium' : 'text-gray-400'}>{selectedPayeeName}</span>
                            </div>

                            {isPayeeDropdownOpen && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-[#B0DCDA] rounded-md shadow-xl overflow-hidden">
                                    <div className="p-2 border-b border-[#B0DCDA] bg-gray-50">
                                        <input type="text" autoFocus placeholder="🔍 Search contact name..." value={payeeSearchQuery} onChange={(e) => setPayeeSearchQuery(e.target.value)} className="w-full bg-transparent p-2 text-sm text-gray-800 outline-none placeholder-gray-400" />
                                    </div>
                                    <ul className="max-h-48 overflow-y-auto">
                                        <li onClick={() => { setPayeeId(''); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-gray-500 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition font-medium">
                                            -- No Sub-Account Tagged --
                                        </li>
                                        {filteredPayees.map((p: any) => (
                                            <li key={p.id} onClick={() => { setPayeeId(p.id); setIsPayeeDropdownOpen(false); setPayeeSearchQuery(''); }} className="p-3 text-sm text-gray-800 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-t border-gray-50">
                                                {p.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description / Memo</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Type transaction details here..." className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 h-20 resize-none font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition" />
                    </div>
                </div>

                <div className="border border-[#B0DCDA] rounded-md bg-white overflow-visible mb-6 shadow-sm">
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
                                    <td className="p-0 border-r border-[#B0DCDA] relative align-top">
                                        {activeAccountRow === idx ? (
                                            <div className="absolute z-50 left-0 top-0 w-full min-w-[350px] bg-white border border-[#1B9387] shadow-xl rounded-md overflow-hidden">
                                                <div className="p-2 bg-[#FBF8F8] border-b border-[#B0DCDA]">
                                                    <input type="text" autoFocus placeholder="🔍 Type account code or name..." value={accountSearchQuery} onChange={(e) => setAccountSearchQuery(e.target.value)} onBlur={() => setTimeout(() => setActiveAccountRow(null), 200)} className="w-full bg-transparent p-1.5 text-sm text-gray-800 outline-none font-medium" />
                                                </div>
                                                <ul className="max-h-48 overflow-y-auto bg-white">
                                                    {accounts.filter(a => a && a.name && `${a.code} ${a.name}`.toLowerCase().includes(String(accountSearchQuery || '').toLowerCase())).map(acc => (
                                                        <li key={acc.code} onMouseDown={() => { updateLine(idx, 'accountId', acc.code); setActiveAccountRow(null); }} className="p-3 text-sm text-gray-700 hover:bg-[#E9FAFA] hover:text-[#1B9387] cursor-pointer transition border-b border-gray-50 last:border-0 flex items-center">
                                                            <span className="font-mono font-bold text-[#1B9387] w-14 inline-block">{acc.code}</span>
                                                            <span className="font-medium">{acc.name}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <div onClick={() => { setActiveAccountRow(idx); setAccountSearchQuery(''); }} className="w-full h-full min-h-[44px] p-3.5 pl-5 text-sm text-gray-800 cursor-text flex justify-between items-center group">
                                                {line.accountId ? (
                                                    <span>
                                                        <span className="font-mono font-extrabold text-[#1B9387] mr-3">{line.accountId}</span>
                                                        <span className="font-medium text-gray-800">{accounts.find(a => a.code === line.accountId)?.name}</span>
                                                    </span>
                                                ) : <span className="text-gray-400 italic font-medium">Type to search account...</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-0 border-r border-[#B0DCDA] align-top">
                                        <div className="relative flex items-center h-full">
                                            <span className="absolute left-3 text-gray-400 font-mono text-xs">₱</span>
                                            <input type="number" min="0" step="0.01" value={line.debit === 0 ? '' : line.debit} placeholder="0.00" onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)} className="w-full h-full min-h-[44px] bg-transparent pl-8 pr-3 text-sm text-right text-gray-800 font-mono font-bold outline-none placeholder-gray-300 focus:bg-[#E9FAFA] transition" />
                                        </div>
                                    </td>
                                    <td className="p-0 border-r border-[#B0DCDA] align-top">
                                        <div className="relative flex items-center h-full">
                                            <span className="absolute left-3 text-gray-400 font-mono text-xs">₱</span>
                                            <input type="number" min="0" step="0.01" value={line.credit === 0 ? '' : line.credit} placeholder="0.00" onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)} className="w-full h-full min-h-[44px] bg-transparent pl-8 pr-3 text-sm text-right text-gray-800 font-mono font-bold outline-none placeholder-gray-300 focus:bg-[#E9FAFA] transition" />
                                        </div>
                                    </td>
                                    <td className="p-2 text-center align-middle">
                                        <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 2} className="text-red-400 hover:text-red-600 disabled:opacity-20 transition cursor-pointer font-bold">✕</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Attachments</label>
                    <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={handleDrop}
                        className={`mt-2 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${isDragging ? 'bg-[#E9FAFA] border-[#1B9387]' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}
                    >
                        <UploadCloud className={`mb-3 ${isDragging ? 'text-[#1B9387]' : 'text-gray-400'}`} size={32} />
                        <p className="text-sm font-bold text-gray-600">Drag and drop or upload attachments here</p>
                        <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF, XLSX, ZIP. Max 10mb each.</p>
                        
                        <input type="file" multiple id="file-upload-adj" className="hidden" onChange={handleFileSelect} accept=".jpg,.jpeg,.png,.pdf,.zip,.xlsx" />
                        <label htmlFor="file-upload-adj" className="mt-4 cursor-pointer bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-xs font-bold hover:bg-gray-50 transition shadow-sm">
                            Browse Files
                        </label>
                    </div>

                    {attachments.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            {attachments.map((file, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-white border border-[#B0DCDA] rounded-lg shadow-sm">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {file.type.includes('image') ? <ImageIcon size={18} className="text-[#1B9387] shrink-0" /> : <FileIcon size={18} className="text-[#1B9387] shrink-0" />}
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-sm font-bold text-gray-700 truncate">{file.name}</span>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeAttachment(i)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition cursor-pointer shrink-0">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-end mt-6">
                    <button type="button" onClick={addLine} className="text-[#1B9387] text-sm font-bold hover:bg-[#E9FAFA] px-5 py-2.5 rounded-md transition border border-transparent hover:border-[#B0DCDA] shadow-sm cursor-pointer">
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
                                <span className="text-red-500 text-sm font-extrabold uppercase tracking-widest flex items-center justify-end">⚠️ Out of Balance</span>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    disabled={!isBalanced || !refSequence || loading}
                    onClick={handleSubmit}
                    className="w-full mt-8 bg-[#1B9387] disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none text-white font-bold py-4 rounded-md transition hover:bg-[#28958B] uppercase tracking-widest shadow-md flex justify-center items-center cursor-pointer disabled:cursor-not-allowed"
                >
                    {loading ? 'Processing...' : 'Post Adjusting Entry'}
                </button>
            </div>
            
            <NewContactModal
                isOpen={isNewContactModalOpen}
                onClose={() => setIsNewContactModalOpen(false)}
                onSaveSuccess={handleContactSaved}
                defaultType="PATIENT"
            />
        </div>
    );
};