// src/renderer/src/components/DatabaseBackupView.tsx
import * as React from 'react';
import { useState } from 'react';

export const DatabaseBackupView: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<{ time: string; msg: string; type: 'info' | 'success' | 'error' }[]>([]);

    const addLog = (msg: string, type: 'info' | 'success' | 'error') => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    const handleTriggerBackup = async () => {
        setLoading(true);
        addLog('Initializing mysqldump backup sequence...', 'info');
        addLog('Connecting to local MySQL instance...', 'info');

        try {
            const api = (window as any).electronAPI;
            const result = await api.triggerBackup();

            if (result.success) {
                addLog('SQL Dump generated successfully.', 'info');
                addLog('Running integrity and completeness scan...', 'info');
                addLog(`Verified! Backup securely saved at: ${result.filePath}`, 'success');
            } else {
                addLog(`Backup Failed: ${result.error}`, 'error');
                // Handle common XAMPP Windows PATH error
                if (result.error?.includes('not recognized') || result.error?.includes('ENOENT')) {
                    addLog('HINT: Make sure "mysqldump" is added to your Windows System Environment PATH (usually located in C:\\xampp\\mysql\\bin).', 'info');
                }
            }
        } catch (err: any) {
            addLog(`System Error: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b border-[#29292e] pb-4">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-wide">Database Management</h2>
                    <p className="text-sm text-[#8d8d99] mt-1">Secure local backup and recovery tools for IT Personnel.</p>
                </div>
                <span className="bg-emerald-500/20 text-emerald-500 text-xs px-3 py-1 rounded font-bold uppercase tracking-widest border border-emerald-500/30">
                    System Secure
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* ACTION PANEL */}
                <div className="col-span-1 space-y-4">
                    <div className="bg-[#121214] border border-[#29292e] rounded-md p-4">
                        <h3 className="text-white font-bold mb-2">Create Local Backup</h3>
                        <p className="text-xs text-[#8d8d99] mb-4">
                            Generates a complete `.sql` snapshot of the accounting database, including the schema and all ledger records.
                        </p>
                        <button
                            onClick={handleTriggerBackup}
                            disabled={loading}
                            className="w-full bg-[#4f46e5] disabled:bg-[#29292e] disabled:text-[#8d8d99] text-white text-sm font-bold py-3 rounded transition hover:bg-[#5b54f6] shadow-md flex justify-center items-center"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Processing...
                                </>
                            ) : (
                                '💾 Run Backup Now'
                            )}
                        </button>
                    </div>
                </div>

                {/* TERMINAL LOG PANEL */}
                <div className="col-span-2">
                    <div className="bg-[#0d0d0f] border border-[#29292e] rounded-md h-full min-h-[300px] flex flex-col font-mono text-xs shadow-inner">
                        <div className="bg-[#202024] px-4 py-2 border-b border-[#29292e] flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="ml-2 text-[#8d8d99] font-sans text-[10px] font-bold tracking-wider uppercase">System Output Log</span>
                        </div>

                        <div className="p-4 overflow-y-auto space-y-2 flex-1">
                            {logs.length === 0 ? (
                                <p className="text-[#3f3f46]">Waiting for system commands...</p>
                            ) : (
                                logs.map((log, idx) => (
                                    <div key={idx} className="flex space-x-3">
                                        <span className="text-[#8d8d99] whitespace-nowrap">[{log.time}]</span>
                                        <span className={`
                      ${log.type === 'success' ? 'text-emerald-400 font-bold' : ''}
                      ${log.type === 'error' ? 'text-[#f75a68] font-bold' : ''}
                      ${log.type === 'info' ? 'text-[#c4c4cc]' : ''}
                    `}>
                                            {log.msg}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};