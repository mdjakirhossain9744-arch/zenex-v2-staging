"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
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

  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedCustom, setAppliedCustom] = useState({ start: "", end: "" });

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

  const fetchSummaryData = async ([_, email, filter, start, end]: any) => {
    const payload: any = { email, role: "user", filter };
    if (filter === "custom" && start && end) {
      payload.startDate = start;
      payload.endDate = end;
    }
    const res = await fetch("/api/summary-report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return res.json();
  };

  const { data, isLoading } = useSWR(
    user?.email ? ["userSummary", user.email, dateFilter, appliedCustom.start, appliedCustom.end] : null,
    fetchSummaryData,
    { refreshInterval: 10000, keepPreviousData: true, revalidateOnFocus: false }
  );

  const handleApplyCustomDate = () => {
    if (customStart && customEnd) {
      setAppliedCustom({ start: customStart, end: customEnd });
    }
  };

  useEffect(() => {
    if (data && data.success) {
      setUserRate(data.userRate !== undefined ? data.userRate : 0);
      setDbEarnings(Number(data.balance || 0).toFixed(2));

      let dateTemplate: string[] = [];
      const serverDate = data.serverDate || new Date().toISOString(); 

      if (dateFilter === "custom" && appliedCustom.start && appliedCustom.end) {
        let curr = new Date(appliedCustom.end);
        const first = new Date(appliedCustom.start);
        while (curr >= first) {
          dateTemplate.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`);
          curr.setDate(curr.getDate() - 1);
        }
      } else {
        let daysToShow = dateFilter === "today" ? 1 : dateFilter === "15" ? 15 : dateFilter === "30" ? 30 : 7;
        dateTemplate = generateDateRange(daysToShow, serverDate);
      }
      
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
  }, [data, dateFilter, appliedCustom]);

  if (!data && isLoading) return (
    <div className="p-4 md:p-10 w-full relative z-10 pb-20 font-sans">
      <div className="w-full animate-pulse">
        <div className="h-8 bg-[#101726] w-64 rounded-xl mb-2"></div>
        <div className="h-4 bg-[#101726] w-96 rounded-xl mb-8"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
           <div className="h-28 bg-[#101726]/80 rounded-2xl border border-[#162749]"></div>
           <div className="h-28 bg-[#101726]/80 rounded-2xl border border-[#162749]"></div>
           <div className="h-28 bg-[#101726]/80 rounded-2xl border border-[#162749]"></div>
           <div className="h-28 bg-[#101726]/80 rounded-2xl border border-[#162749]"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-10 w-full relative z-10 pb-20 font-sans tracking-tight">
      
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-black bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] bg-clip-text text-transparent tracking-tight">
              Performance Report
            </h2>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00D2FF]"></span>
            </span>
          </div>
          <p className="text-sm text-[#6C84A3] font-medium">Your personal OTP success and earnings overview.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
           {dateFilter === "custom" && (
              <div className="flex items-center gap-2 bg-[#101726] border border-[#162749] p-1.5 rounded-xl shadow-lg animate-fade-in-right">
                 <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} max={customEnd || undefined} className="bg-[#030816] border border-[#162749] text-xs font-semibold text-[#F8FAFC] px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#00D2FF] color-scheme-dark" />
                 <span className="text-xs font-semibold text-[#6C84A3]">to</span>
                 <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} min={customStart || undefined} className="bg-[#030816] border border-[#162749] text-xs font-semibold text-[#F8FAFC] px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#00D2FF] color-scheme-dark" />
                 <button onClick={handleApplyCustomDate} disabled={!customStart || !customEnd} className="bg-[#00D2FF]/10 text-[#00D2FF] hover:bg-[#00D2FF]/20 disabled:opacity-50 disabled:cursor-not-allowed border border-[#00D2FF]/20 px-4 py-1.5 rounded-lg text-xs font-black tracking-wide transition-colors">
                   Apply
                 </button>
              </div>
           )}
           <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); if(e.target.value !== 'custom') setAppliedCustom({start:'', end:''}); }} className="bg-[#101726] border border-[#162749] text-xs font-semibold text-[#F8FAFC] px-4 py-2.5 rounded-xl focus:outline-none focus:border-[#00D2FF] cursor-pointer shadow-lg tracking-tight">
             <option value="today">Today's Data</option>
             <option value="7">Last 7 Days</option>
             <option value="15">Last 15 Days</option>
             <option value="30">Last 30 Days</option>
             <option value="custom">Custom Date Range</option>
           </select>
        </div>
      </div>

      {/* Stats Grid - Dashboard Vibe */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
         <div className="bg-[#101726] border border-[#162749] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#60A5FA]">
            <span className="text-[11px] font-medium text-[#6C84A3] mb-1 block">My Allocation</span>
            <div className="flex items-end gap-3 mb-2"><span className="text-3xl font-semibold tracking-tight text-[#F8FAFC]">{totals.allocation}</span></div>
            <span className="text-[10px] font-semibold text-[#60A5FA] bg-[#60A5FA]/10 px-2 py-0.5 rounded tracking-wide border border-[#60A5FA]/20">Generated</span>
         </div>
         
         <div className="bg-[#101726] border border-[#162749] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#00D2FF]">
            <span className="text-[11px] font-medium text-[#6C84A3] mb-1 block">Success Rate</span>
            <div className="flex items-end gap-3 mb-2"><span className="text-3xl font-semibold tracking-tight text-[#F8FAFC]">{overallRate}</span></div>
            <span className="text-[10px] font-semibold text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded tracking-wide border border-[#00D2FF]/20">Average</span>
         </div>

         <div className="bg-[#101726] border border-[#162749] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#60A5FA]">
            <span className="text-[11px] font-medium text-[#6C84A3] mb-1 block">My Earnings</span>
            <div className="flex items-end gap-3 mb-2"><span className="text-3xl font-semibold tracking-tight text-[#60A5FA]">${dbEarnings}</span></div>
            <span className="text-[10px] font-semibold text-[#60A5FA] bg-[#60A5FA]/10 px-2 py-0.5 rounded tracking-wide border border-[#60A5FA]/20">Total Value</span>
         </div>

         <div className="bg-[#101726] border border-[#162749] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#00D2FF]">
            <span className="text-[11px] font-medium text-[#6C84A3] mb-1 block">Your OTP Rate</span>
            <div className="flex items-end gap-3 mb-2"><span className="text-3xl font-semibold tracking-tight text-[#00D2FF]">${userRate.toFixed(2)}</span></div>
            <span className="text-[10px] font-semibold text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded tracking-wide border border-[#00D2FF]/20">Per OTP</span>
         </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
         <div className="bg-[#101726] border border-[#162749] p-6 rounded-2xl shadow-lg h-[350px] flex flex-col">
            <h3 className="text-sm font-semibold text-[#F8FAFC] tracking-wide mb-6">Success vs Failed Trends</h3>
            <div className="flex-1">
              {reportData.length === 0 ? <div className="flex items-center justify-center h-full text-[#6C84A3] font-medium text-sm">No data available.</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...reportData].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#162749" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.substring(0, 6)} />
                    <YAxis stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{backgroundColor: '#0B152A', borderColor: '#162749', borderRadius: '8px', color: '#F8FAFC'}} cursor={{fill: '#162749', opacity: 0.4}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: '500', color: '#6C84A3'}} />
                    <Bar dataKey="success" name="Successful OTPs" stackId="a" fill="#00D2FF" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="failed" name="Failed/Timeout" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
         </div>

         <div className="bg-[#101726] border border-[#162749] p-6 rounded-2xl shadow-lg h-[350px] flex flex-col">
            <h3 className="text-sm font-semibold text-[#F8FAFC] tracking-wide mb-6">My Earnings Overview</h3>
            <div className="flex-1">
              {reportData.length === 0 ? <div className="flex items-center justify-center h-full text-[#6C84A3] font-medium text-sm">No data available.</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...reportData].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#162749" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.substring(0, 6)} />
                    <YAxis stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{backgroundColor: '#0B152A', borderColor: '#162749', borderRadius: '8px', color: '#F8FAFC'}} formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']} />
                    <Line type="monotone" dataKey="amount" name="Revenue" stroke="#60A5FA" strokeWidth={3} dot={{r: 4, fill: '#60A5FA', strokeWidth: 2}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
         </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-[#101726] border border-[#162749] rounded-2xl shadow-lg overflow-hidden w-full">
         <div className="flex justify-between items-center p-5 bg-[#030816]/50 border-b border-[#162749]">
           <h3 className="text-sm font-semibold text-[#F8FAFC] tracking-wide">Detailed Daily Report</h3>
         </div>
         <div className="overflow-x-auto w-full custom-scrollbar">
           <table className="w-full text-left border-collapse min-w-[600px]">
             <thead>
               <tr className="bg-[#0B152A] text-[11px] font-semibold text-[#6C84A3] uppercase tracking-wide border-b border-[#162749]">
                 <th className="p-4 pl-6">Date</th>
                 <th className="p-4 text-center">Numbers Got</th>
                 <th className="p-4 text-center">Success (OTP)</th>
                 <th className="p-4 text-center">Failed</th>
                 <th className="p-4 text-center">Win Rate</th>
                 <th className="p-4 pr-6 text-right">My Earnings ($)</th>
               </tr>
             </thead>
             <tbody className="text-sm font-medium text-[#F8FAFC] divide-y divide-[#162749]/50">
               {reportData.map((row, index) => (
                   <tr key={index} className="hover:bg-[#030816] transition-colors">
                     <td className="p-4 pl-6 text-[#6C84A3] font-mono font-medium">{row.displayDate}</td>
                     <td className="p-4 text-center font-semibold text-[#F8FAFC]">{row.allocation}</td>
                     <td className="p-4 text-center font-semibold text-[#00D2FF]">{row.success}</td>
                     <td className="p-4 text-center font-semibold text-[#F43F5E]">{row.failed}</td>
                     <td className="p-4 text-center font-semibold text-[#60A5FA]">{row.rate}</td>
                     <td className="p-4 pr-6 text-right font-semibold text-[#F8FAFC]">${row.amount.toFixed(2)}</td>
                   </tr>
               ))}
               {reportData.length > 0 && (
                 <tr className="bg-[#0B152A] border-t-2 border-[#162749]">
                   <td className="p-4 pl-6 text-[#F8FAFC] font-semibold uppercase tracking-wide">Total Sum</td>
                   <td className="p-4 text-center font-semibold text-[#F8FAFC]">{totals.allocation}</td>
                   <td className="p-4 text-center font-semibold text-[#00D2FF]">{totals.success}</td>
                   <td className="p-4 text-center font-semibold text-[#F43F5E]">{totals.failed}</td>
                   <td className="p-4 text-center font-semibold text-[#60A5FA]">{overallRate}</td>
                   <td className="p-4 pr-6 text-right font-semibold text-[#00D2FF]">${totals.amount.toFixed(2)}</td>
                 </tr>
               )}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}