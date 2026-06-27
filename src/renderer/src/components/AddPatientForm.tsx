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
            const api = (window as any).electronAPI;
            
            // Check if the API exists to prevent crashes
            if (!api || !api.createPayee) {
                setStatus({ type: 'error', msg: "Backend API not found. Please restart the app." });
                setLoading(false);
                return;
            }

            const result = await api.createPayee(name);

            if (result.success) {
                setStatus({ type: 'success', msg: `${name} saved!` });
                setName(''); 
                onPatientAdded(); 
                
                setTimeout(() => setStatus(null), 3000);
            } else {
                setStatus({ type: 'error', msg: "Failed to add patient." });
            }
        } catch (error) {
            setStatus({ type: 'error', msg: "Connection error." });
        } finally {
            setLoading(false);
        }
    };

    return (
        // Changed to a dashed border and darker background so it doesn't blend into the main form
        <div className="bg-[#121214] border-2 border-dashed border-[#29292e] rounded-lg p-5 mb-4">
            <h3 className="text-sm font-bold text-white mb-3">Register New Patient</h3>
            
            {status && (
                <div className={`mb-3 p-2 rounded-md text-xs font-medium ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
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
                        className="w-full bg-[#202024] border border-[#29292e] rounded-md p-2 text-sm text-white focus:border-[#4f46e5] outline-none transition"
                        required
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={loading || !name}
                    className="bg-[#4f46e5] disabled:bg-[#29292e] disabled:text-[#8d8d99] text-white text-sm font-bold py-2 px-4 rounded-md transition hover:bg-[#5b54f6] shadow-lg"
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </form>
        </div>
    );
};