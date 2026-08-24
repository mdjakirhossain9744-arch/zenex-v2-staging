"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
// 💥 SWR IMPORTED FOR LIGHTNING CACHE 💥
import useSWR from "swr";

export default function AdminSummary() {
  const router = useRouter(); 

  const [dateFilter, setDateFilter] = useState("7"); 
  const [user, setUser] = useState<any>(null);

  const [reportData, setReportData] = useState<any[]>([]);
  const [totals, setTotals] = useState({ allocation: 0, success: 0, failed: 0, amount: 0 });
  const [overallRate, setOverallRate] = useState("0%");

  // 💥 PURE UTC DATE RANGE GENERATOR 💥
  const generateDateRange = (days: number, baseDateStr: string) => {
    const dates = [];
    const baseDate = new Date(baseDateStr);
    for (let i = 0; i < days; i++) {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
    }
    return dates;
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { router.push("/login"); return; }
    
    const parsedUser = JSON.parse(storedUser);

    if (parsedUser.role === "agent") { router.push("/manager/summary"); return; }
    if (parsedUser.role !== "admin") { router.push("/summary"); return; }
    
    setUser(parsedUser);
  }, [router]);

  // 💥 SWR FETCHER 💥
  const fetchAdminSummary = async ([_, email, filter]: [string, string, string]) => {
    const res = await fetch("/api/admin/summary", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "admin", limitDays: filter === "today" ? 1 : filter })
    });
    return res.json();
  };

  // 💥 SWR HOOK: Prevents reloading animation on revisit 💥
  const { data, isLoading } = useSWR(
    user?.email ? ["adminSummary", user.email, dateFilter] : null,
    fetchAdminSummary,
    { refreshInterval: 10000, keepPreviousData: true, revalidateOnFocus: false }
  );

  // Sync SWR Data to UI
  useEffect(() => {
    if (data && data.success) {
      const serverDate = data.serverDate || new Date().toISOString().split('T')[0]; 
      const rawData = data.groupedRawData || {};

      // 🔥 Dynamic Days Calculation for "All Time" 🔥
      let daysToShow = 7;
      if (dateFilter === "today") daysToShow = 1;
      else if (dateFilter !== "all") daysToShow = Number(dateFilter);
      else {
         const keys = Object.keys(rawData).sort();
         if (keys.length > 0) {
             const oldestDate = new Date(keys[0]);
             const todayDate = new Date(serverDate);
             const diffTime = Math.abs(todayDate.getTime() - oldestDate.getTime());
             daysToShow = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
         } else {
             daysToShow = 30; // Fallback
         }
      }

      const finalData = generateDateRange(daysToShow, serverDate).map(dateStr => {
        let existingData = rawData[dateStr];
        return {
          dateStr: dateStr, 
          displayDate: new Date(dateStr).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }),
          allocation: existingData ? existingData.allocation : 0, 
          success: existingData ? existingData.success : 0,
          failed: existingData ? existingData.failed : 0, 
          amount: existingData ? existingData.amount : 0,
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

  // 💥 PREMIUM SKELETON LOADING (V2 Theme) 💥
  if (!data && isLoading) return (
    <div className="p-4 md:p-8 lg:p-10 w-full animate-pulse font-sans bg-[#030816] min-h-screen">
      <div className="h-8 bg-[#0B152A] border border-[#162749] w-64 rounded-xl mb-3"></div>
      <div className="h-4 bg-[#0B152A] border border-[#162749] w-96 rounded-lg mb-8"></div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-8">
         <div className="h-28 bg-[#0B152A] rounded-2xl border border-[#162749]"></div>
         <div className="h-28 bg-[#0B152A] rounded-2xl border border-[#162749]"></div>
         <div className="h-28 bg-[#0B152A] rounded-2xl border border-[#162749]"></div>
         <div className="h-28 bg-[#0B152A] rounded-2xl border border-[#162749]"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
         <div className="h-[350px] bg-[#0B152A] rounded-2xl border border-[#162749]"></div>
         <div className="h-[350px] bg-[#0B152A] rounded-2xl border border-[#162749]"></div>
      </div>

      <div className="h-64 bg-[#0B152A] rounded-2xl border border-[#162749]"></div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full relative z-10 pb-20 bg-[#030816] text-[#F8FAFC]" style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', sans-serif" }}>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h2 className="text-2xl font-semibold bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] bg-clip-text text-transparent uppercase tracking-wider">Global System Report</h2>
            <span className="flex h-2.5 w-2.5 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00D2FF]"></span>
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#6C84A3] font-medium tracking-wide">Overall website performance and stats.</p>
        </div>
        <select 
          value={dateFilter} 
          onChange={(e) => setDateFilter(e.target.value)} 
          className="bg-[#0B152A] border border-[#162749] text-xs font-semibold text-[#F8FAFC] px-4 py-2.5 rounded-xl cursor-pointer hover:border-[#00D2FF]/50 transition-colors focus:outline-none focus:ring-1 focus:ring-[#00D2FF]/30 tracking-wide"
        >
          <option value="today">Today's Data</option>
          <option value="7">Last 7 Days</option>
          <option value="15">Last 15 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="60">Last 60 Days</option>
          <option value="all">All Time History</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-8">
         <div className="bg-[#0B152A] border border-[#162749] p-5 rounded-2xl shadow-sm border-t-2 border-t-[#60A5FA] flex flex-col">
            <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-1.5 block">Global Allocation</span>
            <div className="flex items-end gap-3 mt-auto"><span className="text-2xl md:text-3xl font-semibold text-[#F8FAFC] tracking-tight">{totals.allocation}</span></div>
         </div>
         
         <div className="bg-[#0B152A] border border-[#162749] p-5 rounded-2xl shadow-sm border-t-2 border-t-[#00D2FF] flex flex-col">
            <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-1.5 block">Global Win Rate</span>
            <div className="flex items-end gap-3 mt-auto"><span className="text-2xl md:text-3xl font-semibold text-[#00D2FF] tracking-tight">{overallRate}</span></div>
         </div>

         <div className="bg-[#0B152A] border border-[#162749] p-5 rounded-2xl shadow-sm border-t-2 border-t-[#60A5FA] flex flex-col">
            <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-1.5 block">Total Payout</span>
            <div className="flex items-end gap-3 mt-auto"><span className="text-2xl md:text-3xl font-semibold text-[#F8FAFC] tracking-tight">${totals.amount.toFixed(2)}</span></div>
         </div>

         <div className="bg-[#0B152A] border border-[#162749] p-5 rounded-2xl shadow-sm border-t-2 border-t-[#00D2FF] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#00D2FF] opacity-5 rounded-bl-full pointer-events-none"></div>
            <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-1.5 block">Platform Status</span>
            <div className="flex flex-col items-start gap-1 mt-auto">
               <span className="text-xl md:text-2xl font-semibold text-[#00D2FF] tracking-tight">ONLINE</span>
               <span className="text-[9px] font-bold text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded-md tracking-widest uppercase border border-[#00D2FF]/20">All Systems Go</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 mb-8">
         <div className="bg-[#0B152A] border border-[#162749] p-5 md:p-6 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] h-[350px] flex flex-col">
            <h3 className="text-sm font-semibold text-[#F8FAFC] uppercase tracking-widest mb-6">Success vs Failed Trends</h3>
            <div className="flex-1">
              {reportData.length === 0 ? <div className="flex items-center justify-center h-full text-[#6C84A3] font-medium text-sm">No data available.</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...reportData].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#162749" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.substring(0, 6)} />
                    <YAxis stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{backgroundColor: '#030816', borderColor: '#162749', borderRadius: '8px', color: '#F8FAFC'}} cursor={{fill: '#162749', opacity: 0.3}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: '600', color: '#6C84A3'}} />
                    <Bar dataKey="success" name="Successful OTPs" stackId="a" fill="#00D2FF" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="failed" name="Failed/Timeout" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
         </div>

         <div className="bg-[#0B152A] border border-[#162749] p-5 md:p-6 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] h-[350px] flex flex-col">
            <h3 className="text-sm font-semibold text-[#F8FAFC] uppercase tracking-widest mb-6">Total Payout Overview</h3>
            <div className="flex-1">
              {reportData.length === 0 ? <div className="flex items-center justify-center h-full text-[#6C84A3] font-medium text-sm">No data available.</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...reportData].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#162749" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.substring(0, 6)} />
                    <YAxis stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{backgroundColor: '#030816', borderColor: '#162749', borderRadius: '8px', color: '#F8FAFC'}} formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']} />
                    <Line type="monotone" dataKey="amount" name="Revenue" stroke="#60A5FA" strokeWidth={3} dot={{r: 4, fill: '#60A5FA', strokeWidth: 2}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
         </div>
      </div>

      <div className="bg-[#0B152A] border border-[#162749] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] overflow-hidden w-full">
         <div className="flex justify-between items-center p-4 md:p-5 bg-[#030816] border-b border-[#162749]">
            <h3 className="text-sm font-semibold text-[#F8FAFC] uppercase tracking-widest">Detailed Daily Report</h3>
         </div>
         <div className="overflow-x-auto custom-scrollbar w-full">
           <table className="w-full text-left border-collapse min-w-[600px]">
             <thead>
               <tr className="bg-[#0B152A] text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest border-b border-[#162749]">
                 <th className="p-4 pl-5">Date</th>
                 <th className="p-4 text-center">Numbers Got</th>
                 <th className="p-4 text-center">Success (OTP)</th>
                 <th className="p-4 text-center">Failed</th>
                 <th className="p-4 text-center">Win Rate</th>
                 <th className="p-4 pr-5 text-right">Total Payout ($)</th>
               </tr>
             </thead>
             <tbody className="text-sm font-medium text-[#F8FAFC] divide-y divide-[#162749]">
               {reportData.map((row, index) => (
                   <tr key={index} className="hover:bg-[#101726] transition-colors">
                     <td className="p-4 pl-5 text-[#6C84A3] font-mono font-semibold tracking-wider">{row.displayDate}</td>
                     <td className="p-4 text-center font-semibold text-[#F8FAFC] tracking-tight">{row.allocation}</td>
                     <td className="p-4 text-center font-semibold text-[#00D2FF] tracking-tight">{row.success}</td>
                     <td className="p-4 text-center font-semibold text-[#F43F5E] tracking-tight">{row.failed}</td>
                     <td className="p-4 text-center font-semibold text-[#60A5FA] tracking-tight">{row.rate}</td>
                     <td className="p-4 pr-5 text-right font-semibold text-[#F8FAFC] tracking-tight">${row.amount.toFixed(2)}</td>
                   </tr>
               ))}
               {reportData.length > 0 && (
                 <tr className="bg-[#030816] border-t border-[#162749]">
                   <td className="p-4 pl-5 text-[#F8FAFC] font-semibold uppercase tracking-wider">Total Sum</td>
                   <td className="p-4 text-center font-semibold text-[#F8FAFC] tracking-tight">{totals.allocation}</td>
                   <td className="p-4 text-center font-semibold text-[#00D2FF] tracking-tight">{totals.success}</td>
                   <td className="p-4 text-center font-semibold text-[#F43F5E] tracking-tight">{totals.failed}</td>
                   <td className="p-4 text-center font-semibold text-[#60A5FA] tracking-tight">{overallRate}</td>
                   <td className="p-4 pr-5 text-right font-semibold text-[#00D2FF] tracking-tight">${totals.amount.toFixed(2)}</td>
                 </tr>
               )}
               {reportData.length === 0 && (
                 <tr>
                    <td colSpan={6} className="text-center p-10 text-[#6C84A3] font-medium text-xs border border-dashed border-[#162749] m-4 rounded-xl block">
                       No daily report data available for the selected range.
                    </td>
                 </tr>
               )}
             </tbody>
           </table>
         </div>
      </div>

    </div>
  );
}