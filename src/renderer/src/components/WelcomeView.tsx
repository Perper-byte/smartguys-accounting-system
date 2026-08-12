// src/renderer/src/components/WelcomeView.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';

export const WelcomeView: React.FC<{ username: string; role: string }> = ({ username }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="h-full flex flex-col items-center justify-center bg-[#121214] text-gray-200 font-sans animate-in fade-in duration-500">
            
            <div className="bg-[#202024] border border-[#29292e] rounded-2xl p-12 shadow-2xl max-w-2xl w-full text-center relative overflow-hidden">
                
                {/* Decorative background glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[#4f46e5] opacity-10 blur-3xl rounded-full pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="mx-auto h-20 w-20 bg-[#4f46e5] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)] mb-6 border-4 border-[#202024]">
                        <span className="text-3xl font-bold text-white">S</span>
                    </div>
                    
                    {/* Added mb-8 here to keep the spacing perfect after removing the badge */}
                    <h1 className="text-4xl font-bold text-white mb-8 tracking-tight">
                        Welcome back, <span className="text-[#4f46e5]">{username}</span>!
                    </h1>

                    <div className="bg-[#121214] rounded-lg p-6 border border-[#29292e] inline-block shadow-inner w-full max-w-md">
                        <p className="text-sm text-gray-400 uppercase tracking-widest font-bold mb-1">Current Date & Time</p>
                        <p className="text-2xl font-mono text-white font-bold">
                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    <p className="text-sm text-gray-500 mt-10">
                        Please select a module from the sidebar to begin your tasks.
                    </p>
                </div>
            </div>
        </div>
    );
};