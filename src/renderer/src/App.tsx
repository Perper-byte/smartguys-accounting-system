// src/renderer/src/App.tsx
import { useState } from "react";
import { LoginScreen } from "./components/LoginScreen";

function App(): JSX.Element {
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string } | null>(null);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />
  }

  return (
    <div className="min-h-screen bg-[#121214] text-white p-8">
      <div className="max-w-4xl mx-auto bg-[#202024] border border-[#29292e] rounded-lg p-8 shadow-md">
        <div className="flex justify-between items-center border-b border-[#29292e] pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold">SmartGuys Dashboard</h1>
            <p className="text-[#8d8d99] text-sm mt-1">Logged in as {currentUser.username} ({currentUser.role})</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold transition"
            >
              Logout  
          </button>
        </div>

        <div className="p-6 bg-[#121214] border border-[#29292e] rounded text-center">
          <p className="text-lg">🎉 Welcome! You have successfully bypassed the secure login gateway.</p>
          <p className="text-[#8d8d99] text-sm mt-2">Next up: We will build the Ledger transaction forms and Charts here.</p>
        </div>
      </div>
    </div>
  );
}

export default App;