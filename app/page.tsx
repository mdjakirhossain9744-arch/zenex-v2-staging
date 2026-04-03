"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import DashboardLayout from "./DashboardLayout";

// 💥 ম্যাজিক: সেফ বাংলাদেশ টাইম 💥
const getBDDateString = (dateObj: any = new Date()) => {
  try { 
    return new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' 
    }).format(new Date(dateObj)); 
  } catch(e) { 
    return new Date().toISOString().split('T')[0]; 
  }
};

const getBDHour = (dateObj: any = new Date()) => {
  try { 
    return parseInt(new Intl.DateTimeFormat('en-US', { 
      timeZone: 'Asia/Dhaka', hour: 'numeric', hourCycle: 'h23' 
    }).format(new Date(dateObj)), 10) || 0; 
  } catch(e) { 
    return 0; 
  }
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState("user"); 
  const [liveRate, setLiveRate] = useState<number>(0.50);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [stats, setStats] = useState({ balance: "0.00", todayTotal: 0, todaySuccess: 0, yesterdayTotal: 0, yesterdaySuccess: 0 });
  const [adminStats, setAdminStats] = useState({ totalUsers: 0, totalAgents: 0, systemLiability: "0.00", globalTodaySuccess: 0 });
  const [agentReport, setAgentReport] = useState<any[]>([]);
  const [currentMonthName, setCurrentMonthName] = useState("");
  
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [trafficData, setTrafficData] = useState<number[]>([0, 0, 0, 0, 0, 0]);

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
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { router.push("/login"); return; }
    
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    const userRole = parsedUser.role || "user";
    setRole(userRole);
    setLiveRate(Number(userRole === "agent" ? (parsedUser.agentMaxRate || 0.70) : (parsedUser.rate || parsedUser.otpRate || 0.50)));

    const todayStr = getBDDateString();
    const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getBDDateString(yesterdayDate);

    const fetchDashboardData = async () => {
      try {
        if (parsedUser.role === "admin") {
          const [userData, reportData, summaryRes] = await Promise.all([
            fetch("/api/get-all-users").then(r => r.json()),
            fetch("/api/admin-agent-report").then(r => r.json()),
            fetch("/api/summary-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email, role: "admin" }) }).then(r => r.json())
          ]);
  
          if (summaryRes && summaryRes.success) {
             const todayData = summaryRes.groupedRawData[todayStr] || { success: 0 };
             setAdminStats(p => ({ ...p, globalTodaySuccess: todayData.success || 0 }));
             
             if (summaryRes.todayAppCounts) setTopPerformers(formatTopApps(summaryRes.todayAppCounts));
             if (summaryRes.todayHourlyTraffic) setTrafficData(summaryRes.todayHourlyTraffic);
          }
          if (reportData && reportData.success) { setAgentReport(reportData.report); setCurrentMonthName(reportData.currentMonth); }
          if (userData.users) {
            const allUsers = userData.users;
            const liability = allUsers.reduce((sum: number, u: any) => sum + (Number(u.balance) || 0), 0);
            setAdminStats(p => ({ ...p, totalUsers: allUsers.filter((u: any) => u.role === 'user').length, totalAgents: allUsers.filter((u: any) => u.role === 'agent').length, systemLiability: liability.toFixed(2) }));
          }

        } else if (parsedUser.role === "agent") {
          const [agentSummaryRes, userDetailsRes] = await Promise.all([
            fetch("/api/agent-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }).then(r => r.json()),
            fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }).then(r => r.json())
          ]);

          if (userDetailsRes && userDetailsRes.user) {
             setStats(p => ({ ...p, balance: Number(userDetailsRes.user.balance || 0).toFixed(2) }));
             setLiveRate(Number(userDetailsRes.user.agentMaxRate || 0.70));
          }

          if (agentSummaryRes && agentSummaryRes.success) {
             const todayData = agentSummaryRes.groupedRawData[todayStr] || { total: 0, success: 0 };
             setStats(p => ({ ...p, todayTotal: todayData.total, todaySuccess: todayData.success }));
             
             if (agentSummaryRes.todayAppCounts) setTopPerformers(formatTopApps(agentSummaryRes.todayAppCounts));
             if (agentSummaryRes.todayHourlyTraffic) setTrafficData(agentSummaryRes.todayHourlyTraffic);
          }

        } else {
          const [userDetailsRes, ordersRes] = await Promise.all([
            fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }).then(r => r.json()),
            fetch("/api/sync-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH", email: parsedUser.email }) }).then(r => r.json())
          ]);

          if (userDetailsRes && userDetailsRes.user) {
            setStats(p => ({ ...p, balance: Number(userDetailsRes.user.balance || 0).toFixed(2) }));
          }

          if (ordersRes && ordersRes.success && ordersRes.orders) {
             let tTotal = 0, tSuccess = 0, yTotal = 0, ySuccess = 0;
             const appCounts: Record<string, number> = {};
             let buckets = [0, 0, 0, 0, 0, 0];

             ordersRes.orders.forEach((log: any) => {
               const logDate = log.dateString || getBDDateString(log.createdAt);
               if (logDate === todayStr) {
                 tTotal++;
                 if (log.status === "DONE" || log.status === "Success") {
                   tSuccess++;
                   const hour = getBDHour(log.createdAt);
                   const bIdx = Math.floor(hour / 4);
                   if(bIdx >= 0 && bIdx <= 5) buckets[bIdx]++;
   
                   let sName = "Other Network";
                   const mLower = (log.fullMessage || "").toLowerCase();
                   if (mLower.includes("facebook") || mLower.includes("fb")) sName = "Facebook";
                   else if (mLower.includes("whatsapp") || mLower.includes("wa")) sName = "WhatsApp";
                   else if (mLower.includes("instagram") || mLower.includes("ig")) sName = "Instagram";
                   else if (mLower.includes("telegram") || mLower.includes("tg")) sName = "Telegram";
                   else if (mLower.includes("google") || mLower.includes("gmail")) sName = "Google";
                   else if (mLower.includes("tiktok") || mLower.includes("tt")) sName = "TikTok";
                   else if (mLower.includes("apple") || mLower.includes("ap")) sName = "Apple";

                   if (!appCounts[sName]) appCounts[sName] = 0;
                   appCounts[sName]++;
                 }
               } else if (logDate === yesterdayStr) {
                 yTotal++;
                 if (log.status === "DONE" || log.status === "Success") ySuccess++;
               }
             });

             setStats(p => ({ ...p, todayTotal: tTotal, todaySuccess: tSuccess, yesterdayTotal: yTotal, yesterdaySuccess: ySuccess }));
             setTrafficData(buckets);
             setTopPerformers(formatTopApps(appCounts));
          }
        }
      } catch (e) {} finally { setIsPageLoading(false); }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
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
               <div className="h-28 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
               <div className="h-28 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
               <div className="h-28 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
               <div className="h-28 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
            </div>
            <div className="h-64 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
         </div>
      </div>
    </DashboardLayout>
  );

  const userName = user?.name ? user.name.split(" ")[0] : "User";

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full font-sans">
        
        <div className="mb-6 md:mb-10 text-center md:text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Welcome back, <span className={role === 'admin' ? "text-[#F43F5E]" : role === 'agent' ? "text-[#A855F7]" : "text-[#3B82F6]"}>{userName}!</span>
            </h2>
            <p className="text-[#94A3B8] mt-1 md:mt-2 text-xs md:text-sm font-medium tracking-wide">
              {role === 'admin' ? "Here is the global overview of your entire network today." : role === 'agent' ? "Here is your team's live performance and commission." : "Here's what's happening with your account today."}
            </p>
          </div>
          {role === 'admin' && (
             <span className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2">
               <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> Super Admin
             </span>
          )}
        </div>

        {role === "admin" ? (
          <>
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
                 <table className="w-full text-left border-collapse min-w-[600px]">
                   <thead>
                     <tr className="bg-[#1E293B] text-[10px] font-black text-[#64748B] uppercase tracking-widest border-b border-[#334155]">
                       <th className="p-4 pl-6">Rank</th>
                       <th className="p-4">Agent Name</th>
                       <th className="p-4 text-center">Total OTPs</th> 
                       <th className="p-4 pr-6 text-right">Agent Commission (৳)</th> 
                     </tr>
                   </thead>
                   <tbody className="text-sm font-medium text-[#E2E8F0] divide-y divide-[#334155]/50">
                     {agentReport.length === 0 ? (
                       <tr><td colSpan={4} className="text-center p-8 text-[#64748B] font-bold">No agent data found this month.</td></tr>
                     ) : (
                       agentReport.map((agent, index) => (
                         <tr key={index} className="hover:bg-[#334155]/20 transition-colors">
                           <td className="p-4 pl-6 font-black text-[#94A3B8]">#{index + 1}</td>
                           <td className="p-4">
                             <p className="font-bold text-white">{agent.agentName}</p>
                             <p className="text-[10px] text-[#64748B] font-mono">{agent.agentEmail}</p>
                           </td>
                           <td className="p-4 text-center font-black text-[#3B82F6]">{agent.monthOTPs}</td>
                           <td className="p-4 pr-6 text-right font-black text-[#10B981]">৳ {agent.agentEarnings}</td> 
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-5">
              <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#3B82F6] flex flex-col items-center md:items-start">
                <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">{role === 'agent' ? "Total Balance" : "Wallet Balance"}</h3>
                <p className="text-xl md:text-3xl font-black text-[#F8FAFC]">৳ {stats.balance}</p>
              </div>
              <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#00C6FF] flex flex-col items-center md:items-start">
                <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">{role === 'agent' ? "Admin Given Rate" : "Your OTP Rate"}</h3>
                <p className="text-xl md:text-3xl font-black text-[#00C6FF]">৳ {Number(liveRate).toFixed(2)}</p>
              </div>
              <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#F59E0B] flex flex-col items-center md:items-start">
                <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">{role === 'agent' ? "Network Today's Numbers" : "Today's Total Numbers"}</h3>
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

            {role !== "agent" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5 mb-6 md:mb-10">
                <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 flex flex-row md:flex-col justify-between items-center md:items-start">
                  <h3 className="text-[#94A3B8] text-[10px] font-black uppercase tracking-widest">Yesterday's Total Numbers</h3>
                  <p className="text-2xl md:text-3xl font-black text-[#F8FAFC]">{stats.yesterdayTotal}</p>
                </div>
                <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 flex flex-row md:flex-col justify-between items-center md:items-start">
                  <h3 className="text-[#94A3B8] text-[10px] font-black uppercase tracking-widest">Yesterday's Success</h3>
                  <p className="text-2xl md:text-3xl font-black text-[#F8FAFC]">{stats.yesterdaySuccess}</p>
                </div>
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-10">
          
          <div className="lg:col-span-1 rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6">
            <h3 className="text-lg font-black text-[#F8FAFC] tracking-wide mb-6 text-center md:text-left">
              {role === 'admin' ? "Global Top Services" : role === 'agent' ? "Network Top Apps" : "Your Top Performers"}
            </h3>
            <div className="space-y-4">
              {topPerformers.length === 0 ? (
                <div className="text-center text-[#64748B] text-sm py-4 border border-dashed border-[#334155] rounded-xl">No OTP data yet.</div>
              ) : (
                topPerformers.map((app, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-[#0F172A] border border-[#334155] hover:border-[#8B5CF6]/50 transition-colors">
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

          <div className="lg:col-span-2 rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6 flex flex-col relative overflow-hidden">
             <div className="flex justify-between items-center mb-6 relative z-10">
               <h3 className="text-lg font-black text-[#F8FAFC] tracking-wide">
                 {role === 'admin' ? "Global Traffic" : role === 'agent' ? "Network Traffic" : "Hourly Traffic"}
               </h3>
               <span className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black rounded-full tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span> LIVE
               </span>
             </div>
             
             <div className="flex-1 w-full h-40 relative z-10">
                {Math.max(...trafficData) === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-bold">No Traffic Data Yet</div>
                ) : (
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 150">
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={role === 'admin' ? "#EF4444" : role === 'agent' ? "#A855F7" : "#3B82F6"} />
                        <stop offset="100%" stopColor={role === 'admin' ? "#F59E0B" : role === 'agent' ? "#EC4899" : "#00C6FF"} />
                      </linearGradient>
                    </defs>
                    <path d={generateTrafficPath(trafficData)} fill="none" stroke="url(#lineGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
             </div>
             <div className="flex justify-between items-center text-[10px] font-bold text-[#64748B] uppercase mt-2 relative z-10">
               <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
             </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}