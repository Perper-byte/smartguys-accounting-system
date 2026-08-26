// src/renderer/src/components/InventoryView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export function InventoryView({ userId, role }: { userId: string, role: string }) {
    const [items, setItems] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // New Item Form
    const [showNewItem, setShowNewItem] = useState(false);
    const [newItem, setNewItem] = useState({ code: '', name: '', location: '' });

    // New Log Form
    const [logType, setLogType] = useState<'IN' | 'OUT'>('OUT');
    const [logQty, setLogQty] = useState<number | ''>('');
    const [logRemarks, setLogRemarks] = useState('');
    const [logExpiry, setLogExpiry] = useState(''); // 🔥 NEW: Expiry State

    const fetchItems = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getInventoryItems();
            setItems(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async (itemId: string) => {
        const api = (window as any).api || (window as any).electronAPI;
        const data = await api.getInventoryLogs(itemId);
        setLogs(data || []);
    };

    useEffect(() => { fetchItems(); }, []);
    useEffect(() => { if (selectedItemId) fetchLogs(selectedItemId); }, [selectedItemId]);

    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const api = (window as any).api || (window as any).electronAPI;
        const res = await api.createInventoryItem(newItem);
        if (res.success) {
            setStatusMessage({ type: 'success', msg: 'Product added successfully!' });
            setNewItem({ code: '', name: '', location: '' });
            setShowNewItem(false);
            fetchItems();
        } else {
            setStatusMessage({ type: 'error', msg: res.error });
        }
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemId || !logQty) return;
        
        const inQty = logType === 'IN' ? Number(logQty) : 0;
        const outQty = logType === 'OUT' ? Number(logQty) : 0;

        const api = (window as any).api || (window as any).electronAPI;
        const res = await api.addInventoryLog({ 
            itemId: selectedItemId, 
            userId, 
            inQty, 
            outQty, 
            remarks: logRemarks,
            expiryDate: (logType === 'IN' && logExpiry) ? logExpiry : undefined // 🔥 Send expiry date if it's an IN delivery
        });
        
        if (res.success) {
            setLogQty(''); setLogRemarks(''); setLogExpiry('');
            fetchLogs(selectedItemId);
            fetchItems();
        } else {
            alert(res.error);
        }
    };

    const selectedItem = items.find(i => i.id === selectedItemId);
    const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.code.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col text-gray-800 font-sans">
            <div className="flex justify-between items-end mb-6 border-b border-[#B0DCDA] pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">Stock & Inventory</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Track clinic supplies, medicine logs, and stock balances.</p>
                </div>
            </div>

            {statusMessage && (
                <div className={`mb-6 p-4 rounded-md text-sm font-bold shadow-sm border ${statusMessage.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-500 border-red-200'}`}>
                    {statusMessage.type === 'success' ? '✅ ' : '⚠️ '}{statusMessage.msg}
                </div>
            )}

            <div className="flex-1 flex gap-8 min-h-0">
                {/* LEFT PANE: MASTER LIST */}
                <div className="w-1/3 bg-white border border-[#B0DCDA] rounded-xl shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 bg-[#FBF8F8] border-b border-[#B0DCDA] space-y-3">
                        <input type="text" placeholder="🔍 Search product or code..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white border border-[#B0DCDA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] transition" />
                        <button onClick={() => setShowNewItem(!showNewItem)} className="w-full bg-white border border-[#B0DCDA] text-[#1B9387] hover:bg-[#E9FAFA] px-3 py-2 rounded-md text-xs font-extrabold tracking-wider uppercase transition shadow-sm cursor-pointer">
                            {showNewItem ? 'Cancel' : '+ New Product'}
                        </button>
                    </div>

                    {showNewItem && (
                        <form onSubmit={handleCreateItem} className="p-4 bg-[#E9FAFA] border-b border-[#B0DCDA] shadow-inner space-y-3">
                            <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Item Code</label><input required value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} placeholder="e.g. MED-001" className="w-full bg-white border border-[#B0DCDA] rounded p-2 text-sm outline-none focus:border-[#1B9387]" /></div>
                            <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Product Name</label><input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. Biogesic 500mg" className="w-full bg-white border border-[#B0DCDA] rounded p-2 text-sm outline-none focus:border-[#1B9387]" /></div>
                            <div><label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Location (Optional)</label><input value={newItem.location} onChange={e => setNewItem({...newItem, location: e.target.value})} placeholder="e.g. Cabinet A" className="w-full bg-white border border-[#B0DCDA] rounded p-2 text-sm outline-none focus:border-[#1B9387]" /></div>
                            <button className="w-full bg-[#1B9387] hover:bg-[#28958B] text-white text-xs font-bold py-2 rounded shadow-sm cursor-pointer transition">Save Product</button>
                        </form>
                    )}

                    <div className="flex-1 overflow-auto divide-y divide-gray-100">
                        {loading ? <div className="p-8 text-center text-[#1B9387] font-bold">Loading...</div> : filteredItems.map(item => (
                            <div key={item.id} onClick={() => setSelectedItemId(item.id)} className={`p-4 cursor-pointer transition ${selectedItemId === item.id ? 'bg-[#E9FAFA] border-l-4 border-[#1B9387]' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>
                                <div className="flex justify-between items-start">
                                    <span className="font-extrabold text-gray-800 text-sm truncate pr-2">{item.name}</span>
                                    <span className={`font-mono font-extrabold text-sm ${item.stock <= 5 ? 'text-red-500' : 'text-[#1B9387]'}`}>{item.stock}</span>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-gray-400 font-mono font-bold">{item.code}</span>
                                    <span className="text-[10px] text-gray-400 uppercase font-bold">{item.location || 'No Loc'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT PANE: DIGITAL LOGBOOK */}
                <div className="w-2/3 bg-white border border-[#B0DCDA] rounded-xl shadow-sm flex flex-col overflow-hidden relative">
                    {!selectedItem ? (
                        <div className="flex-1 flex flex-col justify-center items-center text-center p-12 bg-[#FBF8F8]">
                            <div className="text-5xl mb-4">📋</div>
                            <p className="text-gray-800 font-extrabold text-xl">Select a product to view logbook</p>
                            <p className="text-gray-500 font-medium text-sm mt-2 max-w-md">Click any item on the left to record incoming deliveries or outgoing usage.</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-6 bg-white border-b-2 border-gray-800 flex justify-between items-start shrink-0">
                                <div>
                                    <div className="flex items-center space-x-4 mb-2">
                                        <h3 className="text-2xl font-extrabold text-gray-800 tracking-tight">{selectedItem.name}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-black font-mono shadow-sm border ${selectedItem.stock <= 5 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]'}`}>
                                            STOCK: {selectedItem.stock}
                                        </span>
                                    </div>
                                    <div className="flex space-x-8 mt-4 text-sm font-bold text-gray-600 uppercase tracking-wider">
                                        <p>PRODUCT CODE: <span className="font-mono text-gray-800 ml-2">{selectedItem.code}</span></p>
                                        <p>LOCATION: <span className="text-gray-800 ml-2">{selectedItem.location || '—'}</span></p>
                                    </div>
                                </div>
                            </div>

                            {/* ADD ACTIVITY FORM */}
                            <form onSubmit={handleAddLog} className="p-4 bg-[#FBF8F8] border-b border-[#B0DCDA] flex flex-col gap-3 shadow-inner shrink-0">
                                {/* 🔥 DYNAMIC GRID: Expands if "IN" is selected to show Expiry Date */}
                                <div className={`grid gap-3 ${logType === 'IN' ? 'grid-cols-[140px_100px_140px_1fr_auto]' : 'grid-cols-[140px_100px_1fr_auto]'}`}>
                                    <select value={logType} onChange={e => setLogType(e.target.value as any)} className={`font-extrabold text-xs uppercase tracking-wider border rounded-md px-3 py-2 outline-none cursor-pointer ${logType === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                                        <option value="IN">📥 IN (Delivery)</option>
                                        <option value="OUT">📤 OUT (Usage)</option>
                                    </select>
                                    
                                    <input type="number" min="1" required placeholder="Qty" value={logQty} onChange={e => setLogQty(Number(e.target.value))} className="w-full bg-white border border-[#B0DCDA] rounded-md px-3 py-2 text-sm font-mono font-bold outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#E9FAFA]" />
                                    
                                    {/* 🔥 NEW: Expiry Date Field (Only visible when receiving IN) */}
                                    {logType === 'IN' && (
                                        <input 
                                            type="date" 
                                            title="Expiration Date"
                                            value={logExpiry} 
                                            onChange={e => setLogExpiry(e.target.value)} 
                                            className="w-full bg-white border border-[#B0DCDA] rounded-md px-3 py-2 text-xs text-gray-600 font-bold outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#E9FAFA]" 
                                        />
                                    )}

                                    <input type="text" placeholder="Remarks / Ref No..." value={logRemarks} onChange={e => setLogRemarks(e.target.value)} className="w-full bg-white border border-[#B0DCDA] rounded-md px-3 py-2 text-sm font-medium outline-none focus:border-[#1B9387] focus:ring-1 focus:ring-[#E9FAFA]" />
                                    <button className="bg-[#1B9387] hover:bg-[#28958B] text-white px-5 py-2 rounded-md text-sm font-bold shadow-sm uppercase tracking-wider transition cursor-pointer">Save</button>
                                </div>
                            </form>

                            {/* THE LOGBOOK TABLE */}
                            <div className="flex-1 overflow-auto bg-white">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#FBF8F8] sticky top-0 border-b border-[#B0DCDA] shadow-sm">
                                        <tr className="text-gray-500 uppercase tracking-wider text-[10px] font-extrabold">
                                            <th className="p-3 border-r border-gray-100 pl-6 w-32">Date</th>
                                            <th className="p-3 border-r border-gray-100 text-center text-emerald-600 w-16">IN</th>
                                            <th className="p-3 border-r border-gray-100 text-center text-orange-500 w-16">OUT</th>
                                            <th className="p-3 border-r border-gray-100 text-center text-[#1B9387] w-24">Balance</th>
                                            <th className="p-3 border-r border-gray-100 w-28">Exp Date</th> {/* 🔥 NEW HEADER */}
                                            <th className="p-3 border-r border-gray-100">Remarks</th>
                                            <th className="p-3 text-center w-32 pr-6">Counted By</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {logs.length === 0 ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic font-medium">No movement recorded yet.</td></tr>
                                        ) : (
                                            logs.map((log: any) => (
                                                <tr key={log.id} className="hover:bg-gray-50 transition-colors even:bg-gray-50/50 odd:bg-white">
                                                    <td className="p-3 pl-6 font-mono text-xs text-gray-500 border-r border-gray-100">{new Date(log.date).toLocaleDateString()}</td>
                                                    <td className="p-3 text-center font-mono font-bold text-emerald-600 bg-emerald-50/30 border-r border-gray-100">{log.in_qty > 0 ? `+${log.in_qty}` : '-'}</td>
                                                    <td className="p-3 text-center font-mono font-bold text-orange-500 bg-orange-50/30 border-r border-gray-100">{log.out_qty > 0 ? `-${log.out_qty}` : '-'}</td>
                                                    <td className="p-3 text-center font-mono font-black text-[#1B9387] bg-[#E9FAFA]/50 border-r border-gray-100">{log.balance}</td>
                                                    
                                                    {/* 🔥 NEW CELL: Render expiration date if it exists */}
                                                    <td className="p-3 border-r border-gray-100 text-xs font-mono font-bold text-rose-500">
                                                        {log.expiry_date ? new Date(log.expiry_date).toLocaleDateString() : '—'}
                                                    </td>
                                                    
                                                    <td className="p-3 text-gray-700 text-xs border-r border-gray-100 font-medium truncate max-w-[150px]" title={log.remarks}>{log.remarks || '—'}</td>
                                                    <td className="p-3 pr-6 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">{log.user?.username || 'SYSTEM'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}