"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout"; 

export default function Profile() {
  const [toastMessage, setToastMessage] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  const [profileData, setProfileData] = useState({
    id: "ZX-000000",
    name: "Loading...",
    email: "Loading...",
    phone: "Loading...",
    address: "",
    lastLogin: "Just Now",
    status: "Pending"
  });

  // ডিফল্ট অ্যাডমিন ডাটা (যদি কোনো এজেন্ট না থাকে)
  const [agentData, setAgentData] = useState({
    name: "Zenex Admin",
    telegram: "@zenex_official_support",
    telegramLink: "https://t.me/zenex_official_support",
    email: "admin@zenexnetwork.com",
    status: "Online"
  });

  const networkSupport = "https://t.me/zenex_official_support";

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setProfileData({
        id: `ZX-${parsedUser.id.substring(parsedUser.id.length - 6).toUpperCase()}`,
        name: parsedUser.name,
        email: parsedUser.email,
        phone: parsedUser.mobile || "Not Set", 
        address: "Dhaka, Bangladesh", 
        lastLogin: new Date().toLocaleString(),
        status: parsedUser.status === "pending" ? "Pending Approval" : "Account Active"
      });

      // 💥 ম্যাজিক: ডাটাবেস থেকে ইউজারের আসল এজেন্টের ডাটা খুঁজে বের করা হচ্ছে 💥
      fetch("/api/get-all-users")
        .then(res => res.json())
        .then(data => {
          if (data.users) {
            // ডাটাবেস থেকে সেই এজেন্টকে খোঁজো যার মেইল ইউজারের agentEmail এর সাথে মিলে যায়
            const realAgent = data.users.find((u: any) => 
              (u.email === parsedUser.agentEmail || u.customAgentMail === parsedUser.agentEmail) && 
              (u.role === "agent" || u.role === "admin")
            );

            if (realAgent && realAgent.email !== "admin@zenexnetwork.com") {
               let validLink = realAgent.telegramLink || "https://t.me/zenex_official_support";
               
               // টেলিগ্রাম লিংক ঠিকঠাক করা
               if (validLink.startsWith("@")) {
                  validLink = `https://t.me/${validLink.substring(1)}`;
               } else if (!validLink.startsWith("http://") && !validLink.startsWith("https://") && validLink !== "") {
                  validLink = `https://${validLink}`;
               }

               // 💥 এজেন্টের আসল ডাটা প্রোফাইলে সেট করা হলো 💥
               setAgentData({
                  name: realAgent.name || "Your Assigned Agent",
                  telegram: realAgent.telegramLink || "@AgentSupport",
                  telegramLink: validLink,
                  email: realAgent.customAgentMail || realAgent.email,
                  status: "Online"
               });
            }
          }
        })
        .catch(err => console.error("Failed to fetch agent data:", err));
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleSaveProfile = () => {
    setIsEditingProfile(false);
    showToast("Profile changes will be saved to Database soon!");
  };

  return (
    <DashboardLayout>
      <div className="pb-10 p-4 md:p-10 w-full relative">
        
        {toastMessage && (
          <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#10B981] text-white px-5 py-3 rounded-lg shadow-lg font-semibold tracking-wide flex items-center gap-3 border border-[#10B981]/50">
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

              {/* 💥 YOUR ASSIGNED AGENT CARD 💥 */}
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

              <div className="bg-gradient-to-br from-[#1E293B] to-[#3B82F6]/5 border border-[#3B82F6]/20 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
                 <h3 className="text-sm font-black text-[#94A3B8] uppercase tracking-widest mb-2 relative z-10 flex items-center gap-2">
                   <svg className="w-5 h-5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   Global Support
                 </h3>
                 <p className="text-xs text-[#64748B] mb-4 relative z-10">Need help with APIs or the network? Join our official community.</p>
                 
                 <a href={networkSupport} target="_blank" rel="noopener noreferrer" className="bg-[#0F172A] border border-[#334155] hover:border-[#3B82F6] text-[#E2E8F0] hover:text-white w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all text-sm shadow-md">
                    Join Official Channel
                 </a>
              </div>

           </div>

           <div className="lg:col-span-2 flex flex-col gap-8">
              
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
                   <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Email Address</label>
                      <input type="email" value={profileData.email} disabled={!isEditingProfile} onChange={(e) => setProfileData({...profileData, email: e.target.value})} className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#EAB308] focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 transition-colors font-medium" />
                   </div>
                   <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Postal Address</label>
                      <textarea rows={3} value={profileData.address} disabled={!isEditingProfile} onChange={(e) => setProfileData({...profileData, address: e.target.value})} placeholder="Enter your full address..." className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3B82F6] disabled:opacity-60 transition-colors font-medium resize-none"></textarea>
                   </div>
                 </div>

                 {isEditingProfile && (
                   <div className="mt-8 pt-6 border-t border-[#334155] flex justify-end">
                     <button onClick={handleSaveProfile} className="bg-gradient-to-r from-[#10B981] to-[#059669] text-white px-8 py-3 rounded-xl font-black transition-all shadow-lg hover:-translate-y-1 tracking-wider">
                       SAVE CHANGES
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