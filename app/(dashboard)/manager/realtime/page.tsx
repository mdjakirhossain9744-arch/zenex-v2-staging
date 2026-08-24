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

export default function AgentRealtimeConsole() {
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
      if (parsed.role !== "agent") return router.push("/"); 
      setUserStore({ role: parsed.role, email: parsed.email });
    }

    const storedLiveStatus = sessionStorage.getItem("agent_isLive");
    if (storedLiveStatus !== null) setIsLive(storedLiveStatus === "true");

    const frozenData = sessionStorage.getItem("agent_frozenData");
    if (frozenData) {
      try { setDisplayData(JSON.parse(frozenData)); } catch (e) {}
    }
  }, [router]);

  const handleToggleLive = () => {
    const newVal = !isLive;
    setIsLive(newVal);
    sessionStorage.setItem("agent_isLive", String(newVal));
  };

  const { data: swrData } = useSWR(
    userStore && isLive ? ["/api/monitoring", userStore.role, userStore.email, filterStatus, limit] : null,
    ([url, role, email, status, rowLimit]: any) => fetcher(url, { role, email, filterStatus: status, limit: rowLimit }),
    { refreshInterval: 3000 }
  );

  useEffect(() => {
    if (isLive && swrData) {
      setDisplayData(swrData);
      sessionStorage.setItem("agent_frozenData", JSON.stringify(swrData));
    }
  }, [swrData, isLive]);

  if (!userStore) return null;

  return (
    <div className="p-4 md:p-8 w-full relative z-10 pb-20 font-sans">
      <div className="w-full">
        
        {/* 💥 HEADER & SYSTEM TIME 💥 */}
        <div className="mb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="w-full md:w-auto">
            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] bg-clip-text text-transparent uppercase tracking-wider">
              Network Realtime
            </h2>
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className="relative flex h-2.5 w-2.5">
                {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLive ? 'bg-[#00D2FF]' : 'bg-[#F43F5E]'}`}></span>
              </span>
              <p className="text-[#6C84A3] text-xs font-semibold tracking-widest uppercase">
                {isLive ? `Monitoring Signals • ${limit} Rows` : "SYSTEM FROZEN (PAUSED)"}
              </p>
            </div>

            <div className="md:hidden mt-3 w-full bg-[#0B152A] border border-[#162749] px-3 py-2.5 rounded-lg shadow-inner flex justify-between items-center">
              <span className="text-[10px] text-[#6C84A3] font-semibold uppercase tracking-widest">System Time</span>
              <span className="text-[#00D2FF] font-mono font-bold text-xs tracking-wider">{liveTime}</span>
            </div>
          </div>

          <div className="hidden md:flex bg-[#0B152A] border border-[#162749] px-5 py-2.5 rounded-lg shadow-[inset_0_1px_4px_rgba(0,210,255,0.02)] items-center gap-3">
             <svg className="w-4 h-4 text-[#6C84A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             <span className="text-[#00D2FF] font-mono font-bold text-sm tracking-wider">{liveTime}</span>
          </div>
        </div>

        {/* 💥 NOC CONTROLS 💥 */}
        <div className="mb-6 grid grid-cols-2 md:flex md:flex-row items-center gap-3 bg-[#0B152A] border border-[#162749] p-3 md:p-4 rounded-xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)]">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={!isLive} className="col-span-1 w-full bg-[#101726] text-xs font-semibold text-[#F8FAFC] px-3 md:px-4 py-2.5 rounded-lg border border-[#162749] focus:border-[#00D2FF] outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <option value="ALL">🔵 ALL STATUS</option>
            <option value="SUCCESS">💠 SUCCESS</option>
            <option value="PENDING">🌐 PENDING</option>
            <option value="FAILED">🔴 FAILED</option>
          </select>

          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={!isLive} className="col-span-1 w-full bg-[#101726] text-xs font-semibold text-[#F8FAFC] px-3 md:px-4 py-2.5 rounded-lg border border-[#162749] focus:border-[#00D2FF] outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <option value={25}>Limit: 25 Rows</option>
            <option value={50}>Limit: 50 Rows</option>
            <option value={100}>Limit: 100 Rows</option>
          </select>

          <button onClick={handleToggleLive} className={`col-span-2 w-full md:w-auto md:ml-auto flex-shrink-0 whitespace-nowrap text-[11px] md:text-xs px-6 py-2.5 rounded-lg font-bold tracking-widest uppercase transition-all duration-300 border ${isLive ? 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/30 hover:bg-[#00D2FF]/20 shadow-[0_0_15px_rgba(0,210,255,0.2)]' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30 hover:bg-[#F43F5E]/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]'}`}>
            {isLive ? '💠 Live Auto-Sync' : '⏸ SYSTEM FROZEN'}
          </button>
        </div>

        {/* 💥 TERMINAL FEED TABLE 💥 */}
        <div className={`bg-[#0B152A] border ${isLive ? 'border-[#162749]' : 'border-[#F43F5E]/40'} rounded-2xl shadow-lg overflow-auto max-h-[75vh] min-h-[400px] custom-scrollbar relative transition-all duration-300`}>
          
          {/* Frozen Overlay Warning */}
          {!isLive && (
             <div className="absolute top-0 right-0 z-30 bg-[#F43F5E] text-[#030816] text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-lg shadow-md">
                Stream Paused
             </div>
          )}

          <table className="w-full text-left whitespace-nowrap min-w-[700px]">
            <thead className="bg-[#030816]/95 backdrop-blur-md text-[#6C84A3] uppercase text-[10px] tracking-widest border-b border-[#162749] sticky top-0 z-20">
              <tr>
                <th className="px-4 py-4 pl-6 font-semibold">Time (UTC)</th>
                <th className="px-4 py-4 font-semibold">Operator (ID)</th>
                <th className="px-4 py-4 font-semibold">Network Target</th>
                <th className="px-4 py-4 font-semibold min-w-[200px] max-w-[300px]">Intercepted Payload</th>
                <th className="px-4 py-4 pr-6 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#162749]/60">
              {displayData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#6C84A3] font-semibold">
                    <div className="flex flex-col items-center justify-center gap-3">
                       <svg className={`w-8 h-8 ${isLive ? 'animate-spin text-[#00D2FF]' : 'text-[#162749]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                       </svg>
                       {isLive ? 'Listening for signals...' : 'No frozen data available.'}
                    </div>
                  </td>
                </tr>
              ) : (
                displayData.map((req: any) => {
                  const isPending = req.status === "WAIT";
                  const isDone = req.status === "DONE";
                  const rawMessage = req.fullMessage || req.sms || req.message || ""; 
                  const displayMessage = rawMessage.split("_||_")[0]; 

                  return (
                    <tr key={req._id} className="hover:bg-[#101726] transition-colors animate-fade-in group">
                      <td className="px-4 py-3 pl-6">
                         <span className="text-[11px] font-mono font-medium text-[#6C84A3] group-hover:text-[#60A5FA] transition-colors">{formatSimpleTime(req.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-sm text-[#F8FAFC]">{req.userName || "Operator"}</p>
                        <p className="text-[9px] text-[#00D2FF] font-mono bg-[#00D2FF]/10 px-1.5 py-0.5 rounded inline-block mt-1 border border-[#00D2FF]/20 tracking-wider">
                          {req.userUid || "ZX-N/A"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#60A5FA] tracking-wider text-sm font-mono">{req.searchNumber || "N/A"}</p>
                        <p className="text-[9px] text-[#6C84A3] mt-1 font-semibold uppercase">{req.country} • {req.operator}</p>
                      </td>
                      
                      <td className="px-4 py-3 max-w-[200px] md:max-w-[300px]">
                        {isDone && displayMessage ? (
                          <div className="relative overflow-hidden bg-[#101726] border border-[#162749] rounded-md px-3 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
                            <span className="whitespace-nowrap text-xs text-[#F8FAFC] font-medium pr-10 inline-block w-full leading-none">
                              {maskOTPInMessage(displayMessage.trim())}
                            </span>
                            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#101726] to-transparent pointer-events-none rounded-r"></div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[#6C84A3] text-[11px] font-semibold bg-[#101726] border border-[#162749] rounded-md px-3 py-2 w-max">
                            {isPending ? (
                              <>
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#60A5FA] opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#60A5FA]"></span>
                                </span>
                                Awaiting Payload...
                              </>
                            ) : "No Signal"}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 pr-6 text-right">
                        <span className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded border tracking-widest inline-flex items-center gap-1.5 ${
                          isPending ? 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/30' : 
                          isDone ? 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/30 shadow-[0_0_8px_rgba(0,210,255,0.1)]' : 
                          'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30'
                        }`}>
                          {isPending && <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>}
                          {isPending ? "Pending" : req.status === "DONE" ? "SUCCESS" : req.status}
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