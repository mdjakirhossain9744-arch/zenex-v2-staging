"use client";

import { useState, useEffect } from "react";

export default function Profile() {
  const [toastMessage, setToastMessage] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [profileData, setProfileData] = useState({
    id: "ZX-000000",
    name: "Loading...",
    email: "Loading...",
    phone: "Not Set",
    address: "",
    lastLogin: "Just Now",
    status: "Pending",
    role: "user" 
  });

  const [agentData, setAgentData] = useState({
    name: "No Agent Assigned",
    telegram: "Not Provided",
    telegramLink: "#",
    email: "No Email",
    status: "Offline"
  });

  const [globalSupportLink, setGlobalSupportLink] = useState("https://t.me/Zenexacademy1");

  // API Key States
  const [apiKey, setApiKey] = useState("");
  const [isApiActive, setIsApiActive] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // 🔥 NEW: Lifetime Earning & Sessions State 🔥
  const [lifetimeEarning, setLifetimeEarning] = useState("0.00");
  const [loginSessions, setLoginSessions] = useState<any[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setProfileData(prev => ({
        ...prev,
        id: `ZX-${parsedUser.id.substring(parsedUser.id.length - 6).toUpperCase()}`,
        name: parsedUser.name || parsedUser.fullName,
        email: parsedUser.email,
        lastLogin: new Date().toLocaleString(),
        status: parsedUser.status === "pending" ? "Pending Approval" : "Account Active",
        role: parsedUser.role || "user" 
      }));

      // Database Fetch
      fetch("/api/get-user-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parsedUser.email })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setApiKey(data.user.apiKey || "");
          setIsApiActive(data.user.isApiActive || false);
          
          // Set Lifetime Earning (Fallback to 0.00 if not found)
          setLifetimeEarning(data.user.lifetimeEarning ? Number(data.user.lifetimeEarning).toFixed(2) : "0.00");

          setProfileData(prev => ({
            ...prev,
            phone: data.user.mobile || "Not Set",
            address: data.user.address || "",
            name: data.user.fullName || prev.name,
            role: data.user.role || prev.role 
          }));

          if (data.agent) {
             let validLink = data.agent.telegramLink || data.agent.telegram || "";
             if (validLink && validLink.startsWith("@")) {
                validLink = `https://t.me/${validLink.substring(1)}`;
             } else if (validLink && !validLink.startsWith("http://") && !validLink.startsWith("https://")) {
                validLink = `https://${validLink}`;
             }
             
             setAgentData({
                name: data.agent.fullName || "Your Assigned Agent",
                telegram: data.agent.telegramLink || data.agent.telegram || "Not Provided",
                email: data.agent.customAgentMail || data.agent.email,
                telegramLink: validLink || "#",
                status: "Online"
             });
          } else {
             setAgentData({
                name: "Admin Directly",
                telegram: "Admin Support",
                telegramLink: data.globalSupportLink || "https://t.me/Zenexacademy1",
                email: "admin@zenexnetwork.com",
                status: "Online"
             });
          }

          if (data.globalSupportLink) {
             setGlobalSupportLink(data.globalSupportLink);
          }
        }

        // Simulated/Fetched Sessions Data
        setLoginSessions([
          {
            when: "8/24/2026, 1:47:09 AM",
            ip: "2404:1c40:397:ec6:9853:790d:f3d:136c",
            device: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0",
            status: "Active"
          }
        ]);
      })
      .catch(err => console.error("Failed to fetch details"));
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone,
          address: profileData.address
        })
      });
      const data = await res.json();
      
      if (data.success) {
        showToast("Profile successfully updated!");
        setIsEditingProfile(false);
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        storedUser.name = profileData.name;
        localStorage.setItem("user", JSON.stringify(storedUser));
      } else {
        showToast("Failed to update profile.");
      }
    } catch (error) {
      showToast("Server Error.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleKey = () => {
    if (!isApiActive) {
      showToast("Access Denied! Contact your Admin to enable API.");
      return;
    }
    setShowKey(!showKey);
  };

  const handleCopyKey = () => {
    if (!isApiActive) {
      showToast("Access Denied! Contact Admin to enable.");
      return;
    }
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      showToast("API Key Copied to Clipboard!");
    }
  };

  return (
    <div className="pb-16 p-4 md:p-8 lg:p-10 w-full relative font-sans">
      
      {/* 💥 GLOBAL NOTIFICATION 💥 */}
      {toastMessage && (
        <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#0B152A] border-l-4 border-[#00D2FF] text-[#F8FAFC] px-5 py-3 rounded shadow-[0_10px_40px_-10px_rgba(0,210,255,0.3)] font-semibold flex items-center gap-3 animate-bounce-in max-w-sm">
           <div className="w-6 h-6 bg-[#00D2FF]/10 rounded-full flex items-center justify-center border border-[#00D2FF]/20 shrink-0">
              <svg className="w-3.5 h-3.5 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
           </div>
           <span className="text-xs tracking-wide">{toastMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
         
         {/* 💥 LEFT COLUMN 💥 */}
         <div className="lg:col-span-1 flex flex-col gap-6 md:gap-8">
            
            {/* WELCOME CARD */}
            <div className="bg-[#0B152A] border border-[#162749] rounded-3xl overflow-hidden shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)]">
               <div className="h-32 bg-gradient-to-r from-[#162749] to-[#0B152A] relative overflow-hidden">
                 <div className="absolute inset-0 opacity-30 bg-[linear-gradient(90deg,rgba(0,210,255,0.1)_1px,transparent_1px),linear-gradient(0deg,rgba(0,210,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                 <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#00D2FF] rounded-full blur-[80px] opacity-30"></div>
               </div>
               
               <div className="px-6 pb-8 relative -mt-12 flex flex-col items-center text-center">
                 <div className="w-24 h-24 bg-[#030816] rounded-full border-4 border-[#0B152A] p-1 flex items-center justify-center shadow-xl mb-4 relative">
                   <div className="w-full h-full bg-[#101726] border border-[#162749] rounded-full flex items-center justify-center shadow-[inset_0_1px_4px_rgba(0,210,255,0.1)]">
                      <svg className="w-10 h-10 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                   </div>
                   <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#0B152A] ${profileData.status === 'Account Active' ? 'bg-[#00D2FF] shadow-[0_0_8px_#00D2FF]' : 'bg-[#60A5FA]'}`}></div>
                 </div>
                 <h2 className="text-xl md:text-2xl font-bold text-[#F8FAFC] tracking-wide mb-1">
                   {profileData.name}
                 </h2>
                 <p className="text-[#6C84A3] text-[10px] md:text-xs font-mono mb-4 font-medium">
                   Last login: {profileData.lastLogin}
                 </p>
                 <span className={`${profileData.status === 'Account Active' ? 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/30' : 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/30'} border px-4 py-1.5 rounded text-[10px] font-bold tracking-widest uppercase shadow-[0_0_10px_rgba(0,210,255,0.05)]`}>
                   {profileData.status}
                 </span>
               </div>
            </div>

            {/* YOUR ASSIGNED AGENT CARD */}
            <div className="bg-[#0B152A] border border-[#162749] p-6 rounded-3xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#60A5FA] blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
               
               <div className="flex justify-between items-start border-b border-[#162749] pb-4 mb-4 relative z-10">
                 <h3 className="text-xs font-semibold text-[#6C84A3] uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#60A5FA]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Assigned Agent
                 </h3>
                 <span className="flex items-center gap-1.5 bg-[#00D2FF]/10 border border-[#00D2FF]/20 text-[#00D2FF] px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest">
                   <div className="w-1.5 h-1.5 bg-[#00D2FF] rounded-full animate-pulse shadow-[0_0_5px_#00D2FF]"></div>
                   {agentData.status}
                 </span>
               </div>

               <div className="space-y-4 relative z-10">
                  <div>
                     <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest block mb-1">Name</span>
                     <span className="text-sm font-bold text-[#F8FAFC] tracking-wide">{agentData.name}</span>
                  </div>
                  <div>
                     <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest block mb-1">Email</span>
                     <span className="text-xs font-medium text-[#60A5FA] tracking-wide">{agentData.email}</span>
                  </div>
                  <div>
                     <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest block mb-1">Telegram</span>
                     <span className="text-xs font-semibold text-[#00D2FF] font-mono tracking-wide">{agentData.telegram}</span>
                  </div>
                  
                  <a href={agentData.telegramLink} target="_blank" rel="noopener noreferrer" className="mt-3 bg-[#101726] border border-[#162749] hover:border-[#60A5FA]/50 text-[#60A5FA] hover:text-[#00D2FF] w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all group/btn text-xs tracking-widest uppercase">
                    <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.686c.223-.195-.054-.285-.346-.094l-6.4 4.024-2.76-.86c-.6-.188-.614-.6.125-.89l10.736-4.13c.495-.216.945.062.775 1.001z"/></svg>
                    Message Agent
                  </a>
               </div>
            </div>

            {/* GLOBAL SUPPORT CARD */}
            <div className="bg-[#0B152A] border border-[#162749] p-6 rounded-3xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] relative overflow-hidden group">
               <h3 className="text-xs font-semibold text-[#6C84A3] uppercase tracking-widest mb-2 relative z-10 flex items-center gap-2">
                 <svg className="w-4 h-4 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                 Global Support
               </h3>
               <p className="text-[11px] font-medium text-[#6C84A3] mb-4 relative z-10 leading-relaxed">Need help with APIs or network latency? Join the official Telegram community.</p>
               
               <a href={globalSupportLink} target="_blank" rel="noopener noreferrer" className="bg-[#101726] border border-[#162749] hover:border-[#00D2FF]/50 text-[#F8FAFC] hover:text-[#00D2FF] w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all text-xs tracking-widest uppercase shadow-sm">
                  Join Community
               </a>
            </div>

         </div>

         {/* 💥 RIGHT COLUMN 💥 */}
         <div className="lg:col-span-2 flex flex-col gap-6 md:gap-8">
            
            {/* 💥 NEW: LIFETIME EARNINGS CARD 💥 */}
            <div className="bg-[#0B152A] border border-[#162749] p-6 md:p-8 rounded-3xl shadow-[inset_0_1px_4px_rgba(0,210,255,0.02)] relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-48 h-48 bg-[#00D2FF] blur-[120px] opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none"></div>
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                  <div>
                     <h3 className="text-xs font-semibold text-[#6C84A3] uppercase tracking-widest flex items-center gap-2 mb-1.5">
                        <svg className="w-4 h-4 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Lifetime Network Earnings
                     </h3>
                     <p className="text-[10px] text-[#6C84A3] font-medium tracking-wide">Total accumulated revenue since account creation.</p>
                  </div>
                  <div className="bg-[#101726] border border-[#162749] px-6 py-3.5 rounded-2xl shadow-[inset_0_1px_4px_rgba(0,210,255,0.05)]">
                     <span className="text-3xl font-bold text-[#F8FAFC] tracking-tight drop-shadow-sm">${lifetimeEarning}</span>
                  </div>
               </div>
            </div>

            {/* 💥 DEVELOPER API ACCESS CARD 💥 */}
            {profileData.role === 'agent' ? (
              <div id="api-access" className="bg-[#0B152A] border border-[#162749] p-8 rounded-3xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] relative overflow-hidden text-center flex flex-col items-center justify-center scroll-mt-24">
                 <div className="w-16 h-16 bg-[#F43F5E]/10 rounded-full flex items-center justify-center mb-4 border border-[#F43F5E]/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                   <svg className="w-8 h-8 text-[#F43F5E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                   </svg>
                 </div>
                 <h3 className="text-base font-bold text-[#F8FAFC] tracking-widest mb-1.5 uppercase">API Access Restricted</h3>
                 <p className="text-[#6C84A3] font-medium text-xs max-w-sm leading-relaxed">API connectivity is disabled for Manager accounts. Only end-users and developers can generate or invoke API keys.</p>
              </div>
            ) : (
              <div id="api-access" className="bg-[#0B152A] border border-[#162749] p-6 md:p-8 rounded-3xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] relative overflow-hidden scroll-mt-24">
                 
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                   <h3 className="text-sm md:text-base font-bold text-[#F8FAFC] tracking-widest flex items-center gap-3 uppercase">
                      <div className="w-8 h-8 rounded-lg bg-[#00D2FF]/10 flex items-center justify-center border border-[#00D2FF]/20 shadow-[0_0_8px_rgba(0,210,255,0.1)]">
                        <svg className="w-4 h-4 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      </div>
                      Developer API Engine
                   </h3>
                   <span className={`px-3 py-1.5 rounded text-[9px] font-bold tracking-widest uppercase border ${isApiActive ? 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/30 shadow-[0_0_8px_rgba(0,210,255,0.1)]' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30'}`}>
                      {isApiActive ? "Status: Active" : "Status: Offline"}
                   </span>
                 </div>

                 {!isApiActive && (
                    <div className="mb-6 p-4 rounded-xl bg-[#F43F5E]/5 border border-[#F43F5E]/20 flex items-start gap-3">
                       <svg className="w-5 h-5 text-[#F43F5E] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                       <div>
                          <p className="text-xs font-bold text-[#F43F5E] tracking-wide">API Endpoint Disabled</p>
                          <p className="text-[10px] text-[#6C84A3] mt-1.5 font-medium leading-relaxed">To integrate our B2B SaaS API into your Telegram bots or automation software, special authorization is required. Please coordinate with your Network Manager.</p>
                       </div>
                    </div>
                 )}

                 <label className="block text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2.5">API Authentication Token</label>
                 <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-[#101726] border border-[#162749] rounded-xl flex items-center px-4 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]">
                       <input 
                         type={showKey ? "text" : "password"} 
                         readOnly 
                         value={apiKey ? (showKey ? apiKey : "ZNX_************************") : "Generating..."} 
                         className="bg-transparent w-full font-mono text-[#00D2FF] font-bold outline-none tracking-widest text-sm"
                       />
                       <button onClick={handleToggleKey} className="text-[#6C84A3] hover:text-[#00D2FF] ml-2 transition-colors" title="Toggle Visibility">
                          {showKey ? (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-1.593c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" /></svg>
                          ) : (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                       </button>
                    </div>
                    <button onClick={handleCopyKey} className="bg-[#00D2FF]/10 border border-[#00D2FF]/30 text-[#00D2FF] hover:bg-[#00D2FF] hover:text-[#030816] px-6 py-3 sm:py-0 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(0,210,255,0.05)] shrink-0">
                       Copy Key
                    </button>
                 </div>
                 <div className="mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <span className="text-[10px] font-semibold text-[#6C84A3]">⚠️ Do not expose this key publicly.</span>
                    <a href="/api-docs" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-[#60A5FA] hover:text-[#00D2FF] transition-colors uppercase tracking-widest flex items-center gap-1.5">
                      Read API Documentation <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </a>
                 </div>
              </div>
            )}

            {/* 💥 PERSONAL INFORMATION CARD 💥 */}
            <div className="bg-[#0B152A] border border-[#162749] p-6 md:p-8 rounded-3xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] relative overflow-hidden">
               
               <div className="flex justify-between items-center mb-6 border-b border-[#162749] pb-5">
                 <h3 className="text-sm md:text-base font-bold text-[#F8FAFC] tracking-widest flex items-center gap-2.5 uppercase">
                    <svg className="w-4 h-4 text-[#60A5FA]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Profile Configuration
                 </h3>
                 <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="text-[10px] font-bold text-[#00D2FF] hover:text-[#030816] hover:bg-[#00D2FF] border border-[#00D2FF]/40 bg-[#00D2FF]/5 px-4 py-2 rounded-lg transition-all tracking-widest uppercase">
                   {isEditingProfile ? "Cancel" : "Edit Details"}
                 </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div className="md:col-span-2 bg-[#101726] border border-[#162749] p-4 rounded-xl flex items-center justify-between shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
                    <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest">Account ID</span>
                    <span className="text-sm font-mono font-bold text-[#00D2FF] tracking-wider">{profileData.id}</span>
                 </div>

                 <div>
                    <label className="block text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">Full Name</label>
                    <input type="text" value={profileData.name} disabled={!isEditingProfile} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="w-full bg-[#101726] border border-[#162749] rounded-xl px-4 py-3 text-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] disabled:opacity-60 transition-colors font-medium text-sm" />
                 </div>
                 <div>
                    <label className="block text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">Phone Number</label>
                    <input type="text" value={profileData.phone} disabled={!isEditingProfile} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} className="w-full bg-[#101726] border border-[#162749] rounded-xl px-4 py-3 text-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] disabled:opacity-60 transition-colors font-medium text-sm" />
                 </div>
                 
                 <div className="md:col-span-2 relative group">
                    <label className="block text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">Email Address (Read Only)</label>
                    <input type="email" value={profileData.email} disabled className="w-full bg-[#101726]/50 border border-[#162749]/50 rounded-xl px-4 py-3 text-[#60A5FA]/70 cursor-not-allowed font-medium text-sm" />
                    <span className="absolute right-4 top-[38px] text-[9px] font-semibold text-[#F43F5E] opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Contact Admin to modify</span>
                 </div>
                 
                 <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">Postal Address</label>
                    <textarea rows={3} value={profileData.address} disabled={!isEditingProfile} onChange={(e) => setProfileData({...profileData, address: e.target.value})} placeholder="Enter your full address..." className="w-full bg-[#101726] border border-[#162749] rounded-xl px-4 py-3 text-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] disabled:opacity-60 transition-colors font-medium resize-none text-sm"></textarea>
                 </div>
               </div>

               {isEditingProfile && (
                 <div className="mt-8 pt-6 border-t border-[#162749] flex justify-end">
                   <button onClick={handleSaveProfile} disabled={isSaving} className="bg-[#00D2FF] text-[#030816] hover:bg-[#60A5FA] px-8 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(0,210,255,0.3)] tracking-widest disabled:opacity-50 text-xs uppercase">
                     {isSaving ? "SAVING..." : "COMMIT CHANGES"}
                   </button>
                 </div>
               )}
            </div>

         </div>
      </div>

      {/* 💥 NEW: LOGIN SESSIONS TABLE 💥 */}
      <div className="mt-6 bg-[#0B152A] border border-[#162749] rounded-3xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] overflow-hidden">
         <div className="p-5 md:p-6 border-b border-[#162749] bg-[#101726]">
            <h3 className="text-xs md:text-sm font-bold text-[#F8FAFC] uppercase tracking-widest flex items-center gap-2.5">
               <svg className="w-4 h-4 text-[#60A5FA]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
               Login Sessions & Activity
            </h3>
         </div>
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
               <thead className="bg-[#030816] text-[#6C84A3] uppercase text-[10px] tracking-widest border-b border-[#162749]">
                  <tr>
                     <th className="p-4 pl-6 font-semibold">When</th>
                     <th className="p-4 font-semibold">IP Address</th>
                     <th className="p-4 font-semibold">Device Info</th>
                     <th className="p-4 pr-6 font-semibold text-right">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-[#162749]/60 bg-[#0B152A]">
                  {loginSessions.map((session, i) => (
                     <tr key={i} className="hover:bg-[#101726] transition-colors">
                        <td className="p-4 pl-6 text-xs text-[#6C84A3] font-mono font-medium">{session.when}</td>
                        <td className="p-4 text-[11px] text-[#60A5FA] font-mono tracking-wide">{session.ip}</td>
                        <td className="p-4 text-xs text-[#F8FAFC] truncate max-w-[250px] font-medium" title={session.device}>{session.device}</td>
                        <td className="p-4 pr-6 text-right">
                           <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest border ${session.status === 'Active' ? 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/30 shadow-[0_0_8px_rgba(0,210,255,0.1)]' : 'bg-[#162749] text-[#6C84A3] border-[#334155]'}`}>
                              {session.status}
                           </span>
                        </td>
                     </tr>
                  ))}
                  {loginSessions.length === 0 && (
                     <tr>
                        <td colSpan={4} className="p-8 text-center text-[#6C84A3] font-medium text-xs">No session data available.</td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

    </div>
  );
}