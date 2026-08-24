"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import useSWR from "swr";

const fetcher = async (url: string, payload: any) => {
  try {
    const res = await fetch(url, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    return [];
  }
};

const getLiveUTCString = () => {
  const d = new Date();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getUTCMonth()];
  return `${hours}:${minutes}:${seconds} UTC - ${day} ${month}`;
};

const formatSimpleTime = (dateString: string) => {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const maskOTPInMessage = (msg: string) => {
  if (!msg) return "";
  const regex = /(?:\b\d{3}[\s-]\d{3,4}\b)|(?:\b\d{4,10}\b)|(?:G-\d{6,8})/g;
  return msg.replace(regex, (match) => match.replace(/\d/g, '*'));
};

export default function AdminRealtimeConsole() {
  const router = useRouter();
  const [userStore, setUserStore] = useState<{ role: string; email: string } | null>(null);
  const [liveTime, setLiveTime] = useState<string>("");

  const [filterStatus, setFilterStatus] = useState("ALL");
  const [limit, setLimit] = useState(50);
  
  const [isLive, setIsLive] = useState(true);
  const [displayData, setDisplayData] = useState<any[]>([]);

  useEffect(() => {
    setLiveTime(getLiveUTCString());
    const timer = setInterval(() => setLiveTime(getLiveUTCString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed.role !== "admin") return router.push("/"); 
      setUserStore({ role: parsed.role, email: parsed.email });
    }

    const storedLiveStatus = sessionStorage.getItem("admin_isLive");
    if (storedLiveStatus !== null) setIsLive(storedLiveStatus === "true");

    const frozenData = sessionStorage.getItem("admin_frozenData");
    if (frozenData) {
      try { setDisplayData(JSON.parse(frozenData)); } catch (e) {}
    }
  }, [router]);

  const handleToggleLive = () => {
    const newVal = !isLive;
    setIsLive(newVal);
    sessionStorage.setItem("admin_isLive", String(newVal));
  };

  // 💥 SWR ALWAYS FETCHES TO CHECK FOR OTPs EVEN IF FROZEN 💥
  const { data: swrData } = useSWR(
    userStore ? ["/api/monitoring", userStore.role, userStore.email, filterStatus, limit] : null,
    ([url, role, email, status, rowLimit]: any) => fetcher(url, { role, email, filterStatus: status, limit: rowLimit }),
    { refreshInterval: 3000 }
  );

  // 💥 SMART FREEZE LOGIC 💥
  useEffect(() => {
    if (!swrData) return;
    
    if (isLive) {
      setDisplayData(swrData);
      sessionStorage.setItem("admin_frozenData", JSON.stringify(swrData));
    } else {
      // If frozen, keep the current rows but update their status/OTP if it arrived in swrData
      setDisplayData((prev) => {
        const updatedDisplay = prev.map(oldRow => {
          const updatedRow = swrData.find((newRow: any) => newRow._id === oldRow._id);
          return updatedRow ? updatedRow : oldRow;
        });
        sessionStorage.setItem("admin_frozenData", JSON.stringify(updatedDisplay));
        return updatedDisplay;
      });
    }
  }, [swrData, isLive]);

  if (!userStore) return null;

  return (
    <div className="p-3 md:p-10 w-full relative z-10 pb-20 font-sans tracking-tight bg-[#030816] min-h-screen">
      <div className="w-full">
        
        <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="w-full md:w-auto">
            <h2 className="text-2xl md:text-3xl font-black text-[#00D2FF] tracking-tight">Global Realtime</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="relative flex h-3 w-3">
                {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isLive ? 'bg-[#00D2FF]' : 'bg-[#F43F5E]'}`}></span>
              </span>
              <p className="text-[#6C84A3] text-xs md:text-sm font-semibold tracking-widest uppercase">
                {isLive ? `Monitoring Activity • ${limit} Rows` : "SYSTEM FROZEN (PAUSED)"}
              </p>
            </div>
            
            <div className="md:hidden mt-3 w-full bg-[#101726] border border-[#162749] px-3 py-2 rounded-lg shadow-inner flex justify-between items-center">
              <span className="text-[10px] text-[#6C84A3] font-bold uppercase tracking-widest">System Time</span>
              <span className="text-[#00D2FF] font-mono font-black text-xs tracking-wider">{liveTime}</span>
            </div>
          </div>

          <div className="hidden md:block bg-[#101726] border border-[#162749] px-5 py-2.5 rounded-lg shadow-inner">
             <span className="text-[#00D2FF] font-mono font-black text-lg tracking-wider">{liveTime}</span>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 md:flex md:flex-row items-center gap-3 bg-[#101726]/90 border border-[#162749] p-3 rounded-xl shadow-lg backdrop-blur-md">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={!isLive} className="col-span-1 w-full bg-[#0B152A] text-xs md:text-sm font-semibold text-[#F8FAFC] px-3 md:px-4 py-2.5 rounded-lg border border-[#162749] focus:border-[#00D2FF] outline-none transition-all cursor-pointer disabled:opacity-50 tracking-tight">
            <option value="ALL">🔵 ALL STATUS</option>
            <option value="SUCCESS">⚡ SUCCESS</option>
            <option value="PENDING">⏳ PENDING</option>
            <option value="FAILED">🔴 FAILED</option>
          </select>

          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={!isLive} className="col-span-1 w-full bg-[#0B152A] text-xs md:text-sm font-semibold text-[#F8FAFC] px-3 md:px-4 py-2.5 rounded-lg border border-[#162749] focus:border-[#00D2FF] outline-none transition-all cursor-pointer disabled:opacity-50 tracking-tight">
            <option value={25}>25 Rows</option>
            <option value={50}>50 Rows</option>
            <option value={100}>100 Rows</option>
          </select>

          <button onClick={handleToggleLive} className={`col-span-2 w-full md:w-auto md:ml-auto flex-shrink-0 whitespace-nowrap text-[11px] md:text-xs px-5 py-2.5 rounded-lg font-black tracking-widest uppercase transition-all duration-300 border ${isLive ? 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/30 hover:bg-[#00D2FF]/20 shadow-[0_0_15px_rgba(0,210,255,0.2)]' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30 hover:bg-[#F43F5E]/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]'}`}>
            {isLive ? '⚡ Live Auto-Sync' : '⏸ SYSTEM FROZEN'}
          </button>
        </div>

        <div className={`bg-[#0B152A] border ${isLive ? 'border-[#162749]' : 'border-[#F43F5E]/50'} rounded-2xl shadow-lg overflow-auto max-h-[75vh] min-h-[300px] custom-scrollbar relative transition-all duration-300`}>
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[#101726]/95 backdrop-blur-md text-[#6C84A3] uppercase text-[10px] tracking-widest border-b border-[#162749] sticky top-0 z-20 font-bold">
              <tr>
                <th className="px-4 py-3 pl-6">Time (UTC)</th>
                <th className="px-4 py-3">User (ID)</th>
                <th className="px-4 py-3">Number Info</th>
                <th className="px-4 py-3 min-w-[200px] max-w-[300px]">Full Message (Secured)</th>
                <th className="px-4 py-3 pr-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#162749]/50">
              {displayData.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-[#6C84A3] font-semibold">{isLive ? 'Waiting for data...' : 'No frozen data available.'}</td></tr>
              ) : (
                displayData.map((req: any) => {
                  const isPending = req.status === "WAIT";
                  const isDone = req.status === "DONE";
                  const rawMessage = req.fullMessage || req.sms || req.message || ""; 
                  const displayMessage = rawMessage.split("_||_")[0]; 

                  return (
                    <tr key={req._id} className="hover:bg-[#101726] transition-colors animate-fade-in">
                      <td className="px-4 py-2.5 pl-6">
                         <span className="text-xs font-mono font-medium text-[#6C84A3]">{formatSimpleTime(req.createdAt)}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-sm text-[#F8FAFC]">{req.userName || "User"}</p>
                        <p className="text-[9px] text-[#60A5FA] font-mono bg-[#60A5FA]/10 px-1.5 py-0.5 rounded inline-block mt-0.5 border border-[#60A5FA]/20">
                          {req.userUid || "ZX-N/A"}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-bold text-[#00D2FF] tracking-wider text-sm">{req.searchNumber || "N/A"}</p>
                        <p className="text-[9px] text-[#6C84A3] mt-0.5 font-bold uppercase">{req.country} • {req.operator}</p>
                      </td>
                      
                      <td className="px-4 py-2.5 max-w-[200px] md:max-w-[300px]">
                        {isDone && displayMessage ? (
                          <div className="relative overflow-hidden bg-[#030816] border border-[#162749] rounded px-3 py-1.5 shadow-inner group">
                            <span className="whitespace-nowrap text-xs text-[#F8FAFC] font-medium pr-10 inline-block w-full">
                              {maskOTPInMessage(displayMessage.trim())}
                            </span>
                            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#030816] to-transparent pointer-events-none rounded-r"></div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[#6C84A3] text-xs font-semibold bg-[#101726] border border-[#162749] rounded px-3 py-1.5 w-max">
                            {isPending ? (
                              <>
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#60A5FA] opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#60A5FA]"></span>
                                </span>
                                Awaiting SMS...
                              </>
                            ) : "No SMS Received"}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-2.5 pr-6 text-right">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg border ${
                          isPending ? 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20 animate-pulse' : 
                          isDone ? 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/20' : 
                          'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20'
                        }`}>
                          {isPending ? "Pending" : req.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}