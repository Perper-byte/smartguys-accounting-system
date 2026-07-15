import React, { useState, useEffect } from 'react';

export default function UserManagementView() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'CASHIER',
    is_active: true, 
  });

  // Main table states
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // ---> NEW: State for the Password Reset Modal
  const [resetModal, setResetModal] = useState({ isOpen: false, userId: '', username: '' });
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadUsers = async () => {
    try {
      const data = await (window as any).api.getUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await (window as any).api.createUser(formData);
      if (response.success) {
        alert('User created successfully!');
        setFormData({ username: '', password: '', role: 'CASHIER', is_active: true });
        loadUsers(); 
      } else {
        alert('Failed to create user: ' + response.error);
      }
    } catch (error) {
      console.error(error);
      alert('An unexpected error occurred.');
    }
  };

  // ==========================================
  // ---> BUTTON HANDLER FUNCTIONS <---
  // ==========================================
  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await (window as any).api.toggleUserStatus(userId, !currentStatus);
      if (response.success) {
        loadUsers(); 
      } else {
        alert('Failed to update status: ' + response.error);
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred while updating the status.');
    }
  };

  // 1. Opens the Modal instead of using window.prompt
  const openResetModal = (userId: string, username: string) => {
    setResetModal({ isOpen: true, userId, username });
    setNewPasswordInput(''); // Clear previous input
  };

  // 2. Submits the custom password to the backend
  const confirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordInput.trim()) return;

    try {
      const response = await (window as any).api.resetUserPassword(resetModal.userId, newPasswordInput);
      if (response.success) {
        alert(`Success! Password for ${resetModal.username} has been changed.`);
        setResetModal({ isOpen: false, userId: '', username: '' }); // Close modal
      } else {
        alert('Failed to reset password: ' + response.error);
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred while resetting the password.');
    }
  };
  // ==========================================

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'CASHIER': return "bg-blue-900/50 text-blue-400 border-blue-800";
      case 'ACCOUNTANT': return "bg-purple-900/50 text-purple-400 border-purple-800";
      case 'MANAGER': return "bg-yellow-900/50 text-yellow-400 border-yellow-800";
      case 'IT_PERSONNEL': return "bg-red-900/50 text-red-400 border-red-800";
      default: return "bg-gray-800 text-gray-400 border-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-[#121214] text-gray-200 font-sans relative">
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">System Settings / User Management</h1>
        <p className="text-sm text-gray-400">Create and manage access for clinic staff.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- LEFT COLUMN: Create User Form --- */}
        <div className="bg-[#202024] rounded-xl p-6 border border-[#29292e] shadow-lg col-span-1 h-fit">
          <h2 className="text-lg font-semibold text-white mb-4 border-b border-[#29292e] pb-2">Create New Account</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
              <input type="text" required
                className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#4f46e5] text-white"
                value={formData.username} 
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                placeholder="e.g., juan_cashier"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Temporary Password</label>
              <input type="password" required
                className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#4f46e5] text-white"
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">System Role</label>
              <select 
                className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#4f46e5] text-white"
                value={formData.role} 
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="CASHIER">Cashier (Billing & POS)</option>
                <option value="ACCOUNTANT">Accountant (Ledger & Taxes)</option>
                <option value="MANAGER">Manager (Analytics & Approvals)</option>
                <option value="IT_PERSONNEL">IT Personnel (System Settings)</option>
              </select>
            </div>

            <div className="flex items-center mt-2">
              <input 
                type="checkbox" 
                id="isActive" 
                className="w-4 h-4 text-[#4f46e5] bg-[#121214] border-[#29292e] rounded focus:ring-[#4f46e5]"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              />
              <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-300">
                Account is Active (Can log in)
              </label>
            </div>

            <button type="submit" 
              className="w-full mt-4 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold py-2 rounded transition-colors text-sm">
              Create Account
            </button>
          </form>
        </div>

        {/* --- RIGHT COLUMN: Active Users Table --- */}
        <div className="bg-[#202024] rounded-xl p-6 border border-[#29292e] shadow-lg col-span-1 lg:col-span-2">
          
          <div className="flex justify-between items-center mb-4 border-b border-[#29292e] pb-2">
            <h2 className="text-lg font-semibold text-white">System Users</h2>
            <input 
              type="text" 
              placeholder="Search username..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#121214] border border-[#29292e] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] text-white placeholder-gray-500 w-48 transition-all"
            />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-[#29292e]">
                  <th className="pb-2 font-medium">Username</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#29292e]">
                
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      {searchQuery ? `No users found matching "${searchQuery}"` : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-[#2a2a2f] transition-colors">
                      <td className={`py-3 font-medium ${!user.is_active ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {user.username}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs border ${getRoleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3">
                        {user.is_active ? (
                          <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs border border-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs border border-red-800">
                            Disabled
                          </span>
                        )}
                      </td>
                      
                      <td className="py-3 text-right">
                        <button 
                            type="button"
                            onClick={() => openResetModal(user.id, user.username)}
                            className="cursor-pointer px-2 py-1 mr-2 bg-blue-900/30 text-blue-400 border border-blue-800 rounded text-xs font-medium hover:bg-blue-900/60 transition-colors z-10 relative"
                        >
                            Reset Pass
                        </button>
                        
                        {user.is_active ? (
                            <button 
                            type="button"
                            onClick={() => handleToggleStatus(user.id, user.is_active)}
                            className="cursor-pointer px-2 py-1 bg-red-900/30 text-red-400 border border-red-800 rounded text-xs font-medium hover:bg-red-900/60 transition-colors z-10 relative"
                            >
                            Disable
                            </button>
                        ) : (
                            <button 
                            type="button"
                            onClick={() => handleToggleStatus(user.id, user.is_active)}
                            className="cursor-pointer px-2 py-1 bg-green-900/30 text-green-400 border border-green-800 rounded text-xs font-medium hover:bg-green-900/60 transition-colors z-10 relative"
                            >
                            Enable
                            </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}

              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ========================================== */}
      {/* ---> CUSTOM PASSWORD RESET MODAL <--- */}
      {/* ========================================== */}
      {resetModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#202024] border border-[#29292e] rounded-lg shadow-2xl p-6 w-96">
            <h3 className="text-lg font-bold text-white mb-1">Reset Password</h3>
            <p className="text-sm text-gray-400 mb-4">
              Enter a new password for <span className="text-[#4f46e5] font-semibold">{resetModal.username}</span>
            </p>

            <form onSubmit={confirmPasswordReset}>
              <input 
                type="text" 
                required
                autoFocus
                placeholder="New Password" 
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                className="w-full bg-[#121214] border border-[#29292e] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] text-white mb-6"
              />
              
              <div className="flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={() => setResetModal({ isOpen: false, userId: '', username: '' })}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded text-sm font-medium transition-colors shadow-lg"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================== */}

    </div>
  );
}