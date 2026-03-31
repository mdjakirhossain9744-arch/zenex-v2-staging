"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import DashboardLayout from "./DashboardLayout";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState("user"); 
  const [liveRate, setLiveRate] = useState(0.50);

  // ইউজারের লাইভ স্টেট
  const [stats, setStats] = useState({
    balance: "0.00",
    todayTotal: 0,
    todaySuccess: 0,
    yesterdayTotal: 0,
    yesterdaySuccess: 0,
  });

  // অ্যাডমিনের লাইভ স্টেট
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalAgents: 0,
    systemLiability: "0.00",
    globalTodayOTP: 0,
  });

  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  // ট্রাফিকের লাইভ ডাটা স্টেট
  const [trafficData, setTrafficData] = useState<number[]>([0, 0, 0, 0, 0, 0]);

  // সার্ভিস আইকন এবং কালার বের করার ফাংশন
  const getServiceInfo = (message: string) => {
    const msgLower = (message || "").toLowerCase();
    if (msgLower.includes("facebook") || msgLower.includes("fb")) return { name: "Facebook", icon: "F", text: "text-[#1877F2]", bg: "bg-[#1877F2]/10" };
    if (msgLower.includes("whatsapp") || msgLower.includes("wa")) return { name: "WhatsApp", icon: "W", text: "text-[#25D366]", bg: "bg-[#25D366]/10" };
    if (msgLower.includes("instagram") || msgLower.includes("ig")) return { name: "Instagram", icon: "IG", text: "text-[#E1306C]", bg: "bg-[#E1306C]/10" };
    if (msgLower.includes("telegram") || msgLower.includes("tg")) return { name: "Telegram", icon: "TG", text: "text-[#0088cc]", bg: "bg-[#0088cc]/10" };
    if (msgLower.includes("google") || msgLower.includes("gmail")) return { name: "Google", icon: "G", text: "text-[#EA4335]", bg: "bg-[#EA4335]/10" };
    if (msgLower.includes("apple") || msgLower.includes("ap")) return { name: "Apple", icon: "A", text: "text-[#A3AAAE]", bg: "bg-[#A3AAAE]/10" };
    if (msgLower.includes("tiktok") || msgLower.includes("tt")) return { name: "TikTok", icon: "T", text: "text-[#00F2FE]", bg: "bg-[#00F2FE]/10" };
    return { name: "Other Network", icon: "N", text: "text-[#E2E8F0]", bg: "bg-[#334155]/30" };
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const loginTime = localStorage.getItem("zenex_login_time");

    if (!storedUser) {
      router.push("/login");
      return;
    }

    if (loginTime) {
      const timePassed = Date.now() - parseInt(loginTime);
      if (timePassed > 12 * 60 * 60 * 1000) { 
         localStorage.removeItem("user");
         localStorage.removeItem("zenex_login_time");
         router.push("/login");
         return;
      }
    } else {
      localStorage.setItem("zenex_login_time", Date.now().toString());
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    const userRole = parsedUser.role || "user";
    setRole(userRole);
    
    // এজেন্ট হলে প্রথমে লোকাল স্টোরেজ থেকে agentMaxRate নিবে, না থাকলে ডিফল্ট
    if (userRole === "agent") {
      setLiveRate(parsedUser.agentMaxRate || 0.70);
    } else {
      setLiveRate(parsedUser.rate || parsedUser.otpRate || 0.50);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const fetchDashboardData = async () => {
      try {
        if (parsedUser.role === "admin") {
          // অ্যাডমিনের গ্লোবাল ডাটাবেস ফেচ
          const [userData, otpData] = await Promise.all([
            fetch("/api/get-all-users").then(r => r.json()),
            fetch("/api/check-otp", { cache: "no-store" }).then(r => r.json())
          ]);
  
          if (userData.users) {
            const allUsers = userData.users;
            const liability = allUsers.reduce((sum: number, u: any) => sum + (Number(u.balance) || 0), 0);
            setAdminStats({
              totalUsers: allUsers.filter((u: any) => u.role === 'user').length,
              totalAgents: allUsers.filter((u: any) => u.role === 'agent').length,
              systemLiability: liability.toFixed(2),
              globalTodayOTP: otpData.otps ? otpData.otps.length : 0 
            });
          }
  
          if (otpData.success && otpData.otps) {
            const appCounts: Record<string, { count: number, info: any }> = {};
            let buckets = [0, 0, 0, 0, 0, 0];
  
            otpData.otps.forEach((log: any) => {
              const time = log.time || log.createdAt || log.date || Date.now();
              const d = new Date(typeof time === 'number' && time < 10000000000 ? time * 1000 : time);
              
              if (d.toISOString().split('T')[0] === todayStr) {
                 const hour = d.getHours();
                 const bucketIndex = Math.floor(hour / 4);
                 if(bucketIndex >= 0 && bucketIndex <= 5) buckets[bucketIndex]++;
  
                 const sInfo = getServiceInfo(log.sms || log.fullMessage || log.otp || log.msg);
                 if (!appCounts[sInfo.name]) appCounts[sInfo.name] = { count: 0, info: sInfo };
                 appCounts[sInfo.name].count += 1;
              }
            });
  
            setTrafficData(buckets);
            setTopPerformers(Object.values(appCounts).sort((a, b) => b.count - a.count).slice(0, 3));
          }

        } else if (parsedUser.role === "agent") {
          // এজেন্টের নেটওয়ার্ক ও ডাটাবেস ফেচ
          const [agentRes, otpRes, userDetailsRes] = await Promise.all([
            fetch("/api/get-agent-users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentEmail: parsedUser.email }) }).then(r => r.json()),
            fetch("/api/check-otp", { cache: "no-store" }).then(r => r.json()),
            fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }).then(r => r.json())
          ]);

          let netToday = 0;
          let liveAgentBal = "0.00";

          if (agentRes.users) {
             netToday = agentRes.users.reduce((sum: number, u: any) => sum + Number(u.todayOTP || 0), 0);
          }

          // 💥 ডাটাবেস থেকে এজেন্টের রিয়েল ব্যালেন্স এবং অ্যাডমিন রেট কল হচ্ছে 💥
          if (userDetailsRes && userDetailsRes.user) {
             liveAgentBal = Number(userDetailsRes.user.balance || 0).toFixed(2);
             // এজেন্টকে অ্যাডমিন যে রেট দিয়েছে সেটি agentMaxRate থেকে নেওয়া হচ্ছে
             const aRate = Number(userDetailsRes.user.agentMaxRate || 0.70);
             setLiveRate(aRate);
          }

          setStats(prev => ({ 
            ...prev, 
            balance: liveAgentBal, 
            todayTotal: netToday, 
            todaySuccess: netToday 
          }));

          // এজেন্টের গ্রাফ
          if (otpRes.success && otpRes.otps && netToday > 0) {
            const appCounts: Record<string, any> = {};
            let buckets = [0, 0, 0, 0, 0, 0];
            
            const sampleLogs = otpRes.otps.slice(0, netToday); 
            
            sampleLogs.forEach((log: any) => {
              const time = log.time || log.createdAt || log.date || Date.now();
              const d = new Date(typeof time === 'number' && time < 10000000000 ? time * 1000 : time);
              
              if (d.toISOString().split('T')[0] === todayStr) {
                const hour = d.getHours();
                const bIdx = Math.floor(hour / 4);
                if(bIdx >= 0 && bIdx <= 5) buckets[bIdx]++;

                const sInfo = getServiceInfo(log.sms || log.fullMessage || log.otp || log.msg);
                if (!appCounts[sInfo.name]) appCounts[sInfo.name] = { count: 0, info: sInfo };
                appCounts[sInfo.name].count++;
              }
            });

            setTrafficData(buckets);
            setTopPerformers(Object.values(appCounts).sort((a:any, b:any) => b.count - a.count).slice(0, 3));
          } else {
            setTrafficData([0,0,0,0,0,0]);
            setTopPerformers([]);
          }

        } else {
          // ইউজারের ডাটাবেস
          fetch("/api/get-user-details", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ email: parsedUser.email }) 
          })
          .then(res => res.json())
          .then(data => {
            if (data && data.user) {
              const updatedRate = data.user.otpRate || 0.50;
              setLiveRate(updatedRate); 
              parsedUser.rate = updatedRate;
              localStorage.setItem("user", JSON.stringify(parsedUser));
              setStats(prev => ({ ...prev, balance: Number(data.user.balance || 0).toFixed(2) }));
            }
          });
  
          const savedNumbers = localStorage.getItem("zenex_numbers_v2");
          if (savedNumbers) {
            const parsedLogs = JSON.parse(savedNumbers);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
  
            let tTotal = 0, tSuccess = 0, yTotal = 0, ySuccess = 0;
            const appCounts: Record<string, { count: number, info: any }> = {};
            let buckets = [0, 0, 0, 0, 0, 0];
  
            parsedLogs.forEach((log: any) => {
              const logDate = log.dateString || new Date(log.createdAt).toISOString().split('T')[0];
              
              if (logDate === todayStr) {
                tTotal++;
                if (log.status === "DONE") {
                  tSuccess++;
                  const hour = new Date(log.createdAt).getHours();
                  const bucketIndex = Math.floor(hour / 4);
                  if(bucketIndex >= 0 && bucketIndex <= 5) buckets[bucketIndex]++;
  
                  const sInfo = getServiceInfo(log.fullMessage || log.otp);
                  if (!appCounts[sInfo.name]) appCounts[sInfo.name] = { count: 0, info: sInfo };
                  appCounts[sInfo.name].count += 1;
                }
              } else if (logDate === yesterdayStr) {
                yTotal++;
                if (log.status === "DONE") ySuccess++;
              }
            });
  
            setStats(prev => ({
              ...prev,
              todayTotal: tTotal,
              todaySuccess: tSuccess,
              yesterdayTotal: yTotal,
              yesterdaySuccess: ySuccess,
            }));
  
            setTrafficData(buckets);
            setTopPerformers(Object.values(appCounts).sort((a, b) => b.count - a.count).slice(0, 3));
          }
        }
      } catch (e) {}
    };

    fetchDashboardData();
    // প্রতি ১০ সেকেন্ডে ড্যাশবোর্ড কার্ডের ডাটা আপডেট করবে
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);

  }, [router]);

  const generateTrafficPath = (data: number[]) => {
    const maxVal = Math.max(...data, 1); 
    const points = data.map((v, i) => {
      const x = i * 160; 
      const y = 130 - (v / maxVal) * 110; 
      return { x, y };
    });

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      path += ` C ${p0.x + 80},${p0.y} ${p1.x - 80},${p1.y} ${p1.x},${p1.y}`;
    }
    return path;
  };

  if (!user) return <div className="min-h-screen bg-[#0B0F1A]"></div>;

  const userName = user.name ? user.name.split(" ")[0] : "User";

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
            <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#F59E0B] flex flex-col items-center md:items-start">
              <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Global Today's OTP</h3>
              <p className="text-xl md:text-3xl font-black text-[#F59E0B]">{adminStats.globalTodayOTP}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-5">
              <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#3B82F6] flex flex-col items-center md:items-start">
                <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">{role === 'agent' ? "Total Balance" : "Wallet Balance"}</h3>
                <p className="text-xl md:text-3xl font-black text-[#F8FAFC]">৳ {stats.balance}</p>
              </div>
              <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#00C6FF] flex flex-col items-center md:items-start">
                <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">{role === 'agent' ? "Admin Given Rate" : "Your OTP Rate"}</h3>
                <p className="text-xl md:text-3xl font-black text-[#00C6FF]">৳ {liveRate.toFixed(2)}</p>
              </div>
              <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#10B981] flex flex-col items-center md:items-start">
                <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">{role === 'agent' ? "Network Today's OTP" : "Today's Total OTP"}</h3>
                <p className="text-xl md:text-3xl font-black text-[#F8FAFC]">{stats.todayTotal}</p>
              </div>
              <div className="rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-sm border-t-2 border-t-[#8B5CF6] flex flex-col items-center md:items-start">
                <h3 className="text-[#94A3B8] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">{role === 'agent' ? "Network Live Status" : "Yesterday's Total OTP"}</h3>
                <p className="text-lg md:text-2xl font-black text-[#F8FAFC]">{role === 'agent' ? "ACTIVE" : stats.yesterdayTotal}</p>
              </div>
            </div>

            {role !== "agent" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5 mb-6 md:mb-10">
                <div className="rounded-xl md:rounded-2xl bg-gradient-to-br from-[#1E293B] to-[#10B981]/10 border border-[#10B981]/30 backdrop-blur-xl p-4 md:p-6 flex flex-row md:flex-col justify-between items-center md:items-start">
                  <h3 className="text-[#10B981] text-[10px] font-black uppercase tracking-widest">Today's Success</h3>
                  <p className="text-2xl md:text-3xl font-black text-[#10B981]">{stats.todaySuccess}</p>
                </div>
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
                        <p className="text-sm font-bold text-[#E2E8F0]">{app.info.name}</p>
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