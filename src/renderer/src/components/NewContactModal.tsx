// src/renderer/src/components/NewContactModal.tsx
import * as React from 'react';
import { useState } from 'react';

interface NewContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveSuccess: (newId: string, newName: string) => void;
    defaultType?: string; // Lets the POS force it to "PATIENT" or "HMO"
}

export function NewContactModal({ isOpen, onClose, onSaveSuccess, defaultType = 'PATIENT' }: NewContactModalProps) {
    const [formData, setFormData] = useState({
        name: '', type: defaultType, tin: '', email: '', phone: '', address: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSaveContact = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            await api.createPayee(formData.name, formData.type, formData.tin, formData.email, formData.phone, formData.address);
            
            // Fetch updated list to get the new ID
            const updatedPayees = await api.getPayees();
            const newRecord = updatedPayees.find((p: any) => p.name.toLowerCase() === formData.name.toLowerCase());
            
            if (newRecord) {
                onSaveSuccess(newRecord.id, newRecord.name); 
            }
            
            // Clean up
            setFormData({ name: '', type: defaultType, tin: '', email: '', phone: '', address: '' });
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to save contact.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
            <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-2xl w-[700px] overflow-hidden text-gray-800 font-sans">
                
                {/* Header */}
                <div className="flex justify-between items-center px-8 py-5 border-b border-[#B0DCDA]">
                    <h2 className="text-xl font-bold text-gray-800 tracking-wide">New Contact</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-red-500 cursor-pointer font-bold text-2xl leading-none transition-colors">
                        ×
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-8 border-b border-[#B0DCDA] text-xs font-bold text-gray-500 uppercase tracking-widest bg-[#FBF8F8]">
                    <div className="py-4 text-[#4f46e5] border-b-2 border-[#4f46e5] mr-8">General Details</div>
                </div>

                <form onSubmit={handleSaveContact}>
                    <div className="p-8 space-y-6">
                        
                        {/* Entity Type Selection */}
                        <div className="bg-[#E9FAFA]/70 p-5 rounded-lg border border-[#B0DCDA] flex items-center justify-between">
                            <div>
                                <p className="font-bold text-gray-800 text-sm tracking-wide">Entity Classification</p>
                                <p className="text-xs text-gray-500 mt-1">Assigning the correct type ensures they appear in the right ledgers.</p>
                            </div>
                            <select 
                                value={formData.type} 
                                onChange={e => setFormData({...formData, type: e.target.value})} 
                                className="bg-white border border-[#B0DCDA] rounded-md px-4 py-2 text-sm font-bold text-[#4f46e5] outline-none cursor-pointer shadow-sm transition focus:border-[#4f46e5]"
                            >
                                <option value="PATIENT">🧑‍⚕️ Patient</option>
                                <option value="HMO">🏥 HMO</option>
                                <option value="SUPPLIER">📦 Supplier</option>
                                <option value="CORPORATE">🏢 Corporate</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Contact Name *</label>
                                <input type="text" required autoFocus value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Juan Dela Cruz" className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 focus:border-[#4f46e5] outline-none transition placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">BIR Tax ID (TIN)</label>
                                <input type="text" placeholder="000-000-000-000" value={formData.tin} onChange={e => setFormData({...formData, tin: e.target.value})} className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 font-mono focus:border-[#4f46e5] outline-none transition placeholder-gray-400" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="e.g. email@address.com" className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 focus:border-[#4f46e5] outline-none transition placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number</label>
                                <input type="text" placeholder="0912 345 6789" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 focus:border-[#4f46e5] outline-none transition placeholder-gray-400" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Registered Address</label>
                            <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full physical address..." className="w-full bg-white border border-[#B0DCDA] rounded-md p-3 text-sm text-gray-800 focus:border-[#4f46e5] outline-none h-20 resize-none transition placeholder-gray-400" />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="bg-[#FBF8F8] px-8 py-5 border-t border-[#B0DCDA] flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 bg-white hover:bg-[#E9FAFA] border border-[#B0DCDA] text-gray-700 rounded-md text-sm font-bold transition-colors cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 bg-[#4f46e5] hover:bg-[#5b54f6] text-white rounded-md text-sm font-bold shadow-lg transition-colors disabled:opacity-50 cursor-pointer tracking-wide">
                            {isSubmitting ? 'Saving...' : 'Save Contact'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
