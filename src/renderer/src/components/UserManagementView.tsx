import * as React from 'react';
import { useState, useEffect } from 'react';

const MODULES = [
    { id: 'billing', label: 'Patient Billing (POS)' },
    { id: 'collections', label: 'Receive Payments' },
    { id: 'directory', label: 'Contact Directory' },
    { id: 'disbursement', label: 'Cash Disbursements' },
    { id: 'payouts', label: 'Doctor Payouts' },
    { id: 'aging', label: 'Aged Receivables (HMO)' },
    { id: 'tracker', label: 'Invoice Tracker' },
    { id: 'history', label: 'My Sales History' },
    { id: 'payroll', label: 'HR & Payroll' },
    { id: 'journal', label: 'Journal Entry' },
    { id: 'adjusting', label: 'Adjusting Entries' },
    { id: 'ledger', label: 'General Ledger' },
    { id: 'reconciliation', label: 'Bank Reconciliation' },
    { id: 'books', label: 'Books of Accounts' },
    { id: 'analytics', label: 'Analytics Dashboard' },
    { id: 'statements', label: 'Financial Statements' },
    { id: 'bir', label: 'BIR Tax Compliance' },
    { id: 'voids', label: 'Void Approvals' },
    { id: 'audit', label: 'Audit Trails' },
    { id: 'users', label: 'User Management' },
    { id: 'backup', label: 'Database Backup' },
    { id: 'coa', label: 'Chart of Accounts' },
    { id: 'inventory', label: 'Stock & Inventory' },
    { id: 'services', label: 'Services & Pricing' }
];

