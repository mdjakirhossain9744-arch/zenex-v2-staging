"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../../DashboardLayout"; 
import { useRouter } from "next/navigation";
import { messaging, onMessage } from "../../lib/firebase"; // 👈 Firebase import

export default function AdminPayments() {
  const router = useRouter();
  const [role, setRole] = useState("user"); 
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // 💥 3-TIER GATEWAY CONTROLLERS 💥
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(true);
  const [isManualWithdrawOpen, setIsManualWithdrawOpen] = useState(true); 
  const [binanceAutoPayActive, setBinanceAutoPayActive] = useState(true); 
  const [methodConfig, setMethodConfig] = useState<any>({ bKash: true, Nagad: true, Rocket: true, Binance: true, TRC20: true });
  
  const [dbRequests, setDbRequests] = useState<any[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState("MANUAL_PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ totalRequests: 0, pendingAmount: 0, paidAmount: 0, totalAmount: 0 });
  const itemsPerPage = 50;

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed.role !== "admin") return router.push("/"); 
      setRole("admin");
    }
    fetchPaymentSettings();
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeAdminTab, timeFilter, debouncedSearch]);

  useEffect(() => {
    if (role === "admin") {
      fetchRealData();
    }
  }, [role, activeAdminTab, timeFilter, debouncedSearch, currentPage]);

  // ==========================================
  // 🚀 FCM: REAL-TIME AUTO REFRESH MAGIC
  // ==========================================
  useEffect(() => {
    if (role === "admin" && typeof window !== "undefined" && messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("🔥 Live Withdraw Detected! Auto-Refreshing Table...", payload);
        // যখনই নতুন পুশ নোটিফিকেশন আসবে, টেবিল অটো রিফ্রেশ হবে!
        fetchRealData(); 
      });
      return () => unsubscribe(); // Cleanup
    }
  }, [role, messaging]); // Added to active listeners
  // ==========================================

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch("/api/payment-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH" }) });
      const data = await res.json();
      if (data.success && data.data) { 
          setIsWithdrawOpen(data.data.isWithdrawOpen); 
          setIsManualWithdrawOpen(data.data.isManualWithdrawOpen ?? true); 
          setBinanceAutoPayActive(data.data.binanceAutoPayActive ?? true); 
          setMethodConfig(data.data.methods || { bKash: true, Nagad: true, Rocket: true, Binance: true, TRC20: true }); 
      }
    } catch (err) {}
  };

  const fetchRealData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/withdraw", { 
        method: "POST", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ action: "FETCH", role: "admin", tab: activeAdminTab, timeFilter, searchQuery: debouncedSearch, page: currentPage, limit: itemsPerPage }) 
      });
      const data = await res.json();
      if (data.success) {
        setDbRequests(data.data);
        if (data.pagination) setTotalPages(data.pagination.totalPages);
        if (data.stats) setStats(data.stats);
      }
    } catch (error) {} finally { setLoading(false); }
  };

  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(""), 3000); };
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); showToast("Copied!"); };

  const updateSettingsAPI = async (payload: any) => {
    await fetch("/api/payment-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "UPDATE", ...payload }) });
  };

  const toggleGlobalWithdraw = async () => {
    const newState = !isWithdrawOpen;
    setIsWithdrawOpen(newState);
    showToast(newState ? "Global System OPENED" : "Global System CLOSED");
    await updateSettingsAPI({ isWithdrawOpen: newState, isManualWithdrawOpen, methods: methodConfig, binanceAutoPayActive });
  };

  const toggleManualGate = async () => {
    const newState = !isManualWithdrawOpen;
    setIsManualWithdrawOpen(newState);
    showToast(newState ? "Manual Gate ENABLED" : "Manual Gate DISABLED");
    await updateSettingsAPI({ isWithdrawOpen, isManualWithdrawOpen: newState, methods: methodConfig, binanceAutoPayActive });
  };

  const toggleAutoPayEngine = async () => {
    const newState = !binanceAutoPayActive;
    setBinanceAutoPayActive(newState);
    showToast(newState ? "Auto-Pay Engine ENABLED" : "Auto-Pay Engine DISABLED");
    await updateSettingsAPI({ isWithdrawOpen, isManualWithdrawOpen, methods: methodConfig, binanceAutoPayActive: newState });
  };

  const toggleIndividualMethod = async (methodKey: string) => {
    const updatedMethods = { ...methodConfig, [methodKey]: !methodConfig[methodKey] };
    setMethodConfig(updatedMethods);
    showToast(`${methodKey} is now ${updatedMethods[methodKey] ? "ON" : "OFF"}`);
    await updateSettingsAPI({ isWithdrawOpen, isManualWithdrawOpen, methods: updatedMethods, binanceAutoPayActive });
  };

  const handleAdminStatusUpdate = async (id: string, newStatus: string, method: string) => {
    if (newStatus === "PAID" && method === "Binance") {
        if (!window.confirm("Are you sure? This will instantly send REAL USD to the user's Binance account!")) return;
    }
    if (newStatus === "REJECTED") {
        if (!window.confirm("Are you sure you want to REJECT and refund this amount?")) return;
    }

    try {
      const res = await fetch("/api/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "UPDATE_STATUS", withdrawId: id, newStatus }) });
      const data = await res.json();
      if (data.success) { showToast(`Marked as ${newStatus}!`); fetchRealData(); }
      else { showToast(data.message || "Failed!"); }
    } catch (error) { showToast("API Error"); }
  };

  const downloadPageCSV = () => {
    const headers = ["WID", "Date", "Name", "Email", "Amount", "Method", "Account Number", "Status"];
    const rows = dbRequests.map(req => [req.wid || "ZX-PENDING", req.date || new Date(req.createdAt).toLocaleDateString(), req.name, req.email, req.amount, req.method, req.accountNumber, req.status]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }));
    link.download = `Zenex_Page_${currentPage}_${activeAdminTab}.csv`; link.click();
  };

  const handleSmartBulkAction = async () => {
    if (selectedIds.length === 0) return;
    const actionType = (activeAdminTab === "MANUAL_PENDING") ? "PROCESS" : "PAID";
    
    if (!window.confirm(`Execute action for ${selectedIds.length} requests?`)) return;
    try {
      const res = await fetch("/api/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "BULK_ACTION", actionType, selectedIds }) });
      const data = await res.json();
      if (data.success) { showToast(data.message); setSelectedIds([]); fetchRealData(); }
      else { showToast(data.message || "Failed bulk action"); }
    } catch(err) { showToast("Failed bulk action"); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === dbRequests.length) setSelectedIds([]);
    else setSelectedIds(dbRequests.map(r => r._id));
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full relative z-10 pb-20 font-sans">
        {toastMessage && (
          <div className="fixed top-24 right-5 z-[100] bg-[#10B981] text-white px-5 py-3 rounded-lg shadow-2xl font-bold flex items-center gap-3 animate-bounce-in">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {toastMessage}
          </div>
        )}

        <div className="w-full">
          <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-[#F43F5E] tracking-tight">Finance Control Room</h2>
              <p className="text-[#94A3B8] mt-1 text-sm font-medium">Enterprise Gateway Controllers</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-[#0F172A] p-3 rounded-2xl border border-[#334155] shadow-inner w-full xl:w-auto">
              <div className="flex items-center gap-3 px-4 py-1 border-r border-[#334155]">
                 <span className="text-[10px] text-[#94A3B8] uppercase font-black">Global Gate</span>
                 <button onClick={toggleGlobalWithdraw} className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${isWithdrawOpen ? 'bg-[#10B981]' : 'bg-[#F43F5E]'}`}>
                   <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isWithdrawOpen ? 'translate-x-5' : 'translate-x-0'}`}></div>
                 </button>
              </div>

              <div className="flex items-center gap-3 px-4 py-1 border-r border-[#334155]">
                 <span className="text-[10px] text-[#3B82F6] uppercase font-black">Manual Gate</span>
                 <button onClick={toggleManualGate} className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${isManualWithdrawOpen ? 'bg-[#3B82F6]' : 'bg-[#334155]'}`}>
                   <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isManualWithdrawOpen ? 'translate-x-5' : 'translate-x-0'}`}></div>
                 </button>
              </div>

              <div className="flex items-center gap-3 px-4 py-1 border-r border-[#334155]">
                 <span className="text-[10px] text-[#FCD34D] uppercase font-black">⚡ Auto-Pay</span>
                 <button onClick={toggleAutoPayEngine} className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${binanceAutoPayActive ? 'bg-[#F59E0B]' : 'bg-[#334155]'}`}>
                   <div className={`w-3 h-3 bg-white rounded-full transition-transform ${binanceAutoPayActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
                 </button>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 px-2">
                 {Object.keys(methodConfig).filter(m => m !== "TRC20").map((methodKey) => (
                    <div key={methodKey} className="flex items-center gap-2">
                       <span className={`text-[10px] uppercase font-bold ${methodConfig[methodKey] ? 'text-white' : 'text-[#64748B]'}`}>{methodKey}</span>
                       <button onClick={() => toggleIndividualMethod(methodKey)} className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${methodConfig[methodKey] ? 'bg-[#3B82F6]' : 'bg-[#334155]'}`}>
                         <div className={`w-3 h-3 bg-white rounded-full transition-transform ${methodConfig[methodKey] ? 'translate-x-4' : 'translate-x-0'}`}></div>
                       </button>
                    </div>
                 ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#3B82F6]">
              <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1">Total Transactions</p>
              <p className="text-2xl font-black text-white">{stats.totalRequests}</p>
            </div>
            <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#EAB308]">
              <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1">Pending Amount</p>
              <p className="text-2xl font-black text-[#EAB308]">৳ {stats.pendingAmount.toFixed(2)}</p>
            </div>
            <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#10B981]">
              <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1">Total Paid</p>
              <p className="text-2xl font-black text-[#10B981]">৳ {stats.paidAmount.toFixed(2)}</p>
            </div>
            <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#8B5CF6]">
              <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1">Lifetime Volume</p>
              <p className="text-2xl font-black text-white">৳ {stats.totalAmount.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-[#1E293B]/80 p-4 rounded-2xl border border-[#334155]">
             <div className="flex items-center gap-2 bg-[#0F172A] p-1.5 rounded-xl border border-[#334155] overflow-x-auto w-full md:w-auto custom-scrollbar pb-2 md:pb-1.5">
               <button onClick={() => setActiveAdminTab("MANUAL_PENDING")} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs md:text-sm font-black transition-all ${activeAdminTab === "MANUAL_PENDING" ? "bg-[#3B82F6] text-white shadow-lg" : "text-[#64748B] hover:text-white"}`}>Manual Pending</button>
               <button onClick={() => setActiveAdminTab("MANUAL_PROCESSING")} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs md:text-sm font-black transition-all ${activeAdminTab === "MANUAL_PROCESSING" ? "bg-[#EAB308] text-white shadow-lg" : "text-[#64748B] hover:text-white"}`}>Manual Processing</button>
               <button onClick={() => setActiveAdminTab("BINANCE_AUTO")} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs md:text-sm font-black transition-all flex items-center gap-1 ${activeAdminTab === "BINANCE_AUTO" ? "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white shadow-[0_0_10px_rgba(245,158,11,0.5)] border border-[#FCD34D]/50" : "text-[#FCD34D] hover:text-white border border-transparent"}`}>⚡ Binance Auto</button>
               <button onClick={() => setActiveAdminTab("HISTORY")} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs md:text-sm font-black transition-all ${activeAdminTab === "HISTORY" ? "bg-[#10B981] text-white shadow-lg" : "text-[#64748B] hover:text-white"}`}>History</button>
             </div>

             <div className="flex w-full md:w-auto items-center gap-3">
               <button onClick={downloadPageCSV} className="hidden md:flex items-center gap-2 bg-[#0F172A] border border-[#334155] text-white hover:text-[#10B981] hover:border-[#10B981] font-bold px-3 py-2.5 rounded-xl text-xs transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> CSV Page
               </button>
               {(activeAdminTab !== "HISTORY") && selectedIds.length > 0 && (
                 <button onClick={handleSmartBulkAction} className={`text-white font-black px-4 py-2.5 rounded-xl text-sm transition-shadow ${activeAdminTab === "MANUAL_PENDING" ? 'bg-gradient-to-r from-[#EAB308] to-[#CA8A04] shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-gradient-to-r from-[#10B981] to-[#059669] shadow-[0_0_15px_rgba(16,185,129,0.4)]'}`}>
                   {activeAdminTab === "MANUAL_PENDING" ? `Process (${selectedIds.length})` : `Pay All Selected (${selectedIds.length})`}
                 </button>
               )}
               <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-56 bg-[#0F172A] border border-[#334155] text-white text-sm px-4 py-2.5 rounded-xl focus:border-[#3B82F6] outline-none" />
             </div>
          </div>

          <div className="bg-[#1E293B]/80 border border-[#334155] rounded-2xl shadow-lg overflow-x-auto min-h-[300px]">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0F172A]/50 text-[#94A3B8] uppercase text-[10px] tracking-widest border-b border-[#334155]">
                <tr>
                  {(activeAdminTab !== "HISTORY") && (
                    <th className="p-4 pl-6 w-10"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === dbRequests.length && dbRequests.length > 0} className="w-4 h-4 rounded bg-[#1E293B] border-[#334155] cursor-pointer" /></th>
                  )}
                  <th className="p-4 pl-6 font-black">Ref ID & Date</th>
                  <th className="p-4 font-black">User Details</th>
                  <th className="p-4 font-black">Amount</th>
                  <th className="p-4 font-black">Account Info</th>
                  <th className="p-4 pr-6 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/50">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-[#3B82F6] font-bold">Loading Page {currentPage}...</td></tr>
                ) : dbRequests.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-[#64748B] font-bold">No requests found in {activeAdminTab}.</td></tr>
                ) : (
                  dbRequests.map((req) => (
                    <tr key={req._id} className="hover:bg-[#334155]/20 transition-colors">
                      {(activeAdminTab !== "HISTORY") && (
                        <td className="p-4 pl-6"><input type="checkbox" checked={selectedIds.includes(req._id)} onChange={(e) => {
                          if (e.target.checked) setSelectedIds([...selectedIds, req._id]);
                          else setSelectedIds(selectedIds.filter(id => id !== req._id));
                        }} className="w-4 h-4 cursor-pointer" /></td>
                      )}
                      
                      <td className="p-4 pl-6">
                         <div className="font-mono text-[#3B82F6] font-bold text-xs">{req.wid || 'ZX-PENDING'}</div>
                         <div className="text-[10px] font-black text-[#94A3B8] mt-0.5">{req.date || new Date(req.createdAt).toLocaleDateString()}</div>
                      </td>

                      <td className="p-4"><p className="font-bold text-[#E2E8F0]">{req.name}</p><p className="text-[10px] text-[#64748B]">{req.email}</p></td>
                      <td className="p-4 font-black text-[#10B981] text-lg">৳ {req.amount}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                           <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded text-white ${req.method === 'Binance' ? 'bg-[#F59E0B]' : 'bg-[#334155]'}`}>{req.method}</span>
                           <span className="font-mono text-[#A855F7] font-bold">{req.accountNumber}</span>
                           <button onClick={() => copyToClipboard(req.accountNumber)} className="text-[#94A3B8] hover:text-[#3B82F6] transition-colors" title="Copy Number">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                           </button>
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right space-x-2">
                        {req.status === "PENDING" ? (
                          <>
                            <button onClick={() => handleAdminStatusUpdate(req._id, "PROCESSING", req.method)} className="bg-[#EAB308]/10 text-[#EAB308] hover:bg-[#EAB308] hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition-colors">Process</button>
                            <button onClick={() => handleAdminStatusUpdate(req._id, "REJECTED", req.method)} className="text-[#F43F5E] hover:underline text-xs font-black px-2">Reject</button>
                          </>
                        ) : req.status === "PROCESSING" ? (
                          <div className="flex items-center justify-end gap-2">
                              <button 
                                 onClick={() => handleAdminStatusUpdate(req._id, "PAID", req.method)} 
                                 className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    req.method === "Binance" 
                                      ? "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white shadow-lg border border-[#FCD34D]/50" 
                                      : "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981] hover:text-white"
                                 }`}>
                                 {req.method === "Binance" ? "⚡ Auto Pay" : "Mark Paid"}
                              </button>
                              <button 
                                 onClick={() => handleAdminStatusUpdate(req._id, "REJECTED", req.method)} 
                                 className="text-[#F43F5E] bg-[#F43F5E]/10 hover:bg-[#F43F5E] hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition-colors">
                                 Reject
                              </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${req.status === 'PAID' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#F43F5E]/20 text-[#F43F5E]'}`}>{req.status}</span>
                            <button onClick={() => handleAdminStatusUpdate(req._id, "PENDING", req.method)} className="text-[10px] text-[#3B82F6] hover:underline font-bold">Undo</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div className="p-4 border-t border-[#334155] bg-[#0F172A]/50 flex items-center justify-between">
                 <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-[#1E293B] text-white text-xs font-bold rounded-lg border border-[#334155] disabled:opacity-50 hover:bg-[#334155] transition-colors">
                   ← Previous
                 </button>
                 <span className="text-xs font-black text-[#94A3B8]">
                   Page <span className="text-white">{currentPage}</span> of {totalPages}
                 </span>
                 <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-[#1E293B] text-white text-xs font-bold rounded-lg border border-[#334155] disabled:opacity-50 hover:bg-[#334155] transition-colors">
                   Next →
                 </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}