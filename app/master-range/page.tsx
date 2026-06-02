"use client";

import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../DashboardLayout";

type RangeData = {
  service: string;
  country: string;
  operator: string;
  range: string;
};

export default function MasterRange() {
  const [ranges, setRanges] = useState<RangeData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // ব্রাউজার লোড হওয়ার সাথে সাথে JSON ফেচ করবে (Zero DB Load)
  useEffect(() => {
    const fetchRanges = async () => {
      try {
        const res = await fetch("/data/master_ranges.json?v=4.0.1"); 
        const data = await res.json();
        setRanges(data);
      } catch (error) {
        console.error("Failed to load ranges");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRanges();
  }, []);

  // Zero-Latency Filter Engine
  const filteredRanges = useMemo(() => {
    if (!searchTerm) return ranges.slice(0, 40); // ডিফল্টভাবে ৪০টি দেখাবে
    
    const lowerSearch = searchTerm.toLowerCase();
    return ranges
      .filter(
        (item) =>
          item.service.toLowerCase().includes(lowerSearch) ||
          item.country.toLowerCase().includes(lowerSearch) ||
          item.operator.toLowerCase().includes(lowerSearch) ||
          item.range.toLowerCase().includes(lowerSearch)
      )
      .slice(0, 100); // পারফরম্যান্সের জন্য ম্যাক্সিমাম ১০০টি
  }, [searchTerm, ranges]);

  // স্মার্ট কপি ফাংশন
  const handleCopy = (range: string, index: number) => {
    navigator.clipboard.writeText(range);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  return (
    <DashboardLayout>
      {/* Background Cyberpunk Glows (Cyan & Violet) */}
      <div className="fixed top-[10%] right-[-5%] w-[40%] h-[40%] bg-[#06B6D4] rounded-full blur-[200px] opacity-[0.07] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#8B5CF6] rounded-full blur-[180px] opacity-[0.06] pointer-events-none"></div>

      <div className="flex-1 overflow-auto w-full h-full pb-20 relative z-10 custom-scrollbar">
        
        <div className="max-w-[1400px] mx-auto w-full px-3 sm:px-6 md:px-8 pt-4 md:pt-8">
          
          {/* Sticky Header & Search Section for Mobile UX */}
          <div className="sticky top-0 z-40 bg-[#0F172A]/90 backdrop-blur-2xl border border-[#334155]/80 rounded-3xl p-4 md:p-6 shadow-[0_10px_40px_rgba(0,0,0,0.3)] mb-6 transition-all">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#06B6D4] to-transparent opacity-50"></div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
              <div className="flex-1">
                <h1 className="text-xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                  <span className="p-2 bg-[#06B6D4]/10 rounded-xl border border-[#06B6D4]/20 hidden sm:flex">
                    <svg className="w-6 h-6 text-[#06B6D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </span>
                  Master <span className="text-[#06B6D4] drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">Range List</span>
                </h1>
                <p className="text-[#94A3B8] text-xs md:text-sm mt-1 sm:mt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></span>
                  Zero-Latency Global Network Directory
                </p>
              </div>

              {/* Enhanced Search Box */}
              <div className="relative w-full md:w-[400px] group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-[#64748B] group-focus-within:text-[#06B6D4] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full pl-11 pr-10 py-3.5 border border-[#334155] rounded-2xl leading-5 bg-[#1E293B]/50 text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]/50 focus:ring-2 focus:ring-[#06B6D4]/20 transition-all duration-300"
                  placeholder="Service, Country, or Prefix..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {/* Clear Search Button */}
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#64748B] hover:text-[#F43F5E] transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            {/* Results Count Badge */}
            {!isLoading && (
               <div className="absolute -bottom-3 right-6 bg-[#0F172A] border border-[#334155] text-[#94A3B8] text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                 Showing {filteredRanges.length} results
               </div>
            )}
          </div>

          {/* Data Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32">
               <div className="w-20 h-20 relative flex items-center justify-center mb-6">
                 <div className="absolute inset-0 border-4 border-[#334155] rounded-full"></div>
                 <div className="absolute inset-0 border-4 border-transparent border-t-[#06B6D4] border-l-[#8B5CF6] rounded-full animate-spin"></div>
                 <svg className="w-8 h-8 text-[#06B6D4] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                 </svg>
               </div>
               <p className="text-[#06B6D4] font-bold tracking-[0.2em] uppercase text-sm animate-pulse">Establishing Connection...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
              {filteredRanges.length > 0 ? (
                filteredRanges.map((item, index) => (
                  <div 
                    key={index} 
                    className="group relative bg-[#1E293B]/40 backdrop-blur-md border border-[#334155]/60 rounded-2xl overflow-hidden hover:bg-[#1E293B]/80 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_10px_30px_rgba(6,182,212,0.1)] flex flex-col"
                  >
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#06B6D4] to-[#8B5CF6] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="p-4 md:p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4 gap-3">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-[#0F172A] border border-[#334155] flex items-center justify-center shrink-0">
                             <span className="text-white font-bold text-xs">{item.service.charAt(0)}</span>
                          </div>
                          <h3 className="font-bold text-base md:text-lg text-[#F8FAFC] group-hover:text-[#06B6D4] transition-colors truncate">
                            {item.service}
                          </h3>
                        </div>
                      </div>
                      
                      <div className="space-y-2.5 mb-5 flex-1">
                        <div className="flex items-center text-[13px] text-[#94A3B8] bg-[#0F172A]/50 py-1.5 px-3 rounded-lg border border-[#334155]/30">
                          <svg className="h-4 w-4 mr-2.5 text-[#8B5CF6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="truncate font-medium">{item.country}</span>
                        </div>
                        
                        <div className="flex items-center text-[13px] text-[#94A3B8] bg-[#0F172A]/50 py-1.5 px-3 rounded-lg border border-[#334155]/30">
                          <svg className="h-4 w-4 mr-2.5 text-[#10B981] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="truncate font-medium">{item.operator}</span>
                        </div>
                      </div>

                      {/* Interactive Copy Button */}
                      <button 
                        onClick={() => handleCopy(item.range, index)}
                        className={`relative w-full overflow-hidden flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all duration-300 outline-none ${
                          copiedIndex === index 
                          ? 'bg-[#10B981]/10 border-[#10B981]/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                          : 'bg-[#0F172A] border-[#334155] hover:border-[#06B6D4]/50 group-hover:bg-[#06B6D4]/5'
                        }`}
                      >
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#06B6D4]/10 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 pointer-events-none"></div>
                        
                        <span className={`relative z-10 font-mono font-bold text-sm tracking-widest ${copiedIndex === index ? 'text-[#10B981]' : 'text-[#06B6D4]'}`}>
                          {item.range}
                        </span>
                        
                        <div className="relative z-10 flex items-center">
                          {copiedIndex === index ? (
                            <span className="flex items-center text-[#10B981] text-xs font-bold animate-bounce-in">
                              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied
                            </span>
                          ) : (
                            <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#06B6D4] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                      </button>

                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-20 bg-[#1E293B]/30 border border-[#334155] rounded-3xl border-dashed">
                  <div className="p-4 bg-[#0F172A] rounded-full mb-4">
                    <svg className="w-10 h-10 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-[#E2E8F0] text-lg font-bold">No Data Found</p>
                  <p className="text-[#64748B] text-sm mt-1 text-center max-w-xs">
                    We couldn't find any range matching "{searchTerm}". Please try a different keyword.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce-in {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}} />
    </DashboardLayout>
  );
}