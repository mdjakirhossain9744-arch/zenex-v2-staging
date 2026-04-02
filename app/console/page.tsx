"use client";

import { useState, useEffect } from "react"; 
import DashboardLayout from "../DashboardLayout"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Cell as PieCell, LabelList } from 'recharts';

export default function Console() {
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [loading, setLoading] = useState(true);

  const BAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308', '#F43F5E'];

  const fetchGlobalData = async () => {
    try {
      const res = await fetch(`/api/live-console?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      
      if (data.success) {
        const sortedLogs = (data.logs || []).sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setLiveLogs(sortedLogs);
        setGraphData(data.graph || []);
      }
    } catch (error) {
      console.error("Failed to fetch live console data");
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
          return 5; 
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
    return message.replace(/\b\d{4,8}\b/g, "******");
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "Unknown Time";
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : "Time Error";
  };

  const getCarrierData = () => {
    const counts: any = {};
    liveLogs.slice(0, 50).forEach(log => {
      const carrier = log.operator || "Other";
      counts[carrier] = (counts[carrier] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a, b) => b.value - a.value).slice(0, 5);
  };

  const carrierData = getCarrierData();

  const filteredLogs = liveLogs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const fullMessage = (log.otp || "").toLowerCase();
    const number = String(log.number || "").toLowerCase();
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
                 <span className="text-[8px] md:text-[9px] bg-[#0F172A] px-2 py-1 rounded border border-[#334155] text-[#10B981] animate-pulse">Live Updating</span>
              </h3>
              
              <div className="flex-1 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graphData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#64748B" fontSize={9} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{fill: '#334155', opacity: 0.2}} contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff'}} formatter={(val: any) => val > 0 ? [val, 'OTPs'] : []} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
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
                    <Pie data={carrierData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none" isAnimationActive={false}>
                      {carrierData.map((entry, index) => (
                        <PieCell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '12px'}} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#64748B] text-xs md:text-sm">Waiting for data...</div>
              )}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {carrierData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1 text-[9px] md:text-[10px] text-[#E2E8F0] font-bold">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}></div>
                    {entry.name}
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
                 className="w-full bg-[#1E293B]/80 border border-[#334155] rounded-lg pl-9 pr-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-[#8B5CF6] transition-all"
              />
           </div>
           <div className="flex items-center gap-2 bg-[#1E293B]/80 border border-[#334155] px-3 py-2 rounded-lg shadow-sm">
              <svg className={`w-3 h-3 md:w-4 md:h-4 text-[#8B5CF6] ${countdown === 1 ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-[10px] md:text-xs font-bold text-[#94A3B8]">Sync in: <span className="text-white">{countdown}s</span></span>
           </div>
        </div>

        <div className="flex flex-col gap-2.5 w-full pb-10">
           {loading && liveLogs.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center bg-[#1E293B]/50 border border-[#334155] rounded-xl">
                 <div className="w-6 h-6 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-3"></div>
                 <h3 className="text-xs font-black text-[#94A3B8] uppercase tracking-widest">Connecting Live Stream...</h3>
              </div>
           ) : filteredLogs.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center bg-[#1E293B]/50 border border-[#334155] rounded-xl">
                 <h3 className="text-sm font-black text-[#F8FAFC]">No Live Data Found</h3>
              </div>
           ) : (
              filteredLogs.map((log, index) => {
                const time = formatTime(log.createdAt); 
                return (
                 <div key={log.id || index} className="bg-[#0B0F1A]/80 border border-[#334155] p-3 md:p-4 rounded-lg flex flex-col gap-2 relative group hover:bg-[#1E293B]/60 transition-colors shadow-sm">
                    <div className="absolute left-0 top-0 w-1 h-full bg-[#3B82F6]/40 group-hover:bg-[#8B5CF6] transition-colors rounded-l-lg"></div>
                    
                    <div className="flex justify-between items-center ml-2 border-b border-[#334155]/50 pb-2">
                      <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-[10px] md:text-xs font-black text-[#F59E0B] tracking-widest">{time}</span>
                        <span className="text-[10px] md:text-xs font-bold text-[#94A3B8]">{log.operator}</span>
                        <span className="text-[10px] text-[#475569]">|</span>
                        <span className="text-[10px] md:text-xs font-black text-[#10B981] flex items-center gap-1">
                          🌍 {String(log.country).toUpperCase()}
                        </span>
                      </div>

                      <span className={`text-[9px] md:text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest ${
                        log.service === 'FACEBOOK' ? 'bg-[#1877F2]/15 text-[#1877F2]' : 
                        log.service === 'WHATSAPP' ? 'bg-[#25D366]/15 text-[#25D366]' : 
                        log.service === 'INSTAGRAM' ? 'bg-[#E1306C]/15 text-[#E1306C]' : 
                        log.service === 'GOOGLE' ? 'bg-[#EA4335]/15 text-[#EA4335]' : 
                        log.service === 'PAYPAL' ? 'bg-[#00457C]/20 text-[#0079C1]' : 
                        log.service === 'OTHER' ? 'bg-[#64748B]/15 text-[#64748B]' : 
                        'bg-[#3B82F6]/15 text-[#3B82F6]'
                      }`}>
                        {log.service}
                      </span>
                    </div>
                    
                    <div className="ml-2 flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 font-mono mt-1">
                      <div className="flex items-center gap-2 text-white">
                        <span className="text-sm md:text-base font-bold tracking-wider">{maskNumber(log.number)}</span>
                        <span className="hidden md:inline text-[#334155] font-black text-xs">➜</span>
                      </div>
                      
                      <div className="text-[11px] md:text-xs text-[#94A3B8] leading-relaxed flex-1 break-words">
                        <span className="text-[#10B981] font-black mr-1.5 md:hidden">↳</span>
                        <span className="text-[#10B981] font-black mr-1">&lt;#&gt;</span>
                        {maskFullMessage(log.otp)}
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