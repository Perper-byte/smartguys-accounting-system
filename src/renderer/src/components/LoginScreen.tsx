// src/renderer/src/components/LoginScreen.tsx
import * as React from 'react';
import { useState } from 'react';
import logoImage from '../assets/smartguys_logo.jpg';

interface LoginScreenProps {
    onLoginSuccess: (user: { id: string; username: string; role: string }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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
            setError(err.message || "Connection Error: Unable to reach the local database.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full bg-[#FBF8F8] font-sans">

            {/* LEFT/MIDDLE SIDE: POSTER & BRANDING (60% width) */}
            <div className="hidden lg:flex flex-col w-3/5 relative justify-center items-center overflow-hidden">

                {/* Background Image (Medical/Hospital aesthetic) */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${logoImage})` }}
                ></div>

                {/* Soft Teal Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#1B9387]/50 to-[#28958B]/40"></div>

                {/* Branding Content */}
                <div className="relative z-10 text-center px-12">

                    <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-md">
                        SmartGuys Clinic [Placeholder]
                    </h1>
                    <p className="text-xl text-[#E9FAFA] font-medium tracking-wide drop-shadow-sm">
                        LAN-Based Accounting & Financial Management [Placeholder]
                    </p>
                </div>
            </div>

            {/* RIGHT SIDE: LOGIN FORM (40% width) */}
            <div className="w-full lg:w-2/5 flex flex-col justify-center px-8 sm:px-16 lg:px-20 bg-white shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.1)] z-10 relative">
                <div className="w-full max-w-sm mx-auto">

                    <div className="mb-10">
                        <h2 className="text-3xl font-extrabold text-gray-800 mb-2 tracking-wide">Welcome back!</h2>
                    </div>

                    {error && (
                        // Standard red used for error to maintain good UX/Accessibility
                        <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600 flex items-start shadow-sm">
                            <span className="mr-2">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSignIn} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2" htmlFor="username">
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="w-full rounded-md border border-[#B0DCDA] bg-[#FBF8F8] px-4 py-3.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] focus:bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2" htmlFor="password">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full rounded-md border border-[#B0DCDA] bg-[#FBF8F8] px-4 py-3.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-[#1B9387] focus:ring-2 focus:ring-[#E9FAFA] focus:bg-white"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-6 bg-[#1B9387] disabled:bg-[#B0DCDA] text-white font-bold py-4 rounded-md transition hover:bg-[#28958B] uppercase tracking-widest shadow-md flex justify-center items-center"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                            ) : null}
                            {loading ? "Authenticating..." : "Sign In"}
                        </button>
                    </form>

                    <div className="mt-12 pt-6 border-t border-[#E9FAFA] text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                            Authorized Personnel Only
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};