"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 

// 🔥 UNIVERSAL PREMIUM SMS/API ICON 🔥
const ServiceIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

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
  
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [trendingServices, setTrendingServices] = useState<any[]>([]);

  const timeLabels = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];

  // 💥 STRICT PALETTE FOR ALL SERVICES 💥
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
    if (parsedUser.role === "admin") { router.replace("/admin/dashboard"); return; }
    if (parsedUser.role === "agent") { router.replace("/manager/dashboard"); return; }

    setUser(parsedUser);

    const fetchUserDashboardData = async () => {
      try {
        const [userDetailsRes, summaryRes] = await Promise.all([
          fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }).then(r => r.json()),
          fetch("/api/summary-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email, role: "user" }) }).then(r => r.json())
        ]);

        let currentRate = 0;

        if (userDetailsRes && userDetailsRes.user) {
          currentRate = Number(userDetailsRes.user.otpRate || 0);
          setStats(p => ({ ...p, balance: Number(userDetailsRes.user.balance || 0).toFixed(2) }));
          setLiveRate(currentRate);
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
           if (summaryRes.todayAppCounts) setTopPerformers(formatTopApps(summaryRes.todayAppCounts, currentRate));
        }
      } catch (e) {
        console.error("Dashboard Sync Error");
      } finally { 
        setIsPageLoading(false); 
      }
    };

    fetchUserDashboardData();
    const interval = setInterval(fetchUserDashboardData, 25000);
    return () => clearInterval(interval);
  }, [router]);

  // 💥 SIMULATED LIVE TRENDING DATA (Strict Palette) 💥
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

  // 🔥 100% UNIQUE MINI BAR CHART (Monochrome Accent) 🔥
  const renderMiniBarChart = (data: number[], isPositive: boolean) => {
    const max = Math.max(...data, 1);
    // Strict Palette: Accent for positive, Muted for negative (No red/green)
    const color = isPositive ? "#00D2FF" : "#6C84A3"; 
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

  if (isPageLoading) return (
    <div className="p-4 md:p-10 w-full font-sans min-h-screen bg-[#090E17]">
       <div className="animate-pulse">
          <div className="h-8 bg-[#101726] w-64 rounded-xl mb-3 border border-[#1A233A]"></div>
          <div className="h-4 bg-[#101726] w-96 rounded-xl mb-10 border border-[#1A233A]"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
             <div className="h-32 bg-[#101726] rounded-[1.5rem] border border-[#1A233A]"></div>
             <div className="h-32 bg-[#101726] rounded-[1.5rem] border border-[#1A233A]"></div>
             <div className="h-32 bg-[#101726] rounded-[1.5rem] border border-[#1A233A]"></div>
             <div className="h-32 bg-[#101726] rounded-[1.5rem] border border-[#1A233A]"></div>
          </div>
          <div className="h-72 bg-[#101726] rounded-[1.5rem] border border-[#1A233A]"></div>
       </div>
    </div>
  );

  const userName = user?.name ? user.name.split(" ")[0] : "User";

  return (
    <div className="p-4 md:p-8 lg:p-10 w-full font-sans bg-[#090E17] min-h-screen">
      
      {/* Header Section */}
      <div className="mb-8 md:mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#F8FAFC] tracking-wide">
            Welcome back, <span className="text-[#00D2FF]">{userName}!</span>
          </h2>
          <p className="text-[#6C84A3] mt-1.5 text-xs md:text-sm font-medium tracking-wide">
            Track your daily network performance and real-time revenue.
          </p>
        </div>
        <div className="flex items-center gap-3">
           {currentTime && (
             <div className="px-4 py-2 bg-[#101726] border border-[#1A233A] rounded-lg shadow-sm text-[10px] md:text-[11px] font-medium tracking-widest text-[#6C84A3] flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D2FF]"></span>
               </span>
               {currentTime}
             </div>
           )}
        </div>
      </div>

      {/* Stats Grid - Strict 5-Color Palette */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="rounded-[1.5rem] bg-[#101726] border border-[#1A233A] p-5 md:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.3)] hover:border-[#00D2FF]/30 transition-colors duration-300">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-medium uppercase tracking-[0.1em] mb-2">Today's Earnings</h3>
          <p className="text-2xl md:text-3xl font-semibold text-[#F8FAFC] tracking-tight">${Number(stats.todayEarnings).toFixed(2)}</p>
        </div>
        <div className="rounded-[1.5rem] bg-[#101726] border border-[#1A233A] p-5 md:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.3)] hover:border-[#00D2FF]/30 transition-colors duration-300 flex flex-col justify-between">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-medium uppercase tracking-[0.1em] mb-2">Today's Success OTP</h3>
          <div className="flex items-center gap-2">
             <p className="text-2xl md:text-3xl font-semibold text-[#00D2FF] tracking-tight">{stats.todaySuccess}</p>
          </div>
        </div>
        <div className="rounded-[1.5rem] bg-[#101726]/50 border border-[#1A233A] p-5 md:p-6 shadow-sm hover:border-[#1A233A] transition-colors duration-300">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-medium uppercase tracking-[0.1em] mb-2">Yesterday's Earnings</h3>
          <p className="text-xl md:text-2xl font-medium text-[#6C84A3] tracking-tight">${Number(stats.yesterdayEarnings).toFixed(2)}</p>
        </div>
        <div className="rounded-[1.5rem] bg-[#101726]/50 border border-[#1A233A] p-5 md:p-6 shadow-sm hover:border-[#1A233A] transition-colors duration-300">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-medium uppercase tracking-[0.1em] mb-2">Yesterday's Success</h3>
          <p className="text-xl md:text-2xl font-medium text-[#6C84A3] tracking-tight">{stats.yesterdaySuccess}</p>
        </div>
      </div>

      {/* FULL WIDTH: Network Traffic Graph */}
      <div className="w-full rounded-[1.5rem] bg-[#101726] border border-[#1A233A] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.3)] flex flex-col relative mb-8">
         <div className="flex justify-between items-center mb-8">
           <h3 className="text-base md:text-lg font-semibold text-[#F8FAFC] tracking-wide">Network Traffic Overview</h3>
           <span className="flex items-center gap-2 px-3 py-1 bg-[#00D2FF]/10 border border-[#00D2FF]/20 text-[#00D2FF] text-[10px] font-medium rounded-md tracking-widest uppercase">
              <span className="w-1.5 h-1.5 bg-[#00D2FF] rounded-full animate-pulse"></span> Live
           </span>
         </div>
         
         <div 
           className="flex-1 w-full h-52 md:h-64 relative z-10 cursor-crosshair touch-pan-y"
           onMouseMove={handleChartInteraction}
           onTouchMove={handleChartInteraction}
           onMouseLeave={() => setHoverIndex(null)}
           onTouchEnd={() => setHoverIndex(null)}
         >
            {Math.max(...trafficData) === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-[#6C84A3] text-sm font-medium">No Traffic Data Yet</div>
            ) : (
              <>
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 150">
                  <defs>
                    <linearGradient id="userLineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#00D2FF" />
                      <stop offset="100%" stopColor="#00D2FF" stopOpacity="0.6" />
                    </linearGradient>
                    <linearGradient id="userAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D2FF" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#00D2FF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={`${generateTrafficPath(trafficData)} L ${(trafficData.length - 1) * 160},150 L 0,150 Z`} fill="url(#userAreaGrad)" />
                  <path d={generateTrafficPath(trafficData)} fill="none" stroke="url(#userLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                {hoverIndex !== null && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none transition-all duration-75 ease-linear"
                    style={{ left: `${(hoverIndex / 5) * 100}%` }}
                  >
                     <div className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#00D2FF]/50 to-transparent -ml-[0.5px]"></div>
                     <div className="absolute bottom-[85%] md:bottom-[75%] left-1/2 -translate-x-1/2 mb-2 bg-[#090E17] border border-[#1A233A] shadow-2xl rounded-lg py-2 px-3 text-center z-20 min-w-[90px]">
                        <p className="text-[10px] text-[#6C84A3] font-medium uppercase mb-0.5 tracking-[0.1em]">{timeLabels[hoverIndex]}</p>
                        <p className="text-sm text-[#F8FAFC] font-semibold tracking-tight">{trafficData[hoverIndex]} <span className="text-[9px] text-[#6C84A3] font-medium">OTP</span></p>
                     </div>
                     <div 
                        className="absolute w-3.5 h-3.5 bg-[#F8FAFC] border-2 border-[#00D2FF] rounded-full shadow-[0_0_12px_rgba(0,210,255,0.8)] -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-linear"
                        style={{ top: `${((130 - (trafficData[hoverIndex] / maxVal) * 110) / 150) * 100}%` }}
                     ></div>
                  </div>
                )}
              </>
            )}
         </div>
         <div className="flex justify-between items-center text-[10px] font-medium text-[#6C84A3] uppercase mt-4">
           {timeLabels.map((time, idx) => (
             <span key={idx} className={hoverIndex === idx ? "text-[#00D2FF] transition-colors" : ""}>{time}</span>
           ))}
         </div>
      </div>

      {/* BOTTOM ROW: Revenue & Live Trending */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-10">
        
        {/* BOX 1: Top Services Revenue */}
        <div className="w-full rounded-[1.5rem] bg-[#101726] border border-[#1A233A] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
           <h3 className="text-base md:text-lg font-semibold text-[#F8FAFC] tracking-wide mb-6">Top Services Revenue</h3>
           <div className="space-y-3">
             {topPerformers.length === 0 ? (
               <div className="text-center text-[#6C84A3] text-sm py-6 border border-dashed border-[#1A233A] rounded-xl font-medium">No revenue generated yet.</div>
             ) : (
               topPerformers.map((app, index) => (
                 <div key={index} className="flex items-center justify-between p-3.5 rounded-xl bg-[#090E17] border border-[#1A233A] hover:border-[#1F2940] transition-colors group">
                   <div className="flex items-center gap-3.5">
                     <div className={`w-9 h-9 rounded-lg ${app.info.bg} ${app.info.text} border ${app.info.border} flex items-center justify-center shadow-sm`}>
                       <ServiceIcon />
                     </div>
                     <div>
                       <p className="text-[13px] font-semibold text-[#F8FAFC] tracking-wide">{app.name}</p>
                       <p className="text-[10px] text-[#6C84A3] font-medium tracking-wider mt-0.5">Top Earner</p>
                     </div>
                   </div>
                   <span className="text-[15px] font-semibold text-[#F8FAFC] group-hover:text-[#00D2FF] transition-colors tracking-tight">
                     ${app.revenue.toFixed(2)}
                   </span>
                 </div>
               ))
             )}
           </div>
        </div>

        {/* BOX 2: Simple Live Trending */}
        <div className="w-full rounded-[1.5rem] bg-[#101726] border border-[#1A233A] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
           <div className="flex justify-between items-center mb-6">
             <h3 className="text-base md:text-lg font-semibold text-[#F8FAFC] tracking-wide">Live Trending</h3>
             <span className="flex h-2.5 w-2.5 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00D2FF]"></span>
             </span>
           </div>
           
           <div className="space-y-3">
             {trendingServices.map((service, idx) => {
               const isPositive = service.trendValue >= 0;
               // Strict Palette: Accent for Positive, Muted Gray for Negative
               const trendColor = isPositive ? "text-[#00D2FF]" : "text-[#6C84A3]";
               
               return (
                 <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-[#090E17] border border-[#1A233A] hover:border-[#1F2940] transition-colors group">
                   
                   {/* Left: Icon & Name */}
                   <div className="flex items-center gap-3.5">
                     <div className={`w-9 h-9 rounded-lg ${service.bg} ${service.text} border ${service.border} flex items-center justify-center shadow-sm`}>
                       <ServiceIcon />
                     </div>
                     <div>
                       <p className="text-[13px] font-semibold text-[#F8FAFC] tracking-wide">{service.name}</p>
                       <div className={`flex items-center gap-1 text-[10px] font-bold mt-0.5 ${trendColor}`}>
                         {isPositive ? "▲" : "▼"} {Math.abs(service.trendValue).toFixed(1)}%
                       </div>
                     </div>
                   </div>
                   
                   {/* Right: Unique Mini Bar Chart */}
                   <div className="flex items-center gap-4">
                     <div className="w-[60px] flex justify-end">
                        {renderMiniBarChart(service.barData, isPositive)}
                     </div>
                   </div>

                 </div>
               );
             })}
           </div>
        </div>
        
      </div>

    </div>
  );
}