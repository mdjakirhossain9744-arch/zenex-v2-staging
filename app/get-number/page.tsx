"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import DashboardLayout from "../DashboardLayout"; 

// 💥 SMART GLOBAL COUNTRY CODE EXTRACTOR 💥
const GLOBAL_COUNTRY_CODES = [
  "225", "236", "234", "212", "254", "221", "222", "223", "224", "226", "227", "228", "229", "231", "232", "233", "235", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "247", "250", "251", "252", "253", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "269", "20", "27", 
  "880", "91", "92", "93", "94", "95", "86", "81", "82", "84", "62", "60", "63", "66", "65", "855", "856", "886", "976", "977", "960", "961", "962", "963", "964", "965", "966", "967", "968", "971", "972", "973", "974", "975", 
  "44", "33", "49", "48", "39", "34", "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375", "376", "377", "378", "380", "381", "382", "385", "386", "387", "389", "40", "41", "43", "45", "46", "47", "7", 
  "1", "51", "52", "53", "54", "55", "56", "57", "58", "590", "591", "592", "593", "594", "595", "596", "597", "598", "599", "61", "64"
].sort((a, b) => b.length - a.length);

const formatCopyNumber = (rawNum: string, isNat: boolean, noPlus: boolean) => {
  let digitsOnly = String(rawNum).replace(/\D/g, ''); 
  if (!digitsOnly) return rawNum;
  if (isNat) {
      for (let code of GLOBAL_COUNTRY_CODES) {
          if (digitsOnly.startsWith(code)) return digitsOnly.substring(code.length); 
      }
      return digitsOnly;
  }
  if (noPlus) return digitsOnly;
  return '+' + digitsOnly;
};

const getUTCDateString = (dateObj: Date | number | string = new Date()) => {
  return new Date(dateObj).toISOString().split('T')[0];
};

const cleanOTPDisplay = (rawOtp: string) => {
  if (!rawOtp || rawOtp === "Waiting..." || rawOtp === "Timeout") return rawOtp;
  const strOtp = String(rawOtp).trim();
  const match = strOtp.match(/(?:\b\d{4,8}\b)|(?:\b\d{3}[\s-]\d{3,4}\b)|(?:G-\d{6,8})/);
  if (match) return match[0];
  return strOtp.length > 12 ? strOtp.substring(0, 12) + "..." : strOtp;
};

// SMART SORTING LOGIC 
const getSortTime = (item: any) => {
    if (item.status === 'DONE') {
        const t = item.receivedAt || item.updatedAt || item.createdAt;
        return new Date(t).getTime() || 0;
    }
    return new Date(item.createdAt).getTime() || 0;
};

