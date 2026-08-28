// src/renderer/src/components/ChartOfAccountsView.tsx
import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Pencil, X, Search } from 'lucide-react';

export function ChartOfAccountsView() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [accountTypes, setAccountTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [highlightCode, setHighlightCode] = useState<string | null>(null);

    // New Account Form State
    const [newAccount, setNewAccount] = useState({ code: '', name: '', type_id: '' });
    const [touched, setTouched] = useState<{ code: boolean; name: boolean; type_id: boolean }>({ code: false, name: false, type_id: false });

    // Edit Modal State
    const [editingAccount, setEditingAccount] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ code: '', name: '', type_id: '' });
    const [editLoading, setEditLoading] = useState(false);

    const codeInputRef = useRef<HTMLInputElement>(null);

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

    // Close the edit modal on Escape
    useEffect(() => {
        if (!editingAccount) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeEditModal();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [editingAccount]);

    // ---- Validation helpers ----
    const existingCodes = useMemo(
        () => new Set(accounts.map(a => String(a.code).toLowerCase())),
        [accounts]
    );

    const isValidCodeFormat = (code: string) => /^[0-9]{3,6}$/.test(code);

    const codeError = (() => {
        if (!newAccount.code) return touched.code ? 'Account code is required.' : null;
        if (!isValidCodeFormat(newAccount.code)) return 'Use 3–6 digits (e.g. 5060).';
        if (existingCodes.has(newAccount.code.toLowerCase())) return 'That code is already in use.';
        return null;
    })();

    const nameError = !newAccount.name && touched.name ? 'Account name is required.' : null;
    const typeError = !newAccount.type_id && touched.type_id ? 'Select a classification type.' : null;

    const isFormValid =
        !!newAccount.code && isValidCodeFormat(newAccount.code) &&
        !existingCodes.has(newAccount.code.toLowerCase()) &&
        !!newAccount.name && !!newAccount.type_id;

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage(null);
        setTouched({ code: true, name: true, type_id: true });
        if (!isFormValid) return;

        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.createAccount(newAccount);

            if (result.success) {
                setStatusMessage({ type: 'success', msg: `Account ${newAccount.code} added to COA!` });
                setHighlightCode(newAccount.code);
                setNewAccount({ code: '', name: '', type_id: '' });
                setTouched({ code: false, name: false, type_id: false });
                await fetchData();
                codeInputRef.current?.focus();
                setTimeout(() => setStatusMessage(null), 3000);
                setTimeout(() => setHighlightCode(null), 2500);
            } else {
                setStatusMessage({ type: 'error', msg: result.error || "Failed to create account." });
            }
        } catch (error) {
            setStatusMessage({ type: 'error', msg: "System Error." });
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (account: any) => {
        setEditingAccount(account);
        setEditForm({ code: account.code, name: account.name, type_id: account.account_type?.id ?? account.type_id ?? '' });
        setStatusMessage(null);
    };

    const closeEditModal = () => {
        setEditingAccount(null);
        setEditForm({ code: '', name: '', type_id: '' });
    };

    const handleUpdateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccount || !editForm.code || !editForm.name || !editForm.type_id) return;

        setEditLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            if (!api.updateAccount) {
                setStatusMessage({ type: 'error', msg: 'Edit is not yet wired up on the backend (missing updateAccount handler).' });
                return;
            }
            const result = await api.updateAccount(editingAccount.id ?? editingAccount.code, editForm);

            if (result.success) {
                setStatusMessage({ type: 'success', msg: `Account ${editForm.code} updated.` });
                closeEditModal();
                fetchData();
                setTimeout(() => setStatusMessage(null), 3000);
            } else {
                setStatusMessage({ type: 'error', msg: result.error || "Failed to update account." });
            }
        } catch (error) {
            setStatusMessage({ type: 'error', msg: "System Error." });
        } finally {
            setEditLoading(false);
        }
    };

    const filteredAccounts = accounts.filter(a => {
        const matchesQuery =
            a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.account_type?.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = !typeFilter || a.account_type?.name === typeFilter;
        return matchesQuery && matchesType;
    });

    const clearFilters = () => { setSearchQuery(''); setTypeFilter(''); };

    const getTypeColor = (typeName: string) => {
        switch (typeName) {
            case 'Asset': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'Liability': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'Equity': return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'Revenue': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'Expense': return 'text-rose-600 bg-rose-50 border-rose-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    // Lightweight guidance based on common COA numbering conventions.
    // Adjust ranges here if your clinic's COA uses different bands.
    const getCodeRangeHint = (code: string): { label: string; typeName: string } | null => {
        const n = parseInt(code, 10);
        if (isNaN(n)) return null;
        if (n >= 1000 && n < 2000) return { label: '1000–1999 typically = Asset', typeName: 'Asset' };
        if (n >= 2000 && n < 3000) return { label: '2000–2999 typically = Liability', typeName: 'Liability' };
        if (n >= 3000 && n < 4000) return { label: '3000–3999 typically = Equity', typeName: 'Equity' };
        if (n >= 4000 && n < 5000) return { label: '4000–4999 typically = Revenue', typeName: 'Revenue' };
        if (n >= 5000 && n < 6000) return { label: '5000–5999 typically = Expense', typeName: 'Expense' };
        return null;
    };

    const selectedType = accountTypes.find(t => String(t.id) === String(newAccount.type_id));
    const codeHint = getCodeRangeHint(newAccount.code);
    const codeTypeMismatch = !!(codeHint && selectedType && codeHint.typeName !== selectedType.name);

    const renderTypeOptions = () =>
        accountTypes.map(t => <option key={t.id} value={t.id}>{t.name} (Normal: {t.normal_balance})</option>);

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
                    <form onSubmit={handleCreateAccount} className="space-y-4" noValidate>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Account Code</label>
                            <input
                                ref={codeInputRef}
                                type="text"
                                required
                                placeholder="e.g. 5060"
                                value={newAccount.code}
                                onChange={e => setNewAccount({ ...newAccount, code: e.target.value.trim() })}
                                onBlur={() => setTouched(t => ({ ...t, code: true }))}
                                aria-invalid={!!codeError}
                                className={`w-full bg-[#FBF8F8] border rounded-md p-2.5 text-sm text-gray-800 font-mono font-bold outline-none transition ${codeError ? 'border-red-300 focus:border-red-400' : 'border-[#B0DCDA] focus:border-[#1B9387]'}`}
                            />
                            {codeError ? (
                                <p className="mt-1.5 text-[11px] font-semibold text-red-500">{codeError}</p>
                            ) : codeHint ? (
                                <p className={`mt-1.5 text-[11px] font-semibold ${codeTypeMismatch ? 'text-amber-600' : 'text-gray-400'}`}>
                                    {codeTypeMismatch ? `⚠ Code suggests ${codeHint.typeName}, but ${selectedType?.name} is selected` : codeHint.label}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Account Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Marketing Expense"
                                value={newAccount.name}
                                onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                                onBlur={() => setTouched(t => ({ ...t, name: true }))}
                                aria-invalid={!!nameError}
                                className={`w-full bg-[#FBF8F8] border rounded-md p-2.5 text-sm text-gray-800 font-medium outline-none transition ${nameError ? 'border-red-300 focus:border-red-400' : 'border-[#B0DCDA] focus:border-[#1B9387]'}`}
                            />
                            {nameError && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{nameError}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Classification Type</label>
                                    {selectedType && (
                                        <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider border ${getTypeColor(selectedType.name)}`}>
                                            {selectedType.name}
                                        </span>
                                    )}
                                </div>
                                <select
                                    required
                                    value={newAccount.type_id}
                                    onChange={e => setNewAccount({ ...newAccount, type_id: e.target.value })}
                                    onBlur={() => setTouched(t => ({ ...t, type_id: true }))}
                                    aria-invalid={!!typeError}
                                    className={`w-full bg-[#FBF8F8] border rounded-md p-2.5 text-sm text-gray-800 font-medium outline-none transition cursor-pointer ${typeError ? 'border-red-300 focus:border-red-400' : 'border-[#B0DCDA] focus:border-[#1B9387]'}`}
                                >
                                    <option value="">-- Select Type --</option>
                                    {renderTypeOptions()}
                                </select>
                                {typeError && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{typeError}</p>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Normal Balance</label>
                            <div className={`w-full rounded-md p-2.5 text-sm font-extrabold uppercase tracking-wider text-center border ${selectedType ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                                {selectedType ? selectedType.normal_balance : 'Select a type first'}
                            </div>
                            <p className="mt-1.5 text-[11px] font-semibold text-gray-400">Auto-derived from the classification type.</p>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !isFormValid}
                            className="w-full bg-[#1B9387] hover:bg-[#28958B] text-white font-bold py-3 rounded-md transition mt-2 cursor-pointer shadow-sm uppercase tracking-wider text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : 'Create Account'}
                        </button>
                    </form>
                </div>

                {/* RIGHT PANE: EXISTING ACCOUNTS */}
                <div className="col-span-2 bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-lg font-extrabold text-gray-800 tracking-wide">Existing Accounts</h3>
                            <span className="text-xs font-bold text-[#1B9387] bg-[#E9FAFA] border border-[#B0DCDA] px-2 py-0.5 rounded-full">
                                {searchQuery || typeFilter ? `${filteredAccounts.length} of ${accounts.length}` : `${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value)}
                                className="bg-white border border-[#B0DCDA] rounded-md px-2.5 py-1.5 text-xs font-bold text-gray-600 focus:outline-none focus:border-[#1B9387] cursor-pointer"
                            >
                                <option value="">All Types</option>
                                {accountTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                            </select>
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search code or name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-56 bg-white border border-[#B0DCDA] rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA] sticky top-0 z-10">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 border-r border-gray-100 w-24 text-center">Code</th>
                                    <th className="p-4 border-r border-gray-100">Account Name</th>
                                    <th className="p-4 text-center border-r border-gray-100 w-32">Type</th>
                                    <th className="p-4 text-center border-r border-gray-100 w-24">Normal Bal</th>
                                    <th className="p-4 text-center w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading && accounts.length === 0 ? (
                                    <tr><td colSpan={5} className="p-12 text-center text-gray-400 italic font-medium">Loading accounts...</td></tr>
                                ) : accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center">
                                            <p className="text-gray-600 font-bold mb-1">No ledger accounts yet</p>
                                            <p className="text-gray-400 text-sm font-medium">Use the form on the left to create your first account.</p>
                                        </td>
                                    </tr>
                                ) : filteredAccounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center">
                                            <p className="text-gray-500 italic font-medium mb-2">No accounts match your search.</p>
                                            <button onClick={clearFilters} className="text-xs font-bold text-[#1B9387] hover:underline cursor-pointer">
                                                Clear search &amp; filters
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAccounts.map((a) => (
                                        <tr
                                            key={a.code}
                                            onClick={() => openEditModal(a)}
                                            className={`hover:bg-gray-50 transition-colors even:bg-gray-50/50 odd:bg-white group cursor-pointer ${highlightCode === a.code ? 'bg-[#E9FAFA]' : ''}`}
                                        >
                                            <td className="p-4 border-r border-gray-100 text-center font-mono font-extrabold text-[#1B9387]">{a.code}</td>
                                            <td className="p-4 border-r border-gray-100 font-extrabold text-gray-800">{a.name}</td>
                                            <td className="p-4 border-r border-gray-100 text-center">
                                                <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider border shadow-sm ${getTypeColor(a.account_type?.name)}`}>
                                                    {a.account_type?.name}
                                                </span>
                                            </td>
                                            <td className="p-4 border-r border-gray-100 text-center text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                                {a.account_type?.normal_balance}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(a); }}
                                                    className="p-1.5 rounded-md text-gray-400 hover:text-[#1B9387] hover:bg-[#E9FAFA] transition-colors cursor-pointer"
                                                    title="Edit account"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* EDIT ACCOUNT MODAL */}
            {editingAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-6 w-[420px]">
                        <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
                            <h3 className="text-lg font-extrabold text-gray-800">Edit Ledger Account</h3>
                            <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateAccount} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Account Code</label>
                                <input type="text" required value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value.trim() })} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-mono font-bold focus:border-[#1B9387] outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Account Name</label>
                                <input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Classification Type</label>
                                <select required value={editForm.type_id} onChange={e => setEditForm({ ...editForm, type_id: e.target.value })} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition cursor-pointer">
                                    <option value="">-- Select Type --</option>
                                    {renderTypeOptions()}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={closeEditModal} className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-sm font-bold transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={editLoading} className="px-4 py-2 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50">
                                    {editLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}