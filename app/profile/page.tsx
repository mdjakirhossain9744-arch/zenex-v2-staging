"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout"; 

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
    status: "Pending"
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
        status: parsedUser.status === "pending" ? "Pending Approval" : "Account Active"
      }));

      // ডাটাবেস থেকে আসল ডাটা আনা
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
          setProfileData(prev => ({
            ...prev,
            phone: data.user.mobile || "Not Set",
            address: data.user.address || "",
            name: data.user.fullName || prev.name
          }));

          // এজেন্টের ডাটা সেট করা
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
                telegramLink: validLink || "#",
                email: data.agent.customAgentMail || data.agent.email,
                status: "Online"
             });
          } else {
             setAgentData({
                name: "Admin Directly",
                telegram: "Admin Support",
                telegramLink: data.globalSupportLink,
                email: "admin@zenexnetwork.com",
                status: "Online"
             });
          }

          // গ্লোবাল লিংক সেট করা
          if (data.globalSupportLink) {
             setGlobalSupportLink(data.globalSupportLink);
          }
        }
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
        showToast("✅ Profile successfully updated!");
        setIsEditingProfile(false);
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        storedUser.name = profileData.name;
        localStorage.setItem("user", JSON.stringify(storedUser));
      } else {
        showToast("❌ Failed to update profile.");
      }
    } catch (error) {
      showToast("❌ Server Error.");
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
    <DashboardLayout>
      <div className="pb-10 p-4 md:p-10 w-full relative selection:bg-[#8B5CF6] selection:text-white">
        
        {toastMessage && (
          <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#10B981] text-white px-5 py-3 rounded-lg shadow-lg font-semibold tracking-wide flex items-center gap-3 border border-[#10B981]/50 animate-bounce-in">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             {toastMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           
           <div className="lg:col-span-1 flex flex-col gap-8">
              
              <div className="bg-[#1E293B]/80 border border-[#334155] rounded-3xl overflow-hidden shadow-lg">
                 <div className="h-32 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] relative">
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')] opacity-20"></div>
                 </div>
                 
                 <div className="px-6 pb-8 relative -mt-12 flex flex-col items-center text-center">
                   <div className="w-24 h-24 bg-[#0F172A] rounded-full border-4 border-[#1E293B] p-1 flex items-center justify-center shadow-xl mb-4 relative">
                     <div className="w-full h-full bg-gradient-to-tr from-[#00C6FF] to-[#7000FF] rounded-full flex items-center justify-center text-3xl font-black text-white">
                       {profileData.name.charAt(0).toUpperCase()}
                     </div>
                     <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#0F172A] ${profileData.status === 'Pending Approval' ? 'bg-orange-500' : 'bg-[#10B981]'}`}></div>
                   </div>
                   <h2 className="text-2xl font-black text-white flex items-center gap-2">
                     Welcome back, <br/>{profileData.name}
                   </h2>
                   <p className="text-[#64748B] text-xs font-mono mt-2 mb-4">
                     Last login: {profileData.lastLogin}
                   </p>
                   <span className={`${profileData.status === 'Pending Approval' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'} px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase`}>
                     {profileData.status}
                   </span>
                 </div>
              </div>

              {/* YOUR ASSIGNED AGENT CARD */}
              <div className="bg-[#1E293B]/80 border border-[#334155] p-6 rounded-3xl shadow-lg relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#EAB308] blur-[80px] opacity-10"></div>
                 
                 <div className="flex justify-between items-start border-b border-[#334155] pb-4 mb-4 relative z-10">
                   <h3 className="text-sm font-black text-[#94A3B8] uppercase tracking-widest">Your Assigned Agent</h3>
                   <span className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">
                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                     {agentData.status}
                   </span>
                 </div>

                 <div className="space-y-4 relative z-10">
                    <div>
                       <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-0.5">Name</span>
                       <span className="text-base font-black text-white">{agentData.name}</span>
                    </div>
                    <div>
                       <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-0.5">Email</span>
                       <span className="text-sm font-medium text-[#EAB308]">{agentData.email}</span>
                    </div>
                    <div>
                       <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-0.5">Telegram</span>
                       <span className="text-sm font-bold text-[#3B82F6]">{agentData.telegram}</span>
                    </div>
                    
                    <a href={agentData.telegramLink} target="_blank" rel="noopener noreferrer" className="mt-2 bg-[#3B82F6]/10 hover:bg-[#3B82F6] border border-[#3B82F6]/30 text-[#3B82F6] hover:text-white w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all group">
                      <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.686c.223-.195-.054-.285-.346-.094l-6.4 4.024-2.76-.86c-.6-.188-.614-.6.125-.89l10.736-4.13c.495-.216.945.062.775 1.001z"/></svg>
                      Message Agent
                    </a>
                 </div>
              </div>

              {/* GLOBAL SUPPORT CARD */}
              <div className="bg-gradient-to-br from-[#1E293B] to-[#3B82F6]/5 border border-[#3B82F6]/20 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
                 <h3 className="text-sm font-black text-[#94A3B8] uppercase tracking-widest mb-2 relative z-10 flex items-center gap-2">
                   <svg className="w-5 h-5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   Global Support
                 </h3>
                 <p className="text-xs text-[#64748B] mb-4 relative z-10">Need help with APIs or the network? Join our official community.</p>
                 
                 <a href={globalSupportLink} target="_blank" rel="noopener noreferrer" className="bg-[#0F172A] border border-[#334155] hover:border-[#3B82F6] text-[#E2E8F0] hover:text-white w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all text-sm shadow-md">
                    Join Official Channel
                 </a>
              </div>

           </div>

           <div className="lg:col-span-2 flex flex-col gap-8">
              
              {/* 💥 Developer API Access Card (Added id="api-access") 💥 */}
              <div id="api-access" className="bg-[#0F172A] border border-[#334155] p-6 md:p-8 rounded-3xl shadow-[inset_0_0_40px_rgba(0,0,0,0.3)] relative overflow-hidden scroll-mt-24">
                 <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#8B5CF6] blur-[100px] opacity-20"></div>
                 
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-white tracking-widest flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center border border-[#8B5CF6]/30">
                        <svg className="w-5 h-5 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      </div>
                      Developer API Access
                   </h3>
                   <span className={`px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase border ${isApiActive ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20'}`}>
                      {isApiActive ? "Active" : "Inactive"}
                   </span>
                 </div>

                 {!isApiActive && (
                    <div className="mb-6 p-4 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 flex items-start gap-3">
                       <svg className="w-5 h-5 text-[#F43F5E] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                       <div>
                          <p className="text-sm font-bold text-[#F43F5E]">API Access is Currently Disabled</p>
                          <p className="text-[10px] text-[#94A3B8] mt-1">To use our B2B SaaS API for your Telegram bots or softwares, you need special permission. Please contact your assigned agent or the system admin to enable your API access.</p>
                       </div>
                    </div>
                 )}

                 <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Secret API Key (mapikey)</label>
                 <div className="flex gap-3">
                    <div className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl flex items-center px-4 py-3 shadow-inner">
                       <input 
                         type={showKey ? "text" : "password"} 
                         readOnly 
                         value={apiKey ? (showKey ? apiKey : "ZNX_************************") : "Generating..."} 
                         className="bg-transparent w-full font-mono text-[#8B5CF6] font-bold outline-none tracking-widest"
                       />
                       <button onClick={handleToggleKey} className="text-[#64748B] hover:text-[#E2E8F0] ml-2 transition-colors" title="Reveal Key">
                          {showKey ? (
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-1.593c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" /></svg>
                          ) : (
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                       </button>
                    </div>
                    <button onClick={handleCopyKey} className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#8B5CF6] hover:bg-[#8B5CF6] hover:text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                       Copy
                    </button>
                 </div>
                 <div className="mt-4 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#64748B]">Do not share this key with anyone.</span>
                    <a href="/api-docs" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-[#3B82F6] hover:underline uppercase tracking-widest flex items-center gap-1">
                      Read API Docs <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </a>
                 </div>
              </div>

              <div className="bg-[#1E293B]/80 border border-[#334155] p-6 md:p-8 rounded-3xl shadow-lg relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]"></div>
                 
                 <div className="flex justify-between items-center mb-8 border-b border-[#334155] pb-4">
                   <h3 className="text-lg font-black text-white tracking-widest flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Personal Information
                   </h3>
                   <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="text-xs font-bold text-[#3B82F6] hover:text-white bg-[#3B82F6]/10 px-4 py-2 rounded-lg transition-colors">
                     {isEditingProfile ? "Cancel" : "Edit Profile"}
                   </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="md:col-span-2 bg-[#0F172A] border border-[#334155] p-4 rounded-xl flex items-center justify-between">
                      <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Account ID</span>
                      <span className="text-sm font-mono font-black text-[#8B5CF6] tracking-wider">{profileData.id}</span>
                   </div>

                   <div>
                      <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Full Name</label>
                      <input type="text" value={profileData.name} disabled={!isEditingProfile} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 transition-colors font-bold" />
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Phone Number</label>
                      <input type="text" value={profileData.phone} disabled={!isEditingProfile} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 transition-colors font-bold" />
                   </div>
                   <div className="md:col-span-2 relative group">
                      <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Email Address (Read Only)</label>
                      <input type="email" value={profileData.email} disabled className="w-full bg-[#0F172A]/50 border border-[#334155]/50 rounded-xl px-4 py-3 text-[#EAB308]/70 cursor-not-allowed font-medium" />
                      <span className="absolute right-4 top-[38px] text-[10px] text-[#F43F5E] opacity-0 group-hover:opacity-100 transition-opacity">Contact Admin to change</span>
                   </div>
                   <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Postal Address</label>
                      <textarea rows={3} value={profileData.address} disabled={!isEditingProfile} onChange={(e) => setProfileData({...profileData, address: e.target.value})} placeholder="Enter your full address..." className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 transition-colors font-medium resize-none"></textarea>
                   </div>
                 </div>

                 {isEditingProfile && (
                   <div className="mt-8 pt-6 border-t border-[#334155] flex justify-end">
                     <button onClick={handleSaveProfile} disabled={isSaving} className="bg-gradient-to-r from-[#10B981] to-[#059669] text-white px-8 py-3 rounded-xl font-black transition-all shadow-lg hover:-translate-y-1 tracking-wider disabled:opacity-50">
                       {isSaving ? "SAVING..." : "SAVE CHANGES"}
                     </button>
                   </div>
                 )}
              </div>

           </div>

        </div>
      </div>
    </DashboardLayout>
  );
}