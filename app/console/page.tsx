"use client";

import { useState, useEffect } from "react"; 
import DashboardLayout from "../DashboardLayout"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Cell as PieCell, LabelList } from 'recharts';

export default function Console() {
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const getPermanentTime = (uniqueKey: string) => {
    if (typeof window === "undefined") return Date.now(); 

    const storageKey = `z_time_${uniqueKey}`;
    const savedTime = localStorage.getItem(storageKey);

    if (savedTime) {
      return Number(savedTime);
    }

    const newTime = Date.now();
    try {
      localStorage.setItem(storageKey, newTime.toString());
    } catch (e) {
      console.warn("Storage full");
    }
    
    return newTime;
  };

  const fetchGlobalData = async () => {
    try {
      const res = await fetch("/api/live-console", { cache: 'no-store' });
      const responseData = await res.json();
      
      if (responseData.error) {
        if (liveLogs.length === 0) setErrorMsg(responseData.error);
        setLoading(false);
        return;
      }

      let rawOtps = [];
      if (responseData.data && Array.isArray(responseData.data)) rawOtps = responseData.data;
      else if (responseData.otps && Array.isArray(responseData.otps)) rawOtps = responseData.otps;
      
      if (rawOtps.length > 0) {
        setErrorMsg("");
        const processedLogs = rawOtps.map((log: any) => {
          const rawNum = String(log.number || log.searchNumber || "").replace(/[^0-9]/g, '');
          const rawMsg = String(log.otp || log.fullMessage || "").replace(/\s/g, '').substring(0, 15);
          
          const uniqueKey = `${rawNum}_${rawMsg}`;

          return {
            ...log,
            _fixedTime: getPermanentTime(uniqueKey)
          };
        });

        setLiveLogs(processedLogs);
      }
    } catch (error) {
      console.error("Failed to fetch live console data", error);
      if (liveLogs.length === 0) setErrorMsg("Failed to connect to provider API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData(); 
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchGlobalData(); 
          return 5; // ৫ সেকেন্ড রিফ্রেশ
        }
        return prev - 1; 
      });
    }, 1000); 

    return () => clearInterval(interval);
  }, []);

  const maskNumber = (num: string) => {
    if (!num) return "Unknown";
    const cleanNum = String(num).replace("+", "");
    if (cleanNum.length > 9) return `${cleanNum.substring(0, 9)}XXXXXX`;
    return cleanNum; 
  };

  const maskFullMessage = (message: string) => {
    if (!message) return "";
    let masked = message.replace(/\b\d{4,8}\b/g, "******");
    return masked;
  };

  const getServiceName = (message: string, fallbackApp?: string) => {
    const codeMap: Record<string, string> = {
      'fb': 'FACEBOOK', 'wa': 'WHATSAPP', 'ig': 'INSTAGRAM', 'tg': 'TELEGRAM',
      'go': 'GOOGLE', 'tt': 'TIKTOK', 'ap': 'APPLE', 'am': 'AMAZON', 'nf': 'NETFLIX',
      'tw': 'TWITTER', 'ya': 'YAHOO', 'sn': 'SNAPCHAT', 'ma': 'MAIL.RU', 'vi': 'VIBER',
      'li': 'LINE', 'vk': 'VKONTAKTE', 'we': 'WECHAT', 'dc': 'DISCORD', 'uber': 'UBER'
    };

    if (fallbackApp && fallbackApp.trim() !== "" && fallbackApp !== "null") {
      const cleanCode = fallbackApp.toLowerCase().trim();
      if (codeMap[cleanCode]) return codeMap[cleanCode];
      return cleanCode.toUpperCase(); 
    }

    const msgLower = (message || "").toLowerCase();
    const popularApps = ['facebook', 'whatsapp', 'telegram', 'instagram', 'google', 'gmail', 'tiktok', 'apple', 'amazon', 'microsoft', 'netflix', 'yahoo', 'snapchat', 'twitter', 'uber', 'imo', 'discord', 'tinder', 'paypal', 'linkedin', 'viber', 'line'];
    
    for (const app of popularApps) {
      if (msgLower.includes(app)) return app.toUpperCase();
    }
    
    if (msgLower.includes(" fb ")) return "FACEBOOK";
    if (msgLower.includes(" ig ")) return "INSTAGRAM";
    if (msgLower.includes(" wa ")) return "WHATSAPP";
    if (msgLower.includes(" tg ")) return "TELEGRAM";

    return "OTHER"; 
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "Unknown Time";
    const date = new Date(Number(timestamp));
    if (!isNaN(date.getTime())) {
       return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
       });
    }
    return "Time Error";
  };

  const getTopAppsData = () => {
    const counts: Record<string, number> = {};
    liveLogs.slice(0, 50).forEach(log => {
      const msg = log.otp || log.fullMessage || "";
      const app = log.app || log.service || "";
      const source = getServiceName(msg, app);
      counts[source] = (counts[source] || 0) + 1;
    });
    
    let sorted = Object.keys(counts)
      .map(key => ({ name: key, value: counts[key] }))
      .sort((a, b) => b.value - a.value) 
      .slice(0, 8); 
    
    let pad = " ";
    while (sorted.length < 8) {
      sorted.push({ name: pad, value: 0 });
      pad += " ";
    }

    return sorted;
  };

  const graphData = getTopAppsData();
  const BAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308', '#F43F5E'];

  const getCarrierData = () => {
    const counts: any = {};
    liveLogs.slice(0, 50).forEach(log => {
      const carrier = log.operator || "Other";
      counts[carrier] = (counts[carrier] || 0) + 1;
    });
    
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  };

  const carrierData = getCarrierData();

  const filteredLogs = liveLogs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const fullMessage = (log.otp || log.fullMessage || "").toLowerCase();
    const number = String(log.number || log.searchNumber || "").toLowerCase();
    return fullMessage.includes(searchLower) || number.includes(searchLower);
  });

  return (
    <DashboardLayout>
      <div className="p-3 md:p-10 w-full relative z-10 pb-16">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
           <div className="lg:col-span-2 bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 rounded-xl shadow-lg h-[280px] md:h-[320px] flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6]"></div>
              
              <h3 className="text-xs md:text-sm font-black text-[#94A3B8] uppercase tracking-widest flex justify-between mb-2 md:mb-4">
                 Top Apps Live Trend
                 <span className="text-[8px] md:text-[9px] bg-[#0F172A] px-2 py-1 rounded border border-[#334155] text-[#3B82F6]">Global Data</span>
              </h3>
              
              <div className="flex-1 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graphData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#64748B" fontSize={9} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} tickCount={6} />
                    <Tooltip cursor={{fill: '#334155', opacity: 0.2}} contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px'}} formatter={(val: any) => val > 0 ? [val, 'OTPs'] : []} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      <LabelList dataKey="value" position="top" fill="#E2E8F0" fontSize={10} fontWeight="bold" formatter={(val: any) => val > 0 ? `${val}` : ''} />
                      {graphData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div className="lg:col-span-1 bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 rounded-xl shadow-lg h-[280px] md:h-[320px] flex flex-col">
              <h3 className="text-xs md:text-sm font-black text-[#94A3B8] uppercase tracking-widest mb-2">Carrier Distribution</h3>
              {carrierData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={carrierData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                      {carrierData.map((entry, index) => (
                        <PieCell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '12px'}} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#64748B] text-xs md:text-sm">Gathering network data...</div>
              )}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {carrierData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1 text-[9px] md:text-[10px] text-[#E2E8F0] font-bold">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}></div>
                    {entry.name} ({entry.value})
                  </div>
                ))}
              </div>
           </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
           <div className="relative w-full md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <svg className="w-3 h-3 md:w-4 md:h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input type="text" placeholder="Filter logs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-[#1E293B]/80 border border-[#334155] rounded-lg pl-9 pr-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-[#8B5CF6] transition-all placeholder:text-[#64748B]"
              />
           </div>
           <div className="flex items-center gap-2 bg-[#1E293B]/80 border border-[#334155] px-3 py-2 rounded-lg shadow-sm">
              <svg className={`w-3 h-3 md:w-4 md:h-4 text-[#8B5CF6] ${countdown === 1 ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-[10px] md:text-xs font-bold text-[#94A3B8]">Auto Sync: <span className="text-white">{countdown}s</span></span>
           </div>
        </div>

        {/* 💥 Compact List 💥 */}
        <div className="flex flex-col gap-2.5 w-full pb-10">
           {loading && liveLogs.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center bg-[#1E293B]/50 border border-[#334155] rounded-xl">
                 <div className="w-6 h-6 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-3"></div>
                 <h3 className="text-xs font-black text-[#94A3B8] uppercase tracking-widest">Connecting Database...</h3>
              </div>
           ) : errorMsg && liveLogs.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center bg-red-500/10 border border-red-500/30 rounded-xl">
                 <h3 className="text-sm font-black text-red-500 mb-1">API Error</h3>
                 <p className="text-xs text-red-400">{errorMsg}</p>
              </div>
           ) : filteredLogs.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center bg-[#1E293B]/50 border border-[#334155] rounded-xl">
                 <h3 className="text-sm font-black text-[#F8FAFC]">No Live Data Found</h3>
              </div>
           ) : (
              filteredLogs.slice(0, 100).map((log, index) => {
                
                const extractedMsg = log.otp || log.fullMessage || log.sms || "";
                const extractedNum = log.number || log.searchNumber || "Unknown";
                const extractedOp = log.operator || "Other";
                const extractedCountry = log.country || "GLOBAL"; 
                const sourceName = getServiceName(extractedMsg);
                const time = formatTime(log._fixedTime); 
                
                return (
                 <div key={index} className="bg-[#0B0F1A]/80 border border-[#334155] p-2.5 md:p-3 rounded-lg flex flex-col gap-1.5 relative group hover:bg-[#1E293B]/60 transition-colors shadow-sm">
                    {/* Accent Line */}
                    <div className="absolute left-0 top-0 w-1 h-full bg-[#3B82F6]/40 group-hover:bg-[#8B5CF6] transition-colors rounded-l-lg"></div>
                    
                    {/* 1st Row: Time, Country, Operator, App Badge */}
                    <div className="flex justify-between items-center ml-2">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="text-[9px] md:text-[10px] font-black text-[#F59E0B] tracking-widest">{time}</span>
                        <div className="flex items-center gap-1 bg-[#1E293B] border border-[#334155]/50 px-1.5 py-0.5 rounded">
                           <span className="text-[8px] md:text-[9px] font-bold text-[#94A3B8] max-w-[50px] md:max-w-none truncate">{extractedOp}</span>
                           <span className="text-[8px] text-[#475569]">|</span>
                           <span className="text-[8px] md:text-[9px] font-black text-[#10B981] flex items-center gap-0.5">
                             🌍 {String(extractedCountry).toUpperCase()}
                           </span>
                        </div>
                      </div>

                      <span className={`text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                        sourceName === 'FACEBOOK' ? 'bg-[#1877F2]/15 text-[#1877F2]' : 
                        sourceName === 'WHATSAPP' ? 'bg-[#25D366]/15 text-[#25D366]' : 
                        sourceName === 'INSTAGRAM' ? 'bg-[#E1306C]/15 text-[#E1306C]' : 
                        sourceName === 'GOOGLE' ? 'bg-[#EA4335]/15 text-[#EA4335]' : 
                        sourceName === 'TIKTOK' ? 'bg-[#00F2FE]/15 text-[#00F2FE]' : 
                        sourceName === 'OTHER' ? 'bg-[#64748B]/15 text-[#64748B]' : 
                        'bg-[#3B82F6]/15 text-[#3B82F6]'
                      }`}>
                        {sourceName}
                      </span>
                    </div>
                    
                    {/* 2nd Row: Number & OTP Message */}
                    <div className="ml-2 flex flex-col md:flex-row md:items-center gap-1 md:gap-3 font-mono">
                      <div className="flex items-center gap-2 text-white">
                        <span className="text-xs md:text-sm font-bold tracking-wider">{maskNumber(extractedNum)}</span>
                        <span className="hidden md:inline text-[#334155] font-black text-[10px]">➜</span>
                      </div>
                      
                      <div className="text-[10px] md:text-[11px] text-[#94A3B8] leading-tight flex-1 break-words">
                        <span className="text-[#10B981] font-black mr-1.5 md:hidden">↳</span>
                        <span className="text-[#10B981] font-black mr-1">&lt;#&gt;</span>
                        {maskFullMessage(extractedMsg)}
                      </div>
                    </div>
                 </div>
                );
              })
           )}
        </div>

      </div>
    </DashboardLayout>
  );
}