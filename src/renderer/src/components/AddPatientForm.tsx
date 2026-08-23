// src/renderer/src/components/AddPatientForm.tsx
import * as React from 'react';
import { useState } from 'react';

export const AddPatientForm: React.FC<{ onPatientAdded: () => void }> = ({ onPatientAdded }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setStatus(null);

        try {
            // Added the (window as any).api fallback we've been using to prevent crashes
            const api = (window as any).electronAPI || (window as any).api;
            
            if (!api || !api.createPayee) {
                setStatus({ type: 'error', msg: "Backend API not found. Please restart the app." });
                setLoading(false);
                return;
            }

            // 🔥 FIX: Explicitly pass 'PATIENT' so the database tags it correctly!
            const result = await api.createPayee(name, 'PATIENT');

            if (result.success) {
                setStatus({ type: 'success', msg: `${name} saved!` });
                setName(''); 
                onPatientAdded(); 
                
                setTimeout(() => setStatus(null), 3000);
            } else {
                setStatus({ type: 'error', msg: result.error || "Failed to add patient." });
            }
        } catch (error) {
            setStatus({ type: 'error', msg: "Connection error." });
        } finally {
            setLoading(false);
        }
    };

    return (
        // 🔥 FIX: Completely upgraded to the new Light Mode (Teal & White) UI!
        <div className="bg-[#E9FAFA] border border-[#B0DCDA] rounded-lg p-5 mb-4 shadow-inner">
            <h3 className="text-sm font-extrabold text-[#1B9387] mb-3 uppercase tracking-wider">Register New Patient</h3>
            
            {status && (
                <div className={`mb-3 p-2 rounded-md text-xs font-bold ${status.type === 'success' ? 'bg-white text-[#1B9387] border border-[#B0DCDA]' : 'bg-red-50 text-red-500 border border-red-200'}`}>
                    {status.type === 'success' ? '✅ ' : '⚠️ '}{status.msg}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-3 items-end">
                <div className="flex-1">
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="Type Patient Name..." 
                        className="w-full bg-white border border-[#B0DCDA] rounded-md p-2.5 text-sm text-gray-800 font-medium focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] outline-none transition"
                        required
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={loading || !name}
                    className="bg-[#1B9387] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-bold py-2.5 px-5 rounded-md transition hover:bg-[#28958B] shadow-sm cursor-pointer disabled:cursor-not-allowed"
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </form>
        </div>
    );
};