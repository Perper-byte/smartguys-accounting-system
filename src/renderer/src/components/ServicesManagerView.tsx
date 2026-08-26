import * as React from 'react';
import { useState, useEffect } from 'react';

export function ServicesManagerView() {
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // New Service State
    const [newItem, setNewItem] = useState({ category: 'Blood Chemistry', name: '', price: '' });
    
    // Edit State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editPrice, setEditPrice] = useState<string>('');

    const CATEGORIES = [
        'Blood Chemistry', 'Enzymes', 'Electrolytes', 'Chemistry Packages', 
        'Hematology', 'Clinical Microscopy', '24 Hour Urine Test', 'Serology', 
        'Thyroid Function', 'Hepatitis', 'Hormones', 'Tumor Markers', 
        'Bacteriology', 'Histopathology', 'Others'
    ];

    const fetchServices = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getAllServiceItems();
            setServices(data || []);
        } catch (error) {
            console.error("Failed to fetch services", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchServices(); }, []);

    const handleCreateService = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage(null);
        if (!newItem.name || !newItem.price) return;

        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.createServiceItem({ ...newItem, price: Number(newItem.price) });

            if (result.success) {
                setStatusMessage({ type: 'success', msg: `${newItem.name} added successfully!` });
                setNewItem({ ...newItem, name: '', price: '' });
                fetchServices();
                setTimeout(() => setStatusMessage(null), 3000);
            } else {
                setStatusMessage({ type: 'error', msg: result.error || "Failed to create service." });
            }
        } catch (error) {
            setStatusMessage({ type: 'error', msg: "System Error." });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async (id: number) => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const result = await api.updateServiceItem(id, { price: Number(editPrice) });
            
            if (result.success) {
                setStatusMessage({ type: 'success', msg: `Price updated successfully!` });
                setEditingId(null);
                fetchServices();
                setTimeout(() => setStatusMessage(null), 3000);
            } else {
                setStatusMessage({ type: 'error', msg: "Failed to update price." });
            }
        } catch (error) {
            setStatusMessage({ type: 'error', msg: "System Error." });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (id: number, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        if (!window.confirm(`Are you sure you want to ${newStatus ? 'reactivate' : 'archive'} this procedure?`)) return;

        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            await api.updateServiceItem(id, { is_active: newStatus });
            fetchServices();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.category.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col text-gray-800 font-sans">
            <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Services & Pricing Manager</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Manage clinic procedures, laboratory tests, and their fixed prices.</p>
                </div>
            </div>

            {statusMessage && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border ${statusMessage.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {statusMessage.type === 'success' ? '✅ ' : '⚠️ '}{statusMessage.msg}
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
                {/* LEFT PANE: ADD NEW */}
                <div className="col-span-1 bg-white border border-[#B0DCDA] rounded-xl p-6 shadow-sm h-fit">
                    <h3 className="text-lg font-extrabold text-gray-800 mb-5 border-b border-gray-100 pb-3">Add New Procedure</h3>
                    <form onSubmit={handleCreateService} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                            <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none cursor-pointer">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Procedure Name</label>
                            <input type="text" required placeholder="e.g. Ultrasound" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Fixed Price (₱)</label>
                            <input type="number" step="0.01" required placeholder="0.00" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-[#FBF8F8] border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-mono font-bold focus:border-[#1B9387] outline-none" />
                        </div>
                        <button type="submit" disabled={loading || !newItem.name || !newItem.price} className="w-full bg-[#1B9387] hover:bg-[#28958B] text-white font-bold py-3 rounded-md transition mt-6 cursor-pointer shadow-sm uppercase tracking-wider text-sm disabled:opacity-50">
                            {loading ? 'Saving...' : 'Save Procedure'}
                        </button>
                    </form>
                </div>

                {/* RIGHT PANE: LIST */}
                <div className="col-span-2 bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-[#B0DCDA] bg-[#FBF8F8] flex justify-between items-center">
                        <h3 className="text-lg font-extrabold text-gray-800 tracking-wide">Master Price List</h3>
                        <input type="text" placeholder="🔍 Search procedures..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64 bg-white border border-[#B0DCDA] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#1B9387] text-gray-800 shadow-sm" />
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#FBF8F8] border-b border-[#B0DCDA] sticky top-0 z-10">
                                <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                    <th className="p-4 border-r border-gray-100">Category</th>
                                    <th className="p-4 border-r border-gray-100">Procedure Name</th>
                                    <th className="p-4 border-r border-gray-100 text-right">Price</th>
                                    <th className="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredServices.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-gray-500 italic font-medium">No procedures found.</td></tr>
                                ) : (
                                    filteredServices.map((s) => (
                                        <tr key={s.id} className={`transition-colors ${s.is_active ? 'hover:bg-gray-50 even:bg-gray-50/50' : 'bg-gray-100 opacity-60'}`}>
                                            <td className="p-4 border-r border-gray-100 text-xs font-bold text-gray-500 uppercase">{s.category}</td>
                                            <td className="p-4 border-r border-gray-100 font-extrabold text-gray-800">{s.name}</td>
                                            <td className="p-4 border-r border-gray-100 text-right">
                                                {editingId === s.id ? (
                                                    <input type="number" step="0.01" autoFocus value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-24 border border-[#1B9387] rounded px-2 py-1 text-right font-mono font-bold text-gray-800 outline-none shadow-sm" />
                                                ) : (
                                                    <span className="font-mono font-bold text-[#1B9387]">{formatCurrency(s.price)}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center space-x-2">
                                                {editingId === s.id ? (
                                                    <>
                                                        <button onClick={() => handleSaveEdit(s.id)} className="text-[10px] font-extrabold uppercase px-3 py-1.5 rounded-md transition shadow-sm bg-[#1B9387] text-white hover:bg-[#28958B] cursor-pointer">Save</button>
                                                        <button onClick={() => setEditingId(null)} className="text-[10px] font-extrabold uppercase px-3 py-1.5 rounded-md transition shadow-sm bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-pointer">Cancel</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => { setEditingId(s.id); setEditPrice(s.price.toString()); }} disabled={!s.is_active} className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-md transition cursor-pointer shadow-sm bg-white border border-gray-300 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed">Edit Price</button>
                                                        <button onClick={() => handleToggleStatus(s.id, s.is_active)} className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-md transition cursor-pointer shadow-sm border ${s.is_active ? 'bg-white border-gray-300 text-red-600 hover:bg-red-50' : 'bg-[#1B9387] border-transparent text-white hover:bg-[#28958B]'}`}>{s.is_active ? 'Archive' : 'Restore'}</button>
                                                    </>
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
        </div>
    );
}