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

export default function AdminRealtimeConsole() {
  const router = useRouter();
  const [userStore, setUserStore] = useState<{ role: string; email: string } | null>(null);
  const [liveTime, setLiveTime] = useState<string>("");

  const [filterStatus, setFilterStatus] = useState("ALL");
  const [limit, setLimit] = useState(50);
  const [isLive, setIsLive] = useState(true);

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
  }, [router]);

  const { data: liveData = [], isValidating } = useSWR(
    userStore ? ["/api/monitoring", userStore.role, userStore.email, filterStatus, limit] : null,
    ([url, role, email, status, rowLimit]: any) => fetcher(url, { role, email, filterStatus: status, limit: rowLimit }),
    { 
      refreshInterval: isLive ? 3000 : 0, 
      revalidateOnFocus: isLive, 
      revalidateOnReconnect: isLive,
      revalidateIfStale: isLive
    }
  );

  if (!userStore) return null;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full relative z-10 pb-20 font-sans">
        <div className="w-full">
          
          <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-[#3B82F6] tracking-tight">Global Realtime Console</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-3 w-3">
                  {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isLive ? 'bg-[#10B981]' : 'bg-[#F43F5E]'}`}></span>
                </span>
                <p className="text-[#94A3B8] text-sm font-medium tracking-widest uppercase">
                  Monitoring Global User Activity • {limit} Rows
                </p>
              </div>
            </div>
            <div className="hidden md:block bg-[#0F172A] border border-[#334155] px-5 py-2.5 rounded-lg shadow-inner">
               <span className="text-[#3B82F6] font-mono font-black text-lg tracking-wider">{liveTime}</span>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3 bg-[#1E293B]/80 border border-[#334155] p-3 rounded-xl shadow-lg backdrop-blur-md">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#0F172A] text-xs md:text-sm font-bold text-[#94A3B8] px-4 py-2 rounded-lg border border-[#334155] focus:border-[#3B82F6] focus:text-[#E2E8F0] outline-none transition-all cursor-pointer">
              <option value="ALL">🟣 ALL STATUS</option>
              <option value="SUCCESS">🟢 SUCCESS (DONE)</option>
              <option value="PENDING">🟡 PENDING (WAIT)</option>
              <option value="FAILED">🔴 FAILED (CANCEL)</option>
            </select>

            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="bg-[#0F172A] text-xs md:text-sm font-bold text-[#94A3B8] px-4 py-2 rounded-lg border border-[#334155] focus:border-[#3B82F6] focus:text-[#E2E8F0] outline-none transition-all cursor-pointer">
              <option value={25}>Show 25 Rows</option>
              <option value={50}>Show 50 Rows</option>
              <option value={100}>Show 100 Rows</option>
            </select>

            <button onClick={() => setIsLive(!isLive)} className={`ml-auto md:ml-4 text-[10px] md:text-xs px-5 py-2.5 rounded-lg font-black tracking-widest uppercase transition-all duration-300 border ${isLive ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30 hover:bg-[#F43F5E]/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]'}`}>
              {isLive ? '🟢 Live Auto-Sync' : '⏸ Paused (Freezed)'}
            </button>
          </div>

          <div className="bg-[#1E293B]/80 border border-[#334155] rounded-2xl shadow-lg overflow-auto max-h-[75vh] min-h-[300px] custom-scrollbar relative">
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
                {liveData.length === 0 && !isValidating ? (
                  <tr><td colSpan={5} className="p-8 text-center text-[#64748B] font-bold">No data found for this filter.</td></tr>
                ) : (
                  liveData.map((req: any) => {
                    const isPending = req.status === "WAIT";
                    const isDone = req.status === "DONE";
                    // 💥 MULTI রিমুভ করে শুধুমাত্র প্রথম মেসেজটা নেওয়া হচ্ছে 💥
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
                        
                        {/* 💥 MESSAGE COLUMN (Pure Clean Single Line) 💥 */}
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
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3B82F6] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3B82F6]"></span>
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