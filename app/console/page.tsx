"use client";

import { useState, useEffect } from "react"; 
import DashboardLayout from "../DashboardLayout"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Cell as PieCell, LabelList } from 'recharts';

export default function Console() {
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // 💥 রিফ্রেশ রেট ১০ সেকেন্ড করে দেওয়া হলো, যাতে 429 Error না আসে 💥
  const [countdown, setCountdown] = useState(10);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const getPermanentTime = (uniqueKey: string, apiTime: any) => {
    if (typeof window === "undefined") return Date.now(); 

    const storageKey = `zenex_otp_time_${uniqueKey}`;
    const savedTime = localStorage.getItem(storageKey);

    if (savedTime) {
      return Number(savedTime);
    }

    const newTime = apiTime || Date.now();
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
        // যদি একবার error আসে, আগের ডাটা থাকলে মুছবে না, শুধু error text দেখাবে
        if (liveLogs.length === 0) setErrorMsg(responseData.error);
        setLoading(false);
        return;
      }

      let rawOtps = [];
      if (responseData.data && Array.isArray(responseData.data)) {
        rawOtps = responseData.data;
      } else if (responseData.data?.otps && Array.isArray(responseData.data.otps)) {
        rawOtps = responseData.data.otps;
      } else if (responseData.data?.records && Array.isArray(responseData.data.records)) {
        rawOtps = responseData.data.records;
      } else if (responseData.otps && Array.isArray(responseData.otps)) {
        rawOtps = responseData.otps;
      } else if (Array.isArray(responseData)) {
        rawOtps = responseData;
      }
      
      if (rawOtps.length > 0) {
        setErrorMsg("");
        const processedLogs = rawOtps.map((log: any) => {
          const rawNum = String(log.number || log.searchNumber || log.num || log.phone || "").replace(/[^0-9]/g, '');
          const rawMsg = String(log.sms || log.fullMessage || log.otp || log.msg || "").replace(/\s/g, '').substring(0, 30);
          
          const uniqueKey = `LOCK_${rawNum}_${rawMsg}`;

          return {
            ...log,
            _fixedTime: getPermanentTime(uniqueKey, log.time || log.createdAt || log.date)
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
          return 10; // ১০ সেকেন্ড পর পর রিলোড
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
    const popularApps = ['facebook', 'whatsapp', 'telegram', 'instagram', 'google', 'gmail', 'tiktok', 'apple', 'amazon', 'microsoft', 'netflix', 'yahoo', 'snapchat', 'twitter', 'uber', 'imo', 'discord', 'tinder', 'airbnb', 'paypal', 'alibaba', 'linkedin', 'viber', 'line'];
    
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
    try {
      if (!timestamp) return "Unknown Time";
      let date;
      
      if (typeof timestamp === 'number' || !isNaN(Number(timestamp))) {
         const num = Number(timestamp);
         date = new Date(num < 10000000000 ? num * 1000 : num);
      } else {
         date = new Date(timestamp);
      }
      
      if (!isNaN(date.getTime())) {
         return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
         });
      }
      return String(timestamp);
    } catch {
      return "Time Error";
    }
  };

  const getTopAppsData = () => {
    const counts: Record<string, number> = {};
    liveLogs.slice(0, 50).forEach(log => {
      const msg = log.sms || log.fullMessage || log.msg || log.otp || "";
      const app = log.app || log.service || "";
      const source = getServiceName(msg, app);
      counts[source] = (counts[source] || 0) + 1;
    });
    
    return Object.keys(counts)
      .map(key => ({ name: key, value: counts[key] }))
      .sort((a, b) => b.value - a.value) 
      .slice(0, 8); 
  };

  const graphData = getTopAppsData();
  const BAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308', '#F43F5E'];

  const getCarrierData = () => {
    const counts: any = {};
    liveLogs.slice(0, 50).forEach(log => {
      const carrier = log.operator || log.optr || log.carrier || "Other";
      counts[carrier] = (counts[carrier] || 0) + 1;
    });
    
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  };

  const carrierData = getCarrierData();

  const filteredLogs = liveLogs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const fullMessage = (log.sms || log.fullMessage || log.msg || log.otp || "").toLowerCase();
    const number = String(log.number || log.searchNumber || log.num || "").toLowerCase();
    return fullMessage.includes(searchLower) || number.includes(searchLower);
  });

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full relative z-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
           
           <div className="lg:col-span-2 bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6 rounded-2xl shadow-lg h-[320px] flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6]"></div>
              
              <h3 className="text-sm font-black text-[#94A3B8] uppercase tracking-widest flex justify-between mb-4">
                 Top Apps Live Trend
                 <span className="text-[9px] bg-[#0F172A] px-2 py-1 rounded border border-[#334155] text-[#3B82F6]">Global Data</span>
              </h3>
              {graphData.length > 0 ? (
                <div className="flex-1 mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graphData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                      <XAxis dataKey="name" stroke="#64748B" fontSize={9} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" />
                      <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} tickCount={6} />
                      <Tooltip cursor={{fill: '#334155', opacity: 0.2}} contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff'}} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                        <LabelList dataKey="value" position="top" fill="#E2E8F0" fontSize={11} fontWeight="bold" formatter={(val: number) => `${val} OTP`} />
                        {graphData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#64748B] text-sm">Waiting for live data...</div>
              )}
           </div>

           <div className="lg:col-span-1 bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-6 rounded-2xl shadow-lg h-[320px] flex flex-col">
              <h3 className="text-sm font-black text-[#94A3B8] uppercase tracking-widest mb-2">Carrier Distribution</h3>
              {carrierData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={carrierData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                      {carrierData.map((entry, index) => (
                        <PieCell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px'}} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#64748B] text-sm">Gathering network data...</div>
              )}
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {carrierData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1 text-[10px] text-[#E2E8F0] font-bold">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}></div>
                    {entry.name} ({entry.value})
                  </div>
                ))}
              </div>
           </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
           <div className="relative w-full md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input type="text" placeholder="Filter logs (number, sms...)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-[#1E293B]/80 border border-[#334155] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8B5CF6] transition-all placeholder:text-[#64748B]"
              />
           </div>
           <div className="flex items-center gap-2 bg-[#1E293B]/80 border border-[#334155] px-4 py-2.5 rounded-xl shadow-lg">
              <svg className={`w-4 h-4 text-[#8B5CF6] ${countdown === 1 ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-xs font-bold text-[#94A3B8]">Auto Sync: <span className="text-white">{countdown}s</span></span>
           </div>
        </div>

        <div className="flex flex-col gap-4 w-full pb-10">
           {loading && liveLogs.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center bg-[#1E293B]/50 border border-[#334155] rounded-2xl">
                 <div className="w-8 h-8 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-4"></div>
                 <h3 className="text-sm font-black text-[#94A3B8] uppercase tracking-widest">Connecting to Global Database...</h3>
              </div>
           ) : errorMsg && liveLogs.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center bg-red-500/10 border border-red-500/30 rounded-2xl">
                 <h3 className="text-lg font-black text-red-500 mb-2">API Connection Error</h3>
                 <p className="text-sm text-red-400">{errorMsg}</p>
                 <p className="text-xs text-slate-500 mt-2">Cloudflare might be blocking the request, or tokens have expired.</p>
              </div>
           ) : filteredLogs.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center bg-[#1E293B]/50 border border-[#334155] rounded-2xl">
                 <h3 className="text-lg font-black text-[#F8FAFC]">No Live Data Found</h3>
              </div>
           ) : (
              filteredLogs.slice(0, 100).map((log, index) => {
                
                const extractedMsg = log.sms || log.fullMessage || log.msg || log.otp || "";
                const extractedNum = log.number || log.searchNumber || log.num || "Unknown";
                const extractedOp = log.operator || log.optr || log.carrier || "Other";
                const extractedCountry = log.country || log.iso || "GLOBAL"; 
                
                const sourceName = getServiceName(extractedMsg, log.app || log.service);
                const time = formatTime(log._fixedTime); 
                
                return (
                 <div key={index} className="bg-[#0B0F19] border border-[#334155] p-5 rounded-xl flex flex-col gap-3 relative overflow-hidden group hover:border-[#8B5CF6]/50 transition-colors shadow-lg">
                    <div className="absolute left-0 top-0 w-1 h-full bg-[#3B82F6]/30 group-hover:bg-[#8B5CF6] transition-colors"></div>
                    <div className="flex justify-between items-center ml-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        
                        <span className="text-sm font-black text-[#F59E0B] tracking-widest">{time}</span>
                        
                        <div className="flex items-center gap-1 bg-[#1E293B] border border-[#334155] px-2 py-0.5 rounded">
                           <span className="text-xs font-bold text-[#94A3B8]">{extractedOp}</span>
                           <span className="text-xs text-[#475569]">|</span>
                           <span className="text-xs font-black text-[#10B981] flex items-center gap-1">
                             🌍 {String(extractedCountry).toUpperCase()}
                           </span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest ${
                        sourceName === 'FACEBOOK' ? 'bg-[#1877F2]/10 text-[#1877F2]' : 
                        sourceName === 'WHATSAPP' ? 'bg-[#25D366]/10 text-[#25D366]' : 
                        sourceName === 'INSTAGRAM' ? 'bg-[#E1306C]/10 text-[#E1306C]' : 
                        sourceName === 'GOOGLE' ? 'bg-[#EA4335]/10 text-[#EA4335]' : 
                        sourceName === 'APPLE' ? 'bg-[#A3AAAE]/10 text-[#A3AAAE]' : 
                        sourceName === 'TIKTOK' ? 'bg-[#00F2FE]/10 text-[#00F2FE]' : 
                        sourceName === 'OTHER' ? 'bg-[#64748B]/10 text-[#64748B]' : 
                        'bg-[#3B82F6]/10 text-[#3B82F6]'
                      }`}>
                        {sourceName}
                      </span>
                    </div>
                    
                    <div className="ml-2 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 font-mono mt-1">
                      <div className="flex items-center gap-2 text-white">
                        <span className="text-[#8B5CF6] font-black">::</span>
                        <span className="text-lg font-bold tracking-wider">{maskNumber(extractedNum)}</span>
                      </div>
                      <span className="hidden md:block text-[#334155] font-black">➜</span>
                      <span className="md:hidden text-[#334155] font-black">↳</span>
                      <div className="flex-1 bg-[#1E293B]/50 border border-[#334155] p-2.5 rounded-lg text-[#94A3B8] text-sm break-words border-l-2 border-l-[#10B981]/50 group-hover:border-l-[#10B981] transition-colors">
                        <span className="text-[#10B981] font-black mr-2">&lt;#&gt;</span>
                        {/* 💥 এখানে OTP হাইড হয়ে দেখাবে 💥 */}
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