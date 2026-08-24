"use client";

import { useState, useEffect, useMemo } from "react";

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
    <div className="w-full h-full relative" style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', sans-serif" }}>
      
      {/* Background Cyberpunk Glows (V2 Cyan & Blue) */}
      <div className="fixed top-[10%] right-[-5%] w-[40%] h-[40%] bg-[#00D2FF] rounded-full blur-[200px] opacity-[0.03] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#60A5FA] rounded-full blur-[180px] opacity-[0.03] pointer-events-none"></div>

      <div className="w-full h-full pb-20 relative z-10 px-4 md:px-8 pt-6 md:pt-8">
        
        <div className="max-w-[1400px] mx-auto w-full">
          
          {/* Sticky Header & Search Section for Mobile UX */}
          <div className="sticky top-0 z-40 bg-[#0B152A]/90 backdrop-blur-xl border border-[#162749] rounded-2xl p-4 md:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.3)] mb-6 transition-all">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00D2FF]/50 to-transparent opacity-50"></div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-bold text-[#F8FAFC] tracking-tight flex items-center gap-3">
                  <span className="p-2 bg-[#00D2FF]/10 rounded-lg border border-[#00D2FF]/20 hidden sm:flex">
                    <svg className="w-5 h-5 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </span>
                  Master <span className="text-[#00D2FF]">Range List</span>
                </h1>
                <p className="text-[#6C84A3] text-xs font-medium mt-1 flex items-center gap-2 tracking-wide">
                  <span className="w-1.5 h-1.5 bg-[#00D2FF] rounded-full animate-pulse shadow-[0_0_8px_#00D2FF]"></span>
                  Zero-Latency Global Network Directory
                </p>
              </div>

              {/* Enhanced Search Box */}
              <div className="relative w-full md:w-[350px] group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-[#6C84A3] group-focus-within:text-[#00D2FF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-10 py-2.5 border border-[#162749] rounded-xl leading-5 bg-[#030816] text-[#F8FAFC] placeholder-[#6C84A3]/50 focus:outline-none focus:border-[#00D2FF]/50 focus:ring-1 focus:ring-[#00D2FF]/30 transition-all duration-300 text-sm font-medium tracking-wide"
                  placeholder="Service, Country, or Prefix..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {/* Clear Search Button */}
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6C84A3] hover:text-[#F43F5E] transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            {/* Results Count Badge */}
            {!isLoading && (
               <div className="absolute -bottom-2.5 right-6 bg-[#030816] border border-[#162749] text-[#6C84A3] text-[9px] font-semibold px-2.5 py-1 rounded-md tracking-widest uppercase shadow-sm">
                 {filteredRanges.length} results
               </div>
            )}
          </div>

          {/* Data Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32">
               <div className="w-16 h-16 relative flex items-center justify-center mb-5">
                 <div className="absolute inset-0 border-2 border-[#162749] rounded-full"></div>
                 <div className="absolute inset-0 border-2 border-transparent border-t-[#00D2FF] border-l-[#60A5FA] rounded-full animate-spin"></div>
                 <svg className="w-6 h-6 text-[#00D2FF] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                 </svg>
               </div>
               <p className="text-[#6C84A3] font-bold tracking-widest uppercase text-[10px]">Syncing Database...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
              {filteredRanges.length > 0 ? (
                filteredRanges.map((item, index) => (
                  <div 
                    key={index} 
                    className="group relative bg-[#0B152A] border border-[#162749] rounded-xl overflow-hidden hover:border-[#1F335B] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_30px_rgba(0,210,255,0.05)] flex flex-col"
                  >
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-[#00D2FF] to-[#60A5FA] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="p-4 md:p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4 gap-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-[#030816] border border-[#162749] flex items-center justify-center shrink-0 shadow-inner">
                             <span className="text-[#F8FAFC] font-semibold text-xs">{item.service.charAt(0)}</span>
                          </div>
                          <h3 className="font-semibold text-sm md:text-base text-[#F8FAFC] group-hover:text-[#00D2FF] transition-colors truncate tracking-wide">
                            {item.service}
                          </h3>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-5 flex-1">
                        <div className="flex items-center text-xs text-[#6C84A3] bg-[#030816] py-1.5 px-3 rounded-lg border border-[#162749]">
                          <svg className="h-3.5 w-3.5 mr-2 text-[#60A5FA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="truncate font-medium">{item.country}</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-[#6C84A3] bg-[#030816] py-1.5 px-3 rounded-lg border border-[#162749]">
                          <svg className="h-3.5 w-3.5 mr-2 text-[#00D2FF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="truncate font-medium">{item.operator}</span>
                        </div>
                      </div>

                      {/* Interactive Copy Button */}
                      <button 
                        onClick={() => handleCopy(item.range, index)}
                        className={`relative w-full overflow-hidden flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-300 outline-none ${
                          copiedIndex === index 
                          ? 'bg-[#00D2FF]/10 border-[#00D2FF]/50 shadow-[0_0_10px_rgba(0,210,255,0.2)]' 
                          : 'bg-[#030816] border-[#162749] hover:border-[#00D2FF]/30 group-hover:bg-[#101726]'
                        }`}
                      >
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#00D2FF]/5 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 pointer-events-none"></div>
                        
                        <span className={`relative z-10 font-mono font-semibold text-xs tracking-widest ${copiedIndex === index ? 'text-[#00D2FF]' : 'text-[#6C84A3] group-hover:text-[#00D2FF]'}`}>
                          {item.range}
                        </span>
                        
                        <div className="relative z-10 flex items-center">
                          {copiedIndex === index ? (
                            <span className="flex items-center text-[#00D2FF] text-[10px] font-bold uppercase tracking-wider transition-all scale-110">
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied
                            </span>
                          ) : (
                            <svg className="w-4 h-4 text-[#6C84A3] group-hover:text-[#00D2FF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                      </button>

                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-20 bg-[#0B152A] border border-[#162749] rounded-2xl border-dashed">
                  <div className="p-3 bg-[#030816] rounded-xl mb-4 border border-[#162749]">
                    <svg className="w-8 h-8 text-[#6C84A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-[#F8FAFC] text-base font-semibold tracking-wide">No Range Found</p>
                  <p className="text-[#6C84A3] text-xs mt-1.5 text-center max-w-xs font-medium">
                    We couldn't find any range matching <span className="text-[#00D2FF]">"{searchTerm}"</span>.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}