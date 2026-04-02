"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../DashboardLayout"; 

// বাংলাদেশ টাইম ফোর্স করা হলো (রাত ১২টায় পারফেক্টলি ডেট চেঞ্জ হবে)
const getBDDateString = (dateObj: Date | number | string = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
  }).format(new Date(dateObj));
};

export default function GetNumber() {
  const [rangeInput, setRangeInput] = useState("");
  const [isNational, setIsNational] = useState(false);
  const [removePlus, setRemovePlus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ALL"); 
  
  const [toastMessage, setToastMessage] = useState("");
  const [numbersList, setNumbersList] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedDate, setSelectedDate] = useState(getBDDateString());

  // 💥 Refs for Web Worker latest state access 💥
  const numbersListRef = useRef(numbersList);
  useEffect(() => { numbersListRef.current = numbersList; }, [numbersList]);

  const isCheckingRef = useRef(false); // To prevent overlapping API calls

  const getUserEmail = () => {
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
    return storedUser ? JSON.parse(storedUser).email : "";
  };

  useEffect(() => {
    const savedRange = localStorage.getItem("zenex_saved_range");
    if (savedRange) setRangeInput(savedRange);
  }, []);

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRangeInput(val);
    localStorage.setItem("zenex_saved_range", val); 
  };

  const changeDate = (days: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() + days);
    const newDateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    if (newDateStr <= getBDDateString()) setSelectedDate(newDateStr);
  };

  const getFormattedDate = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    if (selectedDate === getBDDateString()) return `Today, ${dateObj.toLocaleDateString('en-GB', options)}`;
    return dateObj.toLocaleDateString('en-GB', options);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // 💥 Fixed "Just Now" Bug: Accurately calculating real time 💥
  const getTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Just Now";
    const secondsPast = Math.floor((currentTime - timestamp) / 1000);
    if (secondsPast < 60) return "Just Now";
    if (secondsPast < 3600) return `${Math.floor(secondsPast / 60)} min ago`;
    if (secondsPast < 86400) return `${Math.floor(secondsPast / 3600)} hour ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const fetchDbOrders = async () => {
    const email = getUserEmail();
    if(!email) return;
    try {
      const res = await fetch("/api/sync-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FETCH", email })
      });
      const data = await res.json();
      if(data.success && data.orders) {
        setNumbersList(data.orders);
      }
    } catch (err) {
      console.error("Failed to sync DB orders");
    }
  };

  const checkOtps = async (isManual = false) => {
    if (isCheckingRef.current) return; // Prevent double checking
    isCheckingRef.current = true;
    if (isManual) setIsRefreshing(true);
    
    try {
      const res = await fetch(`/api/check-otp?t=${Date.now()}`);
      const result = await res.json();

      if (result.success && result.otps) {
        let updatedList = [...numbersListRef.current];
        let newDups: any[] = [];

        for (let i = 0; i < updatedList.length; i++) {
          let item = updatedList[i];

          if (item.status === "WAIT" && Date.now() - item.createdAt > 1200000) {
             await fetch("/api/sync-orders", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ action: "UPDATE", email: getUserEmail(), orderData: { searchNumber: item.searchNumber, status: "FAIL", otp: "Timeout", fullMessage: "" } })
             });
             updatedList[i] = { ...item, status: "FAIL", otp: "Timeout" };
             continue;
          }

          if (item.isDup || item.isMulti) continue;

          const cleanSearchNumber = String(item.searchNumber).replace(/\D/g, ""); 
          const last6Digits = cleanSearchNumber.slice(-6); 
          
          const matchingOtps = result.otps.filter((otpObj: any) => {
             if(!otpObj.number) return false;
             return String(otpObj.number).replace(/\D/g, "").endsWith(last6Digits);
          });

          if (matchingOtps.length > 0) {
             const apiMessages = matchingOtps.map((m: any) => m.otp || "");

             if (item.status === "WAIT") {
                const firstMsg = apiMessages[0];
                const codeMatch = firstMsg.match(/\b\d{4,8}\b/); 
                const finalCode = codeMatch ? codeMatch[0] : firstMsg;

                if(isManual) showToast(`OTP Received: ${finalCode}`);

                const exactReceiveTime = Date.now();

                await fetch("/api/sync-orders", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "UPDATE", email: getUserEmail(), orderData: { searchNumber: item.searchNumber, status: "DONE", otp: finalCode, fullMessage: firstMsg, receivedAt: exactReceiveTime } })
                });

                updatedList[i] = { 
                  ...item, status: "DONE", otp: finalCode, fullMessage: firstMsg, 
                  seenMessages: apiMessages, receivedAt: exactReceiveTime 
                };
             } 
             else if (item.status === "DONE") {
                const alreadySeen = item.seenMessages || [item.fullMessage];
                const alreadySeenCodes = alreadySeen.map((msg: string) => {
                   const match = msg.match(/\b\d{4,8}\b/);
                   return match ? match[0] : msg.trim();
                });

                const newMessages = apiMessages.filter((msg: string) => {
                   const codeMatch = msg.match(/\b\d{4,8}\b/);
                   const extractedCode = codeMatch ? codeMatch[0] : msg.trim();
                   return !alreadySeenCodes.includes(extractedCode);
                });

                if (newMessages.length > 0) {
                   for (const newMsg of newMessages) {
                      const codeMatch = newMsg.match(/\b\d{4,8}\b/); 
                      const finalCode = codeMatch ? codeMatch[0] : newMsg;

                      if(isManual) showToast(`MULTI OTP Received: ${finalCode}`);
                      
                      const exactReceiveTime = Date.now();

                      await fetch("/api/sync-orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "UPDATE", email: getUserEmail(), orderData: { searchNumber: item.searchNumber, status: "DONE", otp: finalCode, fullMessage: newMsg, receivedAt: exactReceiveTime } })
                      });

                      newDups.push({
                         ...item, 
                         id: `${item.id}_${finalCode}`, 
                         status: "DONE",
                         otp: finalCode, fullMessage: newMsg, seenMessages: [], 
                         isMulti: true, receivedAt: exactReceiveTime
                      });
                   }
                   updatedList[i] = { ...item, seenMessages: [...alreadySeen, ...newMessages] };
                }
             }
          }
        }
        setNumbersList([...newDups, ...updatedList]);
      }
    } catch (err) {
      console.error("Check Error");
    } finally {
      isCheckingRef.current = false;
      if (isManual) setTimeout(() => setIsRefreshing(false), 500); 
    }
  };

  const fetchDbOrdersRef = useRef(fetchDbOrders);
  useEffect(() => { fetchDbOrdersRef.current = fetchDbOrders; }, [fetchDbOrders]);

  const checkOtpsRef = useRef(checkOtps);
  useEffect(() => { checkOtpsRef.current = checkOtps; }, [checkOtps]);

  // 💥 THE MAGIC: UNSTOPPABLE BACKGROUND WEB WORKER 💥
  // ব্রাউজার অন্য ট্যাবে গেলেও এই ওয়ার্কার কখনোই ঘুমাবে না!
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const workerCode = `
      let tick3, tick10;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          tick3 = setInterval(() => self.postMessage('tick3'), 3000);
          tick10 = setInterval(() => self.postMessage('tick10'), 10000);
        } else if (e.data === 'stop') {
          clearInterval(tick3);
          clearInterval(tick10);
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => {
      if (e.data === 'tick3') {
         const hasActiveNumbers = numbersListRef.current.some(n => n.status === "WAIT");
         if (hasActiveNumbers) checkOtpsRef.current(false);
      }
      if (e.data === 'tick10') {
         fetchDbOrdersRef.current();
         setCurrentTime(Date.now()); // Update time properly
         
         // Night 12AM Date Change logic
         const realToday = getBDDateString();
         setSelectedDate((prevDate) => {
            if (prevDate !== realToday && prevDate === getBDDateString(Date.now() - 86400000)) return realToday;
            return prevDate;
         });
      }
    };

    worker.postMessage('start');

    return () => {
      worker.postMessage('stop');
      worker.terminate();
    };
  }, []);

  const fetchNewNumber = async () => {
    if (!rangeInput) {
      showToast("Please enter a Number Range first!");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/getnum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range: rangeInput, is_national: isNational, remove_plus: removePlus }),
      });
      const result = await response.json();
      
      if (response.ok && result.success) {
        const numberToCopy = result.data.copy;
        navigator.clipboard.writeText(numberToCopy);
        showToast(`Copied: ${numberToCopy}`);

        const fullNumberDisplay = result.data.full_number.startsWith("+") ? result.data.full_number : `+${result.data.full_number}`;
        const todayStr = getBDDateString();

        const newEntry = {
          id: Date.now().toString(), dateString: todayStr, displayNumber: fullNumberDisplay, 
          searchNumber: result.data.full_number, country: result.data.country || "Unknown",
          operator: result.data.operator || "Any", status: "WAIT", otp: "Waiting...",
          fullMessage: "", seenMessages: [], isDup: false, isMulti: false,
          createdAt: Date.now(), receivedAt: null 
        };
        
        setNumbersList((prev) => [newEntry, ...prev]);
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

  const isToday = selectedDate === getBDDateString();
  const dateFilteredNumbers = numbersList.filter((item) => item.dateString === selectedDate);
    
  const finalFilteredNumbers = dateFilteredNumbers.filter((item) => {
    if (activeFilter === "ALL") return true;
    return item.status === activeFilter;
  });

  const sortedFilteredNumbers = [...finalFilteredNumbers].sort((a, b) => {
    return b.createdAt - a.createdAt; 
  });

  const totalGen = dateFilteredNumbers.length;
  const successCount = dateFilteredNumbers.filter((n) => n.status === "DONE").length;
  const waitCount = dateFilteredNumbers.filter((n) => n.status === "WAIT").length;
  const failCount = dateFilteredNumbers.filter((n) => n.status === "FAIL").length;

  return (
    <DashboardLayout>
      <div className="p-3 md:p-10 w-full relative z-10 font-sans">
        
        {toastMessage && (
          <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#10B981] text-white px-4 py-2 rounded-lg shadow-lg font-bold text-sm flex items-center gap-2 animate-bounce-in">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             {toastMessage}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
           <div className="rounded-xl bg-[#1E293B]/50 border border-[#334155] p-3 flex justify-between items-center transition-all hover:border-[#94A3B8]">
              <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Total</span>
              <span className="text-lg font-black text-white">{totalGen}</span>
           </div>
           <div className="rounded-xl bg-gradient-to-br from-[#1E293B]/50 to-[#10B981]/10 border border-[#10B981]/30 p-3 flex justify-between items-center transition-all hover:border-[#10B981]">
              <span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest">Success</span>
              <span className="text-lg font-black text-[#10B981]">{successCount}</span>
           </div>
           <div className="rounded-xl bg-gradient-to-br from-[#1E293B]/50 to-[#EAB308]/10 border border-[#EAB308]/30 p-3 flex justify-between items-center transition-all hover:border-[#EAB308]">
              <span className="text-[10px] font-black text-[#EAB308] uppercase tracking-widest">Wait</span>
              <span className="text-lg font-black text-[#EAB308]">{waitCount}</span>
           </div>
           <div className="rounded-xl bg-gradient-to-br from-[#1E293B]/50 to-[#F43F5E]/10 border border-[#F43F5E]/30 p-3 flex justify-between items-center transition-all hover:border-[#F43F5E]">
              <span className="text-[10px] font-black text-[#F43F5E] uppercase tracking-widest">Failed</span>
              <span className="text-lg font-black text-[#F43F5E]">{failCount}</span>
           </div>
        </div>

        <div className={`rounded-xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-4 md:p-6 shadow-md mb-4 relative overflow-hidden transition-all ${!isToday ? 'opacity-60 pointer-events-none' : ''}`}>
           {!isToday && (
             <div className="absolute inset-0 bg-[#0F172A]/50 z-20 flex items-center justify-center">
               <span className="bg-[#EAB308] text-black font-black px-4 py-1.5 rounded-lg text-xs uppercase tracking-widest shadow-md">History Mode Locked</span>
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
                 <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsNational(!isNational)}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isNational ? "bg-[#3B82F6] border-[#3B82F6]" : "bg-[#0F172A] border-[#334155]"}`}>
                       {isNational && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-xs font-bold text-[#94A3B8] group-hover:text-white transition-colors">National</span>
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setRemovePlus(!removePlus)}>
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

        <div className="rounded-xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl overflow-hidden shadow-md w-full mb-4">
           <div className="flex justify-between items-center p-3 bg-[#0F172A]/50 border-b border-[#334155]">
             <div className="flex items-center gap-2">
               <h3 className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                 {isToday ? <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span> : <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]"></span>}
                 Feed
               </h3>
               {isToday && (
                 <button onClick={() => checkOtps(true)} className="ml-2 p-1 bg-[#3B82F6]/10 text-[#3B82F6] rounded border border-[#3B82F6]/30 hover:bg-[#3B82F6]/20">
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

           <div className="flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar w-full">
              {sortedFilteredNumbers.length === 0 ? (
                 <div className="p-10 flex flex-col items-center justify-center text-center">
                    <svg className="w-8 h-8 text-[#334155] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <h3 className="text-sm font-black text-[#64748B] tracking-wide">Empty List</h3>
                 </div>
              ) : (
                 sortedFilteredNumbers.map((item) => (
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
                             <span className="text-[9px] font-bold text-[#64748B] hidden md:block">{getTimeAgo(item.receivedAt || item.updatedAt || item.createdAt)}</span>
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
                            <span className="text-[8px] font-bold text-[#64748B] md:hidden mt-0.5">{getTimeAgo(item.receivedAt || item.updatedAt || item.createdAt)}</span>
                          </div>
                       </div>
                    </div>
                 ))
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