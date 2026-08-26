import * as React from 'react';
import { useState, useEffect } from 'react';
import { NewContactModal } from './NewContactModal';
import * as XLSX from 'xlsx'; // 🔥 IMPORT XLSX

export function ContactDirectoryView() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal & UI States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
    
    const fetchContacts = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getContactsWithBalances();
            setContacts(data || []);
        } catch (error) {
            console.error("Failed to fetch contacts", error);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchContacts(); }, []);

    // 🔥 HANDLE EXCEL IMPORT
    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = ''; // Reset input
        if (!file) return;

        setLoading(true);
        try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<any>(sheet);

            if (rows.length === 0) throw new Error("File is empty.");

            // Smart mapping (checks for common column names like 'Name', 'Contact Name', 'Patient Name')
            const formattedData = rows.map(row => ({
                name: row['Name'] || row['Contact Name'] || row['Patient Name'],
                type: (row['Type'] || row['Category'] || 'PATIENT').toUpperCase(),
                tin: row['TIN'] || row['Tax ID'] || '',
                email: row['Email'] || row['Email Address'] || '',
                phone: row['Phone'] || row['Contact Number'] || row['Mobile'] || '',
                address: row['Address'] || ''
            })).filter(r => r.name); // Must have a name to be valid

            if (formattedData.length === 0) throw new Error("Could not find a valid 'Name' column in the Excel file.");

            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.importPayees(formattedData);

            if (result.success) {
                alert(`Successfully imported ${result.count} new contacts! (Duplicates were skipped).`);
                fetchContacts();
            } else {
                alert(`Import failed: ${result.error}`);
            }
        } catch (error: any) {
            alert(`Error reading file: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.tin && c.tin.includes(searchQuery))
    );

    const getTypeStyle = (type: string) => {
        switch(type) {
            case 'SUPPLIER': return 'text-orange-500 bg-orange-50 border-orange-200';
            case 'PATIENT': return 'text-blue-500 bg-blue-50 border-blue-200';
            case 'DOCTOR': return 'text-purple-500 bg-purple-50 border-purple-200';
            case 'HMO': return 'text-[#1B9387] bg-[#E9FAFA] border-[#B0DCDA]';
            case 'CORPORATE': return 'text-teal-600 bg-teal-50 border-teal-200';
            default: return 'text-gray-500 bg-gray-50 border-gray-200';
        }
    };

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    const formatCurrency = (amount: number) => {
        if (!amount || amount === 0) return '-';
        return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col font-sans text-gray-800 relative">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Contacts & Entities</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Manage patients, doctors, HMOs, and outstanding balances.</p>
                </div>
            </div>

            <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] flex space-x-4 items-center">
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Search by name or TIN..." 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                            className="w-80 bg-white border border-[#B0DCDA] rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] text-gray-800 transition-all shadow-sm" 
                        />
                    </div>
                    
                    <div className="flex-1"></div>
                    
                    {/* 🔥 EXCEL IMPORT BUTTON */}
                    <label className="bg-white border border-[#B0DCDA] hover:bg-[#E9FAFA] text-[#1B9387] px-4 py-2 rounded-md text-sm font-extrabold shadow-sm cursor-pointer transition flex items-center space-x-2">
                        <span>📥</span> <span>Import CSV/Excel</span>
                        <input type="file" accept=".csv,.xls,.xlsx" onChange={handleImportFile} className="hidden" />
                    </label>

                    <button onClick={() => setIsModalOpen(true)} className="bg-[#1B9387] hover:bg-[#28958B] border border-transparent text-white px-5 py-2 rounded-md text-sm font-extrabold shadow-sm transition flex items-center space-x-2 cursor-pointer">
                        <span>+ New Contact</span>
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-[#1B9387]">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#FBF8F8] sticky top-0 z-10 border-b border-[#B0DCDA] shadow-sm">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 border-r border-gray-100">Contact Name</th>
                                    <th className="p-4 border-r border-gray-100">Type</th>
                                    <th className="p-4 border-r border-gray-100">Phone / Email</th>
                                    <th className="p-4 text-right text-orange-500 border-r border-gray-100">You Owe (₱)</th>
                                    <th className="p-4 text-right text-[#1B9387]">They Owe (₱)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredContacts.length === 0 ? (
                                    <tr><td colSpan={5} className="p-12 text-center text-gray-500 italic font-medium">No contacts found.</td></tr>
                                ) : (
                                    filteredContacts.map(c => (
                                        <React.Fragment key={c.id}>
                                            <tr 
                                                onClick={() => setExpandedContactId(expandedContactId === c.id ? null : c.id)}
                                                className={`cursor-pointer transition-colors group ${expandedContactId === c.id ? 'bg-[#E9FAFA]' : 'hover:bg-gray-50 even:bg-gray-50/50 odd:bg-white'}`}
                                            >
                                                <td className="p-4 flex items-center space-x-4 border-r border-gray-100">
                                                    <div className="h-8 w-8 rounded-full bg-white text-[#1B9387] flex items-center justify-center font-extrabold text-xs border border-[#B0DCDA] shadow-sm shrink-0">
                                                        {getInitials(c.name)}
                                                    </div>
                                                    <span className="font-extrabold text-gray-800 text-base group-hover:text-[#1B9387] transition">{c.name}</span>
                                                </td>
                                                <td className="p-4 border-r border-gray-100">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${getTypeStyle(c.type)}`}>
                                                        {c.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs text-gray-500 font-medium border-r border-gray-100">
                                                    {c.email ? c.email : c.phone ? c.phone : '-'}
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-orange-500 border-r border-gray-100">
                                                    {formatCurrency(c.youOwe)}
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-[#1B9387]">
                                                    {formatCurrency(c.theyOwe)}
                                                </td>
                                            </tr>

                                            {expandedContactId === c.id && (
                                                <tr className="bg-[#FBF8F8] border-b border-[#B0DCDA] shadow-inner">
                                                    <td colSpan={5} className="p-6 border-l-4 border-l-[#1B9387]">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                            <div>
                                                                <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">Contact Information</p>
                                                                <div className="space-y-1.5 mt-2">
                                                                    <p className="text-sm text-gray-800 font-medium"><span className="text-gray-400 mr-2 inline-block w-12 font-bold">Email:</span> {c.email || <span className="italic text-gray-400 font-normal">Not provided</span>}</p>
                                                                    <p className="text-sm text-gray-800 font-medium"><span className="text-gray-400 mr-2 inline-block w-12 font-bold">Phone:</span> {c.phone || <span className="italic text-gray-400 font-normal">Not provided</span>}</p>
                                                                    <p className="text-sm text-gray-800 font-medium"><span className="text-gray-400 mr-2 inline-block w-12 font-bold">TIN:</span> <span className="font-mono font-bold">{c.tin || <span className="italic text-gray-400 font-sans font-normal">Not provided</span>}</span></p>
                                                                </div>
                                                            </div>
                                                            <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
                                                                <p className="text-[10px] text-orange-500 font-extrabold uppercase tracking-wider mb-1">Accounts Payable (Clinic Owes)</p>
                                                                <p className="text-2xl font-mono font-black text-orange-500 mt-2">
                                                                    ₱ {c.youOwe ? c.youOwe.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-white p-4 rounded-lg border border-[#B0DCDA] shadow-sm">
                                                                <p className="text-[10px] text-[#1B9387] font-extrabold uppercase tracking-wider mb-1">Accounts Receivable (They Owe)</p>
                                                                <p className="text-2xl font-mono font-black text-[#1B9387] mt-2">
                                                                    ₱ {c.theyOwe ? c.theyOwe.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <NewContactModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSaveSuccess={() => fetchContacts()} 
                defaultType="PATIENT"
            />
        </div>
    );
}