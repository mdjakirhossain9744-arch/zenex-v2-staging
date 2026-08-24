"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import useSWR from "swr";

export default function ManagerSummary() {
  const router = useRouter();

  const [dateFilter, setDateFilter] = useState("7"); 
  const [user, setUser] = useState<any>(null);

  const [userRate, setUserRate] = useState(0.50);
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
    if (parsedUser.role !== "agent") { router.push("/summary"); return; }
    
    setUser(parsedUser);
  }, [router]);

  const fetchManagerSummary = async ([_, email]: [string, string]) => {
    const res = await fetch("/api/agent-summary", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "agent" })
    });
    return res.json();
  };

  const { data, isLoading } = useSWR(
    user?.email ? ["managerSummary", user.email, dateFilter] : null,
    fetchManagerSummary,
    { refreshInterval: 10000, keepPreviousData: true, revalidateOnFocus: false }
  );

  useEffect(() => {
    if (data && data.success) {
      setUserRate(data.userRate || 0.50);
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

  // 💥 PREMIUM SKELETON LOADING (V2 Theme) 💥
  if (!data && isLoading) return (
    <div className="p-4 md:p-8 w-full animate-pulse font-sans">
      <div className="h-8 bg-[#0B152A] border border-[#162749] w-64 rounded-xl mb-2"></div>
      <div className="h-4 bg-[#0B152A] border border-[#162749] w-96 rounded-xl mb-8"></div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
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
    <div className="p-4 md:p-8 w-full relative z-10 pb-20 font-sans">
      
      {/* 💥 HEADER & FILTERS 💥 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] bg-clip-text text-transparent uppercase tracking-wider">Network Summary Report</h2>
            <span className="flex h-2.5 w-2.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00D2FF]"></span></span>
          </div>
          <p className="text-xs text-[#6C84A3] font-medium tracking-wide">Aggregated daily report of all network segments under your control.</p>
        </div>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-[#0B152A] border border-[#162749] text-xs font-semibold text-[#F8FAFC] px-4 py-2.5 rounded-xl focus:outline-none focus:border-[#00D2FF] cursor-pointer shadow-lg w-full md:w-auto outline-none appearance-none">
          <option value="today">Today's Intel</option>
          <option value="7">Last 7 Days</option>
          <option value="15">Last 15 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="all">Complete History</option>
        </select>
      </div>

      {/* 💥 STATS CARDS 💥 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-8">
          {/* Allocation */}
          <div className="bg-[#0B152A] border border-[#162749] p-5 rounded-2xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#6C84A3] opacity-30 group-hover:opacity-100 transition-opacity"></div>
            <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-1.5 block">Network Allocation</span>
            <div className="flex items-end gap-3"><span className="text-2xl md:text-3xl font-bold text-[#F8FAFC]">{totals.allocation}</span></div>
          </div>
          
          {/* Success Rate */}
          <div className="bg-[#0B152A] border border-[#162749] p-5 rounded-2xl shadow-[inset_0_1px_4px_rgba(0,210,255,0.02)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#00D2FF] opacity-50 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_#00D2FF]"></div>
            <span className="text-[10px] font-semibold text-[#00D2FF] uppercase tracking-widest mb-1.5 block">Success Rate</span>
            <div className="flex items-end gap-3"><span className="text-2xl md:text-3xl font-bold text-[#00D2FF]">{overallRate}</span></div>
          </div>

          {/* Total Commission */}
          <div className="bg-[#0B152A] border border-[#162749] p-5 rounded-2xl shadow-[inset_0_1px_4px_rgba(96,165,250,0.02)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#60A5FA] opacity-50 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_#60A5FA]"></div>
            <span className="text-[10px] font-semibold text-[#60A5FA] uppercase tracking-widest mb-1.5 block">Total Commission</span>
            <div className="flex items-end gap-3"><span className="text-2xl md:text-3xl font-bold text-[#60A5FA]">${dbEarnings}</span></div>
          </div>

          {/* Your Max Limit */}
          <div className="bg-[#0B152A] border border-[#162749] p-5 rounded-2xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] relative overflow-hidden group flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#3B82F6] opacity-30 group-hover:opacity-100 transition-opacity"></div>
            <div>
               <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-1.5 block">Your Max Limit</span>
               <div className="flex items-end gap-2 mb-2"><span className="text-2xl md:text-3xl font-bold text-[#F8FAFC]">${userRate.toFixed(2)}</span></div>
            </div>
            <span className="text-[9px] font-semibold text-[#60A5FA] bg-[#60A5FA]/10 px-2 py-0.5 rounded tracking-widest uppercase border border-[#60A5FA]/20 w-max">Per OTP Cap</span>
          </div>
      </div>

      {/* 💥 CHARTS GRID 💥 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 mb-8">
          
          {/* Trend Chart */}
          <div className="bg-[#0B152A] border border-[#162749] p-4 md:p-6 rounded-2xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] flex flex-col min-h-[350px]">
            <h3 className="text-xs font-semibold text-[#F8FAFC] uppercase tracking-widest mb-6 shrink-0 flex items-center gap-2">
               <svg className="w-4 h-4 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               Success vs Failed Trends
            </h3>
            <div className="flex-1 w-full h-full min-h-[250px]">
              {reportData.length === 0 ? <div className="flex items-center justify-center h-full text-[#6C84A3] font-medium text-sm">Waiting for signals...</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...reportData].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#162749" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.substring(0, 6)} tick={{ fill: '#6C84A3', fontWeight: 500 }} />
                    <YAxis stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#6C84A3', fontWeight: 500 }} />
                    <Tooltip contentStyle={{backgroundColor: '#0B152A', borderColor: '#162749', borderRadius: '8px', color: '#F8FAFC', fontSize: '12px'}} cursor={{fill: '#162749', opacity: 0.4}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: '600', color: '#6C84A3', paddingTop: '10px'}} />
                    <Bar dataKey="success" name="Successful OTPs" stackId="a" fill="#00D2FF" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="failed" name="Failed/Timeout" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="bg-[#0B152A] border border-[#162749] p-4 md:p-6 rounded-2xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] flex flex-col min-h-[350px]">
            <h3 className="text-xs font-semibold text-[#F8FAFC] uppercase tracking-widest mb-6 shrink-0 flex items-center gap-2">
               <svg className="w-4 h-4 text-[#60A5FA]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
               Commission Overview
            </h3>
            <div className="flex-1 w-full h-full min-h-[250px]">
              {reportData.length === 0 ? <div className="flex items-center justify-center h-full text-[#6C84A3] font-medium text-sm">Waiting for signals...</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...reportData].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#162749" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.substring(0, 6)} tick={{ fill: '#6C84A3', fontWeight: 500 }} />
                    <YAxis stroke="#6C84A3" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#6C84A3', fontWeight: 500 }} />
                    <Tooltip contentStyle={{backgroundColor: '#0B152A', borderColor: '#162749', borderRadius: '8px', color: '#F8FAFC', fontSize: '12px'}} formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']} />
                    <Line type="monotone" dataKey="amount" name="Revenue" stroke="#60A5FA" strokeWidth={3} dot={{r: 4, fill: '#60A5FA', strokeWidth: 2}} activeDot={{r: 6, fill: '#00D2FF', stroke: '#00D2FF'}} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

      </div>

      {/* 💥 DETAILED TABLE 💥 */}
      <div className="bg-[#0B152A] border border-[#162749] rounded-2xl shadow-lg overflow-hidden w-full">
          <div className="flex justify-between items-center p-4 md:p-5 bg-[#101726] border-b border-[#162749]">
            <h3 className="text-xs font-semibold text-[#F8FAFC] uppercase tracking-widest flex items-center gap-2">
               <svg className="w-4 h-4 text-[#6C84A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
               Detailed Daily Report
            </h3>
          </div>
          
          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#030816] text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest border-b border-[#162749]">
                  <th className="p-4 pl-6 whitespace-nowrap">Date</th>
                  <th className="p-4 text-center whitespace-nowrap">Allocated</th>
                  <th className="p-4 text-center whitespace-nowrap">Success (OTP)</th>
                  <th className="p-4 text-center whitespace-nowrap">Failed</th>
                  <th className="p-4 text-center whitespace-nowrap">Win Rate</th>
                  <th className="p-4 pr-6 text-right whitespace-nowrap">Commission ($)</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-[#F8FAFC] divide-y divide-[#162749]/50">
                {reportData.map((row, index) => (
                    <tr key={index} className="hover:bg-[#101726] transition-colors">
                      <td className="p-4 pl-6 text-[#6C84A3] font-mono font-semibold">{row.displayDate}</td>
                      <td className="p-4 text-center font-semibold text-[#F8FAFC]">{row.allocation}</td>
                      <td className="p-4 text-center font-bold text-[#00D2FF]">{row.success}</td>
                      <td className="p-4 text-center font-semibold text-[#F43F5E]">{row.failed}</td>
                      <td className="p-4 text-center font-semibold text-[#60A5FA]">{row.rate}</td>
                      <td className="p-4 pr-6 text-right font-bold text-[#F8FAFC]">${row.amount.toFixed(2)}</td>
                    </tr>
                ))}
                {reportData.length > 0 && (
                  <tr className="bg-[#030816] border-t-2 border-[#162749]">
                    <td className="p-4 pl-6 text-[#F8FAFC] font-bold uppercase tracking-wider">Total Sum</td>
                    <td className="p-4 text-center font-bold text-[#F8FAFC]">{totals.allocation}</td>
                    <td className="p-4 text-center font-bold text-[#00D2FF]">{totals.success}</td>
                    <td className="p-4 text-center font-bold text-[#F43F5E]">{totals.failed}</td>
                    <td className="p-4 text-center font-bold text-[#60A5FA]">{overallRate}</td>
                    <td className="p-4 pr-6 text-right font-bold text-[#60A5FA]">${totals.amount.toFixed(2)}</td>
                  </tr>
                )}
                {reportData.length === 0 && (
                   <tr>
                      <td colSpan={6} className="p-10 text-center text-[#6C84A3] font-semibold text-sm">
                         No operations recorded for the selected timeline.
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