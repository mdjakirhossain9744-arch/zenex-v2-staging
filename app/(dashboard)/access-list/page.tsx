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
      return <span className="bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Excellent</span>;
    }
    if (level === "GOOD") {
      return <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Good</span>;
    }
    return <span className="bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Low Capacity</span>;
  };

  return (
    <div className="relative w-full h-screen p-2 md:p-4 flex items-center justify-center overflow-hidden bg-[#050A15] font-sans">
      
      {/* 💥 LAG-FREE HARDWARE ACCELERATED BACKGROUND 💥 */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vh] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#00D2FF]/10 to-transparent pointer-events-none transform-gpu"></div>
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vh] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#60A5FA]/10 to-transparent pointer-events-none transform-gpu"></div>

      {/* 💥 FULL PAGE WIDTH & MAXIMUM HEIGHT CONTAINER 💥 */}
      <div className="relative z-10 w-full h-[98vh] max-w-[1600px] flex flex-col">
        
        {/* 💥 MAIN MODULE CARD (COMPACT HEIGHT OPTIMIZED) 💥 */}
        <div className="bg-[#0B152A]/95 border border-[#162749] p-3 md:p-5 rounded-2xl shadow-[0_0_50px_rgba(0,210,255,0.05),inset_0_1px_4px_rgba(0,210,255,0.05)] w-full h-full flex flex-col relative overflow-hidden group">
           
           <div className="flex-shrink-0 flex flex-col items-center text-center mb-3 relative">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#101726] border border-[#162749] rounded-full flex items-center justify-center relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] mb-2">
                 <div className="absolute inset-0 border-[2px] border-transparent border-t-[#00D2FF] border-r-[#00D2FF]/30 rounded-full animate-[spin_3s_linear_infinite]"></div>
                 <div className="absolute inset-1.5 border-[2px] border-transparent border-b-[#60A5FA] border-l-[#60A5FA]/30 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                 <svg className="w-4 h-4 md:w-5 md:h-5 text-[#00D2FF] drop-shadow-[0_0_8px_rgba(0,210,255,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
              </div>
              <h2 className="text-lg md:text-2xl font-bold text-[#F8FAFC] tracking-widest uppercase">
                Network <span className="text-[#00D2FF]">Access List</span>
              </h2>
           </div>

           {/* 💥 SEARCH FORM 💥 */}
           <form onSubmit={handleSearch} className="flex-shrink-0 flex flex-col md:flex-row gap-3 mb-3">
              <div className="flex-1 relative">
                 <input 
                    type="text" 
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    placeholder="Search Service (e.g. 1xbet, Facebook)" 
                    className="w-full bg-[#101726] border border-[#162749] focus:border-[#00D2FF] text-[#F8FAFC] px-3 py-2.5 rounded-lg outline-none transition-all placeholder-[#475569] text-sm"
                 />
              </div>
              <div className="flex-1 relative">
                 <input 
                    type="text" 
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Search Country (e.g. Russia, Vietnam)" 
                    className="w-full bg-[#101726] border border-[#162749] focus:border-[#00D2FF] text-[#F8FAFC] px-3 py-2.5 rounded-lg outline-none transition-all placeholder-[#475569] text-sm"
                 />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-[#101726] border border-[#162749] hover:border-[#00D2FF]/50 text-[#00D2FF] px-6 py-2.5 rounded-lg font-bold transition-all uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_20px_rgba(0,210,255,0.1)] flex items-center justify-center disabled:opacity-50 min-w-[120px]"
              >
                {loading ? "Scanning..." : "Search"}
              </button>
           </form>

           {/* 💥 COMPACT RESULTS AREA 💥 */}
           <div className="flex-1 min-h-0 bg-[#101726] border border-[#162749] rounded-xl flex flex-col relative shadow-inner overflow-hidden">
              
              {loading && (
                 <div className="absolute inset-0 z-20 bg-[#101726]/80 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-[3px] border-transparent border-t-[#00D2FF] border-b-[#60A5FA] rounded-full animate-spin mb-3"></div>
                    <span className="text-[#00D2FF] text-[10px] tracking-widest uppercase animate-pulse">Extracting Live Data...</span>
                 </div>
              )}

              {!loading && hasSearched && results.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-[#6C84A3] p-6">
                    <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-center">No active nodes found. Try a different query.</p>
                 </div>
              )}

              {!loading && !hasSearched && (
                 <div className="h-full flex flex-col items-center justify-center text-[#475569] p-6">
                    <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    <p className="text-xs md:text-sm uppercase tracking-widest text-center">Enter a query to view active network routes</p>
                 </div>
              )}

              {!loading && results.length > 0 && (
                 <div className="flex-1 w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-[#162749] scrollbar-track-transparent">
                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
                       <thead className="sticky top-0 z-10 text-[11px] text-[#6C84A3] uppercase tracking-wider bg-[#0B152A] shadow-[0_1px_0_#162749]">
                          <tr>
                             <th className="px-4 py-3 font-semibold w-[15%]">Service</th>
                             <th className="px-4 py-3 font-semibold w-[20%]">Country / Operator</th>
                             <th className="px-4 py-3 font-semibold w-[15%]">Prefix / Range</th>
                             <th className="px-4 py-3 font-semibold w-[10%]">Traffic</th>
                             <th className="px-4 py-3 font-semibold w-[25%]">Live Message Template</th>
                             <th className="px-4 py-3 font-semibold w-[15%] text-right">Last Update (Local)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-[#162749]">
                          {results.map((item: any, idx) => (
                             <tr key={idx} className="hover:bg-[#162749]/30 transition-colors">
                                <td className="px-4 py-2 align-middle">
                                   <div className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#00D2FF] animate-pulse"></span>
                                      <span className="text-[#F8FAFC] font-medium text-xs">{item.service}</span>
                                   </div>
                                </td>
                                <td className="px-4 py-2 align-middle text-[#94A3B8] text-xs">
                                   <div className="whitespace-normal">{item.country_operator}</div>
                                </td>
                                <td className="px-4 py-2 align-middle">
                                   <code className="bg-[#0B152A] text-[#00D2FF] px-1.5 py-0.5 rounded border border-[#162749] text-xs inline-block">
                                      {item.prefix || "N/A"}
                                   </code>
                                </td>
                                <td className="px-4 py-2 align-middle">
                                   <div>
                                     {getTrafficBadge(item.traffic_level)}
                                   </div>
                                </td>
                                <td className="px-4 py-2 align-middle">
                                   <div className="bg-[#0B152A]/50 border border-[#162749]/50 rounded p-1.5 text-[#6C84A3] text-[10px] font-mono whitespace-normal leading-snug min-w-[250px]">
                                      {item.message_template}
                                   </div>
                                </td>
                                <td className="px-4 py-2 align-middle text-right text-[#94A3B8] text-[10px] font-mono">
                                   <div>
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
           <div className="flex-shrink-0 text-center mt-3">
              <Link href="/" className="inline-flex items-center gap-2 bg-[#0B152A] border border-[#162749] hover:border-[#60A5FA]/50 text-[#6C84A3] hover:text-[#60A5FA] px-5 py-2 rounded-lg font-bold transition-all text-[10px] md:text-xs tracking-widest uppercase shadow-sm group/btn">
                 <svg className="w-3 h-3 md:w-4 md:h-4 text-[#6C84A3] group-hover/btn:text-[#60A5FA] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                 </svg>
                 Return to Terminal
              </Link>
           </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-thin::-webkit-scrollbar {
          width: 5px;
          height: 5px;
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