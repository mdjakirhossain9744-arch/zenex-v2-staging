"use client";

import DashboardLayout from "../DashboardLayout";

export default function TopUser() {
  // ডেমো ইউজার ডাটা জেনারেট করার লজিক
  const generateUsers = () => {
    const users = [];
    for (let i = 1; i <= 300; i++) {
      users.push({
        rank: i,
        name: i === 1 ? "siyam11" : `User_${Math.floor(Math.random() * 90000) + 10000}`,
        score: Math.floor(10000 / Math.pow(i, 0.6)), 
      });
    }
    return users;
  };

  const usersList = generateUsers();
  const topTier = usersList.slice(0, 100);
  const midTier = usersList.slice(100, 200);
  const baseTier = usersList.slice(200, 300);

  // নিজের ডাটা (Bottom Bar এর জন্য)
  const myRank = { rank: 1, name: "siyam11", score: 10000 };

  return (
    <DashboardLayout>
      {/* 🏆 Top User পেজের স্পেশাল ব্যাকগ্রাউন্ড কালার */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-[#EAB308] rounded-full blur-[200px] opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-[#F43F5E] rounded-full blur-[200px] opacity-[0.05] pointer-events-none"></div>

      {/* মেইন কন্টেন্ট */}
      <div className="p-4 md:p-10 w-full relative z-10 pb-28 md:pb-24">
        
        {/* Header Section */}
        <div className="mb-10 text-center md:text-left flex flex-col md:flex-row justify-between md:items-end gap-6 border-b border-[#334155] pb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#EAB308] to-[#F59E0B] tracking-tight mb-2">
              Weekly Leaderboard
            </h2>
            <p className="text-[#94A3B8] text-sm md:text-base font-medium">
              Top 1 user at the end of the week receives <span className="text-white font-bold bg-[#EAB308]/20 px-2 py-0.5 rounded">1000 BDT</span> directly to their wallet!
            </p>
          </div>
          
          <div className="bg-[#1E293B] border border-[#334155] px-6 py-4 rounded-2xl flex flex-col items-center shadow-lg">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1">Ends In</span>
            <div className="flex gap-3 text-2xl font-black text-white font-mono">
              <div className="flex flex-col items-center"><span className="bg-[#0F172A] px-3 py-2 rounded-lg border border-[#334155] text-[#3B82F6]">04</span><span className="text-[9px] text-[#64748B] mt-1">DAYS</span></div>
              <span className="mt-2">:</span>
              <div className="flex flex-col items-center"><span className="bg-[#0F172A] px-3 py-2 rounded-lg border border-[#334155] text-[#3B82F6]">12</span><span className="text-[9px] text-[#64748B] mt-1">HRS</span></div>
              <span className="mt-2">:</span>
              <div className="flex flex-col items-center"><span className="bg-[#0F172A] px-3 py-2 rounded-lg border border-[#334155] text-[#3B82F6]">45</span><span className="text-[9px] text-[#64748B] mt-1">MINS</span></div>
            </div>
          </div>
        </div>

        {/* 3 Columns Layout for Tiers */}
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

          {/* 🥉 Base Tier */}
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

        </div>
      </div>

      {/* 🔥 Your Rank Bottom Floating Bar 🔥 */}
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
             <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Total OTPs</span>
             <div className="flex items-center gap-2">
               <span className="text-2xl font-black text-white font-mono">{myRank.score.toLocaleString()}</span>
               <svg className="w-5 h-5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
             </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}