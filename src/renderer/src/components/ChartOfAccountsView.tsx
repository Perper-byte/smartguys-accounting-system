// src/renderer/src/components/ChartOfAccountsView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export function ChartOfAccountsView() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [accountTypes, setAccountTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // New Account Form State
    const [newAccount, setNewAccount] = useState({ code: '', name: '', type_id: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const [accs, types] = await Promise.all([
                api.getAccounts(),
                api.getAccountTypes()
            ]);
            setAccounts(accs || []);
            setAccountTypes(types || []);
        } catch (error) {
            console.error("Failed to fetch COA data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage(null);
        if (!newAccount.code || !newAccount.name || !newAccount.type_id) return;

        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.createAccount(newAccount);

            if (result.success) {
                setStatusMessage({ type: 'success', msg: `Account ${newAccount.code} added to COA!` });
                setNewAccount({ code: '', name: '', type_id: '' });
                fetchData();
                setTimeout(() => setStatusMessage(null), 3000);
            } else {
                setStatusMessage({ type: 'error', msg: result.error || "Failed to create account." });
            }
        } catch (error) {
            setStatusMessage({ type: 'error', msg: "System Error." });
        } finally {
            setLoading(false);
        }
    };

    const filteredAccounts = accounts.filter(a => 
        a.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.account_type?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getTypeColor = (typeName: string) => {
        switch(typeName) {
            case 'Asset': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'Liability': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'Equity': return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'Revenue': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'Expense': return 'text-rose-600 bg-rose-50 border-rose-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col text-gray-800 font-sans animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Chart of Accounts (COA)</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Manage the clinic's ledger accounts and classifications.</p>
                </div>
            </div>

            {statusMessage && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border ${statusMessage.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {statusMessage.type === 'success' ? '✅ ' : '⚠️ '}{statusMessage.msg}
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
                {/* LEFT PANE: CREATE NEW ACCOUNT */}
                <div className="col-span-1 bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm h-fit">
                    <h3 className="text-lg font-extrabold text-gray-800 mb-5 border-b border-gray-100 pb-3">Create Ledger Account</h3>
                    <form onSubmit={handleCreateAccount} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Account Code</label>
                            <input type="text" required placeholder="e.g. 5060" value={newAccount.code} onChange={e => setNewAccount({...newAccount, code: e.target.value.trim()})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-mono font-bold focus:border-[#1B9387] outline-none transition" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Account Name</label>
                            <input type="text" required placeholder="e.g. Marketing Expense" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Classification Type</label>
                            <select required value={newAccount.type_id} onChange={e => setNewAccount({...newAccount, type_id: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition cursor-pointer">
                                <option value="">-- Select Type --</option>
                                {accountTypes.map(t => <option key={t.id} value={t.id}>{t.name} (Normal: {t.normal_balance})</option>)}
                            </select>
                        </div>
                        <button type="submit" disabled={loading || !newAccount.code || !newAccount.name || !newAccount.type_id} className="w-full bg-[#1B9387] hover:bg-[#28958B] text-white font-bold py-3 rounded-md transition mt-6 cursor-pointer shadow-sm uppercase tracking-wider text-sm disabled:opacity-50">
                            {loading ? 'Processing...' : 'Save Account'}
                        </button>
                    </form>
                </div>

                {/* RIGHT PANE: EXISTING ACCOUNTS */}
                <div className="col-span-2 bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] flex justify-between items-center">
                        <h3 className="text-lg font-extrabold text-gray-800 tracking-wide">Existing Accounts</h3>
                        <input type="text" placeholder="🔍 Search code or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64 bg-white border border-[#B0DCDA] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 shadow-sm" />
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA] sticky top-0 z-10">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 border-r border-gray-100 w-24 text-center">Code</th>
                                    <th className="p-4 border-r border-gray-100">Account Name</th>
                                    <th className="p-4 text-center border-r border-gray-100 w-32">Type</th>
                                    <th className="p-4 text-center w-24">Normal Bal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredAccounts.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-gray-500 italic font-medium">No accounts found.</td></tr>
                                ) : (
                                    filteredAccounts.map((a) => (
                                        <tr key={a.code} className="hover:bg-gray-50 transition-colors even:bg-gray-50/50 odd:bg-white">
                                            <td className="p-4 border-r border-gray-100 text-center font-mono font-extrabold text-[#1B9387]">{a.code}</td>
                                            <td className="p-4 border-r border-gray-100 font-extrabold text-gray-800">{a.name}</td>
                                            <td className="p-4 border-r border-gray-100 text-center">
                                                <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider border shadow-sm ${getTypeColor(a.account_type?.name)}`}>
                                                    {a.account_type?.name}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                                {a.account_type?.normal_balance}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}