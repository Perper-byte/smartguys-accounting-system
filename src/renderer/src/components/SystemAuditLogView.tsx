// src/renderer/src/components/SystemAuditLogView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

// Timezone Fix Helper
const getLocalDateString = (date: Date) => {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

export function SystemAuditLogView() {
    const today = new Date();
    const [startDate, setStartDate] = useState(getLocalDateString(today));
    const [endDate, setEndDate] = useState(getLocalDateString(today));
    
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const api = (window as any).api || (window as any).electronAPI;
            const data = await api.getAuditLogs(startDate, endDate);
            setLogs(data || []);
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [startDate, endDate]);

    // Client-side search filtering
    const filteredLogs = logs.filter(log => 
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.user?.username || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleExportCSV = () => {
        if (filteredLogs.length === 0) return alert("No data to export.");
        
        const headers = ['Timestamp', 'User', 'Action', 'Details'];
        const rows = filteredLogs.map(log => [
            new Date(log.timestamp).toLocaleString(),
            `"${log.user?.username || 'SYSTEM'}"`,
            `"${log.action}"`,
            `"${log.details.replace(/"/g, '""')}"` // Escape quotes for CSV
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); 
        link.href = url;
        link.setAttribute('download', `System_Audit_Log_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col font-sans text-gray-200">
            <div className="flex justify-between items-end mb-6 border-b border-[#29292e] pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">System Audit Trail</h2>
                    <p className="text-sm text-gray-400 mt-1">Immutable security log required for BIR CAS accreditation.</p>
                </div>
                
                <div className="flex flex-col items-end space-y-3">
                    <div className="flex items-center space-x-2 bg-[#121214] border border-[#29292e] rounded-md px-3 py-1">
                        <span className="text-xs text-gray-500 uppercase font-bold">From:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                        <span className="text-xs text-gray-500 uppercase font-bold pl-2 border-l border-[#29292e]">To:</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none p-1 cursor-pointer" />
                        <button onClick={fetchLogs} className="ml-2 bg-[#4f46e5] hover:bg-[#5b54f6] text-white px-3 py-1 rounded text-xs font-bold transition">Load</button>
                    </div>
                    <button onClick={handleExportCSV} className="flex items-center space-x-2 bg-[#29292e] hover:bg-[#323238] text-white px-4 py-2 rounded-md text-sm font-medium transition border border-[#323238] cursor-pointer">
                        <span>📥</span><span>Export to CSV</span>
                    </button>
                </div>
            </div>

            <div className="bg-[#121214] border border-[#29292e] rounded-md flex-1 flex flex-col overflow-hidden shadow-xl">
                <div className="bg-[#1a1a1e] p-4 border-b border-[#29292e]">
                    <input 
                        type="text" 
                        placeholder="🔍 Search logs by user, action, or details..." 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-full bg-[#121214] border border-[#29292e] rounded-md px-4 py-2 text-sm focus:outline-none focus:border-[#4f46e5] text-white placeholder-gray-600 transition-colors" 
                    />
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                         <div className="flex justify-center items-center h-full text-[#4f46e5] animate-pulse">Loading Logs...</div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-[#202024] sticky top-0 z-10 shadow-sm border-b border-[#29292e]">
                                <tr className="text-[#8d8d99] uppercase tracking-wider text-xs">
                                    <th className="p-4 font-bold w-[15%]">Timestamp</th>
                                    <th className="p-4 font-bold w-[15%]">User</th>
                                    <th className="p-4 font-bold w-[20%]">Action</th>
                                    <th className="p-4 font-bold w-[50%]">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#29292e]/50">
                                {filteredLogs.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-gray-500 italic">No logs found in this date range.</td></tr>
                                ) : (
                                    filteredLogs.map((log: any, i: number) => (
                                        <tr key={i} className="hover:bg-[#2a2a2f] transition-colors">
                                            <td className="p-4 text-gray-400 font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="p-4 font-bold text-white">{log.user?.username || 'SYSTEM'}</td>
                                            <td className="p-4 text-[#4f46e5] font-bold text-xs uppercase tracking-wider">{log.action}</td>
                                            <td className="p-4 text-gray-300 truncate whitespace-normal max-w-lg">{log.details}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}