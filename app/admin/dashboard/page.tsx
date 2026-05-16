"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../DashboardLayout"; 

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch(e) { return new Date().toISOString().split('T')[0]; }
};

export default function AdminGlobalDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");

  const [adminStats, setAdminStats] = useState({ totalUsers: 0, totalAgents: 0, systemLiability: "0.00", globalTodaySuccess: 0 });
  const [agentReport, setAgentReport] = useState<any[]>([]);
  const [currentMonthName, setCurrentMonthName] = useState("");
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
    
    if (parsedUser.role !== "admin") {
      router.replace(parsedUser.role === "agent" ? "/manager/dashboard" : "/dashboard"); 
      return;
    }

    setIsAdmin(true); 
    fetchAdminDashboardData(parsedUser.email);
    const intervalData = setInterval(() => fetchAdminDashboardData(parsedUser.email), 10000);
    return () => clearInterval(intervalData);
  }, [router]);

  const fetchAdminDashboardData = async (email: string) => {
    try {
      const todayStr = getUTCDateString();
      const [userData, reportData, summaryRes] = await Promise.all([
        fetch("/api/get-all-users").then(r => r.json()), 
        fetch("/api/admin-agent-report").then(r => r.json()),
        fetch("/api/summary-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role: "admin" }) }).then(r => r.json())
      ]);

      if (summaryRes && summaryRes.success) {
         const todayData = summaryRes.groupedRawData[todayStr] || { success: 0 };
         setAdminStats(p => ({ ...p, globalTodaySuccess: todayData.success || 0 }));
         if (summaryRes.todayAppCounts) setTopPerformers(formatTopApps(summaryRes.todayAppCounts));
         if (summaryRes.todayHourlyTraffic) setTrafficData(summaryRes.todayHourlyTraffic);
      }
      if (reportData && reportData.success) { setAgentReport(reportData.report); setCurrentMonthName(reportData.currentMonth); }
      if (userData.stats) {
        setAdminStats(p => ({ ...p, totalUsers: userData.stats.totalUsers || 0, totalAgents: userData.stats.totalAgents || 0, systemLiability: userData.stats.systemLiability || "0.00" }));
      }
    } catch (e) {} finally { setLoading(false); }
  };

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

  if (loading || !isAdmin) return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-[#334155] border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
        <p className="text-[#94A3B8] font-bold tracking-widest uppercase text-sm">Loading Global Stats...</p>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full font-sans">
        
        <div className="mb-6 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Welcome back, <span className="text-[#F43F5E]">Admin!</span>
            </h2>
            <p className="text-[#94A3B8] mt-1 md:mt-2 text-xs md:text-sm font-medium tracking-wide">
              Here is the global overview of your entire network today.
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
             <span className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2">
               <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> Super Admin
             </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-10">
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#3B82F6] flex flex-col items-center md:items-start">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Total Users</h3>
            <p className="text-xl md:text-3xl font-black text-white">{adminStats.totalUsers}</p>
          </div>
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#8B5CF6] flex flex-col items-center md:items-start">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Total Agents</h3>
            <p className="text-xl md:text-3xl font-black text-white">{adminStats.totalAgents}</p>
          </div>
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#10B981] flex flex-col items-center md:items-start">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">System Liability</h3>
            <p className="text-xl md:text-3xl font-black text-[#10B981]">৳ {adminStats.systemLiability}</p>
          </div>
          <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#F59E0B] flex flex-col items-center md:items-start relative overflow-hidden">
            <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Global Today's Success</h3>
            <div className="flex items-center gap-2">
               <p className="text-xl md:text-3xl font-black text-[#F59E0B]">{adminStats.globalTodaySuccess}</p>
               {adminStats.globalTodaySuccess > 0 && (
                  <span className="flex h-2.5 w-2.5 relative ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F59E0B]"></span>
                  </span>
               )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 mb-10">
          <div className="w-full rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6 flex flex-col relative overflow-hidden">
             <div className="flex justify-between items-center mb-6 relative z-10">
               <h3 className="text-lg md:text-xl font-black text-[#F8FAFC] tracking-wide">Global Traffic Overview</h3>
               <span className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black rounded-full tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span> Live Data
               </span>
             </div>
             <div className="flex-1 w-full h-48 md:h-56 relative z-10">
                {Math.max(...trafficData) === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-bold">No Traffic Data Yet</div>
                ) : (
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 150">
                    <defs><linearGradient id="mainLineGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#F59E0B" /></linearGradient></defs>
                    <path d={generateTrafficPath(trafficData)} fill="none" stroke="url(#mainLineGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
             </div>
             <div className="flex justify-between items-center text-[10px] font-bold text-[#64748B] uppercase mt-4 relative z-10">
               <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6 lg:col-span-2">
              <h3 className="text-lg font-black text-[#F8FAFC] tracking-wide mb-6 text-center md:text-left">Global Top Services</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topPerformers.length === 0 ? (
                  <div className="text-center text-[#64748B] text-sm py-4 border border-dashed border-[#334155] rounded-xl col-span-3">No OTP data yet.</div>
                ) : (
                  topPerformers.map((app, index) => (
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
          </div>
        </div>

        <div className="bg-[#1E293B]/80 border border-[#334155] rounded-2xl shadow-lg overflow-hidden w-full mb-10">
           <div className="flex justify-between items-center p-5 bg-[#0F172A]/50 border-b border-[#334155]">
             <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Top Agents Performance</h3>
                <p className="text-[10px] text-[#10B981] font-bold tracking-wider mt-1 flex items-center gap-1">
                   <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></span> 100% Live & Authentic Data ({currentMonthName})
                </p>
             </div>
           </div>
           <div className="overflow-x-auto w-full">
             <table className="w-full text-left border-collapse min-w-[700px]">
               <thead>
                 <tr className="bg-[#1E293B] text-[10px] font-black text-[#64748B] uppercase tracking-widest border-b border-[#334155]">
                   <th className="p-4 pl-6">Rank</th><th className="p-4">Agent Name</th><th className="p-4 text-center">Today's OTPs</th><th className="p-4 text-center">Total OTPs</th><th className="p-4 pr-6 text-right">Agent Commission (৳)</th>
                 </tr>
               </thead>
               <tbody className="text-sm font-medium text-[#E2E8F0] divide-y divide-[#334155]/50">
                 {agentReport.length === 0 ? (
                   <tr><td colSpan={5} className="text-center p-8 text-[#64748B] font-bold">No agent data found this month.</td></tr>
                 ) : (
                   agentReport.map((agent, index) => (
                     <tr key={index} className="hover:bg-[#334155]/20 transition-colors">
                       <td className="p-4 pl-6 font-black text-[#94A3B8]">#{index + 1}</td>
                       <td className="p-4"><p className="font-bold text-white">{agent.agentName}</p><p className="text-[10px] text-[#64748B] font-mono">{agent.agentEmail}</p></td>
                       <td className="p-4 text-center font-black text-[#10B981]">{agent.todayOTPs || 0}</td>
                       <td className="p-4 text-center font-black text-[#3B82F6]">{agent.monthOTPs || 0}</td>
                       <td className="p-4 pr-6 text-right font-black text-[#F59E0B]">৳ {agent.agentEarnings}</td>
                     </tr>
                   ))
                 )}
               </tbody>
             </table>
           </div>
        </div>

      </div>
    </DashboardLayout>
  );
}