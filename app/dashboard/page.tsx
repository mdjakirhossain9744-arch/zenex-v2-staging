"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import DashboardLayout from "../DashboardLayout"; 

const getUTCHour = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).getUTCHours(); } 
  catch(e) { return 0; }
};

export default function UserDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [liveRate, setLiveRate] = useState<number>(0.00);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");

  const [stats, setStats] = useState({ 
    balance: "0.00", 
    todaySuccess: 0, 
    yesterdaySuccess: 0,
    todayEarnings: 0,
    yesterdayEarnings: 0
  });
  
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [trafficData, setTrafficData] = useState<number[]>([0, 0, 0, 0, 0, 0]);

  // 🔥 DYNAMIC APP FORMATTER 🔥
  const formatTopApps = (countsObj: Record<string, number>) => {
    return Object.entries(countsObj).map(([name, count]) => {
      let info = { icon: name.charAt(0).toUpperCase(), text: "text-[#E2E8F0]", bg: "bg-[#334155]/30" };
      const nLower = name.toLowerCase();
      
      if (nLower.includes("facebook") || nLower === "fb") info = { icon: "F", text: "text-[#1877F2]", bg: "bg-[#1877F2]/10" };
      else if (nLower.includes("whatsapp") || nLower === "wa") info = { icon: "W", text: "text-[#25D366]", bg: "bg-[#25D366]/10" };
      else if (nLower.includes("instagram") || nLower === "ig") info = { icon: "IG", text: "text-[#E1306C]", bg: "bg-[#E1306C]/10" };
      else if (nLower.includes("telegram") || nLower === "tg") info = { icon: "TG", text: "text-[#0088cc]", bg: "bg-[#0088cc]/10" };
      else if (nLower.includes("google") || nLower === "gmail") info = { icon: "G", text: "text-[#EA4335]", bg: "bg-[#EA4335]/10" };
      else if (nLower.includes("tiktok") || nLower === "tt") info = { icon: "T", text: "text-[#00F2FE]", bg: "bg-[#00F2FE]/10" };
      else if (nLower.includes("apple") || nLower === "ap") info = { icon: "A", text: "text-[#A3AAAE]", bg: "bg-[#A3AAAE]/10" };
      else {
          const colors = [
              { t: "text-purple-400", b: "bg-purple-400/10" },
              { t: "text-amber-400", b: "bg-amber-400/10" },
              { t: "text-emerald-400", b: "bg-emerald-400/10" },
              { t: "text-rose-400", b: "bg-rose-400/10" },
              { t: "text-cyan-400", b: "bg-cyan-400/10" }
          ];
          const cIdx = name.length % colors.length; 
          info = { icon: name.substring(0, 2).toUpperCase(), text: colors[cIdx].t, bg: colors[cIdx].b };
      }
      return { name, count, info };
    }).sort((a, b) => b.count - a.count).slice(0, 10); 
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
    if (parsedUser.role === "admin") { router.replace("/admin/dashboard"); return; }
    if (parsedUser.role === "agent") { router.replace("/manager/dashboard"); return; }

    setUser(parsedUser);

    const fetchUserDashboardData = async () => {
      try {
        const [userDetailsRes, summaryRes] = await Promise.all([
          fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }).then(r => r.json()),
          fetch("/api/summary-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email, role: "user" }) }).then(r => r.json())
        ]);

        if (userDetailsRes && userDetailsRes.user) {
          setStats(p => ({ ...p, balance: Number(userDetailsRes.user.balance || 0).toFixed(2) }));
          setLiveRate(Number(userDetailsRes.user.otpRate || 0));
        }

        if (summaryRes && summaryRes.success) {
           setStats(p => ({ 
             ...p, 
             todaySuccess: summaryRes.todaySuccess || 0,
             todayEarnings: summaryRes.todaySpend || 0,
             yesterdaySuccess: summaryRes.yesterdaySuccess || 0,
             yesterdayEarnings: summaryRes.yesterdaySpend || 0
           }));
           
           if (summaryRes.todayHourlyTraffic) setTrafficData(summaryRes.todayHourlyTraffic);
           if (summaryRes.todayAppCounts) setTopPerformers(formatTopApps(summaryRes.todayAppCounts));
        }
      } catch (e) {
        console.error("Dashboard Sync Error");
      } finally { 
        setIsPageLoading(false); 
      }
    };

    fetchUserDashboardData();
    const interval = setInterval(fetchUserDashboardData, 10000);
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
      <div className="p-4 md:p-10 w-full font-sans min-h-screen bg-[#0B0F1A]">
         <div className="animate-pulse">
            <div className="h-8 bg-[#1E293B] w-64 rounded-xl mb-3"></div>
            <div className="h-4 bg-[#1E293B] w-96 rounded-xl mb-10"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
               <div className="h-28 bg-[#1E293B]/80 rounded-2xl"></div>
               <div className="h-28 bg-[#1E293B]/80 rounded-2xl"></div>
               <div className="h-28 bg-[#1E293B]/80 rounded-2xl"></div>
               <div className="h-28 bg-[#1E293B]/80 rounded-2xl"></div>
            </div>
            <div className="h-64 bg-[#1E293B]/80 rounded-2xl"></div>
         </div>
      </div>
    </DashboardLayout>
  );

  const userName = user?.name ? user.name.split(" ")[0] : "User";

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full font-sans">
        
        <div className="mb-6 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Welcome back, <span className="text-[#3B82F6]">{userName}!</span>
            </h2>
            <p className="text-[#94A3B8] mt-1 md:mt-2 text-xs md:text-sm font-medium tracking-wide">
              Here's what's happening with your account today.
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
             {currentTime && (
               <div className="px-3 py-1.5 md:px-4 md:py-2 bg-[#0F172A] border border-[#334155] rounded-lg shadow-inner text-[10px] md:text-[11px] font-black tracking-widest text-[#94A3B8] flex items-center gap-2">
                 <svg className="w-3.5 h-3.5 text-[#3B82F6] animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 {currentTime}
               </div>
             )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-10">
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#3B82F6] flex flex-col items-center md:items-start">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Today's Earnings</h3>
            <p className="text-xl md:text-3xl font-black text-green-400">৳ {Number(stats.todayEarnings).toFixed(2)}</p>
          </div>
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#10B981] flex flex-col items-center md:items-start relative overflow-hidden">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Today's Success OTP</h3>
            <div className="flex items-center gap-2">
               <p className="text-xl md:text-3xl font-black text-white">{stats.todaySuccess}</p>
               {stats.todaySuccess > 0 && (
                  <span className="flex h-2.5 w-2.5 relative ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
                  </span>
               )}
            </div>
          </div>
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/50 border border-[#334155] backdrop-blur-xl p-4 md:p-6 flex flex-col items-center md:items-start shadow-inner border-t-2 border-t-[#64748B]">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Yesterday's Earnings</h3>
            <p className="text-xl md:text-3xl font-black text-green-400/70">৳ {Number(stats.yesterdayEarnings).toFixed(2)}</p>
          </div>
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/50 border border-[#334155] backdrop-blur-xl p-4 md:p-6 flex flex-col items-center md:items-start shadow-inner border-t-2 border-t-[#64748B]">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Yesterday's Success</h3>
            <p className="text-xl md:text-3xl font-black text-[#E2E8F0]">{stats.yesterdaySuccess}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 mb-10">
          <div className="w-full rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6 flex flex-col relative overflow-hidden">
             <div className="flex justify-between items-center mb-6 relative z-10">
               <h3 className="text-lg md:text-xl font-black text-[#F8FAFC] tracking-wide">Hourly Traffic</h3>
               <span className="flex items-center gap-2 px-3 py-1 bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] text-[10px] font-black rounded-full tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 bg-[#3B82F6] rounded-full animate-ping"></span> Live Data
               </span>
             </div>
             
             <div className="flex-1 w-full h-48 md:h-56 relative z-10">
                {Math.max(...trafficData) === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-bold">No Traffic Data Yet</div>
                ) : (
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 150">
                    <defs>
                      <linearGradient id="userLineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#00C6FF" />
                      </linearGradient>
                      <linearGradient id="userAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#00C6FF" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d={`${generateTrafficPath(trafficData)} L ${(trafficData.length - 1) * 160},150 L 0,150 Z`} fill="url(#userAreaGrad)" />
                    <path d={generateTrafficPath(trafficData)} fill="none" stroke="url(#userLineGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
             </div>
             <div className="flex justify-between items-center text-[10px] font-bold text-[#64748B] uppercase mt-4 relative z-10">
               <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
             </div>
          </div>

          <div className="rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6">
             <h3 className="text-lg font-black text-[#F8FAFC] tracking-wide mb-6 text-center md:text-left">Your Top Performers</h3>
             <div className="space-y-4">
               {topPerformers.length === 0 ? (
                 <div className="text-center text-[#64748B] text-sm py-4 border border-dashed border-[#334155] rounded-xl">No OTP data yet.</div>
               ) : (
                 topPerformers.map((app, index) => (
                   <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-[#0F172A] border border-[#334155] hover:border-[#8B5CF6]/50 transition-colors shadow-sm">
                     <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-lg ${app.info.bg} ${app.info.text} flex items-center justify-center font-bold`}>
                         {app.info.icon}
                       </div>
                       <div>
                         <p className="text-sm font-bold text-[#E2E8F0]">{app.name}</p>
                         <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wider">Service Name</p>
                       </div>
                     </div>
                     <span className="text-lg font-black text-white font-mono">{app.count} <span className="text-[10px] text-slate-500">OTP</span></span>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}