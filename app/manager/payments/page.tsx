'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '../../DashboardLayout'; 

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
    <DashboardLayout>
      <div className="p-4 md:p-6 w-full font-sans">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black tracking-wide text-white mb-1 uppercase">User Payments</h1>
          <p className="text-[#94A3B8] text-xs md:text-sm font-medium tracking-wide">Track withdrawal history and success notes for users under your agency.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Distributed" value={`৳ ${stats?.totalDistributed?.toFixed(2) || '0.00'}`} subtitle="Lifetime paid amount" color="text-[#10B981]" border="border-[#10B981]/30" />
          <StatCard title="Total Approved" value={stats?.totalApprovedCount || 0} subtitle="Lifetime successful" color="text-[#3B82F6]" border="border-[#3B82F6]/30" />
          <StatCard title="Pending Request" value={stats?.totalPending || 0} subtitle="Waiting for approval" color="text-[#EAB308]" border="border-[#EAB308]/30" />
          <StatCard title="Total Rejected" value={stats?.totalRejectedCount || 0} subtitle="Cancelled or Refunded" color="text-[#F43F5E]" border="border-[#F43F5E]/30" />
        </div>

        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#334155] rounded-xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-[#334155] flex flex-col md:flex-row justify-between items-center bg-[#0F172A]/50 gap-4">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Transaction History</h2>
            <div className="relative w-full md:w-72">
              <svg className="absolute left-3 top-3 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Search WID, Email..."
                className="w-full bg-[#0F172A] border border-[#334155] text-white text-sm rounded-lg focus:ring-[#3B82F6] focus:border-[#3B82F6] block pl-10 p-2.5 outline-none transition-all placeholder-[#64748B]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left text-[#94A3B8]">
              <thead className="text-xs text-[#94A3B8] uppercase bg-[#0F172A] border-b border-[#334155]">
                <tr>
                  <th className="px-6 py-4 tracking-widest">Reference ID & User</th>
                  <th className="px-6 py-4 tracking-widest">Amount</th>
                  <th className="px-6 py-4 tracking-widest">Method & Details</th>
                  <th className="px-6 py-4 tracking-widest">Status</th>
                  <th className="px-6 py-4 tracking-widest">Date & Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="bg-transparent border-b border-[#334155]/50">
                      <td className="p-4 pl-6">
                        <div className="h-4 w-24 bg-[#334155] rounded animate-pulse mb-2"></div>
                        <div className="h-3 w-32 bg-[#334155] rounded animate-pulse mb-1"></div>
                        <div className="h-2 w-40 bg-[#334155] rounded animate-pulse"></div>
                      </td>
                      <td className="p-4"><div className="h-4 w-16 bg-[#334155] rounded animate-pulse"></div></td>
                      <td className="p-4">
                        <div className="h-3 w-16 bg-[#334155] rounded animate-pulse mb-2"></div>
                        <div className="h-5 w-32 bg-[#334155] rounded animate-pulse"></div>
                      </td>
                      <td className="p-4"><div className="h-5 w-16 bg-[#334155] rounded-md animate-pulse"></div></td>
                      <td className="p-4 min-w-[200px]">
                        <div className="h-3 w-28 bg-[#334155] rounded animate-pulse mb-2"></div>
                        <div className="h-8 w-full bg-[#334155] rounded-md animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : data.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-[#64748B] font-medium">No transactions found.</td></tr>
                ) : (
                  data.map((tx, idx) => {
                    const status = tx.status?.toUpperCase() || '';
                    const isPaid = status === 'PAID' || status === 'COMPLETED';
                    const isPending = status === 'PENDING' || status === 'PROCESSING';
                    
                    return (
                      <tr key={idx} className="bg-transparent border-b border-[#334155]/50 hover:bg-[#334155]/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-mono text-[#3B82F6] font-bold text-xs">{tx.wid || 'ZX-PENDING'}</div>
                          <div className="text-[#E2E8F0] mt-1 text-xs truncate max-w-[150px] font-medium">{tx.name}</div>
                          <div className="text-[#64748B] text-[10px]">{tx.email}</div>
                        </td>
                        
                        {/* 💥 FIXED: Clean, Simple, Single-line Amount 💥 */}
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-[#E2E8F0] whitespace-nowrap">
                            <span className="text-[#10B981] mr-1">৳</span>{tx.amount?.toFixed(2)}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-[#A855F7] uppercase text-[10px] font-black tracking-widest mb-1">{tx.method}</div>
                          <div className="text-[#94A3B8] font-mono text-xs truncate max-w-[200px] bg-[#0F172A] px-2 py-1 rounded border border-[#334155]">{tx.accountNumber}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md border whitespace-nowrap ${
                            isPaid ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' :
                            isPending ? 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/30' :
                            'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 min-w-[200px]">
                          <div className="text-[#94A3B8] mb-1 text-[10px] uppercase font-bold tracking-wider">{new Date(tx.createdAt || tx.date).toLocaleString()}</div>
                          {tx.adminNote && (
                            <div className={`text-[10px] p-2 rounded border break-words mt-2 font-mono ${isPaid ? 'bg-[#10B981]/5 border-[#10B981]/20 text-[#34D399]' : 'bg-[#F43F5E]/5 border-[#F43F5E]/20 text-[#FB7185]'}`}>
                              <span className="font-bold opacity-75 mr-1">Note:</span>{tx.adminNote}
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

          <div className="flex justify-between items-center p-4 bg-[#0F172A]/50 border-t border-[#334155]">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">Page {page} of {totalPages}</span>
            <div className="flex space-x-2">
              <button disabled={page === 1} onClick={() => handlePageChange(page - 1)} className="px-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#334155] disabled:opacity-50 text-xs font-bold uppercase tracking-widest transition-all">Prev</button>
              <button disabled={page === totalPages || totalPages === 0} onClick={() => handlePageChange(page + 1)} className="px-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#334155] disabled:opacity-50 text-xs font-bold uppercase tracking-widest transition-all">Next</button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, subtitle, color, border }: any) {
  return (
    <div className={`bg-[#1E293B]/80 backdrop-blur-md border ${border} rounded-xl p-5 shadow-lg relative overflow-hidden group hover:bg-[#1E293B] transition-all`}>
      <div className={`absolute top-0 right-0 w-24 h-24 bg-current opacity-5 rounded-bl-full pointer-events-none ${color}`}></div>
      <h3 className="text-[#94A3B8] text-[10px] font-bold uppercase tracking-widest mb-1">{title}</h3>
      <p className={`text-3xl font-black ${color} mb-1 drop-shadow-md`}>{value}</p>
      <p className="text-[#64748B] text-[9px] font-bold tracking-widest uppercase">{subtitle}</p>
    </div>
  );
}