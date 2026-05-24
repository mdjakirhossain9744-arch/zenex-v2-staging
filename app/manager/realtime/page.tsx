"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../../DashboardLayout"; 
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
    <DashboardLayout>
      <div className="p-3 md:p-10 w-full relative z-10 pb-20 font-sans">
        <div className="w-full">
          
          <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="w-full md:w-auto">
              <h2 className="text-2xl md:text-3xl font-black text-[#A855F7] tracking-tight">Network Realtime</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-3 w-3">
                  {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isLive ? 'bg-[#10B981]' : 'bg-[#F43F5E]'}`}></span>
                </span>
                <p className="text-[#94A3B8] text-xs md:text-sm font-medium tracking-widest uppercase">
                  {isLive ? `Monitoring Network • ${limit} Rows` : "SYSTEM FROZEN (PAUSED)"}
                </p>
              </div>

              <div className="md:hidden mt-3 w-full bg-[#0F172A] border border-[#334155] px-3 py-2 rounded-lg shadow-inner flex justify-between items-center">
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest">System Time</span>
                <span className="text-[#A855F7] font-mono font-black text-xs tracking-wider">{liveTime}</span>
              </div>
            </div>

            <div className="hidden md:block bg-[#0F172A] border border-[#334155] px-5 py-2.5 rounded-lg shadow-inner">
               <span className="text-[#A855F7] font-mono font-black text-lg tracking-wider">{liveTime}</span>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 md:flex md:flex-row items-center gap-3 bg-[#1E293B]/80 border border-[#334155] p-3 rounded-xl shadow-lg backdrop-blur-md">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={!isLive} className="col-span-1 w-full bg-[#0F172A] text-xs md:text-sm font-bold text-[#94A3B8] px-3 md:px-4 py-2.5 rounded-lg border border-[#334155] focus:border-[#A855F7] focus:text-[#E2E8F0] outline-none transition-all cursor-pointer disabled:opacity-50">
              <option value="ALL">🟣 ALL STATUS</option>
              <option value="SUCCESS">🟢 SUCCESS</option>
              <option value="PENDING">🟡 PENDING</option>
              <option value="FAILED">🔴 FAILED</option>
            </select>

            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={!isLive} className="col-span-1 w-full bg-[#0F172A] text-xs md:text-sm font-bold text-[#94A3B8] px-3 md:px-4 py-2.5 rounded-lg border border-[#334155] focus:border-[#A855F7] focus:text-[#E2E8F0] outline-none transition-all cursor-pointer disabled:opacity-50">
              <option value={25}>25 Rows</option>
              <option value={50}>50 Rows</option>
              <option value={100}>100 Rows</option>
            </select>

            {/* 💥 PC Button Text Wrap Fixed (whitespace-nowrap flex-shrink-0) 💥 */}
            <button onClick={handleToggleLive} className={`col-span-2 w-full md:w-auto md:ml-auto flex-shrink-0 whitespace-nowrap text-[11px] md:text-xs px-5 py-2.5 rounded-lg font-black tracking-widest uppercase transition-all duration-300 border ${isLive ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30 hover:bg-[#F43F5E]/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]'}`}>
              {isLive ? '🟢 Live Auto-Sync' : '⏸ SYSTEM FROZEN'}
            </button>
          </div>

          <div className={`bg-[#1E293B]/80 border ${isLive ? 'border-[#334155]' : 'border-[#F43F5E]/50'} rounded-2xl shadow-lg overflow-auto max-h-[75vh] min-h-[300px] custom-scrollbar relative transition-all duration-300`}>
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0F172A]/90 backdrop-blur-md text-[#94A3B8] uppercase text-[10px] tracking-widest border-b border-[#334155] sticky top-0 z-20">
                <tr>
                  <th className="px-4 py-3 pl-6 font-black">Time (UTC)</th>
                  <th className="px-4 py-3 font-black">User (ID)</th>
                  <th className="px-4 py-3 font-black">Number Info</th>
                  <th className="px-4 py-3 font-black min-w-[200px] max-w-[300px]">Full Message (Secured)</th>
                  <th className="px-4 py-3 pr-6 font-black text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/50">
                {displayData.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-[#64748B] font-bold">{isLive ? 'Waiting for data...' : 'No frozen data available.'}</td></tr>
                ) : (
                  displayData.map((req: any) => {
                    const isPending = req.status === "WAIT";
                    const isDone = req.status === "DONE";
                    const rawMessage = req.fullMessage || req.sms || req.message || ""; 
                    const displayMessage = rawMessage.split("_||_")[0]; 

                    return (
                      <tr key={req._id} className="hover:bg-[#334155]/20 transition-colors animate-fade-in">
                        <td className="px-4 py-2.5 pl-6">
                           <span className="text-xs font-mono font-black text-[#64748B]">{formatSimpleTime(req.createdAt)}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-bold text-sm text-[#E2E8F0]">{req.userName || "User"}</p>
                          <p className="text-[9px] text-[#A855F7] font-mono bg-[#A855F7]/10 px-1.5 py-0.5 rounded inline-block mt-0.5 border border-[#A855F7]/20">
                            {req.userUid || "ZX-N/A"}
                          </p>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-black text-[#3B82F6] tracking-wider text-sm">{req.searchNumber || "N/A"}</p>
                          <p className="text-[9px] text-[#64748B] mt-0.5 font-bold uppercase">{req.country} • {req.operator}</p>
                        </td>
                        
                        <td className="px-4 py-2.5 max-w-[200px] md:max-w-[300px]">
                          {isDone && displayMessage ? (
                            <div className="relative overflow-hidden bg-[#0F172A] border border-[#334155] rounded px-3 py-1.5 shadow-inner group">
                              <span className="whitespace-nowrap text-xs text-[#E2E8F0] font-medium pr-10 inline-block w-full">
                                {maskOTPInMessage(displayMessage.trim())}
                              </span>
                              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0F172A] to-transparent pointer-events-none rounded-r"></div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-[#64748B] text-xs font-bold bg-[#1E293B] border border-[#334155]/50 rounded px-3 py-1.5 w-max">
                              {isPending ? (
                                <>
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A855F7] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#A855F7]"></span>
                                  </span>
                                  Awaiting SMS...
                                </>
                              ) : "No SMS Received"}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-2.5 pr-6 text-right">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg border ${
                            isPending ? 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/20 animate-pulse' : 
                            isDone ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 
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
    </DashboardLayout>
  );
}