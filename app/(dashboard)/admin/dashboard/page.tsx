"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// 💥 SWR FOR LIGHTNING FAST CACHE (Zero Loading Screen & MongoDB Protection) 💥
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

export default function AdminGlobalDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  const [adminStats, setAdminStats] = useState({ totalUsers: 0, totalAgents: 0, systemLiability: "0.00", globalTodaySuccess: 0 });
  const [agentReport, setAgentReport] = useState<any[]>([]);
  const [currentMonthName, setCurrentMonthName] = useState("");
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [trendingServices, setTrendingServices] = useState<any[]>([]);

  // 💥 V2 STRICT BLUE PALETTE FOR TOP SERVICES 💥
  const formatTopApps = (countsObj: Record<string, number>) => {
    return Object.entries(countsObj).map(([name, count]) => {
      let info = { text: "text-[#00D2FF]", bg: "bg-[#00D2FF]/10", border: "border-[#00D2FF]/20" };
      return { name: name.toUpperCase(), count, info };
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
    
    if (parsedUser.role !== "admin") {
      router.replace(parsedUser.role === "agent" ? "/manager/dashboard" : "/dashboard"); 
      return;
    }

    setIsAdmin(true); 
    setAdminEmail(parsedUser.email);
  }, [router]);

  // 💥 SWR FETCHER: Merges 3 heavy Admin APIs into 1 Cache Block 💥
  const fetchAdminData = async (email: string) => {
    const todayStr = getUTCDateString();
    const [userData, reportData, summaryRes] = await Promise.all([
      fetch("/api/get-all-users").then(r => r.json()), 
      fetch("/api/admin-agent-report").then(r => r.json()),
      fetch("/api/admin/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role: "admin" }) }).then(r => r.json())
    ]);
    return { userData, reportData, summaryRes, todayStr };
  };

  // 💥 THE BOSS FIX: SWR Auto-Sync Every 15 Seconds 💥
  const { data, isLoading } = useSWR(
    adminEmail ? ["adminData", adminEmail] : null,
    ([_, email]) => fetchAdminData(email as string),
    { 
      refreshInterval: 15000, 
      keepPreviousData: true, 
      revalidateOnFocus: true,
      refreshWhenHidden: true,
      refreshWhenOffline: true
    }
  );

  // Sync SWR cache to UI states securely
  useEffect(() => {
    if (data) {
      const { userData, reportData, summaryRes, todayStr } = data;
      if (summaryRes && summaryRes.success) {
         const todayData = summaryRes.groupedRawData[todayStr] || { success: 0 };
         setAdminStats(p => ({ ...p, globalTodaySuccess: todayData.success || 0 }));
         if (summaryRes.todayAppCounts) setTopPerformers(formatTopApps(summaryRes.todayAppCounts));
      }
      if (reportData && reportData.success) { 
         setAgentReport(reportData.report); 
         setCurrentMonthName(reportData.currentMonth); 
      }
      if (userData.stats) {
        setAdminStats(p => ({ ...p, totalUsers: userData.stats.totalUsers || 0, totalAgents: userData.stats.totalAgents || 0, systemLiability: userData.stats.systemLiability || "0.00" }));
      }
    }
  }, [data]);

  // 💥 SIMULATED LIVE TRENDING DATA (FROM MANAGER) 💥
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

  if ((!data && isLoading) || !isAdmin) return (
    <div className="min-h-screen bg-[#030816] flex flex-col items-center justify-center text-[#F8FAFC]">
      <div className="w-12 h-12 border-4 border-[#162749] border-t-[#00D2FF] rounded-full animate-spin mb-4"></div>
      <p className="text-[#6C84A3] font-semibold tracking-widest uppercase text-xs">Loading Global Stats...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full relative z-10 pb-20 bg-[#030816] text-[#F8FAFC]" style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', sans-serif" }}>
      
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-[#F8FAFC] tracking-tight">
            Welcome back, <span className="text-[#00D2FF]">Admin!</span>
          </h2>
          <p className="text-[#6C84A3] mt-1 text-xs md:text-sm font-medium tracking-wide">
            Here is the global overview of your entire network today.
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
           {currentTime && (
             <div className="px-3.5 py-1.5 bg-[#0B152A] border border-[#162749] rounded-lg shadow-sm text-[10px] md:text-[11px] font-semibold tracking-widest text-[#6C84A3] flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D2FF]"></span>
               </span>
               {currentTime}
             </div>
           )}
           <span className="bg-[#0B152A] border border-[#162749] text-[#60A5FA] px-3.5 py-1.5 rounded-lg text-[10px] md:text-[11px] font-semibold uppercase tracking-widest flex items-center gap-2 shadow-sm">
             <span className="w-1.5 h-1.5 bg-[#00D2FF] rounded-full animate-pulse shadow-[0_0_8px_#00D2FF]"></span> Super Admin
           </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-8">
        <div className="rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-sm hover:border-[#1F335B] transition-colors flex flex-col">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest mb-1.5">Total Users</h3>
          <p className="text-2xl md:text-3xl font-semibold text-[#F8FAFC] tracking-tight">{adminStats.totalUsers}</p>
        </div>
        <div className="rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-sm hover:border-[#1F335B] transition-colors flex flex-col">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest mb-1.5">Total Agents</h3>
          <p className="text-2xl md:text-3xl font-semibold text-[#F8FAFC] tracking-tight">{adminStats.totalAgents}</p>
        </div>
        <div className="rounded-2xl bg-[#101726] border border-[#162749] p-5 md:p-6 shadow-sm hover:border-[#1F335B] transition-colors flex flex-col">
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest mb-1.5">System Liability</h3>
          <p className="text-xl md:text-2xl font-semibold text-[#6C84A3] tracking-tight">${adminStats.systemLiability}</p>
        </div>
        <div className="rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-sm hover:border-[#00D2FF]/30 transition-colors flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#00D2FF] opacity-5 rounded-bl-full pointer-events-none"></div>
          <h3 className="text-[#6C84A3] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest mb-1.5">Global Today's Success</h3>
          <div className="flex items-center gap-2">
             <p className="text-2xl md:text-3xl font-semibold text-[#00D2FF] tracking-tight">{adminStats.globalTodaySuccess}</p>
          </div>
        </div>
      </div>

      {/* 💥 V2 LIVE TRENDING & TOP SERVICES (FROM MANAGER) 💥 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6 mb-8">
        
        {/* Global Top Services (Replaces Revenue Box) */}
        <div className="w-full rounded-2xl bg-[#0B152A] border border-[#162749] p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
           <h3 className="text-sm md:text-base font-semibold text-[#F8FAFC] tracking-wide mb-5">Global Top Services</h3>
           <div className="space-y-2.5">
             {topPerformers.length === 0 ? (
               <div className="text-center text-[#6C84A3] text-xs py-6 border border-dashed border-[#162749] rounded-xl font-medium">No services active today.</div>
             ) : (
               topPerformers.map((app, index) => (
                 <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-[#030816] border border-[#162749] hover:border-[#1F335B] transition-colors group shadow-sm">
                   <div className="flex items-center gap-3">
                     <div className={`w-8 h-8 rounded-lg ${app.info.bg} ${app.info.text} border ${app.info.border} flex items-center justify-center`}>
                       <ServiceIcon />
                     </div>
                     <div>
                       <p className="text-xs font-semibold text-[#F8FAFC] tracking-wide">{app.name}</p>
                       <p className="text-[9px] text-[#6C84A3] font-medium tracking-widest mt-0.5 uppercase">Top Performing</p>
                     </div>
                   </div>
                   <span className="text-sm font-semibold text-[#F8FAFC] group-hover:text-[#00D2FF] transition-colors tracking-tight">
                     {app.count} <span className="text-[9px] text-[#6C84A3] font-medium">OTP</span>
                   </span>
                 </div>
               ))
             )}
           </div>
        </div>

        {/* Global Live Trending (Replaces Big Traffic Graph) */}
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

      {/* AGENTS PERFORMANCE TABLE */}
      <div className="bg-[#0B152A] border border-[#162749] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] overflow-hidden w-full mb-8">
         <div className="flex justify-between items-center p-4 md:p-5 bg-[#0B152A] border-b border-[#162749]">
           <div>
              <h3 className="text-sm md:text-base font-semibold text-[#F8FAFC] tracking-wide">Top Agents Performance</h3>
              <p className="text-[9px] md:text-[10px] text-[#60A5FA] font-semibold tracking-widest uppercase mt-1 flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 bg-[#00D2FF] rounded-full animate-pulse shadow-[0_0_8px_#00D2FF]"></span> Authentic Network Data ({currentMonthName})
              </p>
           </div>
         </div>
         <div className="overflow-x-auto custom-scrollbar w-full">
           <table className="w-full text-left border-collapse min-w-[700px]">
             <thead>
               <tr className="bg-[#030816] text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest border-b border-[#162749]">
                 <th className="p-4 pl-5 whitespace-nowrap">Rank</th>
                 <th className="p-4 whitespace-nowrap">Agent Identity</th>
                 <th className="p-4 text-center whitespace-nowrap">Today's OTPs</th>
                 <th className="p-4 text-center whitespace-nowrap">Total OTPs</th>
                 <th className="p-4 pr-5 text-right whitespace-nowrap">Agent Commission ($)</th>
               </tr>
             </thead>
             <tbody className="text-sm font-medium text-[#F8FAFC] divide-y divide-[#162749]">
               {agentReport.length === 0 ? (
                 <tr><td colSpan={5} className="text-center p-12 text-[#6C84A3] text-xs font-medium border border-dashed border-[#162749] m-4 rounded-xl block">No agent data found this month.</td></tr>
               ) : (
                 agentReport.map((agent, index) => {
                   const isTop1 = index === 0;
                   const rankColor = isTop1 ? "text-[#00D2FF]" : "text-[#6C84A3]";
                   
                   return (
                     <tr key={index} className="hover:bg-[#101726] transition-colors">
                       <td className={`p-4 pl-5 font-semibold text-xs ${rankColor}`}>#{index + 1}</td>
                       <td className="p-4">
                          <p className="font-semibold text-xs tracking-wide text-[#F8FAFC]">{agent.agentName}</p>
                          <p className="text-[10px] text-[#6C84A3] font-medium tracking-wide mt-0.5">{agent.agentEmail}</p>
                       </td>
                       <td className="p-4 text-center font-semibold text-[#00D2FF] tracking-tight">{agent.todayOTPs || 0}</td>
                       <td className="p-4 text-center font-semibold text-[#60A5FA] tracking-tight">{agent.monthOTPs || 0}</td>
                       <td className="p-4 pr-5 text-right font-semibold text-[#F8FAFC] tracking-tight">${agent.agentEarnings}</td>
                     </tr>
                   )
                 })
               )}
             </tbody>
           </table>
         </div>
      </div>

    </div>
  );
}