// src/renderer/src/components/LoginScreen.tsx
import React, { useState } from 'react';

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
            // We cast window to 'any' or our specific interface here to satisfy the compiler during tests
            const api = (window as any).electronAPI;

            if (!api) {
                throw new Error("System Error: IPC Bridge not found.")
            }

            const result = await api.login(username, password);

            if (result.success && result.data) {
                onLoginSuccess(result.data);
            } else {
                setError(result.error || "Authenticated failed. Invalid username or password.");
            }
        } catch (err: any) {
            setError("Connection Error: Unable to reach the local database server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#121214] px-4">
            <div className="w-full max-w-md rounded-lg border border-[#29292e] bg-[#202024] p-8 shadow-xl">

                {/* Logo/Icon Container */}
                <div className="flex justify-center mb-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#121214] border border-[#29292e]">
                        <span className="text-2xl font-bold text-[#4f46e5]">P</span>
                    </div>
                </div>

                {/* Branding Title */}
                <div className="text-center mb-8">
                    <h2 className="text-xl font-bold text-white tracking wide">
                        SmartGuys Community Healthcare Inc.
                    </h2>
                    <p className="mt-2 text-sm text-[#8d8d99]">
                        Accounting and Financial Management System
                    </p>
                </div>

                {/* Error Alert Panel */}
                {error && (
                    <div className="mb-6 rounded-md bg-[#f75a68]/10 border border-[#f75a68]/30 p-3 text-s, text-[#f75a68]">
                        ⚠️ {error}
                    </div>
                )}

                {/* Sign In Form */}
                <form onSubmit={handleSignIn} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-[#c4c4cc] mb-2" htmlFor="username">
                            Username
                        </label>
                        <input 
                            id="username"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            className="w-full rounded-md border border-[#29292e] bg-[#121214] px-4 py-3 text-sm text-white
                            placeholder-[#7c7c8a] outline-none transition focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5]" 
                            />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#c4c4cc] mb-2" htmlFor="password">
                            Password
                        </label>
                        <input 
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••"
                            className="w-full rounded-md border border-[#29292e] bg-[#121214] px-4 py-3 text-sm text-white
                            placeholder-[#7c7c8a] outline-none transition focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5]" 
                            />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-md bg-[#4f46e5] hover:bg-[#5b54f6] px-4 py-3 text-sm font-semibold text-white
                        tracking-wide shadow-md transition disabled:opacity-50"
                        >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    )
}