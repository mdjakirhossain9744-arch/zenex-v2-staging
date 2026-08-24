"use client";

import { useState, useEffect } from 'react';

export default function AgentPayments() {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPayments = async (searchQuery = '', currentPage = 1) => {
    setLoading(true);
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const agentEmail = storedUser?.email || '';
      const role = storedUser?.role || ''; 

      const res = await fetch(`/api/manager/payments?search=${searchQuery}&page=${currentPage}&limit=10&agentEmail=${agentEmail}&role=${role}`, {
        cache: 'no-store'
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setStats(result.stats);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchPayments(search, 1);
    }, 500); 
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
      fetchPayments(search, newPage);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full relative z-10 pb-20 bg-[#030816] text-[#F8FAFC]" style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', sans-serif" }}>
      
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#F8FAFC] mb-1.5 uppercase">User Payments</h1>
        <p className="text-[#6C84A3] text-xs md:text-sm font-medium tracking-wide">Track withdrawal history and success notes for users under your agency.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 mb-8">
        <StatCard title="Total Distributed" value={`$${stats?.totalDistributed?.toFixed(2) || '0.00'}`} subtitle="Lifetime paid amount" color="text-[#00D2FF]" accent="bg-[#00D2FF]" />
        <StatCard title="Total Approved" value={stats?.totalApprovedCount || 0} subtitle="Lifetime successful" color="text-[#60A5FA]" accent="bg-[#60A5FA]" />
        <StatCard title="Pending Request" value={stats?.totalPending || 0} subtitle="Waiting for approval" color="text-[#F8FAFC]" accent="bg-[#6C84A3]" />
        <StatCard title="Total Rejected" value={stats?.totalRejectedCount || 0} subtitle="Cancelled or Refunded" color="text-[#F43F5E]" accent="bg-[#F43F5E]" />
      </div>

      <div className="bg-[#0B152A] border border-[#162749] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
        
        {/* Table Header & Search */}
        <div className="p-4 md:p-5 border-b border-[#162749] flex flex-col md:flex-row justify-between items-start md:items-center bg-[#0B152A] gap-4">
          <h2 className="text-sm md:text-base font-semibold text-[#F8FAFC] tracking-wide">Transaction History</h2>
          <div className="relative w-full md:w-72 group">
            <svg className="absolute left-3.5 top-3 w-4 h-4 text-[#6C84A3] group-focus-within:text-[#00D2FF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search WID, Email..."
              className="w-full bg-[#030816] border border-[#162749] text-[#F8FAFC] text-xs font-medium tracking-wide rounded-xl focus:ring-1 focus:ring-[#00D2FF]/30 focus:border-[#00D2FF]/50 block pl-10 p-2.5 outline-none transition-all placeholder-[#6C84A3]/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left text-[#6C84A3]">
            <thead className="text-[10px] text-[#6C84A3] uppercase bg-[#030816] border-b border-[#162749] font-semibold tracking-widest">
              <tr>
                <th className="px-5 py-4 whitespace-nowrap">Reference ID & User</th>
                <th className="px-5 py-4 whitespace-nowrap">Amount</th>
                <th className="px-5 py-4 whitespace-nowrap">Method & Details</th>
                <th className="px-5 py-4 whitespace-nowrap">Status</th>
                <th className="px-5 py-4 whitespace-nowrap min-w-[180px]">Date & Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#162749]">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="bg-transparent">
                    <td className="p-4 pl-5">
                      <div className="h-3 w-24 bg-[#162749] rounded animate-pulse mb-2.5"></div>
                      <div className="h-2.5 w-32 bg-[#162749] rounded animate-pulse mb-1.5"></div>
                      <div className="h-2 w-40 bg-[#162749] rounded animate-pulse"></div>
                    </td>
                    <td className="p-4"><div className="h-3.5 w-16 bg-[#162749] rounded animate-pulse"></div></td>
                    <td className="p-4">
                      <div className="h-2.5 w-16 bg-[#162749] rounded animate-pulse mb-2.5"></div>
                      <div className="h-4 w-32 bg-[#162749] rounded animate-pulse"></div>
                    </td>
                    <td className="p-4"><div className="h-4 w-16 bg-[#162749] rounded-md animate-pulse"></div></td>
                    <td className="p-4 min-w-[200px]">
                      <div className="h-2.5 w-28 bg-[#162749] rounded animate-pulse mb-2.5"></div>
                      <div className="h-7 w-full bg-[#162749] rounded-md animate-pulse"></div>
                    </td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-16 text-[#6C84A3] font-medium text-xs border border-dashed border-[#162749] m-4 rounded-xl">No transactions found matching your criteria.</td></tr>
              ) : (
                data.map((tx, idx) => {
                  const status = tx.status?.toUpperCase() || '';
                  const isPaid = status === 'PAID' || status === 'COMPLETED';
                  const isPending = status === 'PENDING' || status === 'PROCESSING';
                  
                  return (
                    <tr key={idx} className="bg-transparent hover:bg-[#101726] transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-mono text-[#00D2FF] font-semibold text-[11px] mb-1 tracking-wider">{tx.wid || 'ZX-PENDING'}</div>
                        <div className="text-[#F8FAFC] text-[13px] truncate max-w-[150px] font-semibold tracking-wide">{tx.name}</div>
                        <div className="text-[#6C84A3] text-[10px] font-medium tracking-wide mt-0.5">{tx.email}</div>
                      </td>
                      
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-[#F8FAFC] whitespace-nowrap tracking-tight">
                          <span className="text-[#00D2FF] mr-0.5">$</span>{tx.amount?.toFixed(2)}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-[#60A5FA] uppercase text-[9px] font-bold tracking-widest mb-1.5">{tx.method}</div>
                        <div className="text-[#6C84A3] font-mono text-[11px] truncate max-w-[180px] bg-[#030816] px-2.5 py-1 rounded-md border border-[#162749]">{tx.accountNumber}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md border whitespace-nowrap ${
                          isPaid ? 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/30' :
                          isPending ? 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/30' :
                          'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 min-w-[180px]">
                        <div className="text-[#6C84A3] mb-1.5 text-[9px] uppercase font-semibold tracking-widest">{new Date(tx.createdAt || tx.date).toLocaleString()}</div>
                        {tx.adminNote && (
                          <div className={`text-[10px] p-2 rounded-md border break-words mt-2 font-medium tracking-wide ${isPaid ? 'bg-[#00D2FF]/5 border-[#00D2FF]/20 text-[#00D2FF]' : 'bg-[#F43F5E]/5 border-[#F43F5E]/20 text-[#F43F5E]'}`}>
                            <span className="font-bold opacity-75 mr-1 uppercase text-[8px] tracking-widest">Note:</span>{tx.adminNote}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 md:p-5 bg-[#030816] border-t border-[#162749]">
          <span className="text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest">Page {page} of {totalPages}</span>
          <div className="flex space-x-2">
            <button disabled={page === 1} onClick={() => handlePageChange(page - 1)} className="px-4 py-1.5 bg-[#0B152A] border border-[#162749] rounded-lg text-[#6C84A3] hover:text-[#F8FAFC] hover:border-[#60A5FA]/50 disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest transition-all">Prev</button>
            <button disabled={page === totalPages || totalPages === 0} onClick={() => handlePageChange(page + 1)} className="px-4 py-1.5 bg-[#0B152A] border border-[#162749] rounded-lg text-[#6C84A3] hover:text-[#F8FAFC] hover:border-[#60A5FA]/50 disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest transition-all">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 💥 V2 COMPACT STAT CARD 💥
function StatCard({ title, value, subtitle, color, accent }: any) {
  return (
    <div className={`bg-[#0B152A] border border-[#162749] rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-[#1F335B] transition-colors`}>
      <div className={`absolute top-0 left-0 w-1 h-full opacity-80 ${accent}`}></div>
      <h3 className="text-[#6C84A3] text-[10px] font-semibold uppercase tracking-widest mb-1">{title}</h3>
      <p className={`text-2xl md:text-3xl font-semibold ${color} mb-1 tracking-tight`}>{value}</p>
      <p className="text-[#6C84A3] text-[9px] font-medium tracking-widest uppercase opacity-70">{subtitle}</p>
    </div>
  );
}