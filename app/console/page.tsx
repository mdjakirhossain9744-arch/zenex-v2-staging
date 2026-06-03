"use client";

import { useState, useEffect } from "react"; 
import DashboardLayout from "../DashboardLayout"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Cell as PieCell, LabelList } from 'recharts';

export default function Console() {
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [carrierData, setCarrierData] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState("");

  // Simple, Clean & Premium Minimalist Color Palette
  const BAR_COLORS = [
    '#3B82F6', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', 
    '#6366F1', '#8B5CF6', '#A855F7', '#F43F5E', '#64748B'
  ];

  const fetchGlobalData = async () => {
    try {
      const res = await fetch(`/api/live-console?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      
      if (data.success) {
        const expandedLogs: any[] = [];
        
        (data.logs || []).forEach((log: any) => {
           const otpString = log.otp || "";
           if (otpString.includes('_||_')) {
              const parts = otpString.split('_||_');
              parts.forEach((part: string, idx: number) => {
                 if (part.trim()) {
                   expandedLogs.push({
                      ...log,
                      id: `${log.id}_multi_${idx}`,
                      otp: part.trim() 
                   });
                 }
              });
           } else {
              expandedLogs.push(log);
           }
        });

        setLiveLogs(expandedLogs); 
        setGraphData(data.graph || []); 
        setCarrierData(data.carrier || []);
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
    if (cleanNum.length > 9) return `${cleanNum.substring(0, 9)}XXX`;
    return cleanNum; 
  };

  const extractTargetRange = (num: string) => {
    if (!num) return "Unknown";
    const cleanNum = String(num).replace("+", "");
    if (cleanNum.length >= 6) return `${cleanNum.substring(0, 6)}XXX`;
    if (cleanNum.length >= 5) return `${cleanNum.substring(0, 5)}XXX`;
    return cleanNum;
  };

  const analyzeOTP = (service: string, fullMessage: string) => {
    if (service?.toUpperCase() !== "FACEBOOK") return null;
    const match = fullMessage?.match(/\b\d{4,8}\b/);
    if (!match) return null;
    
    const code = match[0];
    if (code.length === 6 || code.length === 8) {
      return { tag: "Fb Clone 🔥", color: "text-[#F43F5E]", bg: "bg-[#F43F5E]/10 border-[#F43F5E]/30" };
    }
    if (code.length === 5) {
      return { tag: "New Fb", color: "text-[#3B82F6]", bg: "bg-[#3B82F6]/10 border-[#3B82F6]/30" };
    }
    return null;
  };

  const maskFullMessage = (message: string) => {
    if (!message) return "";
    const otpRegex = /(\b\d{4,8}\b)|(\b\d{3}[\s-]\d{3,4}\b)|(G-\d{6,8})/gi;
    return message.replace(otpRegex, (match) => "*".repeat(match.length));
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "Unknown Time";
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) 
      ? date.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) 
      : "Time Error";
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(""), 2000);
  };

  const filteredLogs = liveLogs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const fullMessage = (log.otp || "").toLowerCase();
    const number = String(log.number || "").toLowerCase();
    return fullMessage.includes(searchLower) || number.includes(searchLower);
  });

  // 💥 FIXED: Top 15 Ranges Logic 💥
  const getTopRangesData = () => {
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
    
    const recentCounts: Record<string, any> = {};
    const olderCounts: Record<string, any> = {};

    liveLogs.forEach(log => {
      const range = extractTargetRange(log.number);
      if (range === "Unknown") return;

      const fbData = analyzeOTP(log.service, log.otp);
      const key = `${range}|${log.service}|${fbData ? fbData.tag : 'General'}`;

      if (log.createdAt >= thirtyMinsAgo) {
        if (!recentCounts[key]) recentCounts[key] = { count: 0, platform: log.service, fbTag: fbData ? fbData.tag : null, isRecent: true };
        recentCounts[key].count += 1;
      } else {
        if (!olderCounts[key]) olderCounts[key] = { count: 0, platform: log.service, fbTag: fbData ? fbData.tag : null, isRecent: false };
        olderCounts[key].count += 1;
      }
    });

    const recentSorted = Object.entries(recentCounts).sort((a, b) => b[1].count - a[1].count);
    const olderSorted = Object.entries(olderCounts).sort((a, b) => b[1].count - a[1].count);

    let finalRanges = [...recentSorted];

    // Ensure up to 15 unique ranges are processed
    if (finalRanges.length < 15) {
      for (const oldItem of olderSorted) {
        if (!finalRanges.find(r => r[0] === oldItem[0])) {
          finalRanges.push(oldItem);
        }
        if (finalRanges.length >= 15) break;
      }
    }

    return { 
      ranges: finalRanges.slice(0, 15), 
      isFresh: recentSorted.length > 0,
      recentCount: recentSorted.length
    };
  };

  const topData = getTopRangesData();
  const badgeText = topData.recentCount >= 4 ? 'Last 30m' : (topData.recentCount > 0 ? 'Live & Recent' : 'Recent Hits');

  // 💥 NEW: Graph Data Processing & Dynamic Width Logic 💥
  const processedGraphData = [...graphData]
    .sort((a, b) => b.value - a.value) // Sort Highest to Lowest
    .slice(0, 10); // Show Top 10 Only

  const totalApps = processedGraphData.length;
  let dynamicBarWidth = 30;
  if (totalApps <= 3) {
    dynamicBarWidth = 60;
  } else if (totalApps <= 5) {
    dynamicBarWidth = 45;
  }

  return (
    <>
      {copiedText && (
        <div style={{ zIndex: 9999999 }} className="fixed bottom-6 right-6 md:bottom-10 md:right-10 bg-[#0F172A] border-l-4 border-[#10B981] text-[#E2E8F0] px-4 py-3 rounded shadow-2xl animate-bounce-in flex items-center gap-3 pointer-events-none">
          <div className="w-5 h-5 bg-[#10B981]/20 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
             <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Range Copied</p>
             <p className="text-xs font-black tracking-widest text-white">{copiedText}</p>
          </div>
        </div>
      )}

      <DashboardLayout>
        <div className="p-3 md:p-10 w-full relative z-10 pb-16">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
             
             {/* 💥 FIXED: Top Apps Chart - Fully Optimized & Responsive 💥 */}
             <div className="lg:col-span-1 bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 rounded-xl shadow-lg h-[280px] md:h-[320px] flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6]"></div>
                <h3 className="text-xs md:text-sm font-black text-[#94A3B8] uppercase tracking-widest flex justify-between mb-1">
                   Top Apps
                   <span className="text-[8px] md:text-[9px] bg-[#0F172A] px-2 py-1 rounded border border-[#334155] text-[#10B981] animate-pulse">Live</span>
                </h3>
                
                <div className="flex-1 mt-2 relative w-full overflow-x-auto custom-scrollbar">
                  <div style={{ minWidth: totalApps > 5 ? '400px' : '100%', height: '100%', minHeight: '180px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedGraphData} margin={{ top: 20, right: 10, left: -20, bottom: 25 }} barCategoryGap="15%">
                        <XAxis 
                           dataKey="name" 
                           stroke="#64748B" 
                           fontSize={10} 
                           tickLine={false} 
                           axisLine={false} 
                           interval={0} 
                           angle={-35} 
                           textAnchor="end" 
                        />
                        <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip cursor={{fill: '#334155', opacity: 0.2}} contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff'}} formatter={(val: any) => val > 0 ? [val, 'OTPs'] : []} />
                        <Bar dataKey="value" barSize={dynamicBarWidth} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="value" position="top" fill="#E2E8F0" fontSize={10} fontWeight="bold" formatter={(val: any) => val > 0 ? `${val}` : ''} />
                          {processedGraphData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
             </div>

             {/* Carriers Chart */}
             <div className="lg:col-span-1 bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 rounded-xl shadow-lg h-[280px] md:h-[320px] flex flex-col relative">
                <h3 className="text-xs md:text-sm font-black text-[#94A3B8] uppercase tracking-widest mb-2">Carrier Dist.</h3>
                {carrierData.length > 0 ? (
                  <div style={{ width: '100%', height: '160px' }} className="flex-1 relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                      <PieChart>
                        <Pie data={carrierData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none" isAnimationActive={false}>
                          {carrierData.map((entry, index) => (
                            <PieCell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '12px'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[#64748B] text-xs md:text-sm">Waiting for data...</div>
                )}
                <div className="flex flex-wrap justify-center gap-2 mt-2 custom-scrollbar overflow-y-auto max-h-[60px]">
                  {carrierData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1 text-[9px] md:text-[10px] text-[#E2E8F0] font-bold bg-[#0F172A] px-2 py-1 rounded-md border border-[#334155]">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}></div>
                      {entry.name}
                    </div>
                  ))}
                </div>
             </div>

             {/* Top Hit Ranges Card (15 Ranges Limit) */}
             <div className="lg:col-span-1 bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 rounded-xl shadow-lg h-[280px] md:h-[320px] flex flex-col relative overflow-hidden group">
                <div className={`absolute top-0 right-0 w-full h-1 bg-gradient-to-r ${topData.isFresh ? 'from-[#10B981] to-[#F43F5E]' : 'from-[#EAB308] to-[#F59E0B]'}`}></div>
                
                <div className="flex justify-between items-center mb-4 border-b border-[#334155] pb-3 shrink-0">
                   <h3 className="text-xs md:text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      Top Hit Ranges
                   </h3>
                   
                   <div className="flex items-center gap-1.5 bg-[#0F172A] px-2 py-1 rounded-md border border-[#334155]">
                     <span className="relative flex h-2 w-2">
                       {topData.isFresh && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F43F5E] opacity-75"></span>}
                       <span className={`relative inline-flex rounded-full h-2 w-2 ${topData.isFresh ? 'bg-[#F43F5E]' : 'bg-[#EAB308]'}`}></span>
                     </span>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${topData.isFresh ? 'text-[#F43F5E]' : 'text-[#EAB308]'}`}>
                        {badgeText}
                     </span>
                   </div>
                </div>

                <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2 pb-2">
                   {topData.ranges.length > 0 ? topData.ranges.map(([key, data], idx) => {
                      const range = key.split('|')[0];
                      return (
                        <button 
                           key={idx} 
                           onClick={() => handleCopy(range)}
                           className="w-full flex items-center justify-between bg-[#0F172A] hover:bg-[#3B82F6]/10 border border-[#334155] hover:border-[#3B82F6] px-3 py-2.5 rounded-lg transition-all group/btn shrink-0"
                        >
                           <div className="flex flex-col items-start gap-1 relative pl-3">
                              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${data.isRecent ? 'bg-[#10B981] shadow-[0_0_5px_#10B981]' : 'bg-[#475569]'}`}></div>
                              
                              <span className="text-sm font-black text-white font-mono group-hover/btn:text-[#3B82F6] transition-colors">{range}</span>
                              <div className="flex items-center gap-1.5">
                                 <span className="text-[9px] font-bold text-[#94A3B8]">{data.platform}</span>
                                 {data.fbTag && (
                                   <span className={`text-[8px] font-black px-1.5 py-[1px] rounded border ${
                                      data.fbTag.includes("Fb Clone") ? "text-[#F43F5E] bg-[#F43F5E]/10 border-[#F43F5E]/30" : "text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30"
                                   }`}>
                                      {data.fbTag}
                                   </span>
                                 )}
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold bg-[#1E293B] text-[#10B981] px-2 py-1 rounded border border-[#10B981]/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]">{data.count} Hits</span>
                              <svg className="w-4 h-4 text-[#64748B] group-hover/btn:text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                           </div>
                        </button>
                      )
                   }) : (
                      <div className="text-center text-[#64748B] text-xs h-full flex flex-col items-center justify-center gap-2">
                         <svg className="w-6 h-6 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         Waiting for Data...
                      </div>
                   )}
                </div>
             </div>

          </div>

          {/* Filters & Timer */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
             <div className="relative w-full md:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <svg className="w-3 h-3 md:w-4 md:h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input type="text" placeholder="Filter by number or code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full bg-[#1E293B]/80 border border-[#334155] rounded-lg pl-9 pr-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-[#8B5CF6] transition-all"
                />
             </div>
             <div className="flex items-center gap-2 bg-[#1E293B]/80 border border-[#334155] px-3 py-2 rounded-lg shadow-sm">
                <svg className={`w-3 h-3 md:w-4 md:h-4 text-[#8B5CF6] ${countdown === 1 ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-[10px] md:text-xs font-bold text-[#94A3B8]">Auto Sync in: <span className="text-white">{countdown}s</span></span>
             </div>
          </div>

          {/* Live Logs Feed (Strictly 50 Items) */}
          <div className="flex flex-col gap-2 w-full pb-10">
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
                filteredLogs.slice(0, 50).map((log, index) => {
                  const time = formatTime(log.createdAt); 
                  const targetRange = extractTargetRange(log.number);
                  const bigMaskedNumber = maskNumber(log.number);

                  return (
                   <div key={log.id || index} className="bg-[#0B0F1A]/80 border border-[#334155] p-3 md:p-4 rounded-lg flex flex-col gap-2 relative group hover:bg-[#1E293B]/60 transition-colors shadow-sm">
                      <div className="absolute left-0 top-0 w-1 h-full bg-[#3B82F6]/40 group-hover:bg-[#8B5CF6] transition-colors rounded-l-lg"></div>
                      
                      <div className="flex flex-wrap justify-between items-center ml-2 border-b border-[#334155]/50 pb-2 gap-2">
                        <div className="flex flex-wrap items-center gap-2 md:gap-3">
                          <span className="text-[10px] md:text-xs font-black text-[#F59E0B] tracking-widest">{time}</span>
                          <span className="text-[10px] md:text-xs font-bold text-[#94A3B8]">{log.operator || "Carrier"}</span>
                          <span className="text-[10px] text-[#475569]">|</span>
                          <span className="text-[10px] md:text-xs font-black text-[#10B981] flex items-center gap-1">
                            🌍 {String(log.country || "Global").toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
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
                      </div>
                      
                      <div className="ml-2 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 font-mono mt-1">
                        
                        <div 
                           onClick={() => handleCopy(bigMaskedNumber)}
                           className="flex items-center gap-2 text-white min-w-[140px] cursor-pointer hover:text-[#10B981] transition-colors group/bignum"
                           title="Click to copy this number range"
                        >
                          <span className="text-sm md:text-base font-bold tracking-wider text-[#E2E8F0] group-hover/bignum:text-[#10B981]">{bigMaskedNumber}</span>
                        </div>
                        
                        <button 
                          onClick={() => handleCopy(targetRange)}
                          className="flex items-center gap-1.5 bg-[#0F172A] border border-[#334155] hover:border-[#10B981] px-2.5 py-1 rounded cursor-pointer transition-all group/range w-fit shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
                          title="Copy Network Block to Buy Number"
                        >
                           <span className="text-[10px] md:text-xs font-black text-[#3B82F6] group-hover/range:text-[#10B981] transition-colors">{targetRange}</span>
                           <svg className="w-3 h-3 text-[#64748B] group-hover/range:text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>

                        <span className="hidden md:inline text-[#334155] font-black text-xs">➜</span>
                        
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
    </>
  );
}