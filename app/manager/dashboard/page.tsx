"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import DashboardLayout from "../../DashboardLayout"; 

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch(e) { return new Date().toISOString().split('T')[0]; }
};

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [liveRate, setLiveRate] = useState<number>(0.00);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");

  const [stats, setStats] = useState({ balance: "0.00", todayTotal: 0, todaySuccess: 0 });
  const [topApps, setTopApps] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]); 
  const [trafficData, setTrafficData] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [globalTrafficData, setGlobalTrafficData] = useState<number[]>([0, 0, 0, 0, 0, 0]);

  const formatTopApps = (countsObj: Record<string, number>) => {
    return Object.entries(countsObj).map(([name, count]) => {
      let info = { icon: "N", text: "text-[#E2E8F0]", bg: "bg-[#334155]/30" };
      if (name === "Facebook") info = { icon: "F", text: "text-[#1877F2]", bg: "bg-[#1877F2]/10" };
      else if (name === "WhatsApp") info = { icon: "W", text: "text-[#25D366]", bg: "bg-[#25D366]/10" };
      else if (name === "Instagram") info = { icon: "IG", text: "text-[#E1306C]", bg: "bg-[#E1306C]/10" };
      else if (name === "Telegram") info = { icon: "TG", text: "text-[#0088cc]", bg: "bg-[#0088cc]/10" };
      else if (name === "Google") info = { icon: "G", text: "text-[#EA4335]", bg: "bg-[#EA4335]/10" };
      else if (name === "TikTok") info = { icon: "T", text: "text-[#00F2FE]", bg: "bg-[#00F2FE]/10" };
      else if (name === "Apple") info = { icon: "A", text: "text-[#A3AAAE]", bg: "bg-[#A3AAAE]/10" };
      return { name, count, info };
    }).sort((a, b) => b.count - a.count).slice(0, 3); 
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[now.getUTCMonth()];
      setCurrentTime(`${hours}:${minutes}:${seconds} UTC - ${day} ${month}`);
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { router.replace("/login"); return; }
    
    const parsedUser = JSON.parse(storedUser);
    
    if (parsedUser.role !== "agent") {
      router.replace(parsedUser.role === "admin" ? "/admin/dashboard" : "/dashboard"); 
      return;
    }

    setUser(parsedUser);
    setLiveRate(Number(parsedUser.agentMaxRate || 0));

    const todayStr = getUTCDateString();

    const fetchAgentDashboardData = async () => {
      try {
        fetch("/api/summary-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email, role: "admin" }) })
          .then(r => r.json())
          .then(res => { if (res && res.todayHourlyTraffic) setGlobalTrafficData(res.todayHourlyTraffic); })
          .catch(() => {});

        const [agentSummaryRes, userDetailsRes] = await Promise.all([
          fetch("/api/agent-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }).then(r => r.json()),
          fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }).then(r => r.json())
        ]);

        if (userDetailsRes && userDetailsRes.user) {
           setStats(p => ({ ...p, balance: Number(userDetailsRes.user.balance || 0).toFixed(2) }));
           setLiveRate(Number(userDetailsRes.user.agentMaxRate || 0)); 
        }

        if (agentSummaryRes && agentSummaryRes.success) {
           const todayData = agentSummaryRes.groupedRawData[todayStr] || { total: 0, success: 0 };
           setStats(p => ({ ...p, todayTotal: todayData.total, todaySuccess: todayData.success }));
           if (agentSummaryRes.todayAppCounts) setTopApps(formatTopApps(agentSummaryRes.todayAppCounts));
           if (agentSummaryRes.todayHourlyTraffic) setTrafficData(agentSummaryRes.todayHourlyTraffic);
           if (agentSummaryRes.topPerformers) setTopUsers(agentSummaryRes.topPerformers); 
        }
      } catch (e) {} finally { setIsPageLoading(false); }
    };

    fetchAgentDashboardData();
    const interval = setInterval(fetchAgentDashboardData, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const generateTrafficPath = (data: number[]) => {
    const maxVal = Math.max(...data, 1); 
    const points = data.map((v, i) => { const x = i * 160; const y = 130 - (v / maxVal) * 110; return { x, y }; });
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1]; const p1 = points[i];
      path += ` C ${p0.x + 80},${p0.y} ${p1.x - 80},${p1.y} ${p1.x},${p1.y}`;
    }
    return path;
  };

  if (isPageLoading) return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-[#334155] border-t-[#A855F7] rounded-full animate-spin mb-4"></div>
        <p className="text-[#94A3B8] font-bold tracking-widest uppercase text-sm">Loading Agent Network...</p>
      </div>
    </DashboardLayout>
  );

  const userName = user?.name ? user.name.split(" ")[0] : "Agent";
  
  const highestOTP = topUsers.length > 0 ? topUsers[0].otpCount : 0; 
  let maxScale = 36; 
  while (maxScale <= highestOTP && highestOTP > 0) { maxScale += 12; }
  const axisLabels = [0, maxScale * 0.25, maxScale * 0.50, maxScale * 0.75, maxScale];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full font-sans">
        
        {/* Header */}
        <div className="mb-6 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Welcome back, <span className="text-[#A855F7]">{userName}!</span>
            </h2>
            <p className="text-[#94A3B8] mt-1 md:mt-2 text-xs md:text-sm font-medium tracking-wide">
              Here is your team's live performance and commission.
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
             {currentTime && (
               <div className="px-3 py-1.5 md:px-4 md:py-2 bg-[#0F172A] border border-[#334155] rounded-lg shadow-inner text-[10px] md:text-[11px] font-black tracking-widest text-[#94A3B8] flex items-center gap-2">
                 <svg className="w-3.5 h-3.5 text-[#A855F7] animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 {currentTime}
               </div>
             )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-10">
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#3B82F6] flex flex-col items-center md:items-start">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Total Balance</h3>
            <p className="text-xl md:text-3xl font-black text-[#F8FAFC]">৳ {stats.balance}</p>
          </div>
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#00C6FF] flex flex-col items-center md:items-start">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Admin Given Rate</h3>
            <p className="text-xl md:text-3xl font-black text-[#00C6FF]">৳ {Number(liveRate).toFixed(2)}</p>
          </div>
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#F59E0B] flex flex-col items-center md:items-start">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Network Today's Numbers</h3>
            <p className="text-xl md:text-3xl font-black text-[#F59E0B]">{stats.todayTotal}</p>
          </div>
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#10B981] flex flex-col items-center md:items-start relative overflow-hidden">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Today's Success OTP</h3>
            <div className="flex items-center gap-2">
               <p className="text-xl md:text-3xl font-black text-[#10B981]">{stats.todaySuccess}</p>
               {stats.todaySuccess > 0 && (
                  <span className="flex h-2.5 w-2.5 relative ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
                  </span>
               )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 mb-10">
          <div className="w-full rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6 flex flex-col relative overflow-hidden">
             <div className="flex justify-between items-center mb-6 relative z-10">
               <h3 className="text-lg md:text-xl font-black text-[#F8FAFC] tracking-wide">Network Traffic</h3>
               <span className="flex items-center gap-2 px-3 py-1 bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] text-[10px] font-black rounded-full tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 bg-[#3B82F6] rounded-full animate-ping"></span> Live Data
               </span>
             </div>
             <div className="flex-1 w-full h-48 md:h-56 relative z-10">
                {Math.max(...trafficData) === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-bold">No Traffic Data Yet</div>
                ) : (
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 150">
                    <defs><linearGradient id="mainLineGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#A855F7" /><stop offset="100%" stopColor="#EC4899" /></linearGradient></defs>
                    <path d={generateTrafficPath(trafficData)} fill="none" stroke="url(#mainLineGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
             </div>
             <div className="flex justify-between items-center text-[10px] font-bold text-[#64748B] uppercase mt-4 relative z-10">
               <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
             </div>
          </div>

          {/* 💥 RESTORED: Network Top Services & Global Traffic 💥 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6">
              <h3 className="text-lg font-black text-[#F8FAFC] tracking-wide mb-6 text-center md:text-left">Network Top Services</h3>
              <div className="space-y-4">
                {topApps.length === 0 ? (
                  <div className="text-center text-[#64748B] text-sm py-4 border border-dashed border-[#334155] rounded-xl">No OTP data yet.</div>
                ) : (
                  topApps.map((app, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-[#0F172A] border border-[#334155] hover:border-[#8B5CF6]/50 transition-colors shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${app.info.bg} ${app.info.text} flex items-center justify-center font-bold`}>{app.info.icon}</div>
                        <div><p className="text-sm font-bold text-[#E2E8F0]">{app.name}</p><p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wider">Service</p></div>
                      </div>
                      <span className="text-lg font-black text-white font-mono">{app.count} <span className="text-[10px] text-slate-500">OTP</span></span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6 flex flex-col relative overflow-hidden">
               <div className="flex justify-between items-center mb-6 relative z-10">
                 <h3 className="text-lg font-black text-[#F8FAFC] tracking-wide">Global Traffic Overview</h3>
                 <span className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black rounded-full tracking-widest uppercase">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span> LIVE
                 </span>
               </div>
               <div className="flex-1 w-full h-40 relative z-10">
                  {Math.max(...globalTrafficData) === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-bold">Loading Live Data...</div>
                  ) : (
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 150">
                      <defs><linearGradient id="globalLineGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#F59E0B" /></linearGradient></defs>
                      <path d={generateTrafficPath(globalTrafficData)} fill="none" stroke="url(#globalLineGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
               </div>
               <div className="flex justify-between items-center text-[10px] font-bold text-[#64748B] uppercase mt-2 relative z-10">
                 <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
               </div>
            </div>
          </div>
        </div>

        {/* TOP PERFORMING USERS MAGIC BOX */}
        <div className="w-full rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-xl mb-10">
            <div className="flex items-center justify-between mb-4 md:mb-6 border-b border-[#334155] pb-4">
               <div>
                 <h3 className="text-lg md:text-2xl font-black bg-gradient-to-r from-[#A855F7] to-[#00C6FF] bg-clip-text text-transparent tracking-wide flex items-center gap-2">
                    Top Performing Users 👑
                 </h3>
                 <p className="text-[10px] md:text-xs text-[#94A3B8] font-medium mt-1">Live ranking based on Today's OTP Success.</p>
               </div>
               <div className="px-2 py-1 md:px-3 md:py-1.5 bg-[#A855F7]/10 border border-[#A855F7]/30 rounded-lg text-center hidden md:block">
                 <span className="block text-[8px] md:text-[9px] font-black text-[#A855F7] uppercase tracking-widest">Ranked Users</span>
                 <span className="text-xs md:text-sm font-black text-white">{topUsers.length}</span>
               </div>
            </div>

            {topUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                    <svg className="w-12 h-12 text-[#334155] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-sm font-bold text-[#64748B]">No OTPs processed today yet.</p>
                </div>
            ) : (
                <div className="flex flex-col relative w-full">
                    <div className="flex mb-3 pb-2 border-b border-[#334155]/50 text-[9px] md:text-[10px] font-black text-slate-400">
                         <div className="w-[110px] md:w-[180px] shrink-0 uppercase tracking-widest pl-1">User Identity</div>
                         <div className="flex-1 flex justify-between relative px-2 md:px-0">
                             {axisLabels.map((val, i) => (
                                 <span key={i} className="absolute -translate-x-1/2" style={{left: `${(i/4)*100}%`}}>{val}</span>
                             ))}
                         </div>
                    </div>

                    <div className="relative pt-2 pb-2">
                        <div className="absolute top-0 bottom-0 left-[110px] md:left-[180px] right-0 pointer-events-none px-2 md:px-0">
                            {axisLabels.map((_, i) => (
                                <div key={i} className={`absolute top-0 bottom-0 border-l ${i === 0 ? 'border-[#334155]' : 'border-[#334155]/30 border-dashed'}`} style={{left: `${(i/4)*100}%`}}></div>
                            ))}
                        </div>

                        <div className="space-y-3 md:space-y-4 relative z-10 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                            {topUsers.map((u, index) => {
                                const percentage = (u.otpCount / maxScale) * 100;
                                const isTop1 = index === 0; const isTop2 = index === 1; const isTop3 = index === 2;
                                
                                let barColor = "from-slate-500 to-slate-400";
                                let rankColor = "text-slate-400 bg-slate-400/10";
                                
                                if (isTop1) { barColor = "from-[#F59E0B] to-[#FCD34D]"; rankColor = "text-[#F59E0B]"; }
                                else if (isTop2) { barColor = "from-[#94A3B8] to-[#E2E8F0]"; rankColor = "text-[#E2E8F0]"; }
                                else if (isTop3) { barColor = "from-[#B45309] to-[#D97706]"; rankColor = "text-[#D97706]"; }
                                else { barColor = "from-[#3B82F6] to-[#00C6FF]"; rankColor = "text-[#3B82F6]"; }

                                return (
                                    <div key={index} className="flex items-center text-xs md:text-sm group hover:bg-[#0F172A]/50 rounded-lg transition-colors p-1 md:p-0">
                                        <div className="w-[110px] md:w-[180px] shrink-0 flex items-center gap-1.5 md:gap-3 pr-2">
                                            <span className={`font-black w-4 md:w-6 text-[10px] md:text-sm ${rankColor}`}>#{index + 1}</span>
                                            <div className="truncate">
                                                <p className="font-bold text-slate-200 truncate text-[11px] md:text-sm">{u.name}</p>
                                                <p className="text-[8px] md:text-[10px] text-slate-500 font-mono bg-slate-800/50 px-1 mt-0.5 inline-block rounded border border-slate-700">{u.id}</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 relative flex items-center h-5 md:h-7 bg-[#0F172A] rounded overflow-hidden border border-[#334155] mx-2 md:mx-0">
                                            <div className={`h-full bg-gradient-to-r ${barColor} flex items-center justify-end pr-1.5 md:pr-2 transition-all duration-1000 min-w-[20px]`} style={{width: `${percentage}%`}}>
                                                <span className="text-[9px] md:text-xs font-black text-[#0B0F1A] drop-shadow-sm">{u.otpCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>

      </div>
    </DashboardLayout>
  );
}