"use client";

import Link from "next/link";
import { useState } from "react";

export default function AccessList() {
  const [service, setService] = useState("");
  const [country, setCountry] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHasSearched(true);
    
    try {
      // 💥 API CALL TO LIVE MICROSERVICE 💥
      const API_BASE = "http://135.125.226.195:5000";
      const res = await fetch(`${API_BASE}/v1/access-list?service=${service}&country=${country}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        setResults(data.data);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Error fetching access list:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 💥 TIME CONVERSION LOGIC (UTC TO USER LOCAL TIME) 💥
  const formatTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const utcDate = new Date(dateStr.replace(' ', 'T') + 'Z');
      return utcDate.toLocaleString('en-US', {
        month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateStr;
    }
  };

  // 💥 TRAFFIC BADGE RENDERER 💥
  const getTrafficBadge = (level: string) => {
    if (level === "EXCELLENT") {
      return <span className="bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/50 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Excellent</span>;
    }
    if (level === "GOOD") {
      return <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/50 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Good</span>;
    }
    return <span className="bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/50 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Low Capacity</span>;
  };

  return (
    <div className="relative w-full h-screen p-4 md:p-8 flex items-center justify-center overflow-hidden bg-transparent font-sans">
      
      {/* 💥 CYBER GLOW BACKGROUND 💥 */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#00D2FF] rounded-full blur-[250px] opacity-[0.05] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-[#60A5FA] rounded-full blur-[200px] opacity-[0.03] pointer-events-none"></div>

      {/* 💥 FULL PAGE WIDTH & HEIGHT CONTAINER 💥 */}
      <div className="relative z-10 w-full h-full max-w-[1600px] flex flex-col">
        
        {/* 💥 MAIN MODULE CARD (FIXED HEIGHT) 💥 */}
        <div className="bg-[#0B152A]/90 border border-[#162749] backdrop-blur-2xl p-4 md:p-8 rounded-3xl shadow-[0_0_50px_rgba(0,210,255,0.05),inset_0_1px_4px_rgba(0,210,255,0.05)] w-full h-full flex flex-col relative overflow-hidden group">
           
           {/* 💥 SCANNER LINE ANIMATION 💥 */}
           <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00D2FF] to-transparent animate-[scan_2.5s_ease-in-out_infinite] shadow-[0_0_15px_#00D2FF]"></div>

           <div className="flex-shrink-0 flex flex-col items-center text-center mb-6 relative">
              <div className="w-16 h-16 bg-[#101726] border border-[#162749] rounded-full flex items-center justify-center relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] mb-4">
                 {/* 💥 SPINNING HUD RINGS 💥 */}
                 <div className="absolute inset-0 border-[2px] border-transparent border-t-[#00D2FF] border-r-[#00D2FF]/30 rounded-full animate-[spin_3s_linear_infinite]"></div>
                 <div className="absolute inset-2 border-[2px] border-transparent border-b-[#60A5FA] border-l-[#60A5FA]/30 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                 
                 <svg className="w-6 h-6 text-[#00D2FF] drop-shadow-[0_0_8px_rgba(0,210,255,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
              </div>

              <h2 className="text-xl md:text-3xl font-bold text-[#F8FAFC] tracking-widest uppercase mb-2">
                Network <span className="text-[#00D2FF]">Access List</span>
              </h2>
              <p className="text-[#6C84A3] text-sm font-medium leading-relaxed px-2 max-w-2xl text-center">
                Search global routing nodes by <span className="text-[#F8FAFC] font-semibold">Service</span> or <span className="text-[#F8FAFC] font-semibold">Country</span> to view live traffic, active prefixes, and real-time SMS templates.
              </p>
           </div>

           {/* 💥 SEARCH FORM 💥 */}
           <form onSubmit={handleSearch} className="flex-shrink-0 flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                 <input 
                    type="text" 
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    placeholder="Search Service (e.g. 1xbet, Facebook)" 
                    className="w-full bg-[#101726] border border-[#162749] focus:border-[#00D2FF] text-[#F8FAFC] px-4 py-3 md:py-4 rounded-xl outline-none transition-all placeholder-[#475569] text-sm md:text-base"
                 />
              </div>
              <div className="flex-1 relative">
                 <input 
                    type="text" 
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Search Country (e.g. Russia, Vietnam)" 
                    className="w-full bg-[#101726] border border-[#162749] focus:border-[#00D2FF] text-[#F8FAFC] px-4 py-3 md:py-4 rounded-xl outline-none transition-all placeholder-[#475569] text-sm md:text-base"
                 />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-[#101726] border border-[#162749] hover:border-[#00D2FF]/50 text-[#00D2FF] px-8 py-3 md:py-4 rounded-xl font-bold transition-all uppercase tracking-widest shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_20px_rgba(0,210,255,0.1)] flex items-center justify-center disabled:opacity-50 min-w-[150px]"
              >
                {loading ? "Scanning..." : "Search"}
              </button>
           </form>

           {/* 💥 RESULTS AREA (SCROLLABLE INSIDE) 💥 */}
           <div className="flex-1 min-h-0 bg-[#101726] border border-[#162749] rounded-2xl flex flex-col relative shadow-inner overflow-hidden">
              
              {loading && (
                 <div className="absolute inset-0 z-20 bg-[#101726]/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-[3px] border-transparent border-t-[#00D2FF] border-b-[#60A5FA] rounded-full animate-spin mb-4"></div>
                    <span className="text-[#00D2FF] text-xs tracking-widest uppercase animate-pulse">Extracting Live Network Data...</span>
                 </div>
              )}

              {!loading && hasSearched && results.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-[#6C84A3] p-10">
                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-base text-center">No active nodes found for your query. Try searching a different country or service.</p>
                 </div>
              )}

              {!loading && !hasSearched && (
                 <div className="h-full flex flex-col items-center justify-center text-[#475569] p-10">
                    <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    <p className="text-sm md:text-base uppercase tracking-widest text-center">Enter a query to view active network routes</p>
                 </div>
              )}

              {!loading && results.length > 0 && (
                 <div className="flex-1 w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-[#162749] scrollbar-track-transparent">
                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
                       <thead className="sticky top-0 z-10 text-xs text-[#6C84A3] uppercase tracking-wider bg-[#0B152A] shadow-[0_1px_0_#162749]">
                          <tr>
                             <th className="px-6 py-4 font-semibold w-[15%]">Service</th>
                             <th className="px-6 py-4 font-semibold w-[20%]">Country / Operator</th>
                             <th className="px-6 py-4 font-semibold w-[15%]">Prefix / Range</th>
                             <th className="px-6 py-4 font-semibold w-[10%]">Traffic</th>
                             <th className="px-6 py-4 font-semibold w-[25%]">Live Message Template</th>
                             <th className="px-6 py-4 font-semibold w-[15%] text-right">Last Update (Local)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-[#162749]">
                          {results.map((item: any, idx) => (
                             <tr key={idx} className="hover:bg-[#162749]/30 transition-colors">
                                <td className="px-6 py-4 align-top">
                                   <div className="flex items-center gap-2 mt-1">
                                      <span className="w-2 h-2 rounded-full bg-[#00D2FF] animate-pulse"></span>
                                      <span className="text-[#F8FAFC] font-medium">{item.service}</span>
                                   </div>
                                </td>
                                <td className="px-6 py-4 align-top text-[#94A3B8]">
                                   <div className="whitespace-normal mt-1">{item.country_operator}</div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                   <code className="bg-[#0B152A] text-[#00D2FF] px-2 py-1 rounded border border-[#162749] mt-0.5 inline-block">
                                      {item.prefix || "N/A"}
                                   </code>
                                </td>
                                <td className="px-6 py-4 align-top">
                                   <div className="mt-1">
                                     {getTrafficBadge(item.traffic_level)}
                                   </div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                   <div className="bg-[#0B152A]/50 border border-[#162749]/50 rounded-lg p-2 text-[#6C84A3] text-xs font-mono whitespace-normal leading-relaxed">
                                      {item.message_template}
                                   </div>
                                </td>
                                <td className="px-6 py-4 align-top text-right text-[#94A3B8] text-xs font-mono">
                                   <div className="mt-1">
                                      {formatTime(item.last_update)}
                                   </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
           </div>

           {/* 💥 RETURN BUTTON 💥 */}
           <div className="flex-shrink-0 text-center mt-6">
              <Link href="/" className="inline-flex items-center gap-2 bg-[#0B152A] border border-[#162749] hover:border-[#60A5FA]/50 text-[#6C84A3] hover:text-[#60A5FA] px-6 py-3 rounded-xl font-bold transition-all text-xs md:text-sm tracking-widest uppercase shadow-sm group/btn">
                 <svg className="w-4 h-4 md:w-5 md:h-5 text-[#6C84A3] group-hover/btn:text-[#60A5FA] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                 </svg>
                 Return to Terminal
              </Link>
           </div>
        </div>

      </div>

      {/* 💥 CSS ANIMATIONS & SCROLLBAR CUSTOMIZATION 💥 */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #162749;
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: #00D2FF;
        }
      `}} />
    </div>
  );
}