export default function GetNumber() {
  const [rangeInput, setRangeInput] = useState("");
  const [isNational, setIsNational] = useState(false);
  const [removePlus, setRemovePlus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ALL"); 
  
  const [toasts, setToasts] = useState<{id: number, msg: string}[]>([]);
  const [numbersList, setNumbersList] = useState<any[]>([]);
  
  // TIME SYNC STATES 
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState(0); 

  const [selectedDate, setSelectedDate] = useState(getUTCDateString());
  const [stats, setStats] = useState({ total: 0, success: 0, wait: 0, fail: 0 });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

  // ADJUSTED TRUE SERVER TIME 
  const adjustedTime = currentTime + timeOffset;

  const getUserEmail = () => {
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
    return storedUser ? JSON.parse(storedUser).email : "";
  };

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

  const toggleNational = () => {
    const newVal = !isNational;
    setIsNational(newVal);
    localStorage.setItem("zenex_saved_national", newVal.toString());
  };

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
       setNumbersList([]);
       setIsInitialLoad(true);
       setPage(1); 
       setHasMore(true);
    }
  };

  const getFormattedDate = () => {
    const dateObj = new Date(selectedDate);
    const options: Intl.DateTimeFormatOptions = { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' };
    if (selectedDate === getUTCDateString()) return `Today, ${dateObj.toLocaleDateString('en-GB', options)}`;
    return dateObj.toLocaleDateString('en-GB', options);
  };

  const showToast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => {
      const updatedToasts = [...prev, { id, msg }];
      return updatedToasts.slice(-2); 
    });
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return "Just Now";
    const timeMs = new Date(timestamp).getTime();
    if (isNaN(timeMs)) return "Just Now";

    const secondsPast = Math.floor((adjustedTime - timeMs) / 1000);
    if (secondsPast < 60) return "Just Now";
    if (secondsPast < 3600) return `${Math.floor(secondsPast / 60)} min ago`;
    if (secondsPast < 86400) return `${Math.floor(secondsPast / 3600)} hour ago`;
    
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(timeMs));
  };

  const getDisplayTime = (item: any) => {
      const cTime = new Date(item.createdAt).getTime();
      if (item.status === 'DONE') return item.receivedAt || item.updatedAt || item.createdAt;
      if (item.status === 'FAIL' || (item.status === 'WAIT' && (adjustedTime - cTime) >= 20 * 60 * 1000)) {
          if (item.otp === "Timeout") return cTime + (20 * 60 * 1000); 
          return item.updatedAt || item.createdAt;
      }
      return item.createdAt; 
  };

  const fetchDbOrders = useCallback(async (pageNum = 1, isBackground = false) => {
    const email = getUserEmail();
    if(!email) return;
    try {
      const res = await fetch(`/api/sync-orders?t=${Date.now()}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: 'no-store',
        body: JSON.stringify({ action: "FETCH", email, page: pageNum, limit: 30, targetDate: selectedDate, filterStatus: activeFilter !== "ALL" ? activeFilter : undefined })
      });

      const serverDateStr = res.headers.get('date');
      if (serverDateStr) {
          const serverTimeMs = new Date(serverDateStr).getTime();
          if (!isNaN(serverTimeMs)) setTimeOffset(serverTimeMs - Date.now());
      }

      const data = await res.json();
      if(data.success && data.orders) {
        if (data.stats) setStats(data.stats); 
        setNumbersList((prev) => {
           const prevMap = new Map();
           prev.forEach(item => prevMap.set(item._id || item.id, item));
           data.orders.forEach((fetchedItem: any) => {
              const itemId = fetchedItem._id || fetchedItem.id;
              const existingItem = prevMap.get(itemId);
              if (existingItem) {
                 if (existingItem.status === "DONE" && fetchedItem.status === "WAIT") return;
                 prevMap.set(itemId, { ...existingItem, ...fetchedItem });
                 if (existingItem.status === "WAIT" && fetchedItem.status === "DONE" && isBackground) {
                     showToast(`OTP Received: ${cleanOTPDisplay(fetchedItem.otp)}`);
                 }
              } else {
                 prevMap.set(itemId, fetchedItem);
              }
           });
           return Array.from(prevMap.values()).sort((a, b) => getSortTime(b) - getSortTime(a));
        });
        if(data.pagination) setHasMore(data.pagination.hasMore);
      }
    } catch (err) {} finally { setIsInitialLoad(false); }
  }, [selectedDate, activeFilter, showToast]); 

  const handleFilterClick = (filterName: string) => {
    if (activeFilter === filterName) return;
    setActiveFilter(filterName);
    setNumbersList([]); setIsInitialLoad(true); setPage(1); setHasMore(true);       
  };

  const checkOtps = async () => {
    setIsRefreshing(true);
    try { await fetchDbOrders(1, false); } finally { setTimeout(() => setIsRefreshing(false), 500); }
  };

  const loadMoreNumbers = useCallback(async () => {
     setIsFetchingMore(true);
     const nextPage = page + 1;
     await fetchDbOrders(nextPage, false);
     setPage(nextPage);
     setIsFetchingMore(false);
  }, [page, fetchDbOrders]);

  useEffect(() => {
    const handleInstantOtp = (e: any) => {
      const { searchNumber, otp, fullMessage, isMulti } = e.detail;
      setNumbersList((prev) => prev.map((item) => {
        if (item.searchNumber === searchNumber) {
           if (!isMulti && item.status === "WAIT") {
             setStats(s => ({ ...s, wait: Math.max(0, s.wait - 1), success: s.success + 1 }));
             showToast(`OTP Received: ${cleanOTPDisplay(otp)}`);
             return { ...item, status: "DONE", otp, fullMessage, receivedAt: Date.now() + timeOffset };
           } else if (isMulti) {
             const combinedMessage = item.fullMessage ? `${item.fullMessage} _||_ ${fullMessage}` : fullMessage;
             showToast(`New OTP: ${cleanOTPDisplay(fullMessage)}`);
             return { ...item, status: "DONE", otp, fullMessage: combinedMessage, receivedAt: Date.now() + timeOffset, isMulti: true };
           }
        }
        return item;
      }).sort((a, b) => getSortTime(b) - getSortTime(a))); 
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
  }, [fetchDbOrders, showToast, timeOffset]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !isFetchingMore && !isInitialLoad) loadMoreNumbers();
    }, { threshold: 0.1, rootMargin: "100px" });
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, isInitialLoad, loadMoreNumbers]);

  const fetchNewNumber = async () => {
    if (!rangeInput) { showToast("Please enter a Range!"); return; }
    setIsLoading(true);
    try {
      const response = await fetch("/api/getnum", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: 'no-store',
        body: JSON.stringify({ range: rangeInput, is_national: isNational, remove_plus: removePlus }),
      });
      const result = await response.json();
      
      if (response.ok && result.success) {
        const rawServerNumber = result.data.full_number || result.data.number || result.data.copy || "";
        const pureFeedNumber = String(rawServerNumber).replace(/\D/g, ''); 
        const textToCopy = formatCopyNumber(pureFeedNumber, isNational, removePlus);
        navigator.clipboard.writeText(textToCopy);
        showToast(`Copied: ${textToCopy}`);

        const todayStr = getUTCDateString();
        const realId = result.orderId || Date.now().toString();

        const newEntry = {
          id: realId, _id: realId, dateString: todayStr, displayNumber: pureFeedNumber, searchNumber: pureFeedNumber,  
          copyNumber: textToCopy, country: result.data.country || "Unknown", operator: result.data.operator || "Any", 
          status: "WAIT", otp: "Waiting...", fullMessage: "", seenMessages: [], isDup: false, isMulti: false,
          createdAt: new Date(Date.now() + timeOffset).toISOString(), receivedAt: null 
        };
        
        if (activeFilter === "ALL" || activeFilter === "WAIT") {
           setNumbersList((prev) => [newEntry, ...prev].sort((a, b) => getSortTime(b) - getSortTime(a)));
        }
        setStats(prev => ({ ...prev, total: prev.total + 1, wait: prev.wait + 1 })); 
        setSelectedDate(todayStr);
      } else {
        showToast(result.error || "Failed!");
      }
    } catch (error) { showToast("Error occurred!"); } finally { setIsLoading(false); }
  };

  const isToday = selectedDate === getUTCDateString();
  const dateFilteredNumbers = numbersList.filter((item) => item.dateString === selectedDate);
    
  const finalFilteredNumbers = dateFilteredNumbers.map((item) => {
      const cTime = new Date(item.createdAt).getTime();
      if (item.status === "WAIT" && (adjustedTime - cTime) >= 20 * 60 * 1000) {
          return { ...item, status: "FAIL", otp: "Timeout" };
      }
      return item;
  }).filter((item) => {
    if (!isToday && item.status !== "DONE") return false;
    if (activeFilter === "ALL") return true;
    return item.status === activeFilter;
  });

  const uniqueItemIds = new Set();
  const deduplicatedNumbers = finalFilteredNumbers.filter((item) => {
      const itemId = item._id || item.id;
      if (uniqueItemIds.has(itemId)) return false;
      uniqueItemIds.add(itemId);
      return true;
  });

  const expandedNumbers: any[] = [];
  deduplicatedNumbers.forEach((item: any) => {
      if (item.status === "DONE" && item.fullMessage && item.fullMessage.includes("_||_")) {
          const msgsArray = item.fullMessage.split("_||_").map((m: string) => m.trim()).filter(Boolean);
          msgsArray.forEach((msg: string, idx: number) => {
              const extracted = cleanOTPDisplay(msg);
              expandedNumbers.push({ ...item, id: `${item._id || item.id}_${idx}`, otp: extracted !== "Waiting..." ? extracted : item.otp, fullMessage: msg, isMulti: true });
          });
      } else {
          expandedNumbers.push({ ...item, id: item._id || item.id });
      }
  });

  const sortedFilteredNumbers = [...expandedNumbers].sort((a, b) => getSortTime(b) - getSortTime(a));
  const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : "0.0";

  const downloadAllSuccessOTPs = async () => {
    const email = getUserEmail();
    if (!email) return;
    if (stats.success === 0) { showToast("No successful OTPs to download!"); return; }

    setIsDownloading(true);
    showToast("Preparing Full Download...");

    try {
      const res = await fetch(`/api/download-otps`, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: 'no-store',
        body: JSON.stringify({ email, targetDate: selectedDate })
      });
      const data = await res.json();
      if (data.success && data.textData) {
        const blob = new Blob([data.textData], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = `ZENEX_DONE_OTPS_${selectedDate}.txt`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast(`Success! Downloaded All OTPs.`);
      } else { showToast("Error: No data found for this date."); }
    } catch (err) { showToast("Download failed! Try again."); } finally { setIsDownloading(false); }
  };

  return (
    <DashboardLayout>
      <div className="p-3 md:p-10 w-full relative z-10 font-sans">
        
        <div className="fixed top-24 right-5 md:right-10 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div key={toast.id} className="bg-[#10B981] text-white px-4 py-2 rounded-lg shadow-lg font-bold text-sm flex items-center gap-2 animate-bounce-in transition-all pointer-events-auto">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
               {toast.msg}
            </div>
          ))}
        </div>

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

        <div className="rounded-xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl overflow-hidden shadow-md w-full mb-4 flex flex-col h-[75vh] md:h-[900px] min-h-[500px]">
           <div className="flex justify-between items-center p-3 bg-[#0F172A]/50 border-b border-[#334155] flex-shrink-0">
             <div className="flex items-center gap-2">
               <h3 className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                 {isToday ? <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span> : <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]"></span>}
                 Feed
               </h3>
               {isToday && (
                 <button onClick={checkOtps} className="ml-2 p-1 bg-[#3B82F6]/10 text-[#3B82F6] rounded border border-[#3B82F6]/30 hover:bg-[#3B82F6]/20 transition-colors">
                   <svg className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 </button>
               )}
             </div>
             
             {/* 💥 FILTER TABS 💥 */}
             <div className="flex gap-1 bg-[#0B0F19] p-0.5 rounded border border-[#334155]">
               {["ALL", "DONE", "WAIT", "FAIL"].map((filterName) => {
                 const displayLabel = filterName === "DONE" ? "SUCCESS" : filterName === "WAIT" ? "PENDING" : filterName === "FAIL" ? "FAILED" : filterName;
                 return (
                   <button key={filterName} onClick={() => handleFilterClick(filterName)}
                     className={`px-2 py-1 text-[9px] font-black rounded uppercase transition-colors ${activeFilter === filterName ? "bg-[#3B82F6] text-white" : "text-[#64748B] hover:text-[#E2E8F0]"}`}>
                     {displayLabel}
                   </button>
                 );
               })}
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
                 <div className="h-full flex flex-col items-center justify-center text-center my-auto p-10 min-h-[200px]">
                    <svg className="w-10 h-10 text-[#334155] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <h3 className="text-sm font-black text-[#64748B] tracking-wide">Empty List</h3>
                 </div>
              ) : (
                 <>
                   {sortedFilteredNumbers.map((item) => {
                      const isMultiTag = item.isMulti || item.isDup;
                      
                      let displayStatus = item.status;
                      if (item.status === "DONE") displayStatus = "SUCCESS";
                      if (item.status === "WAIT") displayStatus = "PENDING";
                      if (item.status === "FAIL") displayStatus = "FAILED";

                      // 💥 PERFECTLY BALANCED BADGE SIZE: Not too big, not too small 💥
                      const badgeClasses = `px-1.5 py-[2px] md:px-2 md:py-[3px] border text-[8.5px] md:text-[9.5px] font-black rounded uppercase tracking-widest ${item.status === "WAIT" ? "bg-[#EAB308]/10 border-[#EAB308]/30 text-[#EAB308]" : item.status === "DONE" ? "bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]" : "bg-[#F43F5E]/10 border-[#F43F5E]/30 text-[#F43F5E]"}`;

                      return (
                      <div key={item.id} className={`flex justify-between items-center p-2.5 md:p-3 border-b border-[#334155] transition-colors w-full ${item.status === 'DONE' && (adjustedTime - new Date(item.receivedAt||0).getTime() < 5000) ? 'bg-[#10B981]/10' : 'hover:bg-[#334155]/20'}`}>
                         
                         {/* 💥 LEFT COLUMN: Number & Fixed Height OTP Box 💥 */}
                         <div className="flex flex-col justify-center items-start gap-1.5 md:gap-2 flex-1 min-w-0 pr-2">
                            
                            <div className="flex items-center gap-1.5">
                              <div onClick={() => { 
                                 const textToCopy = formatCopyNumber(item.displayNumber || item.searchNumber, isNational, removePlus);
                                 navigator.clipboard.writeText(textToCopy); 
                                 showToast("Number Copied!"); 
                              }} className="text-sm md:text-base font-black text-white tracking-wide cursor-pointer hover:text-[#3B82F6] transition-colors truncate">
                                {String(item.displayNumber || item.searchNumber).replace(/\D/g, '')}
                              </div>
                              
                              <span className="px-1.5 py-0.5 bg-[#334155]/50 text-[#94A3B8] border border-[#334155] text-[8px] font-black rounded uppercase tracking-widest hidden sm:inline-block">
                                {item.country}
                              </span>

                              {isMultiTag && (
                                 <span className="px-1 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[8px] font-black rounded uppercase tracking-widest">
                                   MULTI
                                 </span>
                              )}
                            </div>
                            
                            <div className="w-full min-h-[26px] md:min-h-[28px] flex flex-col justify-center">
                               {item.status === "WAIT" ? (
                                 <div className="flex items-center gap-1.5 min-h-[26px] md:min-h-[28px]">
                                   <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EAB308] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#EAB308]"></span></span>
                                   <span className="text-[10px] md:text-[11px] italic text-[#64748B]">{item.otp}</span>
                                 </div>
                               ) : item.status === "FAIL" ? (
                                 <div className="flex items-center min-h-[26px] md:min-h-[28px]">
                                    <span className="text-[10px] md:text-[11px] font-bold text-[#F43F5E]">{item.otp}</span>
                                 </div>
                               ) : (
                                 <div className="flex flex-col items-start gap-1 py-0.5">
                                   <button 
                                      onClick={() => { navigator.clipboard.writeText(cleanOTPDisplay(item.otp).replace(/[\s-]+/g, '')); showToast("OTP Copied!"); }} 
                                      className="group relative inline-flex items-center gap-1 bg-[#0F172A] border border-[#10B981]/30 hover:border-[#10B981] px-1.5 py-[1px] md:px-2 md:py-0.5 rounded cursor-pointer transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.05)] hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] overflow-hidden"
                                   >
                                      <div className="absolute inset-0 bg-gradient-to-r from-[#10B981]/0 via-[#10B981]/10 to-[#10B981]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                      <span className="text-xs md:text-sm font-mono font-black text-[#10B981] tracking-wider relative z-10">{cleanOTPDisplay(item.otp)}</span>
                                      <div className="bg-[#10B981]/10 p-0.5 rounded group-hover:bg-[#10B981] transition-colors relative z-10">
                                         <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#10B981] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                      </div>
                                   </button>
                                   {item.fullMessage && <span className="text-[9px] text-[#64748B] line-clamp-1">{item.fullMessage}</span>}
                                 </div>
                               )}
                            </div>
                         </div>
                         
                         {/* 💥 RIGHT COLUMN: STRICT FIXED WIDTH TO PREVENT LAYOUT SHIFT 💥 */}
                         <div className="flex flex-col justify-center shrink-0 w-[110px] sm:w-[130px] md:w-[150px]">
                            
                            {/* 💥 MOBILE ONLY VIEW (Text Align Right + Truncate Ellipsis) 💥 */}
                            <div className="flex sm:hidden flex-col items-end justify-center w-full">
                               <span className={`${badgeClasses} mb-1`}>{displayStatus}</span>
                               
                               <span className="text-[10px] font-bold text-[#E2E8F0] uppercase text-right w-full block truncate leading-tight">
                                  {item.country}
                               </span>
                               
                               {item.operator && item.operator !== "Any" && (
                                  <span className="flex items-center justify-end gap-1 text-[8.5px] font-medium text-[#94A3B8] uppercase w-full mt-[2px]">
                                     <svg className="w-[10px] h-[10px] shrink-0 text-[#94A3B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                         <circle cx="12" cy="12" r="2"></circle>
                                         <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
                                     </svg>
                                     <span className="block truncate max-w-[85px]">{item.operator}</span>
                                  </span>
                               )}
                               
                               <span className="text-[7.5px] font-medium text-[#64748B] w-full text-right mt-[3px] block truncate">
                                  {getTimeAgo(getDisplayTime(item))}
                               </span>
                            </div>

                            {/* 💥 PC ONLY VIEW (Right Aligned) 💥 */}
                            <div className="hidden sm:flex flex-col items-end justify-center w-full gap-1.5">
                               <div className="flex items-center gap-2">
                                  <span className={badgeClasses}>{displayStatus}</span>
                                  <span className="text-[10px] font-bold text-[#64748B] whitespace-nowrap">{getTimeAgo(getDisplayTime(item))}</span>
                               </div>
                               
                               {item.operator && item.operator !== "Any" && (
                                  <div className="flex items-center justify-end w-full text-[10px] font-bold text-[#E2E8F0] uppercase">
                                     <svg className="w-3 h-3 shrink-0 text-[#94A3B8] mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="2"></circle>
                                        <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
                                     </svg>
                                     <span className="truncate shrink-0 text-right max-w-[120px] md:max-w-[150px] uppercase" title={item.operator}>{item.operator}</span>
                                  </div>
                               )}
                            </div>

                         </div>

                      </div>
                      )
                   })}
                   
                   {isFetchingMore && (
                     <div className="py-4 flex justify-center flex-shrink-0">
                        <svg className="w-5 h-5 animate-spin text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     </div>
                   )}
                   <div ref={observerRef} className="h-4 w-full bg-transparent flex-shrink-0"></div>
                 </>
              )}
           </div>
        </div>

        <div className="flex flex-col items-center justify-center pb-2 flex-shrink-0">
           <div className="flex items-center gap-3 bg-[#1E293B]/80 border border-[#334155] rounded-full px-4 py-1.5 shadow-md">
             <button onClick={() => changeDate(-1)} className="p-1 text-[#94A3B8] hover:text-[#3B82F6] rounded-full transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
             <span className="text-xs font-black text-white min-w-[120px] text-center">{getFormattedDate()}</span>
             <button onClick={() => changeDate(1)} disabled={isToday} className={`p-1 rounded-full transition-colors ${isToday ? 'text-[#334155] cursor-not-allowed' : 'text-[#94A3B8] hover:text-[#3B82F6]'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
             
             <div className="w-[1px] h-4 bg-[#334155] mx-1"></div>
             
             <button 
                onClick={downloadAllSuccessOTPs} 
                disabled={isDownloading || stats.success === 0}
                title="Download ALL DONE OTPs" 
                className={`p-1.5 rounded-full transition-all border ${
                  isDownloading || stats.success === 0 
                  ? 'bg-[#334155]/20 text-[#64748B] border-[#334155]/30 cursor-not-allowed' 
                  : 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30 hover:text-white hover:bg-[#10B981]'
                }`}
             >
               {isDownloading ? (
                 <svg className="w-4 h-4 animate-spin text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                 </svg>
               ) : (
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                 </svg>
               )}
             </button>
           </div>
        </div>

      </div>
    </DashboardLayout>
  );
}