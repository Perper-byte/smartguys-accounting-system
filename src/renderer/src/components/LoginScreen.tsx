// src/renderer/src/components/LoginScreen.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import bgImage from '../assets/smartguys_logo.jpg';
import logoImage from '../assets/smartguys_logo.jpg';

interface LoginScreenProps {
  onLoginSuccess: (user: { id: string; username: string; role: string }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 🌐 LAN SETTINGS STATE
  const [showSettings, setShowSettings] = useState(false);
  const [serverIp, setServerIp] = useState('localhost');

  useEffect(() => {
    // Fetch the currently configured IP address on load
    const api = (window as any).electronAPI;
    if (api && api.getServerIp) {
      api.getServerIp().then(setServerIp).catch(console.error);
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const api = (window as any).electronAPI;
      if (!api) throw new Error("System Error: IPC Bridge not found.");

      const result = await api.login(username, password);

      if (result.success && result.data) {
        onLoginSuccess(result.data);
      } else {
        setError(result.error || "Authentication failed. Invalid username or password.");
      }
    } catch (err: any) {
      setError(err.message || `Connection Error: Unable to reach the database at ${serverIp}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNetwork = async () => {
    const api = (window as any).electronAPI;
    if (api && api.setServerIp) {
      await api.setServerIp(serverIp); // This will restart the app!
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FBF8F8] font-sans relative">
      
      {/* 🌐 NETWORK SETTINGS MODAL */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md border border-[#B0DCDA] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-gray-800">LAN Connection Setup</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-red-500 font-bold">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-6 font-medium">
              Enter the IPv4 Address of the main Database Server PC. If this computer is the server, leave it as 'localhost'.
            </p>
            <div className="mb-6">
              <label className="block text-xs font-bold text-[#1B9387] uppercase tracking-wider mb-2">Database Server IP Address</label>
              <input
                type="text"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="e.g. 192.168.1.100"
                className="w-full rounded-md border border-[#B0DCDA] bg-[#FBF8F8] px-4 py-3 font-mono font-bold text-gray-800 outline-none focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA]"
              />
            </div>
            <button
              onClick={handleSaveNetwork}
              className="w-full bg-[#1B9387] text-white font-bold py-3.5 rounded-md hover:bg-[#28958B] transition uppercase tracking-widest shadow-md"
            >
              Save & Restart System
            </button>
          </div>
        </div>
      )}

      {/* LEFT/MIDDLE SIDE: POSTER & BRANDING */}
      <div className="hidden lg:flex flex-col w-3/5 relative justify-center items-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }}></div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B9387]/50 to-[#28958B]/40"></div>
        <div className="relative z-10 text-center px-12">
          <div className="h-32 w-32 rounded-3xl bg-[#E9FAFA] flex items-center justify-center mx-auto mb-8 shadow-2xl border-4 border-[#B0DCDA] overflow-hidden bg-white p-2">
            <img src={logoImage} alt="SmartGuys Logo" className="w-full h-full object-contain"/>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-md">SmartGuys Clinic</h1>
          <p className="text-xl text-[#E9FAFA] font-medium tracking-wide drop-shadow-sm">LAN-Based Accounting & Financial Management</p>
          <div className="mt-12 flex justify-center space-x-4">
            <span className="bg-[#FBF8F8]/20 text-white border border-[#B0DCDA]/50 backdrop-blur-md px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">Local-First Secure</span>
            <span className="bg-[#FBF8F8]/20 text-white border border-[#B0DCDA]/50 backdrop-blur-md px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">BIR Compliant</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: LOGIN FORM */}
      <div className="w-full lg:w-2/5 flex flex-col justify-center px-8 sm:px-16 lg:px-20 bg-white shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.1)] z-10 relative">
        
        {/* 🌐 NETWORK SETTINGS GEAR ICON */}
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute top-6 right-8 text-gray-400 hover:text-[#1B9387] transition flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 shadow-sm"
          title="Configure LAN Settings"
        >
          <span className="text-xs font-extrabold tracking-wider">⚙️ SERVER: {serverIp}</span>
        </button>

        <div className="w-full max-w-sm mx-auto mt-8">
          <div className="mb-10">
            <h2 className="text-3xl font-extrabold text-gray-800 mb-2 tracking-wide">Welcome back</h2>
            <p className="text-sm text-gray-500 font-medium">Please enter your credentials to securely access the local database.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600 flex items-start shadow-sm">
              <span className="mr-2">⚠️</span><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Username</label>
              <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username" className="w-full rounded-md border border-[#B0DCDA] bg-[#FBF8F8] px-4 py-3.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] focus:bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-md border border-[#B0DCDA] bg-[#FBF8F8] px-4 py-3.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] focus:bg-white" />
            </div>

            <button type="submit" disabled={loading} className="w-full mt-6 bg-[#1B9387] disabled:bg-[#B0DCDA] text-white font-bold py-4 rounded-md transition hover:bg-[#28958B] uppercase tracking-widest shadow-md flex justify-center items-center">
              {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>}
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="mt-12 pt-6 border-t border-[#E9FAFA] text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Authorized Personnel Only</p>
          </div>
        </div>
      </div>
    </div>
  );
};