export default function UserManagementView() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'CASHIER', isActive: true });

    // Modal States
    const [userToToggle, setUserToToggle] = useState<{ id: string, username: string, isActive: boolean } | null>(null);
    const [userToReset, setUserToReset] = useState<{ id: string, username: string } | null>(null);
    const [newPassword, setNewPassword] = useState('');
    
    // 🔥 Permissions Modal State
    const [userToEditPerms, setUserToEditPerms] = useState<{ id: string, username: string, perms: string[] } | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getUsers();
            setUsers(data || []);
        } catch (error) { console.error("Failed to fetch users", error); } 
        finally { setLoading(false); }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage(null);
        if (!newUser.username || !newUser.password) return;

        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.createUser(newUser);

            if (result.success) {
                setStatusMessage({ type: 'success', msg: `User ${newUser.username} created successfully!` });
                setNewUser({ username: '', password: '', role: 'CASHIER', isActive: true });
                fetchUsers();
                setTimeout(() => setStatusMessage(null), 3000);
            } else {
                setStatusMessage({ type: 'error', msg: result.error || "Failed to create user." });
            }
        } catch (error) { setStatusMessage({ type: 'error', msg: "System Error." }); } 
        finally { setLoading(false); }
    };

    const confirmToggleStatus = async () => {
        if (!userToToggle) return;
        setStatusMessage(null);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const newStatus = !userToToggle.isActive;
            const result = await api.toggleUserStatus(userToToggle.id, newStatus);
            if (result.success) {
                setStatusMessage({ type: 'success', msg: `User ${userToToggle.username} is now ${newStatus ? 'Active' : 'Disabled'}.` });
                fetchUsers();
            } else setStatusMessage({ type: 'error', msg: "Failed to update status." });
        } catch (error) { setStatusMessage({ type: 'error', msg: "System Error." }); } 
        finally { setUserToToggle(null); }
    };

    const confirmResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userToReset || !newPassword) return;
        setStatusMessage(null);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.resetUserPassword(userToReset.id, newPassword);
            if (result.success) {
                setStatusMessage({ type: 'success', msg: `Password reset successfully for ${userToReset.username}.` });
                setNewPassword('');
            } else setStatusMessage({ type: 'error', msg: "Failed to reset password." });
        } catch (error) { setStatusMessage({ type: 'error', msg: "System Error." }); } 
        finally { setUserToReset(null); }
    };

    // 🔥 SAVE CUSTOM PERMISSIONS
    const handleSavePermissions = async () => {
        if (!userToEditPerms) return;
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.updateUserPermissions(userToEditPerms.id, userToEditPerms.perms);
            if (result.success) {
                setStatusMessage({ type: 'success', msg: `Custom permissions saved for ${userToEditPerms.username}!` });
                fetchUsers();
            } else {
                setStatusMessage({ type: 'error', msg: "Failed to save permissions." });
            }
        } catch (error) {
            setStatusMessage({ type: 'error', msg: "System Error." });
        } finally {
            setLoading(false);
            setUserToEditPerms(null);
        }
    };

    const togglePermission = (moduleId: string) => {
        if (!userToEditPerms) return;
        const current = userToEditPerms.perms;
        if (current.includes(moduleId)) {
            setUserToEditPerms({ ...userToEditPerms, perms: current.filter(id => id !== moduleId) });
        } else {
            setUserToEditPerms({ ...userToEditPerms, perms: [...current, moduleId] });
        }
    };

    const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

    const getRoleBadge = (role: string) => {
        switch(role) {
            case 'MANAGER': return 'bg-amber-50 text-amber-600 border-amber-200';
            case 'ACCOUNTANT': return 'bg-purple-50 text-purple-600 border-purple-200';
            case 'CASHIER': return 'bg-blue-50 text-blue-600 border-blue-200';
            case 'IT_PERSONNEL': return 'bg-rose-50 text-rose-600 border-rose-200';
            default: return 'bg-gray-50 text-gray-600 border-gray-200';
        }
    };

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col text-gray-800 font-sans">
            <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">System Settings / User Management</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Create and manage access credentials and fine-grained permissions.</p>
                </div>
            </div>

            {statusMessage && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border ${statusMessage.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {statusMessage.type === 'success' ? '✅ ' : '⚠️ '}{statusMessage.msg}
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
                
                {/* LEFT PANE: CREATE USER FORM */}
                <div className="col-span-1 bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm h-fit">
                    <h3 className="text-lg font-extrabold text-gray-800 mb-5 border-b border-gray-100 pb-3">Create New Account</h3>
                    
                    <form onSubmit={handleCreateUser} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Username</label>
                            <input type="text" required placeholder="e.g. juan_cashier" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase().replace(/\s/g, '')})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Temporary Password</label>
                            <input type="text" required placeholder="Set initial password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Default System Role</label>
                            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition cursor-pointer">
                                <option value="CASHIER">Cashier (Billing & POS)</option>
                                <option value="ACCOUNTANT">Accountant (Ledger & Reports)</option>
                                <option value="MANAGER">Manager (Analytics & Approvals)</option>
                                <option value="IT_PERSONNEL">IT / Admin (Settings & Backup)</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center mt-2 pt-2">
                            <input type="checkbox" id="isActive" checked={newUser.isActive} onChange={e => setNewUser({...newUser, isActive: e.target.checked})} className="w-4 h-4 text-[#1B9387] bg-white border-[#B0DCDA] rounded cursor-pointer focus:ring-[#1B9387]" />
                            <label htmlFor="isActive" className="ml-3 text-sm font-bold text-gray-700 cursor-pointer">Account is Active</label>
                        </div>

                        <button type="submit" disabled={loading || !newUser.username || !newUser.password} className="w-full bg-[#1B9387] hover:bg-[#28958B] text-white font-bold py-3 rounded-md transition mt-6 cursor-pointer shadow-sm uppercase tracking-wider text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? 'Processing...' : 'Create Account'}
                        </button>
                    </form>
                </div>

                {/* RIGHT PANE: USER LIST */}
                <div className="col-span-2 bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] flex justify-between items-center">
                        <h3 className="text-lg font-extrabold text-gray-800 tracking-wide">System Users</h3>
                        <input type="text" placeholder="🔍 Search username..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64 bg-white border border-[#B0DCDA] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 transition-colors shadow-sm" />
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA] sticky top-0 z-10">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 border-r border-gray-100">Username</th>
                                    <th className="p-4 border-r border-gray-100">Role</th>
                                    <th className="p-4 text-center border-r border-gray-100">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredUsers.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-gray-500 italic font-medium">No users found.</td></tr>
                                ) : (
                                    filteredUsers.map((u) => {
                                        const isActive = u.is_active !== false && u.isActive !== false;
                                        const hasCustomPerms = u.permissions && u.permissions.length > 0;

                                        return (
                                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4 border-r border-gray-100">
                                                    <span className="font-extrabold text-gray-800 text-base">{u.username}</span>
                                                    {hasCustomPerms && <span className="ml-2 bg-indigo-50 border border-indigo-200 text-indigo-600 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">Custom</span>}
                                                </td>
                                                <td className="p-4 border-r border-gray-100">
                                                    <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider border shadow-sm ${getRoleBadge(u.role)}`}>
                                                        {u.role.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center border-r border-gray-100">
                                                    {isActive ? <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Active</span> : <span className="px-2.5 py-1 bg-gray-100 border border-gray-300 text-gray-500 text-[10px] font-extrabold rounded-md uppercase tracking-wider shadow-sm">Disabled</span>}
                                                </td>
                                                <td className="p-4 text-right space-x-2">
                                                    {/* 🔥 NEW CUSTOM ACCESS BUTTON */}
                                                    <button 
                                                        onClick={() => setUserToEditPerms({ id: u.id, username: u.username, perms: u.permissions || [] })}
                                                        className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-md transition cursor-pointer shadow-sm bg-white border border-gray-300 text-[#1B9387] hover:bg-[#E9FAFA]"
                                                    >
                                                        Access
                                                    </button>
                                                    <button 
                                                        onClick={() => setUserToReset({ id: u.id, username: u.username })}
                                                        className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-md transition cursor-pointer shadow-sm bg-white border border-gray-300 text-blue-600 hover:bg-blue-50"
                                                    >
                                                        Reset Pass
                                                    </button>
                                                    <button 
                                                        onClick={() => setUserToToggle({ id: u.id, username: u.username, isActive })}
                                                        className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-md transition cursor-pointer shadow-sm border ${isActive ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-teal-600 border-teal-600 text-white hover:bg-teal-700'}`}
                                                    >
                                                        {isActive ? 'Disable' : 'Enable'}
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
            </div>

            {/* 🔥 NEW: CUSTOM PERMISSIONS MODAL */}
            {userToEditPerms && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="border-b border-gray-100 pb-4 mb-4 shrink-0">
                            <h3 className="text-xl font-extrabold text-gray-800 uppercase tracking-wide">
                                Custom Access: {userToEditPerms.username}
                            </h3>
                            <p className="text-sm text-gray-500 font-medium mt-1">
                                Check boxes to explicitly grant access. If you leave all boxes unchecked, the user will revert to their default Role permissions.
                            </p>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                {MODULES.map(mod => (
                                    <div key={mod.id} className="flex items-center p-3 bg-[#FBF8F8] border border-gray-200 rounded-lg hover:border-[#1B9387] transition cursor-pointer" onClick={() => togglePermission(mod.id)}>
                                        <input 
                                            type="checkbox" 
                                            checked={userToEditPerms.perms.includes(mod.id)} 
                                            readOnly
                                            className="w-5 h-5 text-[#1B9387] bg-white border-gray-300 rounded cursor-pointer" 
                                        />
                                        <span className="ml-3 text-sm font-bold text-gray-700 select-none">{mod.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-4 shrink-0">
                            <button onClick={() => setUserToEditPerms(null)} className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={handleSavePermissions} disabled={loading} className="px-5 py-2.5 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm disabled:opacity-50">
                                {loading ? 'Saving...' : 'Save Permissions'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: TOGGLE STATUS */}
            {userToToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-8 w-[420px] animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-extrabold text-gray-800 mb-2 uppercase tracking-wide">{userToToggle.isActive ? 'Disable Account?' : 'Enable Account?'}</h3>
                        <p className="text-sm text-gray-600 mb-8 font-medium leading-relaxed">{userToToggle.isActive ? <>Are you sure you want to disable <strong className="text-gray-800">{userToToggle.username}</strong>? They will be instantly logged out and prevented from signing in.</> : <>Are you sure you want to re-enable <strong className="text-gray-800">{userToToggle.username}</strong>? They will be allowed to log into the system again.</>}</p>
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button onClick={() => setUserToToggle(null)} className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer">Cancel</button>
                            <button onClick={confirmToggleStatus} className={`px-5 py-2.5 text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm ${userToToggle.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1B9387] hover:bg-[#28958B]'}`}>{userToToggle.isActive ? 'Disable User' : 'Enable User'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: RESET PASSWORD */}
            {userToReset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl p-8 w-[420px] animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-extrabold text-gray-800 mb-2 uppercase tracking-wide">Reset Password</h3>
                        <p className="text-sm text-gray-600 mb-6 font-medium">Set a new temporary password for <strong className="text-gray-800">{userToReset.username}</strong>.</p>
                        <form onSubmit={confirmResetPassword}>
                            <div className="mb-8">
                                <label className="block text-[10px] font-extrabold text-[#1B9387] uppercase tracking-wider mb-2">New Password</label>
                                <input type="text" autoFocus required placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none transition shadow-inner" />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setUserToReset(null)} className="px-5 py-2.5 bg-[#FBF8F8] border border-[#B0DCDA] hover:bg-gray-100 text-gray-600 rounded-md text-sm font-bold transition cursor-pointer">Cancel</button>
                                <button type="submit" disabled={!newPassword} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-md text-sm font-bold transition cursor-pointer shadow-sm">Update Password</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}