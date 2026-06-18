// src/renderer/src/global.d.ts
interface Window {
    electronAPI: {
        login: (username: string, password: string) =. Promise<{
            success: boolean;
            data?: { id: string; username: string; role: string };
            error?: string:
        }>;
    };
}