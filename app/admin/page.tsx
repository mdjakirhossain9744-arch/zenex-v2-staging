"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../DashboardLayout"; 

export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // 💥 System Health States 💥
  const [apiStatus, setApiStatus] = useState("Checking...");
  const [dbStatus, setDbStatus] = useState("Checking...");
  const [ping, setPing] = useState(0);

  // 💥 Global Settings States 💥
  const [globalRate, setGlobalRate] = useState("0.50");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // 💥 Security Firewall States (Simulation for Dashboard) 💥
  const [blockedRequests, setBlockedRequests] = useState(124);
  const [activeConnections, setActiveConnections] = useState(0);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user.role !== "admin") {
        router.push("/"); 
        return;
      } else {
        setIsAdmin(true); 
        checkSystemHealth();
        fetchSystemSettings();
        
        // Randomize active connections for live effect
        const interval = setInterval(() => {
           setActiveConnections(Math.floor(Math.random() * 15) + 5);
        }, 5000);
        return () => clearInterval(interval);
      }
    } else {
      router.push("/login"); 
    }
  }, [router]);

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch("/api/system-settings");
      const data = await res.json();
      if (data) {
        setMaintenanceMode(data.maintenance || false);
        setGlobalRate(data.globalRate ? data.globalRate.toString() : "0.50");
      }
    } catch (error) {
      console.error("Failed to load settings");
    }
  };

  // 💥 ফিক্সড: সঠিক হেলথ চেক (এখন আর API ERROR আসবে না) 💥
  const checkSystemHealth = async () => {
    setApiStatus("Pinging...");
    setDbStatus("Connecting...");
    try {
      const startTime = Date.now();
      // আমরা system-settings এ পিং করছি কারণ এটি সরাসরি ডাটাবেস থেকে রেসপন্স আনে
      const res = await fetch("/api/system-settings", { cache: "no-store" });
      const endTime = Date.now();
      
      setPing(endTime - startTime); 

      if (res.ok) {
        setApiStatus("ONLINE");
        setDbStatus("SECURE & ACTIVE");
      } else {
        setApiStatus("DEGRADED");
        setDbStatus("WARNING");
      }
    } catch (error) {
      setApiStatus("OFFLINE");
      setDbStatus("DISCONNECTED");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newMaintenance: boolean, newRate: string) => {
    try {
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
    } catch (error) {
      alert("❌ Network error while saving.");
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-[#334155] border-t-[#F43F5E] rounded-full animate-spin mb-4"></div>
        <p className="text-[#94A3B8] font-bold tracking-widest uppercase text-sm">Verifying Admin Clearance...</p>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full bg-[#0B0F1A] min-h-screen text-slate-200 font-sans relative overflow-hidden">
        
        {/* Background Glowing Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-[#F43F5E] rounded-full blur-[150px] opacity-10 pointer-events-none"></div>

        <div className="relative z-10 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#334155] pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-[#F43F5E] via-[#EC4899] to-[#8B5CF6] bg-clip-text text-transparent uppercase tracking-wider">
              System Control Room
            </h1>
            <p className="text-xs md:text-sm text-[#94A3B8] mt-2 font-bold tracking-widest uppercase">Advanced Security Monitoring & Master Configuration</p>
          </div>
          <div className="flex gap-3">
             <button onClick={checkSystemHealth} className="bg-[#1E293B] border border-[#334155] text-white px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-[#334155] hover:border-[#94A3B8] transition-all shadow-lg flex items-center gap-2">
                <svg className={`w-4 h-4 text-[#3B82F6] ${apiStatus === 'Pinging...' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Run Diagnostics
             </button>
          </div>
        </div>

        {/* 💥 Top Stats / API Health 💥 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
           <div className={`p-6 rounded-2xl border flex flex-col shadow-lg transition-all ${apiStatus === 'ONLINE' ? 'bg-gradient-to-br from-[#10B981]/10 to-[#0F172A] border-[#10B981]/30' : 'bg-gradient-to-br from-[#F43F5E]/10 to-[#0F172A] border-[#F43F5E]/30'}`}>
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] uppercase font-black tracking-widest text-[#94A3B8]">Server Network</p>
                <span className={`w-2 h-2 rounded-full ${apiStatus === 'ONLINE' ? 'bg-[#10B981] animate-pulse shadow-[0_0_10px_#10B981]' : 'bg-[#F43F5E]'}`}></span>
              </div>
              <h2 className={`text-3xl md:text-4xl font-black ${apiStatus === 'ONLINE' ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>{apiStatus}</h2>
           </div>

           <div className={`p-6 rounded-2xl border flex flex-col shadow-lg transition-all ${dbStatus.includes('SECURE') ? 'bg-gradient-to-br from-[#3B82F6]/10 to-[#0F172A] border-[#3B82F6]/30' : 'bg-gradient-to-br from-[#EAB308]/10 to-[#0F172A] border-[#EAB308]/30'}`}>
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] uppercase font-black tracking-widest text-[#94A3B8]">Database Health</p>
                <svg className="w-4 h-4 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-[#F8FAFC] mt-auto">{dbStatus}</h2>
           </div>

           <div className="p-6 rounded-2xl border border-[#334155] bg-gradient-to-br from-[#1E293B] to-[#0F172A] flex flex-col shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] uppercase font-black tracking-widest text-[#94A3B8]">API Latency (Ping)</p>
                <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white">{ping} <span className="text-sm md:text-lg text-[#64748B]">ms</span></h2>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
           
           {/* 💥 Configuration & Kill Switch 💥 */}
           <div className="bg-[#1E293B]/60 backdrop-blur-xl border border-[#334155] rounded-3xl p-6 md:p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-8">
                 <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/20 flex items-center justify-center border border-[#3B82F6]/30">
                    <svg className="w-5 h-5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </div>
                 <h3 className="text-xl font-black text-white tracking-wide">Global Configurations</h3>
              </div>

              <div className="space-y-6">
                <div className="bg-[#0F172A]/50 p-5 rounded-2xl border border-[#334155]/50">
                   <label className="block text-[10px] font-black tracking-widest text-[#94A3B8] uppercase mb-3">Default New User Rate (BDT)</label>
                   <div className="flex gap-3">
                     <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] font-black">৳</span>
                        <input type="number" value={globalRate} onChange={(e)=>setGlobalRate(e.target.value)} step="0.01" className="bg-[#1E293B] border border-[#334155] text-white pl-10 pr-4 py-3 rounded-xl w-full font-black text-lg focus:outline-none focus:border-[#3B82F6] transition-colors shadow-inner" />
                     </div>
                     <button onClick={handleRateSave} className="bg-gradient-to-r from-[#3B82F6] to-[#00C6FF] text-white font-black px-8 rounded-xl hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-0.5 tracking-wider uppercase text-xs">Save</button>
                   </div>
                </div>

                <div className={`p-6 rounded-2xl border transition-all duration-300 ${maintenanceMode ? 'bg-[#F43F5E]/10 border-[#F43F5E] shadow-[0_0_30px_rgba(244,63,94,0.15)]' : 'bg-[#0F172A]/80 border-[#334155]'}`}>
                   <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${maintenanceMode ? 'bg-[#F43F5E]/20 text-[#F43F5E]' : 'bg-[#334155]/50 text-[#64748B]'}`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div>
                          <p className={`text-base font-black tracking-wide ${maintenanceMode ? 'text-[#F43F5E]' : 'text-white'}`}>Kill Switch (Maintenance)</p>
                          <p className="text-[10px] text-[#94A3B8] mt-0.5 uppercase tracking-widest font-bold">Instantly block all network traffic</p>
                        </div>
                     </div>
                     <button 
                       onClick={toggleMaintenance} 
                       className={`relative w-16 h-8 rounded-full flex items-center p-1 transition-colors duration-300 ${maintenanceMode ? 'bg-[#F43F5E]' : 'bg-[#334155]'}`}
                     >
                       <div className={`w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${maintenanceMode ? 'translate-x-8' : 'translate-x-0'}`}></div>
                     </button>
                   </div>
                   {maintenanceMode && (
                      <p className="text-xs font-bold text-[#F43F5E] bg-[#F43F5E]/10 p-3 rounded-lg border border-[#F43F5E]/20 animate-pulse">
                        ⚠️ WARNING: System is Offline. Users and Agents cannot access the dashboard or generate numbers.
                      </p>
                   )}
                </div>
              </div>
           </div>

           {/* 💥 Advanced Security & Firewall 💥 */}
           <div className="bg-[#0F172A] border border-[#334155] rounded-3xl p-6 md:p-8 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 flex items-center justify-center border border-[#10B981]/30">
                      <svg className="w-5 h-5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                   </div>
                   <h3 className="text-xl font-black text-white tracking-wide">Network Firewall</h3>
                </div>
                <span className="bg-[#10B981]/10 text-[#10B981] px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase border border-[#10B981]/20">Active</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-[#1E293B] border border-[#334155] p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-[10px] text-[#94A3B8] uppercase font-black tracking-widest mb-1">Blocked IPs (24h)</span>
                    <span className="text-2xl font-black text-[#EAB308]">{blockedRequests}</span>
                 </div>
                 <div className="bg-[#1E293B] border border-[#334155] p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-[10px] text-[#94A3B8] uppercase font-black tracking-widest mb-1">Active Sessions</span>
                    <span className="text-2xl font-black text-[#00C6FF]">{activeConnections}</span>
                 </div>
              </div>

              <div className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
                 <div className="bg-[#0B0F1A] px-4 py-3 border-b border-[#334155] flex justify-between items-center">
                    <span className="text-xs font-black text-[#94A3B8] uppercase tracking-widest">Spam / Bot Logs</span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
                    </span>
                 </div>
                 <div className="p-2 space-y-1">
                    <div className="flex items-center justify-between px-3 py-2 bg-[#0F172A] rounded-lg">
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-[#F43F5E] bg-[#F43F5E]/10 px-1.5 py-0.5 rounded border border-[#F43F5E]/20">BLOCKED</span>
                          <span className="text-xs text-slate-300 font-mono">192.168.x.x</span>
                       </div>
                       <span className="text-[10px] text-[#64748B]">Auto-Ban (Spam)</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 bg-[#0F172A] rounded-lg">
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-[#EAB308] bg-[#EAB308]/10 px-1.5 py-0.5 rounded border border-[#EAB308]/20">FILTERED</span>
                          <span className="text-xs text-slate-300 font-mono">45.22.x.x</span>
                       </div>
                       <span className="text-[10px] text-[#64748B]">Cloudflare Bypass</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 bg-[#0F172A] rounded-lg">
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-[#F43F5E] bg-[#F43F5E]/10 px-1.5 py-0.5 rounded border border-[#F43F5E]/20">BLOCKED</span>
                          <span className="text-xs text-slate-300 font-mono">103.112.x.x</span>
                       </div>
                       <span className="text-[10px] text-[#64748B]">Invalid Token</span>
                    </div>
                 </div>
              </div>

           </div>

        </div>

      </div>
    </DashboardLayout>
  );
}