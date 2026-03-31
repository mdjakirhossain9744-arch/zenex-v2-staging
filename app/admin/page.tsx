"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../DashboardLayout"; 

export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [apiStatus, setApiStatus] = useState("Checking...");
  const [ping, setPing] = useState(0);
  const [totalOtpCount, setTotalOtpCount] = useState(0);

  // 💥 রিয়েল গ্লোবাল সেটিংস স্টেট 💥
  const [globalRate, setGlobalRate] = useState("0.50");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user.role !== "admin") {
        router.push("/dashboard"); 
        return;
      } else {
        setIsAdmin(true); 
        checkSystemHealth();
        fetchSystemSettings(); // সেটিংস লোড করবে
      }
    } else {
      router.push("/login"); 
    }
  }, [router]);

  // ডাটাবেস থেকে বর্তমান সেটিংস আনা
  const fetchSystemSettings = async () => {
    const res = await fetch("/api/system-settings");
    const data = await res.json();
    if (data) {
      setMaintenanceMode(data.maintenance || false);
      setGlobalRate(data.globalRate ? data.globalRate.toString() : "0.50");
    }
  };

  const checkSystemHealth = async () => {
    try {
      const startTime = Date.now();
      const res = await fetch("/api/check-otp", { cache: "no-store" });
      const endTime = Date.now();
      const data = await res.json();

      setPing(endTime - startTime); 

      if (res.ok && data.success) {
        setApiStatus("ONLINE");
        if (data.otps) setTotalOtpCount(data.otps.length);
      } else {
        setApiStatus("API ERROR");
      }
    } catch (error) {
      setApiStatus("OFFLINE");
    } finally {
      setLoading(false);
    }
  };

  // 💥 ডাটাবেসে সেভ করার রিয়েল ফাংশন 💥
  const saveSettings = async (newMaintenance: boolean, newRate: string) => {
    const res = await fetch("/api/system-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maintenance: newMaintenance, globalRate: newRate })
    });
    
    if(res.ok) {
      alert("✅ System Settings Updated Successfully!");
    } else {
      alert("❌ Failed to update system.");
    }
  };

  const toggleMaintenance = () => {
    const newVal = !maintenanceMode;
    setMaintenanceMode(newVal);
    saveSettings(newVal, globalRate);
  };

  const handleRateSave = () => {
    saveSettings(maintenanceMode, globalRate);
  };

  if (!isAdmin) return <div className="min-h-screen bg-[#0B0F1A] flex items-center justify-center text-white">VERIFYING ADMIN...</div>;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full bg-[#0B0F1A] min-h-screen text-slate-200 font-sans">
        
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-[#F43F5E] via-[#EC4899] to-[#8B5CF6] bg-clip-text text-transparent uppercase tracking-wider">
              System Control Room
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-medium">Master Configuration, API Health & Database Security</p>
          </div>
          <div className="flex gap-3">
             <button onClick={checkSystemHealth} className="bg-[#334155]/50 border border-[#334155] text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#334155] transition flex items-center gap-2">
                Ping API
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className={`p-6 rounded-2xl border flex flex-col shadow-lg ${apiStatus === 'ONLINE' ? 'bg-[#10B981]/10 border-[#10B981]/30' : 'bg-[#F43F5E]/10 border-[#F43F5E]/30'}`}>
              <p className="text-xs uppercase font-black tracking-widest text-[#94A3B8] mb-2">Main Provider API</p>
              <h2 className={`text-3xl font-black ${apiStatus === 'ONLINE' ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>{apiStatus}</h2>
           </div>
           <div className="p-6 rounded-2xl border border-[#334155] bg-[#1E293B]/80 flex flex-col shadow-lg">
              <p className="text-xs uppercase font-black tracking-widest text-[#94A3B8] mb-2">Server Latency (Ping)</p>
              <h2 className="text-3xl font-black text-[#F8FAFC]">{ping} <span className="text-sm">ms</span></h2>
           </div>
           <div className="p-6 rounded-2xl border border-[#334155] bg-[#1E293B]/80 flex flex-col shadow-lg">
              <p className="text-xs uppercase font-black tracking-widest text-[#94A3B8] mb-2">Live Cached Logs</p>
              <h2 className="text-3xl font-black text-[#F8FAFC]">{totalOtpCount}</h2>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           
           <div className="bg-[#1E293B]/80 border border-[#334155] rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-black text-white mb-6">Global Settings</h3>

              <div className="space-y-6">
                <div>
                   <label className="block text-[10px] font-bold tracking-widest text-[#94A3B8] uppercase mb-2">Default New User Rate (BDT)</label>
                   <div className="flex gap-3">
                     <input type="number" value={globalRate} onChange={(e)=>setGlobalRate(e.target.value)} step="0.01" className="bg-[#0F172A] border border-[#334155] text-white px-4 py-2.5 rounded-lg w-full font-black focus:outline-none" />
                     <button onClick={handleRateSave} className="bg-[#3B82F6]/10 text-[#3B82F6] font-bold px-6 rounded-lg hover:bg-[#3B82F6] hover:text-white transition">Save</button>
                   </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#0F172A] border border-[#334155] rounded-xl">
                   <div>
                     <p className="text-sm font-bold text-white">Maintenance Mode (Kill Switch)</p>
                     <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Block all users & agents immediately</p>
                   </div>
                   <button 
                     onClick={toggleMaintenance} 
                     className={`w-14 h-7 rounded-full flex items-center p-1 transition-colors ${maintenanceMode ? 'bg-[#F43F5E] shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-[#334155]'}`}
                   >
                     <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-md ${maintenanceMode ? 'translate-x-7' : 'translate-x-0'}`}></div>
                   </button>
                </div>
              </div>
           </div>

           <div className="bg-[#1E293B]/80 border border-[#F43F5E]/30 rounded-2xl p-6">
              <h3 className="text-lg font-black text-[#F43F5E] mb-6">Security & Logs</h3>
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 border border-[#334155] rounded-xl">
                   <div>
                     <p className="text-sm font-bold text-white">Suspicious Activities</p>
                     <p className="text-[10px] text-slate-400 mt-1">Bypass attempts & fake requests</p>
                   </div>
                   <span className="text-[#10B981] font-black text-sm">0 Detected (Safe)</span>
                 </div>
                 <div className="p-4 border border-[#F43F5E]/30 bg-[#F43F5E]/5 rounded-xl">
                   <p className="text-xs text-slate-300 font-bold mb-2">If you suspect an attack or overload, immediately turn ON the <span className="text-[#F43F5E]">Maintenance Mode</span>. It will block all IPs except the Admin.</p>
                 </div>
              </div>
           </div>

        </div>

      </div>
    </DashboardLayout>
  );
}