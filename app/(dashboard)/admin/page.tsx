"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [apiStatus, setApiStatus] = useState("Checking...");
  const [dbStatus, setDbStatus] = useState("Checking...");
  const [ping, setPing] = useState(0);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  
  const [globalSupportLink, setGlobalSupportLink] = useState("https://t.me/Zenexacademy1");
  const [globalContactLink, setGlobalContactLink] = useState("https://t.me/abdullah_124");

  // 🔥 Hidden Keywords & Dynamic Services State 🔥
  const [hiddenKeywords, setHiddenKeywords] = useState("");
  const [dynamicServices, setDynamicServices] = useState(""); // 💥 BOSS UPGRADE: State for CMS Engine

  const [blockedRequests, setBlockedRequests] = useState(124);

  const [hardware, setHardware] = useState({ 
      cpu: "0", ram: "0", disk: "0", ramDetails: "Loading...", cpuCores: 0, activeSessions: 0 
  });

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
        fetchGlobalLinks();
        fetchHardware(); 
        
        const interval = setInterval(() => {
           fetchHardware(); 
        }, 5000);
        return () => clearInterval(interval);
      }
    } else {
      router.push("/login"); 
    }
  }, [router]);

  const fetchHardware = async () => {
    try {
      const res = await fetch("/api/admin/server-health");
      const data = await res.json();
      if (data.success) {
        setHardware({ 
            cpu: data.cpu, 
            ram: data.ram, 
            disk: data.disk, 
            ramDetails: data.ramDetails, 
            cpuCores: data.cpuCores,
            activeSessions: data.activeSessions || 0
        });
      }
    } catch (e) {}
  };

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch("/api/system-settings");
      const data = await res.json();
      if (data) {
          setMaintenanceMode(data.maintenance || false);
          
          if (data.hiddenKeywords && Array.isArray(data.hiddenKeywords)) {
              setHiddenKeywords(data.hiddenKeywords.join(", "));
          }
          // 💥 Load Dynamic Services from DB 💥
          if (data.dynamicServices && Array.isArray(data.dynamicServices)) {
              setDynamicServices(data.dynamicServices.join(", "));
          }
      }
    } catch (error) {}
  };

  const fetchGlobalLinks = async () => {
    try {
      const res = await fetch("/api/admin/update-support-link");
      const data = await res.json();
      if (data.success) {
        if (data.supportLink) setGlobalSupportLink(data.supportLink);
        if (data.contactLink) setGlobalContactLink(data.contactLink);
      }
    } catch (error) {}
  };

  const checkSystemHealth = async () => {
    setApiStatus("Pinging...");
    setDbStatus("Connecting...");
    try {
      const startTime = Date.now();
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

  const saveSettings = async (newMaintenance: boolean) => {
    try {
      const res = await fetch("/api/system-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenance: newMaintenance })
      });
      
      if(res.ok) alert("✅ System Settings Updated Successfully!");
      else alert("❌ Failed to update system.");
    } catch (error) {}
  };

  const handleKeywordsSave = async () => {
    try {
      const keywordArray = hiddenKeywords.split(",").map(k => k.trim().toLowerCase()).filter(k => k);
      const res = await fetch("/api/system-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenKeywords: keywordArray })
      });
      if(res.ok) alert("✅ Secret Keywords Masked Successfully!");
      else alert("❌ Failed to save keywords.");
    } catch (error) { alert("❌ Server error."); }
  };

  // 💥 BOSS UPGRADE: Handle Dynamic Services Save 💥
  const handleDynamicServicesSave = async () => {
    try {
      // Services will be saved in exact case or lowercase (we can match case-insensitively later)
      const serviceArray = dynamicServices.split(",").map(k => k.trim()).filter(k => k);
      const res = await fetch("/api/system-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dynamicServices: serviceArray })
      });
      if(res.ok) alert("✅ Dynamic Services Saved Successfully! Engine will now detect them.");
      else alert("❌ Failed to save dynamic services.");
    } catch (error) { alert("❌ Server error."); }
  };

  const handleLinksSave = async () => {
    try {
      const res = await fetch("/api/admin/update-support-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          supportLink: globalSupportLink,
          contactLink: globalContactLink
        })
      });
      if(res.ok) alert("✅ Global Links Updated Successfully! Users will see this instantly.");
    } catch (error) {
      alert("❌ Failed to update links.");
    }
  };

  const toggleMaintenance = () => {
    const newVal = !maintenanceMode;
    setMaintenanceMode(newVal);
    saveSettings(newVal);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#030816] flex flex-col items-center justify-center text-[#F8FAFC]">
        <div className="w-12 h-12 border-4 border-[#162749] border-t-[#00D2FF] rounded-full animate-spin mb-4"></div>
        <p className="text-[#6C84A3] font-bold tracking-widest uppercase text-sm">Verifying Clearance...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full bg-[#030816] min-h-screen text-[#F8FAFC] font-sans relative overflow-hidden tracking-tight pb-20">
      
      <div className="max-w-[1600px] mx-auto w-full">

        <div className="relative z-10 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#162749] pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#00D2FF] tracking-wide flex items-center gap-3">
              System Control Room
              {apiStatus === 'ONLINE' && (
                 <span className="flex h-3 w-3 relative">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00D2FF]"></span>
                 </span>
              )}
            </h1>
            <p className="text-xs md:text-sm text-[#6C84A3] mt-2 font-medium tracking-wide uppercase">Advanced Security Monitoring & Master Configuration</p>
          </div>
          <div className="flex gap-3">
             <button onClick={checkSystemHealth} className="bg-[#101726] border border-[#162749] text-[#F8FAFC] px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#0B152A] hover:border-[#00D2FF] transition-all shadow-sm flex items-center gap-2 group">
                <svg className={`w-4 h-4 text-[#00D2FF] group-hover:animate-spin ${apiStatus === 'Pinging...' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Run Diagnostics
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
           {/* SERVER NETWORK */}
           <div className={`p-6 rounded-xl border flex flex-col shadow-sm transition-all ${apiStatus === 'ONLINE' ? 'bg-[#101726] border-[#00D2FF]/30' : 'bg-[#101726] border-[#F43F5E]/50'}`}>
              <div className="flex justify-between items-center mb-4">
                <p className="text-[11px] uppercase font-semibold tracking-widest text-[#6C84A3]">Server Network</p>
                <span className={`w-2 h-2 rounded-full ${apiStatus === 'ONLINE' ? 'bg-[#00D2FF] shadow-[0_0_10px_#00D2FF]' : 'bg-[#F43F5E] shadow-[0_0_10px_#F43F5E]'}`}></span>
              </div>
              <h2 className={`text-2xl md:text-3xl font-bold tracking-tight ${apiStatus === 'ONLINE' ? 'text-[#00D2FF]' : 'text-[#F43F5E]'}`}>{apiStatus}</h2>
           </div>

           {/* DB HEALTH */}
           <div className={`p-6 rounded-xl border flex flex-col shadow-sm transition-all ${dbStatus.includes('SECURE') ? 'bg-[#101726] border-[#60A5FA]/30' : 'bg-[#101726] border-[#F43F5E]/50'}`}>
              <div className="flex justify-between items-center mb-4">
                <p className="text-[11px] uppercase font-semibold tracking-widest text-[#6C84A3]">Database Health</p>
                <svg className={`w-4 h-4 ${dbStatus.includes('SECURE') ? 'text-[#60A5FA]' : 'text-[#F43F5E]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              </div>
              <h2 className={`text-xl md:text-2xl font-bold tracking-tight mt-auto ${dbStatus.includes('SECURE') ? 'text-[#60A5FA]' : 'text-[#F43F5E]'}`}>{dbStatus}</h2>
           </div>

           {/* PING */}
           <div className="p-6 rounded-xl border border-[#162749] bg-[#101726] flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <p className="text-[11px] uppercase font-semibold tracking-widest text-[#6C84A3]">API Latency (Ping)</p>
                <svg className="w-4 h-4 text-[#6C84A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#F8FAFC] tracking-tight">{ping} <span className="text-sm md:text-lg text-[#6C84A3]">ms</span></h2>
           </div>
        </div>

        {/* LIVE HARDWARE MONITOR */}
        <div className="mb-8 p-6 md:p-8 rounded-2xl border border-[#162749] bg-[#0B152A] shadow-sm relative z-10">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#00D2FF]/10 flex items-center justify-center border border-[#00D2FF]/30">
                 <svg className="w-5 h-5 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
              </div>
              <h3 className="text-xl font-bold text-[#F8FAFC] tracking-wide">Live VPS Hardware Monitor</h3>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-[#101726] border border-[#162749] rounded-xl p-5 flex items-center justify-between shadow-inner">
                 <div>
                    <p className="text-[10px] text-[#6C84A3] font-semibold uppercase tracking-widest mb-1">CPU Load ({hardware.cpuCores || 0} Cores)</p>
                    <p className="text-2xl font-bold text-[#F43F5E]">{hardware.cpu}%</p>
                 </div>
                 <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                       <path className="text-[#030816] stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                       <path className="text-[#F43F5E] stroke-current transition-all duration-1000 ease-out" strokeWidth="3" strokeDasharray={`${hardware.cpu}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                 </div>
              </div>
              <div className="bg-[#101726] border border-[#162749] rounded-xl p-5 flex items-center justify-between shadow-inner">
                 <div>
                    <p className="text-[10px] text-[#6C84A3] font-semibold uppercase tracking-widest mb-1">RAM Usage</p>
                    <p className="text-2xl font-bold text-[#60A5FA]">{hardware.ram}%</p>
                    <p className="text-[10px] text-[#6C84A3] mt-1 font-mono font-medium">{hardware.ramDetails}</p>
                 </div>
                 <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                       <path className="text-[#030816] stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                       <path className="text-[#60A5FA] stroke-current transition-all duration-1000 ease-out" strokeWidth="3" strokeDasharray={`${hardware.ram}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                 </div>
              </div>
              <div className="bg-[#101726] border border-[#162749] rounded-xl p-5 flex items-center justify-between shadow-inner">
                 <div>
                    <p className="text-[10px] text-[#6C84A3] font-semibold uppercase tracking-widest mb-1">Disk Space (SSD)</p>
                    <p className="text-2xl font-bold text-[#00D2FF]">{hardware.disk === 'N/A' ? 'N/A' : `${hardware.disk}%`}</p>
                 </div>
                 <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                       <path className="text-[#030816] stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                       <path className="text-[#00D2FF] stroke-current transition-all duration-1000 ease-out" strokeWidth="3" strokeDasharray={`${hardware.disk === 'N/A' ? 0 : hardware.disk}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                 </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
           
           {/* GLOBAL CONFIGS */}
           <div className="bg-[#0B152A] border border-[#162749] rounded-2xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                 <div className="w-10 h-10 rounded-xl bg-[#60A5FA]/10 flex items-center justify-center border border-[#60A5FA]/30">
                    <svg className="w-5 h-5 text-[#60A5FA]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </div>
                 <h3 className="text-xl font-bold text-[#F8FAFC] tracking-wide">Global Configurations</h3>
              </div>

              <div className="space-y-6">

                {/* Secret Brand Masking Box */}
                <div className="bg-[#101726] p-5 rounded-xl border border-[#162749] relative overflow-hidden">
                   <div className="absolute top-0 right-0 bg-[#00D2FF] text-[#030816] text-[9px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">Security</div>
                   <div className="mb-4 mt-2">
                     <label className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#00D2FF] uppercase mb-2">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                       Secret Brand Masking (Hide Keywords)
                     </label>
                     <p className="text-xs text-[#6C84A3] mb-3 font-medium">Enter service names separated by commas. Name will show as <span className="text-[#00D2FF] font-mono bg-[#030816] px-1.5 rounded">******</span>.</p>
                     <div className="relative">
                        <textarea 
                           rows={2}
                           value={hiddenKeywords} 
                           onChange={(e)=>setHiddenKeywords(e.target.value)} 
                           placeholder="paypal, payoneer, wise, bank..." 
                           className="bg-[#030816] border border-[#162749] text-[#F8FAFC] p-3 rounded-lg w-full font-mono text-sm focus:outline-none focus:border-[#00D2FF] transition-colors shadow-inner resize-none placeholder:text-[#6C84A3]/50" 
                        />
                     </div>
                   </div>
                   <button onClick={handleKeywordsSave} className="w-full bg-[#00D2FF]/10 border border-[#00D2FF]/30 text-[#00D2FF] font-bold py-2.5 rounded-lg hover:bg-[#00D2FF] hover:text-[#030816] transition-all tracking-widest uppercase text-[11px]">Mask Keywords</button>
                </div>

                {/* 💥 BOSS UPGRADE: Dynamic Service Engine (CMS) Box 💥 */}
                <div className="bg-[#101726] p-5 rounded-xl border border-[#162749] relative overflow-hidden">
                   <div className="absolute top-0 right-0 bg-[#60A5FA] text-[#030816] text-[9px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">AI Engine</div>
                   <div className="mb-4 mt-2">
                     <label className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#60A5FA] uppercase mb-2">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       Dynamic Service Engine (CMS)
                     </label>
                     <p className="text-xs text-[#6C84A3] mb-3 font-medium">Enter custom service names separated by commas. Engine will detect and show exactly this instead of <span className="text-[#60A5FA] font-mono bg-[#030816] px-1.5 rounded">OTHER</span>.</p>
                     <div className="relative">
                        <textarea 
                           rows={2}
                           value={dynamicServices} 
                           onChange={(e)=>setDynamicServices(e.target.value)} 
                           placeholder="inDrive, bKash, Nagad, Airtel..." 
                           className="bg-[#030816] border border-[#162749] text-[#F8FAFC] p-3 rounded-lg w-full font-mono text-sm focus:outline-none focus:border-[#60A5FA] transition-colors shadow-inner resize-none placeholder:text-[#6C84A3]/50" 
                        />
                     </div>
                   </div>
                   <button onClick={handleDynamicServicesSave} className="w-full bg-[#60A5FA]/10 border border-[#60A5FA]/30 text-[#60A5FA] font-bold py-2.5 rounded-lg hover:bg-[#60A5FA] hover:text-[#030816] transition-all tracking-widest uppercase text-[11px]">Save Services</button>
                </div>

                {/* GLOBAL LINKS */}
                <div className="bg-[#101726] p-5 rounded-xl border border-[#162749]">
                   <div className="mb-4">
                     <label className="block text-[10px] font-bold tracking-widest text-[#6C84A3] uppercase mb-2">Global Telegram Support Link</label>
                     <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00D2FF] font-bold">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        </span>
                        <input type="text" value={globalSupportLink} onChange={(e)=>setGlobalSupportLink(e.target.value)} placeholder="https://t.me/Zenexacademy1" className="bg-[#030816] border border-[#162749] text-[#F8FAFC] pl-11 pr-4 py-3 rounded-lg w-full font-semibold text-sm focus:outline-none focus:border-[#00D2FF] transition-colors shadow-inner" />
                     </div>
                   </div>

                   <div className="mb-4">
                     <label className="block text-[10px] font-bold tracking-widest text-[#6C84A3] uppercase mb-2">Global Admin Contact Link</label>
                     <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#60A5FA] font-bold">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </span>
                        <input type="text" value={globalContactLink} onChange={(e)=>setGlobalContactLink(e.target.value)} placeholder="https://t.me/abdullah_124" className="bg-[#030816] border border-[#162749] text-[#F8FAFC] pl-11 pr-4 py-3 rounded-lg w-full font-semibold text-sm focus:outline-none focus:border-[#60A5FA] transition-colors shadow-inner" />
                     </div>
                   </div>

                   <button onClick={handleLinksSave} className="w-full bg-[#00D2FF] text-[#030816] font-bold py-3 rounded-lg shadow-[0_0_15px_rgba(0,210,255,0.3)] hover:shadow-[0_0_25px_rgba(0,210,255,0.5)] transition-all tracking-widest uppercase text-[11px]">Save Both Links</button>
                </div>

                {/* KILL SWITCH */}
                <div className={`p-5 rounded-xl border transition-all duration-300 ${maintenanceMode ? 'bg-[#F43F5E]/10 border-[#F43F5E]/50 shadow-[0_0_20px_rgba(244,63,94,0.15)]' : 'bg-[#101726] border-[#162749]'}`}>
                   <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${maintenanceMode ? 'bg-[#F43F5E]/20 text-[#F43F5E]' : 'bg-[#162749] text-[#6C84A3]'}`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div>
                          <p className={`text-sm font-bold tracking-wide ${maintenanceMode ? 'text-[#F43F5E]' : 'text-[#F8FAFC]'}`}>Kill Switch (Maintenance)</p>
                          <p className="text-[9px] text-[#6C84A3] mt-0.5 uppercase tracking-widest font-semibold">Instantly block all network traffic</p>
                        </div>
                     </div>
                     <button 
                       onClick={toggleMaintenance} 
                       className={`relative w-12 h-6 rounded-full flex items-center p-1 transition-colors duration-300 ${maintenanceMode ? 'bg-[#F43F5E]' : 'bg-[#162749]'}`}
                     >
                       <div className={`w-4 h-4 bg-[#F8FAFC] rounded-full transition-transform duration-300 shadow-md ${maintenanceMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                     </button>
                   </div>
                   {maintenanceMode && (
                      <p className="text-[10px] font-bold text-[#F43F5E] bg-[#F43F5E]/10 p-3 rounded border border-[#F43F5E]/20 animate-pulse mt-3 uppercase tracking-wide">
                        ⚠️ WARNING: System Offline. Users and Agents cannot access dashboard.
                      </p>
                   )}
                </div>
              </div>
           </div>

           {/* NETWORK FIREWALL */}
           <div className="bg-[#0B152A] border border-[#162749] rounded-2xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-[#00D2FF]/10 flex items-center justify-center border border-[#00D2FF]/30">
                      <svg className="w-5 h-5 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                   </div>
                   <h3 className="text-xl font-bold text-[#F8FAFC] tracking-wide">Network Firewall</h3>
                </div>
                <span className="bg-[#00D2FF]/10 text-[#00D2FF] px-3 py-1 rounded text-[9px] font-bold tracking-widest uppercase border border-[#00D2FF]/30">Active</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-[#101726] border border-[#162749] p-4 rounded-xl flex flex-col justify-center">
                    <span className="text-[9px] text-[#6C84A3] uppercase font-bold tracking-widest mb-1">Blocked IPs (24h)</span>
                    <span className="text-2xl font-bold text-[#60A5FA]">{blockedRequests}</span>
                 </div>
                 <div className="bg-[#101726] border border-[#162749] p-4 rounded-xl flex flex-col justify-center">
                    <span className="text-[9px] text-[#6C84A3] uppercase font-bold tracking-widest mb-1">Active Sessions (15m)</span>
                    <span className="text-2xl font-bold text-[#00D2FF]">{hardware.activeSessions}</span>
                 </div>
              </div>

              <div className="bg-[#101726] rounded-xl border border-[#162749] overflow-hidden">
                 <div className="bg-[#0B152A] px-4 py-3 border-b border-[#162749] flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#6C84A3] uppercase tracking-widest">Spam / Bot Logs</span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D2FF]"></span>
                    </span>
                 </div>
                 <div className="p-2 space-y-1">
                    <div className="flex items-center justify-between px-3 py-2 bg-[#030816] rounded-lg">
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-[#F43F5E] bg-[#F43F5E]/10 px-1.5 py-0.5 rounded border border-[#F43F5E]/20">BLOCKED</span>
                          <span className="text-[11px] text-[#F8FAFC] font-mono">192.168.x.x</span>
                       </div>
                       <span className="text-[9px] font-semibold text-[#6C84A3]">Auto-Ban (Spam)</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 bg-[#030816] rounded-lg">
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-[#60A5FA] bg-[#60A5FA]/10 px-1.5 py-0.5 rounded border border-[#60A5FA]/20">FILTERED</span>
                          <span className="text-[11px] text-[#F8FAFC] font-mono">45.22.x.x</span>
                       </div>
                       <span className="text-[9px] font-semibold text-[#6C84A3]">Cloudflare Bypass</span>
                    </div>
                 </div>
              </div>

           </div>

        </div>

      </div>
    </div>
  );
}