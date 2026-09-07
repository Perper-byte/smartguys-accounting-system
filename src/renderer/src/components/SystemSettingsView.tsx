// src/renderer/src/components/SystemSettingsView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Lock, Unlock, AlertTriangle, CheckCircle, Save, CalendarClock, KeyRound } from 'lucide-react';

export function SystemSettingsView() {
    // Manual Lock Date
    const [lockDate, setLockDate] = useState('');
    const [originalDate, setOriginalDate] = useState('');
    
    // Auto-Lock Date (Grace Period)
    const [autoLockDay, setAutoLockDay] = useState<number | ''>('');
    const [originalAutoLockDay, setOriginalAutoLockDay] = useState<number | ''>('');

    // Manager Override PIN
    const [overridePin, setOverridePin] = useState('');
    const [hasExistingPin, setHasExistingPin] = useState(false);

    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const api = (window as any).api || (window as any).electronAPI;
                const res = await api.getLockDate();
                
                if (res?.lockDate) {
                    const localDate = res.lockDate.split('T')[0];
                    setLockDate(localDate);
                    setOriginalDate(localDate);
                }
                if (res?.autoLockDay) {
                    setAutoLockDay(res.autoLockDay);
                    setOriginalAutoLockDay(res.autoLockDay);
                }
                if (res?.hasOverridePin) {
                    setHasExistingPin(true);
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setStatus(null);
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            
            const payload = {
                lockDate: lockDate || null,
                autoLockDay: autoLockDay ? Number(autoLockDay) : null,
                overridePin: overridePin || null
            };

            const result = await api.setLockDate(payload);
            
            if (result.success) {
                setOriginalDate(lockDate);
                setOriginalAutoLockDay(autoLockDay);
                if (overridePin) setHasExistingPin(true);
                else if (overridePin === '') setHasExistingPin(false);
                
                setOverridePin(''); // Clear the input field for security
                
                setStatus({ type: 'success', msg: 'System security settings updated successfully!' });
                
                // Audit Trail
                if (api.logAction) {
                    await api.logAction('SYSTEM', 'SECURITY', `Updated Accounting Lock Settings`);
                }
            }
        } catch (error: any) {
            setStatus({ type: 'error', msg: error.message || 'Failed to update settings.' });
        } finally {
            setLoading(false);
        }
    };

    // Form is dirty if dates changed, or if a new PIN was typed
    const isDirty = lockDate !== originalDate || autoLockDay !== originalAutoLockDay || overridePin.length > 0;

    return (
        <div className="w-full min-h-[calc(100vh-64px)] p-6 md:p-10 bg-[#f9fafb] animate-in fade-in duration-300">
            <div className="max-w-4xl mx-auto">
                
                <div className="mb-8 border-b border-[#B0DCDA] pb-6">
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide">System Security & Settings</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Protect your accounting periods and manage global system configurations.</p>
                </div>

                {status && (
                    <div className={`mb-6 p-4 rounded-xl text-sm font-bold flex items-center gap-3 shadow-sm border ${status.type === 'success' ? 'bg-[#E9FAFA] text-[#1B9387] border-[#B0DCDA]' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {status.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                        {status.msg}
                    </div>
                )}

                <div className="bg-white border border-[#B0DCDA] rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row mb-6">
                    {/* Visual Side */}
                    <div className={`w-full md:w-1/3 p-8 flex flex-col items-center justify-center text-center transition-colors ${lockDate ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        {lockDate ? (
                            <>
                                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                    <Lock size={28} />
                                </div>
                                <h3 className="text-red-700 font-extrabold uppercase tracking-widest text-sm mb-1">Period Locked</h3>
                                <p className="text-xs font-bold text-red-500/70">As of {new Date(lockDate).toLocaleDateString()}</p>
                                {hasExistingPin && (
                                    <span className="mt-4 bg-white/50 text-red-600 border border-red-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                        <KeyRound size={12} /> PIN Active
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                    <Unlock size={28} />
                                </div>
                                <h3 className="text-emerald-700 font-extrabold uppercase tracking-widest text-sm mb-1">Unlocked</h3>
                                <p className="text-xs font-bold text-emerald-500/70">All dates open</p>
                            </>
                        )}
                    </div>

                    {/* Input Side */}
                    <div className="w-full md:w-2/3 p-8">
                        <h3 className="text-lg font-extrabold text-gray-800 mb-2">Month-End Accounting Lock</h3>
                        <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
                            Set a date below to prevent anyone from adding, editing, or voiding transactions on or before that date. This ensures your reconciled data and filed taxes are never accidentally modified.
                        </p>

                        <div className="space-y-6">
                            
                            {/* MANUAL LOCK */}
                            <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl">
                                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Current Global Lock Date</label>
                                <div className="flex gap-3">
                                    <input 
                                        type="date" 
                                        value={lockDate} 
                                        onChange={e => setLockDate(e.target.value)} 
                                        className="w-full max-w-xs bg-white border border-gray-300 rounded-md p-3 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none transition cursor-pointer shadow-sm" 
                                    />
                                    {lockDate && (
                                        <button 
                                            onClick={() => setLockDate('')} 
                                            className="px-4 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md uppercase tracking-wider transition cursor-pointer border border-transparent"
                                        >
                                            Remove Lock
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* AUTOMATIC LOCK */}
                            <div className="bg-[#E9FAFA]/50 border border-[#B0DCDA] p-5 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <CalendarClock size={16} className="text-[#1B9387]" />
                                    <label className="block text-[10px] font-extrabold text-[#1B9387] uppercase tracking-wider">Automate Closing (Grace Period)</label>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">Automatically lock the previous month after this many days have passed in the new month.</p>
                                
                                <div className="flex items-center gap-3">
                                    <select 
                                        value={autoLockDay}
                                        onChange={e => setAutoLockDay(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full max-w-xs bg-white border border-[#B0DCDA] rounded-md p-3 text-sm font-bold text-gray-800 focus:border-[#1B9387] outline-none cursor-pointer shadow-sm"
                                    >
                                        <option value="">Disabled (Manual Lock Only)</option>
                                        <option value={3}>Lock on the 3rd of the month</option>
                                        <option value={5}>Lock on the 5th of the month</option>
                                        <option value={7}>Lock on the 7th of the month</option>
                                        <option value={10}>Lock on the 10th of the month</option>
                                    </select>
                                </div>
                            </div>

                            {/* OVERRIDE PIN */}
                            <div className="bg-red-50/50 border border-red-200 p-5 rounded-xl">
                                <label className="block text-[10px] font-extrabold text-red-600 uppercase tracking-wider mb-2">Manager Override PIN</label>
                                <p className="text-xs text-red-500/80 mb-3 font-medium">Required to backdate Adjusting Entries or Void transactions in a locked period. Leave blank to retain current PIN.</p>
                                <input 
                                    type="password" 
                                    value={overridePin} 
                                    onChange={e => setOverridePin(e.target.value)} 
                                    placeholder={hasExistingPin ? "•••• (PIN is set)" : "Enter 4 to 6 digit PIN"} 
                                    className="w-full max-w-xs bg-white border border-red-200 rounded-md p-3 text-sm font-mono font-bold text-gray-800 focus:border-red-500 outline-none shadow-sm" 
                                />
                            </div>

                            {/* SAVE BUTTON */}
                            <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                                <button 
                                    disabled={!isDirty || loading}
                                    onClick={handleSave} 
                                    className="px-8 py-3 bg-[#1B9387] hover:bg-[#28958B] text-white rounded-md text-sm font-bold uppercase tracking-wider shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    <Save size={16} /> Save Security Settings
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}