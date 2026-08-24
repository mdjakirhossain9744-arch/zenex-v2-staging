"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
// 💥 SWR FOR LIGHTNING FAST CACHE 💥
import useSWR from "swr";

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch(e) { return new Date().toISOString().split('T')[0]; }
};

// 🔥 UNIVERSAL PREMIUM SMS/API ICON 🔥
const ServiceIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

// 🔥 UNIVERSAL PREMIUM USER ICON (REPLACING INITIALS) 🔥
const UserAvatarIcon = () => (
  <svg className="w-5 h-5 text-[#6C84A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [liveRate, setLiveRate] = useState<number>(0.00);
  const [currentTime, setCurrentTime] = useState("");

  const [stats, setStats] = useState({ 
    balance: "0.00", todayTotal: 0, todaySuccess: 0, 
    todayRevenue: 0, yesterdaySuccess: 0, yesterdayRevenue: 0 
  });
  
  const [topApps, setTopApps] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]); 
  const [inactiveUsers, setInactiveUsers] = useState<any[]>([]); 
  const [trafficData, setTrafficData] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [trendingServices, setTrendingServices] = useState<any[]>([]);

  const timeLabels = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];

  // 💥 STRICT BLUE PALETTE FOR TOP SERVICES 💥
  const formatTopApps = (countsObj: Record<string, number>, currentRate: number) => {
    return Object.entries(countsObj).map(([name, count]) => {
      let info = { text: "text-[#00D2FF]", bg: "bg-[#00D2FF]/10", border: "border-[#00D2FF]/20" };
      const revenue = count * currentRate;
      return { name: name.toUpperCase(), count, revenue, info };
    }).sort((a, b) => b.count - a.count).slice(0, 6); 
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
  }, [router]);

  const fetchManagerData = async (email: string) => {
    const todayStr = getUTCDateString();
    const [agentSummaryRes, userDetailsRes] = await Promise.all([
      fetch("/api/agent-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).then(r => r.json()),
      fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).then(r => r.json())
    ]);
    return { agentSummaryRes, userDetailsRes, todayStr };
  };

  const { data, isLoading, mutate } = useSWR(
    user?.email ? ["managerData", user.email] : null,
    ([_, email]) => fetchManagerData(email as string),
    { 
      refreshInterval: 15000, 
      keepPreviousData: true, 
      revalidateOnFocus: true,
      refreshWhenHidden: true,
      refreshWhenOffline: true
    }
  );

  useEffect(() => {
    if (data) {
      const { agentSummaryRes, userDetailsRes, todayStr } = data;
      
      let currentRate = 0;
      if (userDetailsRes && userDetailsRes.user) {
         currentRate = Number(userDetailsRes.user.agentMaxRate || 0);
         setStats(p => ({ ...p, balance: Number(userDetailsRes.user.balance || 0).toFixed(2) }));
         setLiveRate(currentRate); 
      }

      if (agentSummaryRes && agentSummaryRes.success) {
         const todayData = agentSummaryRes.groupedRawData[todayStr] || { total: 0, success: 0 };
         setStats(p => ({ 
             ...p, 
             todayTotal: todayData.total, 
             todaySuccess: agentSummaryRes.todaySuccess || 0,
             todayRevenue: agentSummaryRes.todayRevenue || 0,
             yesterdaySuccess: agentSummaryRes.yesterdaySuccess || 0,
             yesterdayRevenue: agentSummaryRes.yesterdayRevenue || 0
         }));
         
         if (agentSummaryRes.todayAppCounts) setTopApps(formatTopApps(agentSummaryRes.todayAppCounts, currentRate));
         if (agentSummaryRes.todayHourlyTraffic) setTrafficData(agentSummaryRes.todayHourlyTraffic);
         if (agentSummaryRes.topPerformers) setTopUsers(agentSummaryRes.topPerformers); 
         if (agentSummaryRes.inactiveUsers) setInactiveUsers(agentSummaryRes.inactiveUsers); 
      }
    }
  }, [data]);

  // 💥 SIMULATED LIVE TRENDING DATA 💥
  useEffect(() => {
    const generateMockTrendData = () => {
      const bases = [
        { name: "FACEBOOK" }, { name: "WHATSAPP" }, { name: "INSTAGRAM" },
        { name: "TELEGRAM" }, { name: "GOOGLE" }, { name: "TIKTOK" },
      ];
      
      const newTrends = bases.map((base) => {
        const barData = Array.from({length: 12}, () => Math.floor(Math.random() * 80) + 10);
        const isNegative = Math.random() > 0.6;
        const trendValue = (Math.random() * 25 + 1) * (isNegative ? -1 : 1);
        const sortScore = Math.floor(Math.random() * 100); 
        
        return {
          ...base,
          bg: "bg-[#00D2FF]/10", text: "text-[#00D2FF]", border: "border-[#00D2FF]/20",
          barData,
          trendValue,
          sortScore
        };
      }).sort((a, b) => b.sortScore - a.sortScore); 

      setTrendingServices(newTrends);
    };

    generateMockTrendData();
    const trendInterval = setInterval(generateMockTrendData, 15000);
    return () => clearInterval(trendInterval);
  }, []);

  const maxVal = Math.max(...trafficData, 1);

  const generateTrafficPath = (data: number[]) => {
    const points = data.map((v, i) => { const x = i * 160; const y = 130 - (v / maxVal) * 110; return { x, y }; });
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1]; const p1 = points[i];
      path += ` C ${p0.x + 80},${p0.y} ${p1.x - 80},${p1.y} ${p1.x},${p1.y}`;
    }
    return path;
  };

  // 🔥 MINI BAR CHART (Cyan for UP, Rose Red for DOWN) 🔥
  const renderMiniBarChart = (data: number[], isPositive: boolean) => {
    const max = Math.max(...data, 1);
    const color = isPositive ? "#00D2FF" : "#F43F5E"; 
    const width = 60;
    const height = 24;
    
    return (
      <svg width={width} height={height} className="overflow-visible">
        {data.map((val, i) => {
          const barHeight = Math.max((val / max) * height, 2);
          const x = i * 5; 
          const y = height - barHeight;
          return (
            <rect 
              key={i} x={x} y={y} width="3" height={barHeight} fill={color} rx="1" 
              className="opacity-80 hover:opacity-100 transition-opacity" 
            />
          );
        })}
      </svg>
    );
  };

  const handleChartInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const xPercentage = (clientX - rect.left) / rect.width;
    const index = Math.round(xPercentage * 5);
    setHoverIndex(Math.max(0, Math.min(index, 5)));
  };

  if ((!data && isLoading) || !user) return (
    <div className="flex flex-col items-center justify-center py-20 text-white">
      <div className="w-10 h-10 border-4 border-[#162749] border-t-[#00D2FF] rounded-full animate-spin mb-4"></div>
      <p className="text-[#6C84A3] font-semibold tracking-widest uppercase text-xs">Syncing Network...</p>
    </div>
  );

  const userName = user?.name ? user.name.split(" ")[0] : "Agent";
  const highestOTP = topUsers.length > 0 ? topUsers[0].otpCount : 0; 
  let maxScale = 36; 
  while (maxScale <= highestOTP && highestOTP > 0) { maxScale += 12; }
  const axisLabels = [0, maxScale * 0.25, maxScale * 0.50, maxScale * 0.75, maxScale];

  return (
    <div 
      className="p-4 md:p-6 lg:p-8 w-full relative z-10 pb-20 bg-[#030816] text-[#F8FAFC]"
      style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', sans-serif" }}
    >
      
      {/* Header Section */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-[#F8FAFC] tracking-tight">
            Welcome back, <span className="text-[#00D2FF]">{userName}!</span>
          </h2>
          <p className="text-[#6C84A3] mt-1 text-xs md:text-sm font-medium tracking-wide">
            Here is your team's live performance and commission.
          </p>
        </div>
        <div className="flex items-center gap-3">
           {currentTime && (
             <div className="px-3.5 py-1.5 bg-[#0B152A] border border-[#162749] rounded-lg shadow-sm text-[10px] md:text-[11px] font-semibold tracking-widest text-[#6C84A3] flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D2FF]"></span>
               </span>
               {currentTime}
             </div>
           )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-8">
        <div className="rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-sm hover:border-[#00D2FF]/30 transition-colors duration-300">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest mb-1.5">Today's Revenue</h3>
          <p className="text-2xl md:text-3xl font-semibold text-[#F8FAFC] tracking-tight">${Number(stats.todayRevenue).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-sm hover:border-[#00D2FF]/30 transition-colors duration-300 flex flex-col justify-between">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest mb-1.5">Today's Success OTP</h3>
          <div className="flex items-center gap-2">
             <p className="text-2xl md:text-3xl font-semibold text-[#00D2FF] tracking-tight">{stats.todaySuccess}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-[#101726] border border-[#162749] p-5 md:p-6 shadow-sm hover:border-[#162749] transition-colors duration-300">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest mb-1.5">Yesterday's Revenue</h3>
          <p className="text-xl md:text-2xl font-medium text-[#6C84A3] tracking-tight">${Number(stats.yesterdayRevenue).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-[#101726] border border-[#162749] p-5 md:p-6 shadow-sm hover:border-[#162749] transition-colors duration-300">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest mb-1.5">Yesterday's Success</h3>
          <p className="text-xl md:text-2xl font-medium text-[#6C84A3] tracking-tight">{stats.yesterdaySuccess}</p>
        </div>
      </div>

      {/* FULL WIDTH: Network Traffic Graph */}
      <div className="w-full rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)] flex flex-col relative mb-8">
         <div className="flex justify-between items-center mb-6">
           <h3 className="text-sm md:text-base font-semibold text-[#F8FAFC] tracking-wide">Network Traffic Overview</h3>
           <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00D2FF]/10 border border-[#00D2FF]/20 text-[#00D2FF] text-[9px] font-semibold rounded-md tracking-widest uppercase">
              <span className="w-1.5 h-1.5 bg-[#00D2FF] rounded-full animate-pulse"></span> Live
           </span>
         </div>
         
         <div 
           className="flex-1 w-full h-48 md:h-56 relative z-10 cursor-crosshair touch-pan-y"
           onMouseMove={handleChartInteraction}
           onTouchMove={handleChartInteraction}
           onMouseLeave={() => setHoverIndex(null)}
           onTouchEnd={() => setHoverIndex(null)}
         >
            {Math.max(...trafficData) === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-[#6C84A3] text-xs font-medium">No Traffic Data Yet</div>
            ) : (
              <>
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 150">
                  <defs>
                    <linearGradient id="userLineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#00D2FF" />
                      <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="userAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D2FF" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#00D2FF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={`${generateTrafficPath(trafficData)} L ${(trafficData.length - 1) * 160},150 L 0,150 Z`} fill="url(#userAreaGrad)" />
                  <path d={generateTrafficPath(trafficData)} fill="none" stroke="url(#userLineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                {hoverIndex !== null && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none transition-all duration-75 ease-linear"
                    style={{ left: `${(hoverIndex / 5) * 100}%` }}
                  >
                     <div className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#00D2FF]/40 to-transparent -ml-[0.5px]"></div>
                     <div className="absolute bottom-[85%] md:bottom-[75%] left-1/2 -translate-x-1/2 mb-2 bg-[#030816] border border-[#162749] shadow-2xl rounded-lg py-1.5 px-3 text-center z-20 min-w-[85px]">
                        <p className="text-[9px] text-[#6C84A3] font-semibold uppercase mb-0.5 tracking-widest">{timeLabels[hoverIndex]}</p>
                        <p className="text-xs md:text-sm text-[#F8FAFC] font-semibold tracking-tight">{trafficData[hoverIndex]} <span className="text-[8px] text-[#6C84A3] font-medium">OTP</span></p>
                     </div>
                     <div 
                        className="absolute w-3 h-3 bg-[#030816] border-[2px] border-[#00D2FF] rounded-full shadow-[0_0_12px_rgba(0,210,255,0.6)] -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-linear"
                        style={{ top: `${((130 - (trafficData[hoverIndex] / maxVal) * 110) / 150) * 100}%` }}
                     ></div>
                  </div>
                )}
              </>
            )}
         </div>
         <div className="flex justify-between items-center text-[9px] font-semibold text-[#6C84A3] uppercase mt-4 tracking-widest">
           {timeLabels.map((time, idx) => (
             <span key={idx} className={hoverIndex === idx ? "text-[#00D2FF] transition-colors" : ""}>{time}</span>
           ))}
         </div>
      </div>

      {/* REVENUE & GLOBAL LIVE TRENDING */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6 mb-8">
        
        {/* Top Services Revenue */}
        <div className="w-full rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
           <h3 className="text-sm md:text-base font-semibold text-[#F8FAFC] tracking-wide mb-5">Top Services Revenue</h3>
           <div className="space-y-2.5">
             {topApps.length === 0 ? (
               <div className="text-center text-[#6C84A3] text-xs py-6 border border-dashed border-[#162749] rounded-xl font-medium">No revenue generated yet.</div>
             ) : (
               topApps.map((app, index) => (
                 <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-[#030816] border border-[#162749] hover:border-[#1F335B] transition-colors group shadow-sm">
                   <div className="flex items-center gap-3">
                     <div className={`w-8 h-8 rounded-lg ${app.info.bg} ${app.info.text} border ${app.info.border} flex items-center justify-center`}>
                       <ServiceIcon />
                     </div>
                     <div>
                       <p className="text-xs font-semibold text-[#F8FAFC] tracking-wide">{app.name}</p>
                       <p className="text-[9px] text-[#6C84A3] font-medium tracking-widest mt-0.5 uppercase">Top Earner</p>
                     </div>
                   </div>
                   <span className="text-sm font-semibold text-[#F8FAFC] group-hover:text-[#00D2FF] transition-colors tracking-tight">
                     ${app.revenue.toFixed(2)}
                   </span>
                 </div>
               ))
             )}
           </div>
        </div>

        {/* Global Live Trending */}
        <div className="w-full rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
           <div className="flex justify-between items-center mb-5">
             <h3 className="text-sm md:text-base font-semibold text-[#F8FAFC] tracking-wide">Global Live Trending</h3>
             <span className="flex h-2 w-2 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D2FF]"></span>
             </span>
           </div>
           
           <div className="space-y-2.5">
             {trendingServices.map((service, idx) => {
               const isPositive = service.trendValue >= 0;
               const trendColor = isPositive ? "text-[#00D2FF]" : "text-[#F43F5E]";
               
               return (
                 <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#030816] border border-[#162749] hover:border-[#1F335B] transition-colors group shadow-sm">
                   
                   <div className="flex items-center gap-3">
                     <div className={`w-8 h-8 rounded-lg ${service.bg} ${service.text} border ${service.border} flex items-center justify-center`}>
                       <ServiceIcon />
                     </div>
                     <div>
                       <p className="text-xs font-semibold text-[#F8FAFC] tracking-wide">{service.name}</p>
                       <div className={`flex items-center gap-1 text-[9px] font-bold mt-0.5 tracking-wider ${trendColor}`}>
                         {isPositive ? "▲" : "▼"} {Math.abs(service.trendValue).toFixed(1)}%
                       </div>
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-4">
                     <div className="w-[50px] flex justify-end">
                        {renderMiniBarChart(service.barData, isPositive)}
                     </div>
                   </div>

                 </div>
               );
             })}
           </div>
        </div>
        
      </div>

      {/* AGENT SPECIFIC MANAGEMENT ROWS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 mb-8">
          
          {/* Top Performing Users */}
          <div className="w-full rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between mb-5 border-b border-[#162749] pb-4">
                 <div>
                   <h3 className="text-sm md:text-base font-semibold text-[#F8FAFC] tracking-wide flex items-center gap-2">
                      Top Performing Users
                   </h3>
                   <p className="text-[10px] md:text-xs text-[#6C84A3] font-medium mt-1">Live ranking based on Today's OTP Success.</p>
                 </div>
                 <div className="px-3 py-1 bg-[#00D2FF]/10 border border-[#00D2FF]/20 rounded-md text-center hidden sm:block">
                   <span className="block text-[7px] font-semibold text-[#00D2FF] uppercase tracking-widest">Ranked</span>
                   <span className="text-xs font-bold text-white tracking-tight">{topUsers.length}</span>
                 </div>
              </div>

              {topUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                      <svg className="w-10 h-10 text-[#162749] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-xs text-[#6C84A3] font-medium">No OTPs processed today yet.</p>
                  </div>
              ) : (
                  <div className="flex flex-col relative w-full">
                      <div className="flex mb-3 pb-2 border-b border-[#162749] text-[9px] md:text-[10px] text-[#6C84A3] font-semibold">
                           <div className="w-[100px] shrink-0 uppercase tracking-widest pl-1">Identity</div>
                           <div className="flex-1 flex justify-between relative px-2">
                               {axisLabels.map((val, i) => (
                                   <span key={i} className="absolute -translate-x-1/2" style={{left: `${(i/4)*100}%`}}>{val}</span>
                               ))}
                           </div>
                      </div>
                      <div className="relative pt-2 pb-2">
                          <div className="absolute top-0 bottom-0 left-[100px] right-0 pointer-events-none px-2">
                              {axisLabels.map((_, i) => (
                                  <div key={i} className={`absolute top-0 bottom-0 border-l ${i === 0 ? 'border-[#162749]' : 'border-[#162749] border-dashed'}`} style={{left: `${(i/4)*100}%`}}></div>
                              ))}
                          </div>
                          <div className="space-y-3 relative z-10 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                              {topUsers.map((u, index) => {
                                  const percentage = (u.otpCount / maxScale) * 100;
                                  const isTop1 = index === 0; const isTop2 = index === 1; const isTop3 = index === 2;
                                  let barColor = "from-[#00D2FF] to-[#60A5FA]"; 
                                  let rankColor = "text-[#00D2FF]";
                                  
                                  if (isTop1) { barColor = "from-[#00D2FF] to-[#60A5FA]"; rankColor = "text-[#00D2FF]"; }
                                  else if (isTop2) { barColor = "from-[#60A5FA] to-[#00D2FF]"; rankColor = "text-[#60A5FA]"; }
                                  else if (isTop3) { barColor = "from-[#00D2FF]/80 to-[#60A5FA]/80"; rankColor = "text-[#00D2FF]/80"; }
                                  else { barColor = "from-[#162749] to-[#101726]"; rankColor = "text-[#6C84A3]"; }

                                  return (
                                      <div key={index} className="flex items-center text-xs group hover:bg-[#030816] rounded-lg transition-colors p-1 md:p-0">
                                          <div className="w-[100px] shrink-0 flex items-center gap-2 pr-2">
                                              <span className={`font-semibold w-4 text-[10px] md:text-xs ${rankColor}`}>#{index + 1}</span>
                                              <div className="truncate">
                                                  <p className="font-semibold truncate text-[10px] md:text-xs text-[#F8FAFC] tracking-wide">{u.name}</p>
                                              </div>
                                          </div>
                                          
                                          <div className="flex-1 relative flex items-center h-5 md:h-6 bg-[#030816] rounded overflow-hidden border border-[#162749] mx-2">
                                              <div className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r ${barColor} transition-all duration-1000 z-0 opacity-90`} style={{width: `${percentage}%`}}></div>
                                              <div className="absolute right-0 top-0 bottom-0 flex items-center pr-1.5 z-10">
                                                  <span className="text-[9px] md:text-[10px] font-semibold text-[#F8FAFC] bg-[#030816]/50 px-1.5 py-0.5 rounded shadow-sm border border-[#162749]/50 tracking-tight">
                                                      {u.otpCount}
                                                  </span>
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

          {/* Unseen Users */}
          <div className="w-full rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between mb-5 border-b border-[#162749] pb-4">
                 <div>
                   <h3 className="text-sm md:text-base font-semibold text-[#F43F5E] tracking-wide flex items-center gap-2">
                      Unseen Users <span className="text-[8px] font-semibold bg-[#F43F5E]/10 text-[#F43F5E] px-1.5 py-0.5 rounded border border-[#F43F5E]/20 uppercase tracking-widest">Active Only</span>
                   </h3>
                   <p className="text-[10px] md:text-xs text-[#6C84A3] font-medium mt-1">Users taking up limits without activity.</p>
                 </div>
                 <div className="p-1.5 bg-[#F43F5E]/10 rounded-lg border border-[#F43F5E]/20 hidden sm:block">
                    <svg className="w-4 h-4 text-[#F43F5E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                 </div>
              </div>

              {inactiveUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                      <p className="text-xs font-semibold text-[#6C84A3]">All your users are active! 🎉</p>
                  </div>
              ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                      {inactiveUsers.map((u, index) => {
                          const lastSeenText = u.inactiveText || "Unknown";
                          
                          let statusColor = "text-[#60A5FA]"; 
                          if (lastSeenText.includes("Never")) statusColor = "text-[#F43F5E]";
                          else if (lastSeenText === "Today" || lastSeenText === "Yesterday") statusColor = "text-[#00D2FF]";

                          const handleUserAction = async (targetEmail: string, action: string) => {
                              if (!targetEmail) { alert("Error: User Email not found!"); return; }
                              const confirmAction = window.confirm(`Are you sure you want to mark this user as ${action.toUpperCase()}?`);
                              if (!confirmAction) return;
                              const previousUsers = [...inactiveUsers];
                              setInactiveUsers(prev => prev.filter(user => user.email !== targetEmail));
                              try {
                                 const res = await fetch("/api/update-user", {
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ userId: targetEmail, newStatus: action })
                                 });
                                 if (!res.ok) { alert(`Failed!`); setInactiveUsers(previousUsers); } 
                                 else { mutate(); }
                              } catch (e) { alert("Network Error! Try again."); setInactiveUsers(previousUsers); }
                          };

                          return (
                              <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-[#030816] border border-[#162749] hover:border-[#1F335B] transition-colors gap-3 shadow-sm">
                                  <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 shrink-0 rounded-lg bg-[#0B152A] border border-[#162749] flex items-center justify-center shadow-inner">
                                          <UserAvatarIcon />
                                      </div>
                                      <div>
                                          <p className="text-xs font-semibold text-[#F8FAFC] tracking-wide">{u.name}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                             <span className="text-[9px] text-[#6C84A3] font-semibold tracking-widest uppercase">{u.id || "User"}</span>
                                             <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${statusColor} bg-[#030816] border border-[#162749] uppercase tracking-wide`}>
                                                 {lastSeenText}
                                             </span>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 self-end sm:self-auto">
                                      <button 
                                        onClick={() => handleUserAction(u.email, "pending")}
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#60A5FA]/10 text-[#60A5FA] border border-[#60A5FA]/20 hover:bg-[#60A5FA] hover:text-[#030816] transition-all rounded-md text-[8px] font-bold uppercase tracking-widest shadow-sm"
                                      >
                                         Pending
                                      </button>
                                      <button 
                                        onClick={() => handleUserAction(u.email, "banned")}
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/20 hover:bg-[#F43F5E] hover:text-[#030816] transition-all rounded-md text-[8px] font-bold uppercase tracking-widest shadow-sm"
                                      >
                                         Ban
                                      </button>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>

      </div>

    </div>
  );
}