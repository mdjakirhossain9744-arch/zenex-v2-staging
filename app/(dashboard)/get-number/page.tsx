"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// 💥 THE BOSS FIX: 100% COMPLETE GLOBAL COUNTRY CODES (ITU-T STANDARD) 💥
const GLOBAL_COUNTRY_CODES = [
  "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98",
  "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "247", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "267", "268", "269", "290", "291", "297", "298", "299",
  "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375", "376", "377", "378", "379", "380", "381", "382", "383", "385", "386", "387", "389", "420", "421", "423",
  "500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "590", "591", "592", "593", "594", "595", "596", "597", "598", "599",
  "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692",
  "850", "852", "853", "855", "856", "880", "886", "882", "883", "888",
  "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977", "979", "992", "993", "994", "995", "996", "998"
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
  
  return "00000";
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
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState(0); 

  const [selectedDate, setSelectedDate] = useState(getUTCDateString());
  const [stats, setStats] = useState({ total: 0, success: 0, wait: 0, fail: 0 });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
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
      if (item.status === 'FAIL' || (item.status === 'WAIT' && (adjustedTime - cTime) >= 20 * 60 * 1000)) {
          if (item.otp === "Timeout") return cTime + (20 * 60 * 1000); 
      }
      return item.displayTime || item.receivedAt || new Date(item.updatedAt || item.createdAt).getTime(); 
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
          if (!isNaN(serverTimeMs)) {
              setTimeOffset(prevOffset => {
                  const newOffset = serverTimeMs - Date.now();
                  return Math.abs(prevOffset - newOffset) > 2000 ? newOffset : prevOffset;
              });
          }
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
                 
                 const newLen = (fetchedItem.fullMessage || "").length;
                 const oldLen = (existingItem.fullMessage || "").length;
                 
                 if (existingItem.status === "DONE" && fetchedItem.status === "DONE" && oldLen > newLen) {
                     fetchedItem.fullMessage = existingItem.fullMessage;
                     fetchedItem.otp = existingItem.otp;
                     fetchedItem.isMulti = existingItem.isMulti;
                 }
                 
                 prevMap.set(itemId, { ...existingItem, ...fetchedItem });
                 if (existingItem.status === "WAIT" && fetchedItem.status === "DONE" && isBackground) {
                     showToast(`OTP Received: ${cleanOTPDisplay(fetchedItem.otp)}`);
                 }
              } else {
                 prevMap.set(itemId, fetchedItem);
              }
           });
           return Array.from(prevMap.values());
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
      setNumbersList((prev) => {
        let targetId = prev.find((i: any) => i.searchNumber === searchNumber && i.status === "WAIT")?.id || prev.find((i: any) => i.searchNumber === searchNumber && i.status === "WAIT")?._id;
        
        if (!targetId && isMulti) {
            targetId = prev.find((i: any) => i.searchNumber === searchNumber && i.status === "DONE")?.id || prev.find((i: any) => i.searchNumber === searchNumber && i.status === "DONE")?._id;
        }

        if (!targetId) return prev; 

        return prev.map((item) => {
          if (item.id === targetId || item._id === targetId) {
             if (!isMulti && item.status === "WAIT") {
               setStats(s => ({ ...s, wait: Math.max(0, s.wait - 1), success: s.success + 1 }));
               showToast(`OTP Received: ${cleanOTPDisplay(otp)}`);
               return { ...item, status: "DONE", otp, fullMessage, receivedAt: Date.now() + timeOffset };
             } else if (isMulti) {
               const currentMsgs = item.fullMessage ? item.fullMessage.split("_||_").map((s: string) => s.trim()) : [];
               if (!currentMsgs.includes(fullMessage.trim())) {
                   const combinedMessage = item.fullMessage ? `${item.fullMessage} _||_ ${fullMessage}` : fullMessage;
                   showToast(`New OTP: ${cleanOTPDisplay(fullMessage)}`);
                   return { ...item, status: "DONE", otp, fullMessage: combinedMessage, isMulti: true, receivedAt: Date.now() + timeOffset };
               }
             }
          }
          return item;
        });
      }); 
    };

    window.addEventListener('otp-received-instant', handleInstantOtp);
    fetchDbOrders(1, false);
    const syncInterval = setInterval(() => fetchDbOrders(1, true), 3000); 
    
    return () => {
       window.removeEventListener('otp-received-instant', handleInstantOtp);
       clearInterval(syncInterval);
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
           setNumbersList((prev) => [newEntry, ...prev]);
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
              
              let specificTime;
              if (idx === msgsArray.length - 1) {
                  specificTime = item.receivedAt || new Date(item.updatedAt || item.createdAt).getTime();
              } else {
                  specificTime = new Date(item.createdAt).getTime() + (idx * 1000);
              }

              expandedNumbers.push({ 
                  ...item, 
                  id: `${item._id || item.id}_${idx}`, 
                  otp: extracted !== "Waiting..." ? extracted : item.otp, 
                  fullMessage: msg, 
                  isMulti: true,
                  displayTime: specificTime
              });
          });
      } else {
          let specificTime = new Date(item.createdAt).getTime();
          if (item.status === "DONE") {
             specificTime = item.receivedAt || new Date(item.updatedAt || item.createdAt).getTime();
          }
          expandedNumbers.push({ 
              ...item, 
              id: item._id || item.id,
              displayTime: specificTime
          });
      }
  });

  const sortedFilteredNumbers = [...expandedNumbers].sort((a, b) => (b.displayTime || 0) - (a.displayTime || 0));
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
    // 💥 FIX: Removed the extra pt-20 and pl-64 so it perfectly fits your Global Layout 💥
    <div className="w-full h-full bg-[#030816] p-4 md:p-6 transition-all duration-300 font-sans tracking-tight">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col pb-10 relative z-10">
        
        {/* 💥 GLOBAL CYBER TOASTS 💥 */}
        <div className="fixed top-24 right-5 md:right-10 z-[100] flex flex-col gap-3 pointer-events-none">
          {toasts.map((toast) => (
            <div key={toast.id} className="bg-[#0B152A] border-l-4 border-[#00D2FF] text-[#F8FAFC] px-5 py-3 rounded shadow-[0_10px_40px_-10px_rgba(0,210,255,0.3)] font-semibold text-sm flex items-center gap-3 animate-bounce-in transition-all pointer-events-auto">
               <div className="w-6 h-6 bg-[#00D2FF]/10 rounded-full flex items-center justify-center border border-[#00D2FF]/20">
                  <svg className="w-3.5 h-3.5 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
               </div>
               <span className="tracking-wide">{toast.msg}</span>
            </div>
          ))}
        </div>

        {/* 💥 CYBER TELEMETRY HUD (STATS) 💥 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-5">
           <div className="rounded-xl bg-[#101726] border border-[#162749] shadow-sm p-4 flex flex-col justify-center relative overflow-hidden group">
              <span className="text-[11px] font-semibold text-[#6C84A3] mb-1">Total Signals</span>
              <span className="text-2xl font-bold tracking-tight text-[#00D2FF]">{stats.total}</span>
           </div>
           
           <div className="rounded-xl bg-[#101726] border border-[#162749] shadow-sm p-4 flex flex-col justify-center relative overflow-hidden group">
              <span className="text-[11px] font-semibold text-[#6C84A3] mb-1">Success</span>
              <span className="text-2xl font-bold tracking-tight text-[#00D2FF]">{stats.success}</span>
           </div>

           <div className="rounded-xl bg-[#101726] border border-[#162749] shadow-sm p-4 flex flex-col justify-center relative overflow-hidden group">
              <span className="text-[11px] font-semibold text-[#6C84A3] mb-1">Pending</span>
              <span className="text-2xl font-bold tracking-tight text-[#60A5FA]">{stats.wait}</span>
           </div>

           <div className="rounded-xl bg-[#101726] border border-[#162749] shadow-sm p-4 flex flex-col justify-center relative overflow-hidden group">
              <span className="text-[11px] font-semibold text-[#6C84A3] mb-1">Failed</span>
              <span className="text-2xl font-bold tracking-tight text-[#F43F5E]">{stats.fail}</span>
           </div>
        </div>

        {/* 💥 PROGRESS BAR 💥 */}
        <div className="mb-5 md:mb-8 bg-[#101726] border border-[#162749] rounded-xl p-5 flex flex-col gap-3 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center relative z-10">
            <span className="text-[11px] md:text-xs font-semibold text-[#6C84A3] uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Network Efficiency
            </span>
            <span className="text-sm md:text-base font-bold text-[#00D2FF]">{successRate}%</span>
          </div>
          <div className="w-full bg-[#030816] rounded-full h-2 md:h-2.5 border border-[#162749] overflow-hidden relative z-10">
            <div 
              className="bg-gradient-to-r from-[#60A5FA] via-[#00D2FF] to-[#00D2FF] h-full rounded-full transition-all duration-1000 ease-out relative shadow-[0_0_10px_#00D2FF]" 
              style={{ width: `${successRate}%` }}>
            </div>
          </div>
        </div>

        {/* 💥 TERMINAL COMMAND INPUT 💥 */}
        <div className={`rounded-xl bg-[#0B152A] border border-[#162749] p-5 shadow-sm mb-5 relative overflow-hidden transition-all ${!isToday ? 'opacity-60 pointer-events-none' : ''}`}>
           {!isToday && (
             <div className="absolute inset-0 bg-[#030816]/70 z-20 flex items-center justify-center backdrop-blur-sm">
               <span className="bg-[#60A5FA] text-[#030816] font-bold px-5 py-2 rounded-lg text-xs uppercase tracking-widest shadow-[0_0_15px_#60A5FA]">History Mode Locked (Only Success)</span>
             </div>
           )}
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#60A5FA] to-[#00D2FF] opacity-30"></div>
           
           <div className="flex flex-col md:flex-row gap-4 md:items-end">
              <div className="flex-1 w-full">
                 <label className="block text-[11px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">Target Network Range / Base Code</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                       <span className="text-[#00D2FF] font-mono font-bold text-sm">{">_"}</span>
                    </div>
                    <input 
                        type="text" value={rangeInput} onChange={handleRangeChange} placeholder="e.g. 23276345XXX" 
                        className="w-full bg-[#101726] border border-[#162749] rounded-lg pl-12 pr-4 py-3 text-[#F8FAFC] font-mono text-base focus:outline-none focus:border-[#00D2FF] transition-all placeholder:text-[#6C84A3]/50 shadow-inner tracking-tight" 
                    />
                 </div>
              </div>

              <div className="flex gap-5 pb-2 md:pb-0">
                 <label className="flex items-center gap-2.5 cursor-pointer group" onClick={toggleNational}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isNational ? "bg-[#00D2FF]/10 border-[#00D2FF]" : "bg-[#101726] border-[#162749]"}`}>
                       {isNational && <svg className="w-3.5 h-3.5 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-xs font-semibold text-[#6C84A3] group-hover:text-[#F8FAFC] transition-colors tracking-wide">National</span>
                 </label>
                 <label className="flex items-center gap-2.5 cursor-pointer group" onClick={toggleRemovePlus}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${removePlus ? "bg-[#00D2FF]/10 border-[#00D2FF]" : "bg-[#101726] border-[#162749]"}`}>
                       {removePlus && <svg className="w-3.5 h-3.5 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-xs font-semibold text-[#6C84A3] group-hover:text-[#F8FAFC] transition-colors tracking-wide">No (+)</span>
                 </label>
              </div>

              <button 
                 onClick={fetchNewNumber} disabled={isLoading || !isToday}
                 className={`bg-[#00D2FF] hover:bg-[#60A5FA] text-[#030816] font-bold text-sm px-8 py-3 rounded-lg transition-all flex items-center gap-2 w-full md:w-auto justify-center tracking-widest uppercase ${isLoading || !isToday ? "opacity-50 cursor-not-allowed" : "shadow-[0_0_15px_rgba(0,210,255,0.4)] hover:shadow-[0_0_25px_rgba(96,165,250,0.6)] hover:-translate-y-0.5"}`}>
                 {isLoading ? <svg className="w-4 h-4 animate-spin text-[#030816]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> : <svg className="w-4 h-4 text-[#030816]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                 {isLoading ? "EXECUTING..." : "GET NUMBER"}
              </button>
           </div>
        </div>

        {/* 💥 LIVE DATA STREAM (FEED) 💥 */}
        <div className="rounded-xl bg-[#0B152A] border border-[#162749] overflow-hidden shadow-sm w-full mb-5 flex flex-col h-[75vh] md:h-[900px] min-h-[500px]">
           
           <div className="flex justify-between items-center p-3 md:p-4 bg-[#101726] border-b border-[#162749] flex-shrink-0 w-full overflow-hidden">
             <div className="flex items-center gap-2 shrink-0 pr-2">
               <h3 className="text-[11px] md:text-xs font-semibold text-[#F8FAFC] uppercase tracking-widest flex items-center gap-2">
                 {isToday ? <span className="w-2 h-2 rounded-full bg-[#00D2FF] animate-pulse shadow-[0_0_8px_#00D2FF]"></span> : <span className="w-2 h-2 rounded-full bg-[#6C84A3]"></span>}
                 Live Feed
               </h3>
               {isToday && (
                 <button onClick={checkOtps} className="p-1.5 bg-[#00D2FF]/5 text-[#00D2FF] rounded border border-[#00D2FF]/20 hover:bg-[#00D2FF]/15 transition-colors shrink-0">
                   <svg className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 </button>
               )}
             </div>
             
             <div className="flex gap-1 bg-[#030816] p-1 rounded-lg border border-[#162749] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-w-[70%] sm:max-w-none">
               {["ALL", "DONE", "WAIT", "FAIL"].map((filterName) => {
                 const displayLabel = filterName === "DONE" ? "SUCCESS" : filterName === "WAIT" ? "PENDING" : filterName === "FAIL" ? "FAILED" : filterName;
                 return (
                   <button key={filterName} onClick={() => handleFilterClick(filterName)}
                     className={`px-3 py-1.5 text-[9px] md:text-[10px] font-bold rounded-md uppercase transition-all shrink-0 ${activeFilter === filterName ? "bg-[#101726] text-[#00D2FF] shadow-sm border border-[#162749]" : "text-[#6C84A3] hover:text-[#F8FAFC] border border-transparent"}`}>
                     {displayLabel}
                   </button>
                 );
               })}
             </div>
           </div>

           <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar w-full bg-[#030816]">
              {isInitialLoad ? (
                 Array(5).fill(0).map((_, i) => (
                   <div key={i} className="flex flex-col p-4 border-b border-[#162749] w-full animate-pulse bg-[#0B152A] h-[95px]">
                      <div className="flex justify-between items-center mb-2">
                        <div className="h-4 bg-[#162749] rounded w-32 md:w-48"></div>
                        <div className="h-3 bg-[#162749] rounded w-16"></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="h-3 bg-[#162749] rounded w-24"></div>
                        <div className="h-3 bg-[#162749] rounded w-12 md:w-20"></div>
                      </div>
                   </div>
                 ))
              ) : sortedFilteredNumbers.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-center my-auto p-10 min-h-[200px]">
                    <svg className="w-12 h-12 text-[#162749] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <h3 className="text-sm font-semibold text-[#6C84A3] tracking-wide">No Intel Found</h3>
                 </div>
              ) : (
                 <>
                   {sortedFilteredNumbers.map((item) => {
                      const isMultiTag = item.isMulti || item.isDup;
                      
                      let displayStatus = item.status;
                      if (item.status === "DONE") displayStatus = "SUCCESS";
                      if (item.status === "WAIT") displayStatus = "PENDING";
                      if (item.status === "FAIL") displayStatus = "FAILED";

                      const badgeClasses = `px-2 py-[3px] border text-[9px] font-semibold rounded uppercase tracking-widest ${
                        item.status === "WAIT" ? "bg-[#60A5FA]/10 border-[#60A5FA]/30 text-[#60A5FA]" : 
                        item.status === "DONE" ? "bg-[#00D2FF]/10 border-[#00D2FF]/30 text-[#00D2FF]" : 
                        "bg-[#F43F5E]/10 border-[#F43F5E]/30 text-[#F43F5E]"
                      }`;

                      return (
                      <div key={item.id} className={`h-[95px] shrink-0 flex justify-between items-center px-3 md:px-4 py-2 border-b border-[#162749] transition-colors w-full overflow-hidden ${item.status === 'DONE' && (adjustedTime - new Date(item.receivedAt||0).getTime() < 5000) ? 'bg-[#00D2FF]/5' : 'bg-[#0B152A] hover:bg-[#101726]'}`}>
                         
                         <div className="flex flex-col justify-between items-start h-full flex-1 min-w-0 pr-2">
                            
                            <div className="flex items-center gap-2 h-[26px] w-full shrink-0">
                              <div onClick={() => { 
                                 const textToCopy = formatCopyNumber(item.displayNumber || item.searchNumber, isNational, removePlus);
                                 navigator.clipboard.writeText(textToCopy); 
                                 showToast("Number Copied!"); 
                              }} className="text-sm md:text-base font-bold text-[#F8FAFC] tracking-wider cursor-pointer hover:text-[#00D2FF] transition-colors truncate font-mono">
                                {String(item.displayNumber || item.searchNumber).replace(/\D/g, '')}
                              </div>
                              <span className="px-1.5 py-0.5 bg-[#101726] text-[#6C84A3] border border-[#162749] text-[9px] font-semibold rounded uppercase tracking-widest hidden sm:inline-block">
                                {item.country}
                              </span>
                              {isMultiTag && (
                                 <span className="px-1.5 py-0.5 bg-[#60A5FA]/10 text-[#60A5FA] border border-[#60A5FA]/30 text-[9px] font-semibold rounded uppercase tracking-widest">
                                   MULTI
                                 </span>
                              )}
                            </div>
                            
                            <div className="flex items-center h-[30px] w-full shrink-0">
                               {item.status === "WAIT" ? (
                                 <div className="flex items-center gap-2">
                                   <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#60A5FA] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#60A5FA]"></span></span>
                                   <span className="text-[11px] font-medium italic text-[#6C84A3]">Intercepting...</span>
                                 </div>
                               ) : item.status === "FAIL" ? (
                                 <span className="text-[11px] font-semibold text-[#F43F5E]">{item.otp}</span>
                               ) : (
                                 <button 
                                    onClick={() => { navigator.clipboard.writeText(cleanOTPDisplay(item.otp).replace(/[\s-]+/g, '')); showToast("OTP Copied!"); }} 
                                    className="group relative inline-flex items-center gap-1.5 bg-[#101726] border border-[#00D2FF]/30 hover:border-[#00D2FF] px-2 py-0.5 rounded cursor-pointer transition-all duration-300 shadow-[0_0_10px_rgba(0,210,255,0.05)] hover:shadow-[0_0_15px_rgba(0,210,255,0.2)] overflow-hidden shrink-0"
                                 >
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#00D2FF]/0 via-[#00D2FF]/10 to-[#00D2FF]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                    <span className="text-xs md:text-sm font-mono font-bold text-[#00D2FF] tracking-widest relative z-10">{cleanOTPDisplay(item.otp)}</span>
                                    <div className="bg-[#00D2FF]/10 p-1 rounded group-hover:bg-[#00D2FF] transition-colors relative z-10">
                                       <svg className="w-3 h-3 text-[#00D2FF] group-hover:text-[#030816] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    </div>
                                 </button>
                               )}
                            </div>

                            <div className="flex items-center h-[18px] w-full shrink-0 overflow-hidden">
                               {item.status === "DONE" && item.fullMessage ? (
                                  <span className="text-[10px] text-[#6C84A3] w-full truncate font-medium">{item.fullMessage}</span>
                               ) : null}
                            </div>
                         </div>
                         
                         <div className="flex flex-col justify-between shrink-0 w-[110px] sm:w-[140px] md:w-[160px] h-full">
                            
                            <div className="flex sm:hidden flex-col items-end justify-between w-full h-full py-0.5">
                               <span className={`${badgeClasses}`}>{displayStatus}</span>
                               <span className="text-[10px] font-semibold text-[#F8FAFC] uppercase text-right w-full block truncate">
                                  {item.country}
                               </span>
                               {item.operator && item.operator !== "Any" && (
                                  <span className="flex items-center justify-end gap-1 text-[9px] font-medium text-[#6C84A3] uppercase w-full">
                                     <svg className="w-2.5 h-2.5 shrink-0 text-[#6C84A3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                         <circle cx="12" cy="12" r="2"></circle>
                                         <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
                                     </svg>
                                     <span className="block truncate max-w-[85px]">{item.operator}</span>
                                  </span>
                               )}
                               <span className="text-[9px] font-medium text-[#6C84A3] w-full text-right block truncate transition-all duration-300">
                                  {getTimeAgo(getDisplayTime(item))}
                               </span>
                            </div>

                            <div className="hidden sm:flex flex-col items-end justify-between w-full h-full py-0.5">
                               <div className="flex flex-col items-end gap-1.5">
                                  <span className={badgeClasses}>{displayStatus}</span>
                                  <span className="text-[10px] font-medium text-[#6C84A3] whitespace-nowrap mt-0.5 transition-all duration-300">{getTimeAgo(getDisplayTime(item))}</span>
                               </div>
                               
                               {item.operator && item.operator !== "Any" && (
                                  <div className="flex items-center justify-end w-full text-[11px] font-semibold text-[#F8FAFC] uppercase">
                                     <svg className="w-3 h-3 shrink-0 text-[#6C84A3] mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                     <div className="py-5 flex justify-center flex-shrink-0">
                        <svg className="w-5 h-5 animate-spin text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     </div>
                   )}
                   <div ref={observerRef} className="h-4 w-full bg-transparent flex-shrink-0"></div>
                 </>
              )}
           </div>
        </div>

        {/* 💥 BOTTOM DATE PAGINATOR 💥 */}
        <div className="flex flex-col items-center justify-center pb-5 flex-shrink-0">
           <div className="flex items-center gap-3 bg-[#101726] border border-[#162749] rounded-full px-5 py-2 shadow-sm">
             <button onClick={() => changeDate(-1)} className="p-1 text-[#6C84A3] hover:text-[#00D2FF] rounded-full transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
             <span className="text-xs font-semibold text-[#F8FAFC] min-w-[130px] text-center tracking-wide">{getFormattedDate()}</span>
             <button onClick={() => changeDate(1)} disabled={isToday} className={`p-1 rounded-full transition-colors ${isToday ? 'text-[#162749] cursor-not-allowed' : 'text-[#6C84A3] hover:text-[#00D2FF]'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
             
             <div className="w-[1px] h-5 bg-[#162749] mx-1"></div>
             
             <button 
                onClick={downloadAllSuccessOTPs} 
                disabled={isDownloading || stats.success === 0}
                title="Download ALL DONE OTPs" 
                className={`p-1.5 rounded-full transition-all border ${
                  isDownloading || stats.success === 0 
                  ? 'bg-[#030816] text-[#6C84A3] border-[#162749] cursor-not-allowed' 
                  : 'text-[#00D2FF] bg-[#00D2FF]/10 border-[#00D2FF]/30 hover:text-[#030816] hover:bg-[#00D2FF]'
                }`}
             >
               {isDownloading ? (
                 <svg className="w-4 h-4 animate-spin text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    </div>
  );
}