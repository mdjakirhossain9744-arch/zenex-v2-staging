"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout"; 

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

  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayString());

  useEffect(() => {
    const savedRange = localStorage.getItem("zenex_saved_range");
    if (savedRange) setRangeInput(savedRange);
  }, []);

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRangeInput(val);
    localStorage.setItem("zenex_saved_range", val); 
  };

  useEffect(() => {
    let lastKnownToday = getTodayString();
    
    const checkDateChange = setInterval(() => {
      const realToday = getTodayString();
      if (lastKnownToday !== realToday) {
        setSelectedDate((prevDate) => {
          if (prevDate === lastKnownToday) return realToday; 
          return prevDate;
        });
        lastKnownToday = realToday;
      }
    }, 60000); 
    return () => clearInterval(checkDateChange);
  }, []);

  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const newDateStr = `${year}-${month}-${day}`;

    if (newDateStr <= getTodayString()) setSelectedDate(newDateStr);
  };

  const getFormattedDate = () => {
    const dateObj = new Date(selectedDate);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    if (selectedDate === getTodayString()) return `Today, ${dateObj.toLocaleDateString('en-GB', options)}`;
    return dateObj.toLocaleDateString('en-GB', options);
  };

  useEffect(() => {
    const savedNumbers = localStorage.getItem("zenex_numbers_v2");
    if (savedNumbers) setNumbersList(JSON.parse(savedNumbers));
  }, []);

  useEffect(() => {
    if (numbersList.length > 0) {
      localStorage.setItem("zenex_numbers_v2", JSON.stringify(numbersList));
    }
  }, [numbersList]);

  useEffect(() => {
    const timerInterval = setInterval(() => setCurrentTime(Date.now()), 10000); 
    return () => clearInterval(timerInterval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const getTimeAgo = (timestamp: number) => {
    const secondsPast = Math.floor((currentTime - timestamp) / 1000);
    if (secondsPast < 60) return "Just Now";
    if (secondsPast < 3600) return `${Math.floor(secondsPast / 60)} min ago`;
    if (secondsPast < 86400) return `${Math.floor(secondsPast / 3600)} hour ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const addBalanceToDatabase = async () => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
       const userEmail = JSON.parse(storedUser).email;
       await fetch("/api/add-balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail })
       });
    }
  };

  const checkOtps = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/check-otp?t=${Date.now()}`);
      const result = await res.json();

      if (result.success && result.otps) {
        setNumbersList((prevList) => {
          let updatedList = [...prevList];
          let newDups: any[] = [];
          let balanceAdded = false; 

          updatedList = updatedList.map((item) => {
            // 💥 টাইমআউট লজিক এখানেই আছে, শুধু নিচের useEffect এ চেকারটি ঠিক করা হয়েছে 💥
            if (item.status === "WAIT" && Date.now() - item.createdAt > 1200000) {
               return { ...item, status: "FAIL", otp: "Timeout (20 mins passed)" };
            }

            if (item.isDup) return item;

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

                  showToast(`OTP Received: ${finalCode}`);
                  balanceAdded = true; 

                  return { 
                    ...item, 
                    status: "DONE", 
                    otp: finalCode, 
                    fullMessage: firstMsg, 
                    seenMessages: apiMessages, 
                    receivedAt: Date.now() 
                  };
               } 
               else if (item.status === "DONE") {
                  const alreadySeen = item.seenMessages || [item.fullMessage];
                  const newMessages = apiMessages.filter((msg: string) => !alreadySeen.includes(msg));

                  if (newMessages.length > 0) {
                     newMessages.forEach((newMsg: string) => {
                        const codeMatch = newMsg.match(/\b\d{4,8}\b/); 
                        const finalCode = codeMatch ? codeMatch[0] : newMsg;

                        showToast(`2nd OTP Received: ${finalCode}`);
                        balanceAdded = true; 
                        
                        newDups.push({
                           ...item,
                           id: Date.now() + Math.random(),
                           status: "DONE",
                           otp: finalCode,
                           fullMessage: newMsg,
                           seenMessages: [], 
                           isDup: true, 
                           receivedAt: Date.now()
                        });
                     });
                     return { ...item, seenMessages: [...alreadySeen, ...newMessages] };
                  }
               }
            }
            return item;
          });

          if (balanceAdded) {
             addBalanceToDatabase();
          }

          return [...newDups, ...updatedList];
        });
      }
    } catch (err) {
      console.error("Check Error");
    } finally {
      if (isManual) setTimeout(() => setIsRefreshing(false), 500); 
    }
  };

  // 💥 ফিক্সড: ২০ মিনিট পার হলেও এখন ঠিকমতো ফেইল হবে 💥
  useEffect(() => {
    const interval = setInterval(() => {
      // আগের কোডে ২০ মিনিট পার হলে চেকার বন্ধ হয়ে যেত, এখন যতোক্ষণ "WAIT" স্ট্যাটাস থাকবে ততোক্ষণ চেকার চলবে এবং টাইমআউট হলে ফেইল করবে
      const hasActiveNumbers = numbersList.some(n => n.status === "WAIT");
      if (hasActiveNumbers) checkOtps(false);
    }, 3000); 
    return () => clearInterval(interval);
  }, [numbersList]);

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
        const todayStr = getTodayString();

        const newEntry = {
          id: Date.now(),
          dateString: todayStr, 
          displayNumber: fullNumberDisplay, 
          searchNumber: result.data.full_number, 
          country: result.data.country,
          operator: result.data.operator,
          status: "WAIT",
          otp: "Waiting for SMS...",
          fullMessage: "",
          seenMessages: [], 
          isDup: false,
          createdAt: Date.now(),
          receivedAt: null 
        };
        setNumbersList((prev) => [newEntry, ...prev]);
        setSelectedDate(todayStr);
      } else {
        showToast(result.error || "Failed to fetch number!");
      }
    } catch (error) {
      showToast("Something went wrong!");
    } finally {
      setIsLoading(false);
    }
  };

  const isToday = selectedDate === getTodayString();
  
  const dateFilteredNumbers = numbersList.filter((item) => item.dateString === selectedDate);
    
  const finalFilteredNumbers = dateFilteredNumbers.filter((item) => {
    if (activeFilter === "ALL") return true;
    return item.status === activeFilter;
  });

  const sortedFilteredNumbers = [...finalFilteredNumbers].sort((a, b) => {
    const timeA = a.receivedAt || a.createdAt;
    const timeB = b.receivedAt || b.createdAt;
    return timeB - timeA; 
  });

  const totalGen = dateFilteredNumbers.length;
  const successCount = dateFilteredNumbers.filter((n) => n.status === "DONE").length;
  const waitCount = dateFilteredNumbers.filter((n) => n.status === "WAIT").length;
  const failCount = dateFilteredNumbers.filter((n) => n.status === "FAIL").length;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full relative z-10 font-sans">
        
        {toastMessage && (
          <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#10B981] text-white px-5 py-3 rounded-lg shadow-lg font-semibold flex items-center gap-3 animate-bounce-in">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             {toastMessage}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
           <div className="rounded-xl bg-[#1E293B]/50 border border-[#334155] p-4 md:p-5 flex flex-col justify-center items-center md:items-start md:flex-row md:justify-between transition-all hover:border-[#94A3B8]">
              <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-1 md:mb-0">Total Gen</span>
              <span className="text-2xl font-black text-white">{totalGen}</span>
           </div>
           <div className="rounded-xl bg-gradient-to-br from-[#1E293B]/50 to-[#10B981]/10 border border-[#10B981]/30 p-4 md:p-5 flex flex-col justify-center items-center md:items-start md:flex-row md:justify-between transition-all hover:border-[#10B981]">
              <span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest mb-1 md:mb-0">Success</span>
              <span className="text-2xl font-black text-[#10B981]">{successCount}</span>
           </div>
           <div className="rounded-xl bg-gradient-to-br from-[#1E293B]/50 to-[#EAB308]/10 border border-[#EAB308]/30 p-4 md:p-5 flex flex-col justify-center items-center md:items-start md:flex-row md:justify-between transition-all hover:border-[#EAB308]">
              <span className="text-[10px] font-black text-[#EAB308] uppercase tracking-widest mb-1 md:mb-0">Wait (Live)</span>
              <span className="text-2xl font-black text-[#EAB308]">{waitCount}</span>
           </div>
           <div className="rounded-xl bg-gradient-to-br from-[#1E293B]/50 to-[#F43F5E]/10 border border-[#F43F5E]/30 p-4 md:p-5 flex flex-col justify-center items-center md:items-start md:flex-row md:justify-between transition-all hover:border-[#F43F5E]">
              <span className="text-[10px] font-black text-[#F43F5E] uppercase tracking-widest mb-1 md:mb-0">Failed</span>
              <span className="text-2xl font-black text-[#F43F5E]">{failCount}</span>
           </div>
        </div>

        <div className={`rounded-xl md:rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-5 md:p-8 shadow-lg mb-6 relative overflow-hidden transition-all ${!isToday ? 'opacity-60 pointer-events-none' : ''}`}>
           {!isToday && (
             <div className="absolute inset-0 bg-[#0F172A]/50 z-20 flex items-center justify-center">
               <span className="bg-[#EAB308] text-black font-black px-6 py-2 rounded-xl text-sm uppercase tracking-widest shadow-lg">Generating is locked in History Mode</span>
             </div>
           )}
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3B82F6] to-[#00C6FF]"></div>
           <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-end">
              <div className="flex-1 w-full">
                 <label className="block text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-3">Target Range / Country Code</label>
                 <input 
                    type="text" 
                    value={rangeInput}
                    onChange={handleRangeChange}
                    placeholder="e.g. 23276345XXX" 
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-4 text-white font-mono text-xl focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all" 
                 />
              </div>
              <div className="flex gap-6 pb-4">
                 <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsNational(!isNational)}>
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isNational ? "bg-[#3B82F6] border-[#3B82F6]" : "bg-[#0F172A] border-[#334155]"}`}>
                       {isNational && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-sm font-bold text-[#94A3B8] group-hover:text-white transition-colors">National</span>
                 </label>
                 <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setRemovePlus(!removePlus)}>
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${removePlus ? "bg-[#3B82F6] border-[#3B82F6]" : "bg-[#0F172A] border-[#334155]"}`}>
                       {removePlus && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-sm font-bold text-[#94A3B8] group-hover:text-white transition-colors">Remove (+)</span>
                 </label>
              </div>
              <button 
                 onClick={fetchNewNumber}
                 disabled={isLoading || !isToday}
                 className={`bg-gradient-to-r from-[#3B82F6] to-[#00C6FF] hover:from-[#2563EB] hover:to-[#00B4E6] text-white font-black text-lg px-10 py-4 rounded-xl transition-all flex items-center gap-3 w-full md:w-auto justify-center tracking-wider ${isLoading || !isToday ? "opacity-50 cursor-not-allowed" : "shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:-translate-y-1"}`}>
                 {isLoading ? <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                 {isLoading ? "FETCHING..." : "GET NUMBER"}
              </button>
           </div>
        </div>

        <div className="rounded-2xl bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl overflow-hidden shadow-lg w-full mb-6">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-[#0F172A]/50 border-b border-[#334155] gap-4 md:gap-0">
             <div className="flex items-center justify-between w-full md:w-auto">
               <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                 {isToday ? <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span> : <span className="w-2 h-2 rounded-full bg-[#64748B]"></span>}
                 {isToday ? "Active Feed" : "History Feed"}
               </h3>
               {isToday && (
                 <button onClick={() => checkOtps(true)} className="md:ml-4 p-1.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg border border-[#3B82F6]/30 hover:bg-[#3B82F6]/20">
                   <svg className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                   </svg>
                 </button>
               )}
             </div>
             <div className="flex gap-2 bg-[#0B0F19] p-1 rounded-lg border border-[#334155]">
               {["ALL", "DONE", "WAIT", "FAIL"].map((filterName) => (
                 <button key={filterName} onClick={() => setActiveFilter(filterName)}
                   className={`px-4 py-1.5 text-[10px] font-black rounded uppercase transition-colors ${activeFilter === filterName ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "text-[#64748B] hover:text-[#E2E8F0]"}`}>
                   {filterName}
                 </button>
               ))}
             </div>
           </div>

           <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-4 border-b border-[#334155] text-[10px] font-black text-[#64748B] uppercase tracking-widest bg-[#1E293B]">
              <div className="col-span-3">Phone Number</div>
              <div className="col-span-5">Received OTP / SMS</div>
              <div className="col-span-2">Network Info</div>
              <div className="col-span-2 text-right">Status</div>
           </div>

           <div className="flex flex-col max-h-[500px] overflow-y-auto custom-scrollbar w-full relative">
              {sortedFilteredNumbers.length === 0 ? (
                 <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-[#0F172A] rounded-full border border-[#334155] flex items-center justify-center mb-5 relative">
                       <div className="absolute inset-0 rounded-full border-t-2 border-[#3B82F6] animate-spin"></div>
                       <svg className="w-8 h-8 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <h3 className="text-xl font-black text-[#F8FAFC] tracking-wide">
                      {isToday ? "Waiting for Command" : "No History Found"}
                    </h3>
                    <p className="text-[#94A3B8] text-sm mt-2 font-medium max-w-md">
                      {isToday ? "Enter a range above and hit Get Number to intercept live network signals." : `No numbers were generated on ${selectedDate}.`}
                    </p>
                 </div>
              ) : (
                 sortedFilteredNumbers.map((item) => (
                    <div key={item.id} className={`grid grid-cols-12 gap-4 p-5 border-b border-[#334155] items-center transition-colors w-full ${item.status === 'DONE' && (currentTime - (item.receivedAt||0) < 5000) ? 'bg-[#10B981]/10' : 'hover:bg-[#334155]/20'}`}>
                       
                       <div className="col-span-12 md:col-span-3 flex justify-between items-center">
                          <div onClick={() => { navigator.clipboard.writeText(item.displayNumber); showToast("Number Copied!"); }} className="flex items-center gap-2 group cursor-pointer">
                            <span className="text-lg font-bold text-slate-200 tracking-wide group-hover:text-[#3B82F6] transition-colors">{item.displayNumber}</span>
                            {item.isDup && (
                               <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[9px] font-black rounded uppercase tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                                 DUP
                               </span>
                            )}
                          </div>
                          <span className={`md:hidden px-2 py-0.5 border text-[9px] font-black rounded uppercase ${item.status === "WAIT" ? "bg-[#EAB308]/10 border-[#EAB308]/20 text-[#EAB308]" : item.status === "DONE" ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]" : "bg-[#F43F5E]/10 border-[#F43F5E]/20 text-[#F43F5E]"}`}>{item.status}</span>
                       </div>
                       
                       <div className="col-span-12 md:col-span-5 py-1 md:py-0">
                          <div className="flex items-center gap-3">
                             {item.status === "WAIT" ? (
                               <>
                                 <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EAB308] opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-[#EAB308]"></span></span>
                                 <span className="text-sm italic font-medium text-[#94A3B8]">{item.otp}</span>
                               </>
                             ) : item.status === "FAIL" ? (
                               <span className="text-sm font-bold text-[#F43F5E] bg-[#F43F5E]/10 px-3 py-1 rounded-lg">{item.otp}</span>
                             ) : (
                               <div className="flex flex-col">
                                 <div onClick={() => { navigator.clipboard.writeText(item.otp); showToast("OTP Copied!"); }} className="inline-flex items-center gap-2 bg-[#0F172A] border border-[#10B981]/30 px-3 py-1.5 rounded-md cursor-pointer hover:border-[#10B981] w-max">
                                   <span className="text-xl font-mono font-black text-[#10B981] tracking-widest">{item.otp}</span>
                                 </div>
                                 {item.fullMessage && <span className="text-[10px] text-[#64748B] mt-1.5 line-clamp-1">{item.fullMessage}</span>}
                               </div>
                             )}
                          </div>
                       </div>
                       
                       <div className="flex justify-between md:hidden items-center mt-2 pt-2 border-t border-[#334155]/50 col-span-12">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-[#94A3B8]"><span className="text-[#E2E8F0]">{item.country}</span> • <span className="uppercase">{item.operator}</span></div>
                          <span className="text-[9px] font-bold text-[#64748B] flex items-center gap-1">{getTimeAgo(item.receivedAt || item.createdAt)}</span>
                       </div>

                       <div className="hidden md:flex flex-col justify-center col-span-2">
                          <span className="text-xs font-bold text-[#E2E8F0]">{item.country}</span>
                          <span className="text-[10px] font-bold text-[#64748B] uppercase mt-1">{item.operator}</span>
                       </div>
                       <div className="hidden md:flex flex-col items-end justify-center gap-1 col-span-2">
                          <span className={`px-3 py-1 border text-[10px] font-black rounded uppercase tracking-widest ${item.status === "WAIT" ? "bg-[#EAB308]/10 border-[#EAB308]/20 text-[#EAB308]" : item.status === "DONE" ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-[#F43F5E]/10 border-[#F43F5E]/20 text-[#F43F5E]"}`}>{item.status}</span>
                          <span className="text-[10px] font-bold text-[#64748B] flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{getTimeAgo(item.receivedAt || item.createdAt)}</span>
                       </div>

                    </div>
                 ))
              )}
           </div>
        </div>

        <div className="flex flex-col items-center justify-center mt-2 mb-6">
           <span className="text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-2">Viewing Data For</span>
           <div className="flex items-center gap-4 bg-[#1E293B]/80 border border-[#334155] rounded-full px-5 py-2 shadow-lg backdrop-blur-md">
             <button 
                onClick={() => changeDate(-1)} 
                className="p-1.5 text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-full transition-all"
                title="Previous Day"
             >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
             </button>

             <span className="text-sm md:text-base font-black text-white min-w-[140px] text-center tracking-wide">
                {getFormattedDate()}
             </span>

             <button 
                onClick={() => changeDate(1)} 
                disabled={isToday}
                className={`p-1.5 rounded-full transition-all ${isToday ? 'text-[#334155] cursor-not-allowed' : 'text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10'}`}
                title="Next Day"
             >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
             </button>
           </div>
        </div>

      </div>
    </DashboardLayout>
  );
}