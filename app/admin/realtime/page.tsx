"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../../DashboardLayout"; 
import { useRouter } from "next/navigation";
import useSWR from "swr";

const fetcher = async (url: string, payload: any) => {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    return [];
  }
};

// 💥 TIME FIX: হুবহু ড্যাশবোর্ডের মতো UTC ফরম্যাট 💥
const formatUTC = (dateString: string) => {
  const d = new Date(dateString);
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getUTCMonth()];
  return `${hours}:${minutes}:${seconds} UTC - ${day} ${month}`;
};

export default function AdminRealtimeConsole() {
  const router = useRouter();
  const [userStore, setUserStore] = useState<{ role: string; email: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed.role !== "admin") return router.push("/"); 
      setUserStore({ role: parsed.role, email: parsed.email });
    }
  }, [router]);

  const { data: liveData = [], isValidating } = useSWR(
    userStore ? ["/api/monitoring", userStore] : null,
    ([url, payload]: [string, any]) => fetcher(url, payload),
    { refreshInterval: 3000, revalidateOnFocus: true }
  );

  if (!userStore) return null;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full relative z-10 pb-20 font-sans">
        <div className="w-full">
          <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-[#3B82F6] tracking-tight">Global Realtime Console</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981]"></span></span>
                <p className="text-[#94A3B8] text-sm font-medium tracking-widest uppercase">Monitoring Global User Activity • 50 Rows</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1E293B]/80 border border-[#334155] rounded-2xl shadow-lg overflow-auto max-h-[75vh] min-h-[300px] custom-scrollbar relative">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0F172A]/90 backdrop-blur-md text-[#94A3B8] uppercase text-[10px] tracking-widest border-b border-[#334155] sticky top-0 z-20">
                <tr>
                  {/* 💥 SLIMMER BOX FIX: px-4 py-3 ব্যবহার করা হয়েছে 💥 */}
                  <th className="px-4 py-3 pl-6 font-black">Time (UTC)</th>
                  <th className="px-4 py-3 font-black">User (ID)</th>
                  <th className="px-4 py-3 font-black">Number Info</th>
                  <th className="px-4 py-3 pr-6 font-black text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/50">
                {liveData.length === 0 && !isValidating ? (
                  <tr><td colSpan={4} className="p-8 text-center text-[#64748B] font-bold">No live activity found.</td></tr>
                ) : (
                  liveData.map((req: any) => {
                    const isPending = req.status === "WAIT";
                    const isDone = req.status === "DONE";
                    return (
                      <tr key={req._id} className="hover:bg-[#334155]/20 transition-colors animate-fade-in">
                        {/* 💥 SLIMMER BOX FIX: py-2.5 💥 */}
                        <td className="px-4 py-2.5 pl-6"><span className="text-[11px] font-mono font-black text-[#94A3B8]">{formatUTC(req.createdAt)}</span></td>
                        <td className="px-4 py-2.5"><p className="font-bold text-sm text-[#E2E8F0]">{req.userName || "User"}</p><p className="text-[9px] text-[#A855F7] font-mono bg-[#A855F7]/10 px-1.5 py-0.5 rounded inline-block mt-0.5">{req.userUid || "N/A"}</p></td>
                        <td className="px-4 py-2.5"><p className="font-black text-[#3B82F6] tracking-wider text-sm">{req.searchNumber || "N/A"}</p><p className="text-[9px] text-[#64748B] mt-0.5 font-bold uppercase">{req.country} • {req.operator}</p></td>
                        <td className="px-4 py-2.5 pr-6 text-right"><span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg border ${isPending ? 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/20 animate-pulse' : isDone ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20'}`}>{isPending ? "Pending" : req.status}</span></td>
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