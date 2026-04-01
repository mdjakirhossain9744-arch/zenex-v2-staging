"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout";

export default function TopUser() {
  const [role, setRole] = useState("user");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  const [usersList, setUsersList] = useState<any[]>([]);
  const [myRank, setMyRank] = useState({ rank: 0, name: "Loading...", score: 0 });

  // 💥 Admin Controller States 💥
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(true); // 💥 নতুন: পেজ অন/অফ সুইচ
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerText, setBannerText] = useState("Top 1 user at the end of the week receives");
  const [bannerPrize, setBannerPrize] = useState("1000 BDT");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setRole(parsedUser.role);
      setUserEmail(parsedUser.email);
      fetchLeaderboardData(parsedUser.email);
    }
  }, []);

  const fetchLeaderboardData = async (email: string) => {
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FETCH", email })
      });
      const data = await res.json();

      if (data.success) {
        setUsersList(data.topUsersList);
        setMyRank(data.myRank);
        if (data.settings) {
          setIsLeaderboardOpen(data.settings.isLeaderboardOpen ?? true);
          setBannerActive(data.settings.bannerActive ?? false);
          setBannerText(data.settings.bannerText ?? "Top 1 user at the end of the week receives");
          setBannerPrize(data.settings.bannerPrize ?? "1000 BDT");
        }
      }
    } catch (err) {
      console.error("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const saveBannerSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           action: "UPDATE_BANNER", 
           isLeaderboardOpen, // 💥 পেজ লক সেভ করা হচ্ছে
           bannerActive, 
           bannerText, 
           bannerPrize 
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Leaderboard Settings Updated Successfully!");
      } else {
        showToast(data.message || "Error updating settings.");
      }
    } catch (error) {
      showToast("Network Error!");
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Tiers Setup
  const topTier = usersList.slice(0, 100);
  const midTier = usersList.slice(100, 200);
  const baseTier = usersList.slice(200, 300);

  return (
    <DashboardLayout>
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-[#EAB308] rounded-full blur-[200px] opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-[#F43F5E] rounded-full blur-[200px] opacity-[0.05] pointer-events-none"></div>

      <div className="p-4 md:p-10 w-full relative z-10 pb-28 md:pb-24">
        
        {toastMessage && (
          <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#10B981] text-white px-5 py-3 rounded-lg shadow-lg font-bold flex items-center gap-3 animate-bounce-in">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             {toastMessage}
          </div>
        )}

        {/* 👑 ADMIN CONTROLS 👑 */}
        {role === "admin" && (
          <div className="mb-10 bg-[#1E293B]/80 border border-[#3B82F6]/50 p-6 rounded-2xl shadow-lg border-t-4 border-t-[#3B82F6]">
             <h3 className="text-[#3B82F6] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               Admin Leaderboard Control
             </h3>
             
             {/* 💥 Main Leaderboard Toggle 💥 */}
             <div className="flex items-center justify-between bg-[#0F172A] p-4 rounded-xl border border-[#334155] mb-6">
                <div>
                   <h4 className="text-sm font-black text-white uppercase tracking-widest">Global Leaderboard Status</h4>
                   <p className="text-[10px] text-[#64748B] mt-0.5">Turn off to completely hide this page from all users and agents.</p>
                </div>
                <label className="flex items-center cursor-pointer">
                   <div className="relative">
                     <input type="checkbox" checked={isLeaderboardOpen} onChange={() => setIsLeaderboardOpen(!isLeaderboardOpen)} className="sr-only" />
                     <div className={`block w-14 h-8 rounded-full transition-colors ${isLeaderboardOpen ? 'bg-[#10B981]' : 'bg-[#F43F5E]'}`}></div>
                     <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isLeaderboardOpen ? 'transform translate-x-6' : ''}`}></div>
                   </div>
                </label>
             </div>

             {/* Banner Controls */}
             <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 items-end transition-opacity ${!isLeaderboardOpen ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                   <label className="block text-[10px] font-bold text-[#94A3B8] mb-1.5 uppercase">Offer Banner Text</label>
                   <input type="text" value={bannerText} onChange={(e) => setBannerText(e.target.value)} className="w-full bg-[#0F172A] border border-[#334155] px-4 py-2.5 rounded-lg text-white text-sm focus:border-[#3B82F6] outline-none" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-[#94A3B8] mb-1.5 uppercase">Prize Amount</label>
                   <input type="text" value={bannerPrize} onChange={(e) => setBannerPrize(e.target.value)} className="w-full bg-[#0F172A] border border-[#334155] px-4 py-2.5 rounded-lg text-white text-sm focus:border-[#EAB308] outline-none" />
                </div>
                <div className="flex items-center gap-4 pb-1">
                   <label className="flex items-center gap-2 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" checked={bannerActive} onChange={() => setBannerActive(!bannerActive)} className="sr-only" />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${bannerActive ? 'bg-[#EAB308]' : 'bg-[#334155]'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${bannerActive ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-[10px] font-bold text-white uppercase">{bannerActive ? "Banner ON" : "Banner OFF"}</span>
                   </label>
                   <button onClick={saveBannerSettings} disabled={isSaving} className="ml-auto bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50">
                     {isSaving ? "Saving..." : "Save All"}
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* 💥 PAGE LOCK VIEW FOR USERS 💥 */}
        {!isLeaderboardOpen && role !== "admin" && !loading ? (
           <div className="flex flex-col items-center justify-center py-20 md:py-32 text-center animate-fade-in">
             <div className="w-24 h-24 bg-[#F43F5E]/10 rounded-full flex items-center justify-center mb-6 border border-[#F43F5E]/30 relative">
               <div className="absolute inset-0 rounded-full border-t-2 border-[#F43F5E] animate-spin opacity-50"></div>
               <svg className="w-10 h-10 text-[#F43F5E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
             </div>
             <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">Leaderboard is Offline</h2>
             <p className="text-[#94A3B8] max-w-md mx-auto font-medium leading-relaxed">
               The system administrator has temporarily disabled the leaderboard. All rankings and scores are safely preserved. Please check back later!
             </p>
           </div>
        ) : (
          /* 💥 NORMAL LEADERBOARD UI 💥 */
          <div className={`${!isLeaderboardOpen && role === "admin" ? 'opacity-50 grayscale' : ''}`}>
            
            {/* Header Section */}
            <div className="mb-10 text-center md:text-left flex flex-col md:flex-row justify-between md:items-end gap-6 border-b border-[#334155] pb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#EAB308] to-[#F59E0B] tracking-tight mb-2">
                  Daily Top Performers
                </h2>
                {bannerActive ? (
                  <p className="text-[#94A3B8] text-sm md:text-base font-medium animate-pulse">
                    {bannerText} <span className="text-white font-bold bg-[#EAB308]/20 px-2 py-0.5 rounded ml-1">{bannerPrize}</span> 🔥
                  </p>
                ) : (
                  <p className="text-[#64748B] text-sm md:text-base font-medium">
                    Compete with other users and reach the top rank by generating more OTPs!
                  </p>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20 text-[#EAB308] font-black text-xl animate-pulse">
                Loading Real-Time Rankings...
              </div>
            ) : usersList.length === 0 ? (
              <div className="flex justify-center items-center py-20 text-[#64748B] font-bold">
                No users have generated OTPs yet today.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 pb-10">
                {/* 🥇 Top Tier */}
                <div className="flex flex-col">
                   <div className="bg-gradient-to-r from-[#EAB308]/20 to-transparent border-l-4 border-[#EAB308] p-4 rounded-t-xl mb-4 flex items-center justify-between">
                     <div>
                       <h3 className="text-lg font-black text-white flex items-center gap-2">🥇 Top Tier</h3>
                       <span className="text-xs text-[#EAB308] font-bold">Rank 1 - 100</span>
                     </div>
                   </div>
                   <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                     {topTier.map((user) => (
                       <div key={user.rank} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                         user.rank === 1 ? "bg-gradient-to-r from-[#EAB308]/10 to-[#F59E0B]/5 border-[#EAB308]/50 shadow-[0_0_20px_rgba(234,179,8,0.15)] transform scale-[1.02]" : 
                         user.rank <= 3 ? "bg-[#1E293B]/80 border-[#334155] hover:border-[#EAB308]/30" : "bg-[#0F172A]/80 border-[#1E293B] hover:border-[#334155]"
                       }`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                              user.rank === 1 ? "bg-[#EAB308] text-black shadow-lg" : 
                              user.rank === 2 ? "bg-[#94A3B8] text-black" : 
                              user.rank === 3 ? "bg-[#B45309] text-white" : "bg-[#1E293B] text-[#64748B]"
                            }`}>
                              {user.rank === 1 ? "👑" : `#${user.rank}`}
                            </div>
                            <span className={`font-bold ${user.rank === 1 ? "text-[#EAB308] text-lg" : "text-white"}`}>{user.name}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-black text-white font-mono">{user.score.toLocaleString()}</span>
                            <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-widest">OTPs</span>
                          </div>
                       </div>
                     ))}
                   </div>
                </div>

                {/* 🥈 Mid Tier */}
                {midTier.length > 0 && (
                  <div className="flex flex-col opacity-90">
                     <div className="bg-gradient-to-r from-[#3B82F6]/20 to-transparent border-l-4 border-[#3B82F6] p-4 rounded-t-xl mb-4 flex items-center justify-between">
                       <div>
                         <h3 className="text-lg font-black text-white flex items-center gap-2">🥈 Mid Tier</h3>
                         <span className="text-xs text-[#3B82F6] font-bold">Rank 101 - 200</span>
                       </div>
                     </div>
                     <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                       {midTier.map((user) => (
                         <div key={user.rank} className="flex items-center justify-between p-3.5 rounded-xl bg-[#0F172A]/50 border border-[#1E293B] hover:border-[#334155] transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded bg-[#1E293B] flex items-center justify-center font-bold text-xs text-[#64748B]">{user.rank}</div>
                              <span className="font-semibold text-[#94A3B8] text-sm">{user.name}</span>
                            </div>
                            <span className="text-sm font-black text-white font-mono">{user.score.toLocaleString()}</span>
                         </div>
                       ))}
                     </div>
                  </div>
                )}

                {/* 🥉 Base Tier */}
                {baseTier.length > 0 && (
                  <div className="flex flex-col opacity-70 hover:opacity-100 transition-opacity">
                     <div className="bg-gradient-to-r from-[#64748B]/20 to-transparent border-l-4 border-[#64748B] p-4 rounded-t-xl mb-4 flex items-center justify-between">
                       <div>
                         <h3 className="text-lg font-black text-white flex items-center gap-2">🥉 Base Tier</h3>
                         <span className="text-xs text-[#94A3B8] font-bold">Rank 201 - 300</span>
                       </div>
                     </div>
                     <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                       {baseTier.map((user) => (
                         <div key={user.rank} className="flex items-center justify-between p-3 rounded-lg bg-transparent border border-[#1E293B]/50 hover:bg-[#0F172A] transition-all">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-[#64748B] w-6 text-right">{user.rank}.</span>
                              <span className="font-medium text-[#64748B] text-xs">{user.name}</span>
                            </div>
                            <span className="text-xs font-bold text-[#94A3B8] font-mono">{user.score}</span>
                         </div>
                       ))}
                     </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* 🔥 Your Rank Bottom Floating Bar 🔥 */}
      {!loading && isLeaderboardOpen && role === "user" && myRank.rank > 0 && (
        <div className="fixed bottom-0 md:bottom-4 left-0 md:left-[272px] right-0 md:right-4 bg-[#EAB308] p-1 md:rounded-2xl z-50 shadow-[0_-10px_30px_rgba(234,179,8,0.2)]">
          <div className="bg-[#0F172A] w-full h-full md:rounded-xl p-4 flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-full bg-[#EAB308] flex items-center justify-center text-xl font-black text-black shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                #{myRank.rank}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-[#EAB308] uppercase tracking-widest">Your Current Position</span>
                <span className="text-xl font-black text-white">{myRank.name}</span>
              </div>
            </div>

            <div className="flex flex-col items-end relative z-10">
               <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Today's OTPs</span>
               <div className="flex items-center gap-2">
                 <span className="text-2xl font-black text-white font-mono">{myRank.score.toLocaleString()}</span>
                 <svg className="w-5 h-5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
               </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}