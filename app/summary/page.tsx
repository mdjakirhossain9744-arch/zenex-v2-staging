"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import DashboardLayout from "../DashboardLayout"; 
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
// 💥 SWR IMPORTED FOR LIGHTNING CACHE 💥
import useSWR from "swr";

export default function UserSummary() {
  const router = useRouter();

  const [dateFilter, setDateFilter] = useState("7"); 
  const [user, setUser] = useState<any>(null);

  const [userRate, setUserRate] = useState(0);
  const [dbEarnings, setDbEarnings] = useState("0.00"); 

  const [reportData, setReportData] = useState<any[]>([]);
  const [totals, setTotals] = useState({ allocation: 0, success: 0, failed: 0, amount: 0 });
  const [overallRate, setOverallRate] = useState("0%");

  const generateDateRange = (days: number, baseDateStr: string) => {
    const dates = [];
    const baseDate = new Date(baseDateStr);
    for (let i = 0; i < days; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dates.push(localDateStr);
    }
    return dates;
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { router.push("/login"); return; }
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role === "admin") { router.push("/admin/summary"); return; }
    if (parsedUser.role === "agent") { router.push("/manager/summary"); return; }
    setUser(parsedUser);
  }, [router]);

  // 💥 SWR FETCHER 💥
  const fetchSummaryData = async ([_, email]: [string, string]) => {
    const res = await fetch("/api/summary-report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "user" })
    });
    return res.json();
  };

  // 💥 SWR HOOK: Prevents reloading animation on revisit 💥
  const { data, isLoading } = useSWR(
    user?.email ? ["userSummary", user.email, dateFilter] : null,
    fetchSummaryData,
    { refreshInterval: 10000, keepPreviousData: true, revalidateOnFocus: false }
  );

  // Sync SWR Data to UI
  useEffect(() => {
    if (data && data.success) {
      setUserRate(data.userRate !== undefined ? data.userRate : 0);
      setDbEarnings(Number(data.balance || 0).toFixed(2));

      let daysToShow = dateFilter === "today" ? 1 : dateFilter === "15" ? 15 : dateFilter === "30" ? 30 : dateFilter === "all" ? 60 : 7;
      const serverDate = data.serverDate || new Date().toISOString(); 
      const dateTemplate = generateDateRange(daysToShow, serverDate);
      
      const rawData = data.groupedRawData || {};

      const finalData = dateTemplate.map(dateStr => {
        let existingData = rawData[dateStr] || rawData[new Date(dateStr).toLocaleDateString('en-US')];
        return {
          dateStr: dateStr, displayDate: new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          allocation: existingData ? existingData.allocation : 0, success: existingData ? existingData.success : 0,
          failed: existingData ? existingData.failed : 0, amount: existingData ? existingData.amount : 0,
          rate: existingData && existingData.allocation > 0 ? ((existingData.success / existingData.allocation) * 100).toFixed(0) + "%" : "0%"
        };
      });

      setReportData(finalData);

      const t = finalData.reduce((acc: any, curr: any) => ({
          allocation: acc.allocation + curr.allocation, success: acc.success + curr.success,
          failed: acc.failed + curr.failed, amount: acc.amount + curr.amount,
      }), { allocation: 0, success: 0, failed: 0, amount: 0 });

      setTotals(t);
      setOverallRate(t.allocation > 0 ? ((t.success / t.allocation) * 100).toFixed(0) + "%" : "0%");
    }
  }, [data, dateFilter]);

  // 💥 PREMIUM SKELETON LOADING 💥
  if (!data && isLoading) return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full animate-pulse font-sans">
        <div className="h-8 bg-[#1E293B] w-64 rounded-xl mb-2"></div>
        <div className="h-4 bg-[#1E293B] w-96 rounded-xl mb-8"></div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
           <div className="h-28 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
           <div className="h-28 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
           <div className="h-28 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
           <div className="h-28 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           <div className="h-[350px] bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
           <div className="h-[350px] bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
        </div>

        <div className="h-64 bg-[#1E293B]/80 rounded-2xl border border-[#334155]"></div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full relative z-10 pb-20 font-sans">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent uppercase tracking-wider">
                My Performance Report
              </h2>
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] font-medium">Your personal OTP success and earnings overview.</p>
          </div>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-[#0F172A] border border-[#334155] text-xs font-bold text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-[#3B82F6] cursor-pointer shadow-lg">
            <option value="today">Today's Data</option>
            <option value="7">Last 7 Days</option>
            <option value="15">Last 15 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="all">All Time History</option>
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
           <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#3B82F6]">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1 block">My Allocation</span>
              <div className="flex items-end gap-3 mb-2"><span className="text-3xl font-black text-white">{totals.allocation}</span></div>
              <span className="text-[9px] font-black text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-0.5 rounded tracking-widest uppercase border border-[#3B82F6]/20">Generated</span>
           </div>
           
           <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#EAB308]">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1 block">Success Rate</span>
              <div className="flex items-end gap-3 mb-2"><span className="text-3xl font-black text-white">{overallRate}</span></div>
              <span className="text-[9px] font-black text-[#EAB308] bg-[#EAB308]/10 px-2 py-0.5 rounded tracking-widest uppercase border border-[#EAB308]/20">Average</span>
           </div>

           <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#10B981]">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1 block">My Earnings</span>
              <div className="flex items-end gap-3 mb-2"><span className="text-3xl font-black text-[#10B981]">৳ {dbEarnings}</span></div>
              <span className="text-[9px] font-black text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded tracking-widest uppercase border border-[#10B981]/20">Total Value</span>
           </div>

           <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#8B5CF6]">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1 block">Your OTP Rate</span>
              <div className="flex items-end gap-3 mb-2"><span className="text-3xl font-black text-[#8B5CF6]">৳ {userRate.toFixed(2)}</span></div>
              <span className="text-[9px] font-black text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-0.5 rounded tracking-widest uppercase border border-[#8B5CF6]/20">Per OTP</span>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           <div className="bg-[#1E293B]/80 border border-[#334155] p-6 rounded-2xl shadow-lg h-[350px] flex flex-col">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Success vs Failed Trends</h3>
              <div className="flex-1">
                {reportData.length === 0 ? <div className="flex items-center justify-center h-full text-[#64748B] font-bold text-sm">No data available.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...reportData].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="displayDate" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.substring(0, 6)} />
                      <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff'}} cursor={{fill: '#334155', opacity: 0.2}} />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 'bold', color: '#94A3B8'}} />
                      <Bar dataKey="success" name="Successful OTPs" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
                      <Bar dataKey="failed" name="Failed/Timeout" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
           </div>

           <div className="bg-[#1E293B]/80 border border-[#334155] p-6 rounded-2xl shadow-lg h-[350px] flex flex-col">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">My Earnings Overview</h3>
              <div className="flex-1">
                {reportData.length === 0 ? <div className="flex items-center justify-center h-full text-[#64748B] font-bold text-sm">No data available.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...reportData].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="displayDate" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.substring(0, 6)} />
                      <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff'}} formatter={(value: any) => [`৳ ${Number(value).toFixed(2)}`, 'Revenue']} />
                      <Line type="monotone" dataKey="amount" name="Revenue" stroke="#3B82F6" strokeWidth={3} dot={{r: 4, fill: '#3B82F6', strokeWidth: 2}} activeDot={{r: 6}} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
           </div>
        </div>

        <div className="bg-[#1E293B]/80 border border-[#334155] rounded-2xl shadow-lg overflow-hidden w-full">
           <div className="flex justify-between items-center p-5 bg-[#0F172A]/50 border-b border-[#334155]"><h3 className="text-sm font-black text-white uppercase tracking-widest">Detailed Daily Report</h3></div>
           <div className="overflow-x-auto w-full">
             <table className="w-full text-left border-collapse min-w-[600px]">
               <thead>
                 <tr className="bg-[#1E293B] text-[10px] font-black text-[#64748B] uppercase tracking-widest border-b border-[#334155]">
                   <th className="p-4 pl-6">Date</th>
                   <th className="p-4 text-center">Numbers Got</th>
                   <th className="p-4 text-center">Success (OTP)</th>
                   <th className="p-4 text-center">Failed</th>
                   <th className="p-4 text-center">Win Rate</th>
                   <th className="p-4 pr-6 text-right">My Earnings (৳)</th>
                 </tr>
               </thead>
               <tbody className="text-sm font-medium text-[#E2E8F0] divide-y divide-[#334155]/50">
                 {reportData.map((row, index) => (
                     <tr key={index} className="hover:bg-[#334155]/20 transition-colors">
                       <td className="p-4 pl-6 text-[#94A3B8] font-mono font-bold">{row.displayDate}</td>
                       <td className="p-4 text-center font-bold text-white">{row.allocation}</td>
                       <td className="p-4 text-center font-bold text-[#10B981]">{row.success}</td>
                       <td className="p-4 text-center font-bold text-[#F43F5E]">{row.failed}</td>
                       <td className="p-4 text-center font-bold text-[#EAB308]">{row.rate}</td>
                       <td className="p-4 pr-6 text-right font-black text-white">৳ {row.amount.toFixed(2)}</td>
                     </tr>
                 ))}
                 {reportData.length > 0 && (
                   <tr className="bg-[#0F172A] border-t-2 border-[#334155]">
                     <td className="p-4 pl-6 text-white font-black uppercase tracking-wider">Total Sum</td>
                     <td className="p-4 text-center font-black text-white">{totals.allocation}</td>
                     <td className="p-4 text-center font-black text-[#10B981]">{totals.success}</td>
                     <td className="p-4 text-center font-black text-[#F43F5E]">{totals.failed}</td>
                     <td className="p-4 text-center font-black text-[#EAB308]">{overallRate}</td>
                     <td className="p-4 pr-6 text-right font-black text-[#3B82F6]">৳ {totals.amount.toFixed(2)}</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}