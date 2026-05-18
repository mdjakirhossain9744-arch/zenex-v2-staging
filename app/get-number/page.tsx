"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import DashboardLayout from "../DashboardLayout"; 

// 💥 PURE UTC TIMEZONE FUNCTION 💥
const getUTCDateString = (dateObj: Date | number | string = new Date()) => {
  return new Date(dateObj).toISOString().split('T')[0];
};

export default function GetNumber() {
  const [rangeInput, setRangeInput] = useState("");
  const [isNational, setIsNational] = useState(false);
  const [removePlus, setRemovePlus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ALL"); 
  
  const [toastMessage, setToastMessage] = useState("");
  const [numbersList, setNumbersList] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedDate, setSelectedDate] = useState(getUTCDateString());

  const [stats, setStats] = useState({ total: 0, success: 0, wait: 0, fail: 0 });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

  const getUserEmail = () => {
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
    return storedUser ? JSON.parse(storedUser).email : "";
  };

  // 💥 UPDATE: Load Saved Preferences (Range, National, No +) on Page Load 💥
  useEffect(() => {
    const savedRange = localStorage.getItem("zenex_saved_range");
    if (savedRange) setRangeInput(savedRange);

    const savedNational = localStorage.getItem("zenex_saved_national");
    if (savedNational === "true") setIsNational(true);

    const savedRemovePlus = localStorage.getItem("zenex_saved_remove_plus");
    if (savedRemovePlus === "true") setRemovePlus(true);
  }, []);

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRangeInput(val);
    localStorage.setItem("zenex_saved_range", val); 
  };

  // 💥 UPDATE: Save National Checkbox State 💥
  const toggleNational = () => {
    const newVal = !isNational;
    setIsNational(newVal);
    localStorage.setItem("zenex_saved_national", newVal.toString());
  };

  // 💥 UPDATE: Save No (+) Checkbox State 💥
  const toggleRemovePlus = () => {
    const newVal = !removePlus;
    setRemovePlus(newVal);
    localStorage.setItem("zenex_saved_remove_plus", newVal.toString());
  };

  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setUTCDate(current.getUTCDate() + days);
    const newDateStr = current.toISOString().split('T')[0];
    if (newDateStr <= getUTCDateString()) {
       setSelectedDate(newDateStr);
       setPage(1); 
    }
  };

  const getFormattedDate = () => {
    const dateObj = new Date(selectedDate);
    const options: Intl.DateTimeFormatOptions = { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' };
    if (selectedDate === getUTCDateString()) return `Today, ${dateObj.toLocaleDateString('en-GB', options)}`;
    return dateObj.toLocaleDateString('en-GB', options);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const getTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Just Now";
    const timeMs = new Date(timestamp).getTime();
    if (isNaN(timeMs)) return "Just Now";

    const secondsPast = Math.floor((currentTime - timeMs) / 1000);
    if (secondsPast < 60) return "Just Now";
    if (secondsPast < 3600) return `${Math.floor(secondsPast / 60)} min ago`;
    if (secondsPast < 86400) return `${Math.floor(secondsPast / 3600)} hour ago`;
    
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(timeMs));
  };

  const getDisplayTime = (item: any) => {
      if (item.status === 'DONE') return item.receivedAt || item.updatedAt || item.createdAt;
      
      if (item.status === 'FAIL' || (item.status === 'WAIT' && (currentTime - item.createdAt) >= 20 * 60 * 1000)) {
          if (item.otp === "Timeout") return item.createdAt + (20 * 60 * 1000); 
          return item.updatedAt || item.createdAt;
      }
      return item.createdAt; 
  };

  const fetchDbOrders = useCallback(async (pageNum = 1, isBackground = false) => {
    const email = getUserEmail();
    if(!email) return;
    try {
      const res = await fetch("/api/sync-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FETCH", email, page: pageNum, limit: 50, targetDate: selectedDate })
      });
      const data = await res.json();
      
      if(data.success && data.orders) {
        if (data.stats) setStats(data.stats); 

        setNumbersList((prev) => {
           const prevMap = new Map(prev.map(item => [item.id, item]));
           
           data.orders.forEach((fetchedItem: any) => {
              const existingItem = prevMap.get(fetchedItem.id);
              if (existingItem && existingItem.status === "DONE" && fetchedItem.status === "WAIT") {
                 return;
              }
              prevMap.set(fetchedItem.id, fetchedItem);
           });

           if (isBackground) {
              const dbSearchNumbers = new Set(data.orders.map((o: any) => o.searchNumber));
              let combined = Array.from(prevMap.values()).filter(item => {
                 if (item.id.toString().startsWith("temp_") && dbSearchNumbers.has(item.searchNumber)) return false; 
                 return true;
              });
              return combined.sort((a, b) => b.createdAt - a.createdAt);
           } else {
              return Array.from(prevMap.values()).sort((a, b) => b.createdAt - a.createdAt);
           }
        });

        if(data.pagination) setHasMore(data.pagination.hasMore);
      }
    } catch (err) {} 
    finally {
      setIsInitialLoad(false); 
    }
  }, [selectedDate]);

  const checkOtps = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/check-otp?t=${Date.now()}`);
      const result = await res.json();
      if (result.success) await fetchDbOrders(1, false); 
    } catch (err) {} 
    finally {
      setTimeout(() => setIsRefreshing(false), 500); 
    }
  };

  useEffect(() => {
    const handleInstantOtp = (e: any) => {
      const { searchNumber, otp, fullMessage, isMulti } = e.detail;
      
      setNumbersList((prev) => prev.map((item) => {
        if (item.searchNumber === searchNumber) {
           if (!isMulti && item.status === "WAIT") {
             setStats(s => ({ ...s, wait: Math.max(0, s.wait - 1), success: s.success + 1 }));
             return { ...item, status: "DONE", otp, fullMessage, receivedAt: Date.now() };
           } else if (isMulti) {
             const newSeen = item.seenMessages ? [...item.seenMessages, fullMessage] : [item.fullMessage, fullMessage];
             return { ...item, status: "DONE", otp, fullMessage, seenMessages: newSeen, receivedAt: Date.now(), isMulti: true };
           }
        }
        return item;
      }));
    };

    window.addEventListener('otp-received-instant', handleInstantOtp);

    fetchDbOrders(1, false);
    const syncInterval = setInterval(() => fetchDbOrders(1, true), 3000); 
    const timeInterval = setInterval(() => setCurrentTime(Date.now()), 10000);
    
    return () => {
       window.removeEventListener('otp-received-instant', handleInstantOtp);
       clearInterval(syncInterval);
       clearInterval(timeInterval);
    };
  }, [fetchDbOrders]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !isFetchingMore && !isInitialLoad) {
         loadMoreNumbers();
      }
    }, { threshold: 1.0 });
    
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, isInitialLoad, page, fetchDbOrders]);

  const loadMoreNumbers = async () => {
     setIsFetchingMore(true);
     const nextPage = page + 1;
     await fetchDbOrders(nextPage, false);
     setPage(nextPage);
     setIsFetchingMore(false);
  };

  const fetchNewNumber = async () => {
    if (!rangeInput) {
      showToast("Please enter a Number Range first!");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/getnum", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range: rangeInput, is_national: isNational, remove_plus: removePlus }),
      });
      const result = await response.json();
      
      if (response.ok && result.success) {
        const numberToCopy = result.data.copy;
        navigator.clipboard.writeText(numberToCopy);
        showToast(`Copied: ${numberToCopy}`);

        const fullNumberDisplay = result.data.full_number.startsWith("+") ? result.data.full_number : `+${result.data.full_number}`;
        const todayStr = getUTCDateString();

        const newEntry = {
          id: `temp_${Date.now()}`, dateString: todayStr, displayNumber: fullNumberDisplay, 
          searchNumber: result.data.full_number, country: result.data.country || "Unknown",
          operator: result.data.operator || "Any", status: "WAIT", otp: "Waiting...",
          fullMessage: "", seenMessages: [], isDup: false, isMulti: false,
          createdAt: Date.now(), receivedAt: null 
        };
        
        setNumbersList((prev) => [newEntry, ...prev]);
        setStats(prev => ({ ...prev, total: prev.total + 1, wait: prev.wait + 1 })); 
        setSelectedDate(todayStr);

        fetch("/api/sync-orders", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CREATE", email: getUserEmail(), orderData: newEntry })
        });

      } else {
        showToast(result.error || "Failed to fetch number!");
      }
    } catch (error) {
      showToast("Something went wrong!");
    } finally {
      setIsLoading(false);
    }
  };

  const isToday = selectedDate === getUTCDateString();
  const dateFilteredNumbers = numbersList.filter((item) => item.dateString === selectedDate);
    
  const finalFilteredNumbers = dateFilteredNumbers.map((item) => {
      if (item.status === "WAIT" && (currentTime - item.createdAt) >= 20 * 60 * 1000) {
          return { ...item, status: "FAIL", otp: "Timeout" };
      }
      return item;
  }).filter((item) => {
    if (!isToday && item.status !== "DONE") return false;

    if (activeFilter === "ALL") return true;
    return item.status === activeFilter;
  });

  const sortedFilteredNumbers = [...finalFilteredNumbers].sort((a, b) => b.createdAt - a.createdAt);
  const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : "0.0";

  return (
    <DashboardLayout>
      <div className="p-3 md:p-10 w-full relative z-10 font-sans">
        {toastMessage && (
          <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#10B981] text-white px-4 py-2 rounded-lg shadow-lg font-bold text-sm flex items-center gap-2 animate-bounce-in">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             {toastMessage}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4">
           <div className="rounded-xl bg-[#1E293B]/50 border border-[#334155] p-3 flex justify-between items-center transition-all hover:border-[#94A3B8]">
              <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Total</span>
              <span className="text-lg font-black text-white">{stats.total}</span>
           </div>
           <div className="rounded-xl bg-gradient-to-br from-[#1E293B]/50 to-[#10B981]/10 border border-[#10B981]/30 p-3 flex justify-between items-center transition-all hover:border-[#10B981]">
              <span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest">Success</span>
              <span className="text-lg font-black text-[#10B981]">{stats.success}</span>
           </div>
           <div className="rounded-xl bg-gradient-to-br from-[#1E293B]/50 to-[#EAB308]/10 border border-[#EAB308]/30 p-3 flex justify-between items-center transition-all hover:border-[#EAB308]">
              <span className="text-[10px] font-black text-[#EAB308] uppercase tracking-widest">Wait</span>
              <span className="text-lg font-black text-[#EAB308]">{stats.wait}</span>
           </div>
           <div className="rounded-xl bg-gradient-to-br from-[#1E293B]/50 to-[#F43F5E]/10 border border-[#F43F5E]/30 p-3 flex justify-between items-center transition-all hover:border-[#F43F5E]">
              <span className="text-[10px] font-black text-[#F43F5E] uppercase tracking-widest">Failed</span>
              <span className="text-lg font-black text-[#F43F5E]">{stats.fail}</span>
           </div>
        </div>

        <div className="mb-4 md:mb-6 bg-[#1E293B]/50 border border-[#334155] rounded-xl p-4 flex flex-col gap-2 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center relative z-10">
            <span className="text-[10px] md:text-xs font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Success Rate
            </span>
            <span className="text-sm md:text-base font-black text-[#10B981]">{successRate}%</span>
          </div>
          <div className="w-full bg-[#0F172A] rounded-full h-2 md:h-2.5 border border-[#334155] overflow-hidden relative z-10 shadow-inner">
            <div 
              className="bg-gradient-to-r from-[#3B82F6] via-[#10B981] to-[#34D399] h-full rounded-full transition-all duration-1000 ease-out relative" 
              style={{ width: `${successRate}%` }}>
                <div className="absolute top-0 right-0 bottom-0 left-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-20"></div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-md mb-4 relative overflow-hidden transition-all ${!isToday ? 'opacity-60 pointer-events-none' : ''}`}>
           {!isToday && (
             <div className="absolute inset-0 bg-[#0F172A]/50 z-20 flex items-center justify-center">
               <span className="bg-[#EAB308] text-black font-black px-4 py-1.5 rounded-lg text-xs uppercase tracking-widest shadow-md">History Mode Locked (Only Success)</span>
             </div>
           )}
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3B82F6] to-[#00C6FF]"></div>
           <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1 w-full">
                 <label className="block text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-1.5">Target Range / Code</label>
                 <input 
                    type="text" value={rangeInput} onChange={handleRangeChange} placeholder="e.g. 23276345XXX" 
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-4 py-2.5 text-white font-mono text-base focus:outline-none focus:border-[#3B82F6] transition-all" 
                 />
              </div>
              <div className="flex gap-4 pb-2 md:pb-0">
                 <label className="flex items-center gap-2 cursor-pointer group" onClick={toggleNational}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isNational ? "bg-[#3B82F6] border-[#3B82F6]" : "bg-[#0F172A] border-[#334155]"}`}>
                       {isNational && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-xs font-bold text-[#94A3B8] group-hover:text-white transition-colors">National</span>
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer group" onClick={toggleRemovePlus}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${removePlus ? "bg-[#3B82F6] border-[#3B82F6]" : "bg-[#0F172A] border-[#334155]"}`}>
                       {removePlus && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-xs font-bold text-[#94A3B8] group-hover:text-white transition-colors">No (+)</span>
                 </label>
              </div>
              <button 
                 onClick={fetchNewNumber} disabled={isLoading || !isToday}
                 className={`bg-gradient-to-r from-[#3B82F6] to-[#00C6FF] hover:from-[#2563EB] hover:to-[#00B4E6] text-white font-black text-sm px-6 py-2.5 rounded-lg transition-all flex items-center gap-2 w-full md:w-auto justify-center tracking-wider ${isLoading || !isToday ? "opacity-50 cursor-not-allowed" : "shadow-md hover:shadow-lg hover:-translate-y-0.5"}`}>
                 {isLoading ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                 {isLoading ? "FETCHING..." : "GET NUMBER"}
              </button>
           </div>
        </div>

        <div className="rounded-xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl overflow-hidden shadow-md w-full mb-4 min-h-[300px] flex flex-col">
           <div className="flex justify-between items-center p-3 bg-[#0F172A]/50 border-b border-[#334155]">
             <div className="flex items-center gap-2">
               <h3 className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                 {isToday ? <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span> : <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]"></span>}
                 Feed
               </h3>
               {isToday && (
                 <button onClick={checkOtps} className="ml-2 p-1 bg-[#3B82F6]/10 text-[#3B82F6] rounded border border-[#3B82F6]/30 hover:bg-[#3B82F6]/20">
                   <svg className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 </button>
               )}
             </div>
             <div className="flex gap-1 bg-[#0B0F19] p-0.5 rounded border border-[#334155]">
               {["ALL", "DONE", "WAIT", "FAIL"].map((filterName) => (
                 <button key={filterName} onClick={() => setActiveFilter(filterName)}
                   className={`px-2 py-1 text-[9px] font-black rounded uppercase transition-colors ${activeFilter === filterName ? "bg-[#3B82F6] text-white" : "text-[#64748B] hover:text-[#E2E8F0]"}`}>
                   {filterName}
                 </button>
               ))}
             </div>
           </div>

           <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar w-full">
              {isInitialLoad ? (
                 Array(5).fill(0).map((_, i) => (
                   <div key={i} className="flex flex-col p-3 border-b border-[#334155] w-full animate-pulse bg-[#1E293B]/40">
                      <div className="flex justify-between items-center mb-2">
                        <div className="h-4 bg-[#334155] rounded w-32 md:w-48"></div>
                        <div className="h-3 bg-[#334155] rounded w-16"></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="h-3 bg-[#334155] rounded w-24"></div>
                        <div className="h-3 bg-[#334155] rounded w-12 md:w-20"></div>
                      </div>
                   </div>
                 ))
              ) : sortedFilteredNumbers.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-center my-auto p-10">
                    <svg className="w-10 h-10 text-[#334155] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <h3 className="text-sm font-black text-[#64748B] tracking-wide">Empty List</h3>
                 </div>
              ) : (
                 <>
                   {sortedFilteredNumbers.map((item) => (
                      <div key={item.id} className={`flex flex-col p-2.5 md:p-3 border-b border-[#334155] transition-colors w-full ${item.status === 'DONE' && (currentTime - (item.receivedAt||0) < 5000) ? 'bg-[#10B981]/10' : 'hover:bg-[#334155]/20'}`}>
                         <div className="flex justify-between items-center mb-1.5">
                            <div onClick={() => { navigator.clipboard.writeText(item.displayNumber); showToast("Number Copied!"); }} className="flex items-center gap-1.5 cursor-pointer group">
                              <span className="text-sm md:text-base font-black text-white tracking-wide group-hover:text-[#3B82F6] transition-colors">{item.displayNumber}</span>
                              <span className="px-1.5 py-0.5 bg-[#334155]/50 text-[#94A3B8] border border-[#334155] text-[8px] font-black rounded uppercase tracking-widest hidden sm:inline-block">
                                {item.country}
                              </span>
                              {(item.isMulti || item.isDup) && (
                                 <span className="px-1 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[8px] font-black rounded uppercase tracking-widest">
                                   MULTI
                                 </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                               <span className="text-[9px] font-bold text-[#64748B] hidden md:block">{getTimeAgo(getDisplayTime(item))}</span>
                               <span className={`px-1.5 py-0.5 border text-[8px] font-black rounded uppercase ${item.status === "WAIT" ? "bg-[#EAB308]/10 border-[#EAB308]/20 text-[#EAB308]" : item.status === "DONE" ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]" : "bg-[#F43F5E]/10 border-[#F43F5E]/20 text-[#F43F5E]"}`}>{item.status}</span>
                            </div>
                         </div>
                         
                         <div className="flex justify-between items-center">
                            <div className="flex-1 overflow-hidden pr-2">
                               {item.status === "WAIT" ? (
                                 <div className="flex items-center gap-1.5">
                                   <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EAB308] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#EAB308]"></span></span>
                                   <span className="text-[10px] italic text-[#64748B]">{item.otp}</span>
                                 </div>
                               ) : item.status === "FAIL" ? (
                                 <span className="text-[10px] font-bold text-[#F43F5E]">{item.otp}</span>
                               ) : (
                                 <div className="flex flex-col">
                                   <div onClick={() => { navigator.clipboard.writeText(item.otp); showToast("OTP Copied!"); }} className="inline-flex items-center bg-[#0F172A] border border-[#10B981]/30 px-2 py-0.5 rounded cursor-pointer hover:border-[#10B981] w-max">
                                     <span className="text-sm font-mono font-black text-[#10B981] tracking-widest">{item.otp}</span>
                                   </div>
                                   {item.fullMessage && <span className="text-[9px] text-[#64748B] mt-0.5 line-clamp-1">{item.fullMessage}</span>}
                                 </div>
                               )}
                            </div>
                            
                            <div className="flex flex-col items-end text-right min-w-[60px]">
                              <span className="text-[9px] font-bold text-[#E2E8F0] uppercase">
                                 <span className="sm:hidden text-[#94A3B8]">{item.country} • </span>
                                 {item.operator}
                              </span>
                              <span className="text-[8px] font-bold text-[#64748B] md:hidden mt-0.5">{getTimeAgo(getDisplayTime(item))}</span>
                            </div>
                         </div>
                      </div>
                   ))}
                   
                   {isFetchingMore && (
                     <div className="py-4 flex justify-center">
                        <svg className="w-5 h-5 animate-spin text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     </div>
                   )}
                   <div ref={observerRef} className="h-4 w-full bg-transparent"></div>
                 </>
              )}
           </div>
        </div>

        <div className="flex flex-col items-center justify-center pb-2">
           <div className="flex items-center gap-3 bg-[#1E293B]/80 border border-[#334155] rounded-full px-4 py-1.5 shadow-md">
             <button onClick={() => changeDate(-1)} className="p-1 text-[#94A3B8] hover:text-[#3B82F6] rounded-full"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
             <span className="text-xs font-black text-white min-w-[120px] text-center">{getFormattedDate()}</span>
             <button onClick={() => changeDate(1)} disabled={isToday} className={`p-1 rounded-full ${isToday ? 'text-[#334155] cursor-not-allowed' : 'text-[#94A3B8] hover:text-[#3B82F6]'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
           </div>
        </div>

      </div>
    </DashboardLayout>
  );
}