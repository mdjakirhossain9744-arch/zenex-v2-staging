"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setupOnMessage } from "../../../lib/firebase"; 

export default function AdminPayments() {
  const router = useRouter();
  const [role, setRole] = useState("user"); 
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // 💥 4-TIER GATEWAY CONTROLLERS 💥
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(true);
  const [isManualWithdrawOpen, setIsManualWithdrawOpen] = useState(true); 
  const [binanceAutoPayActive, setBinanceAutoPayActive] = useState(true); 
  const [isAutoApproveBotActive, setIsAutoApproveBotActive] = useState(false);
  const [methodConfig, setMethodConfig] = useState<any>({ bKash: true, Nagad: true, Rocket: true, Binance: true, TRC20: true });
  
  const [dbRequests, setDbRequests] = useState<any[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState("MANUAL_PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // 💥 NEW: systemLiability state added
  const [stats, setStats] = useState({ totalRequests: 0, pendingAmount: 0, paidAmount: 0, totalAmount: 0, systemLiability: 0 });
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
    if (role === "admin") fetchRealData();
  }, [role, activeAdminTab, timeFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    if (role === "admin" && typeof window !== "undefined") {
      setupOnMessage((payload: any) => {
        console.log("🔥 Live Withdraw Detected! Auto-Refreshing Table...", payload);
        fetchRealData(); 
      });
    }
  }, [role]); 

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch("/api/payment-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH" }) });
      const data = await res.json();
      if (data.success && data.data) { 
          setIsWithdrawOpen(data.data.isWithdrawOpen); 
          setIsManualWithdrawOpen(data.data.isManualWithdrawOpen ?? true); 
          setBinanceAutoPayActive(data.data.binanceAutoPayActive ?? true); 
          setIsAutoApproveBotActive(data.data.isAutoApproveBotActive ?? false);
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
    await updateSettingsAPI({ isWithdrawOpen: newState, isManualWithdrawOpen, isAutoApproveBotActive, methods: methodConfig, binanceAutoPayActive });
  };

  const toggleManualGate = async () => {
    const newState = !isManualWithdrawOpen;
    setIsManualWithdrawOpen(newState);
    showToast(newState ? "Manual Gate ENABLED" : "Manual Gate DISABLED");
    await updateSettingsAPI({ isWithdrawOpen, isManualWithdrawOpen: newState, isAutoApproveBotActive, methods: methodConfig, binanceAutoPayActive });
  };

  const toggleAutoPayEngine = async () => {
    const newState = !binanceAutoPayActive;
    setBinanceAutoPayActive(newState);
    showToast(newState ? "User Auto-Pay ENABLED" : "User Auto-Pay DISABLED");
    await updateSettingsAPI({ isWithdrawOpen, isManualWithdrawOpen, isAutoApproveBotActive, methods: methodConfig, binanceAutoPayActive: newState });
  };

  const toggleAutoApproveBot = async () => {
    const newState = !isAutoApproveBotActive;
    setIsAutoApproveBotActive(newState);
    showToast(newState ? "🤖 Bot: AUTO-CLEARANCE ON!" : "🤖 Bot: AUTO-CLEARANCE OFF!");
    await updateSettingsAPI({ isWithdrawOpen, isManualWithdrawOpen, isAutoApproveBotActive: newState, methods: methodConfig, binanceAutoPayActive });
  };

  const toggleIndividualMethod = async (methodKey: string) => {
    const updatedMethods = { ...methodConfig, [methodKey]: !methodConfig[methodKey] };
    setMethodConfig(updatedMethods);
    showToast(`${methodKey} is now ${updatedMethods[methodKey] ? "ON" : "OFF"}`);
    await updateSettingsAPI({ isWithdrawOpen, isManualWithdrawOpen, isAutoApproveBotActive, methods: updatedMethods, binanceAutoPayActive });
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
    <div className="p-4 md:p-10 w-full relative z-10 pb-20 font-sans tracking-tight">
      {toastMessage && (
        <div className="fixed top-24 right-5 z-[100] bg-[#00D2FF] text-[#030816] px-5 py-3 rounded-lg shadow-2xl font-bold flex items-center gap-3 animate-bounce-in">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {toastMessage}
        </div>
      )}

      <div className="w-full">
        <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-[#F8FAFC] tracking-tight">Finance Control Room</h2>
            <p className="text-[#6C84A3] mt-1 text-sm font-medium">Enterprise Gateway Controllers</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-[#101726] p-3 rounded-2xl border border-[#162749] shadow-inner w-full xl:w-auto">
            <div className="flex items-center gap-3 px-4 py-1 border-r border-[#162749]">
               <span className="text-[10px] text-[#6C84A3] uppercase font-bold">Global Gate</span>
               <button onClick={toggleGlobalWithdraw} className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${isWithdrawOpen ? 'bg-[#00D2FF]' : 'bg-[#F43F5E]'}`}>
                 <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isWithdrawOpen ? 'translate-x-5' : 'translate-x-0'}`}></div>
               </button>
            </div>

            <div className="flex items-center gap-3 px-4 py-1 border-r border-[#162749]">
               <span className="text-[10px] text-[#60A5FA] uppercase font-bold">Manual Gate</span>
               <button onClick={toggleManualGate} className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${isManualWithdrawOpen ? 'bg-[#60A5FA]' : 'bg-[#162749]'}`}>
                 <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isManualWithdrawOpen ? 'translate-x-5' : 'translate-x-0'}`}></div>
               </button>
            </div>

            <div className="flex items-center gap-3 px-4 py-1 border-r border-[#162749]">
               <span className="text-[10px] text-[#00D2FF] uppercase font-bold" title="User's Auto Request Setting">⚡ Auto-Pay</span>
               <button onClick={toggleAutoPayEngine} className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${binanceAutoPayActive ? 'bg-[#00D2FF]' : 'bg-[#162749]'}`}>
                 <div className={`w-3 h-3 bg-white rounded-full transition-transform ${binanceAutoPayActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
               </button>
            </div>

            <div className="flex items-center gap-3 px-4 py-1 border-r border-[#162749]">
               <span className="text-[10px] text-[#00D2FF] uppercase font-bold" title="Clear pending requests automatically">🤖 Auto-Approve</span>
               <button onClick={toggleAutoApproveBot} className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${isAutoApproveBotActive ? 'bg-[#00D2FF]' : 'bg-[#162749]'}`}>
                 <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isAutoApproveBotActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
               </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 px-2">
               {Object.keys(methodConfig).filter(m => m !== "TRC20").map((methodKey) => (
                  <div key={methodKey} className="flex items-center gap-2">
                     <span className={`text-[10px] uppercase font-bold ${methodConfig[methodKey] ? 'text-white' : 'text-[#6C84A3]'}`}>{methodKey}</span>
                     <button onClick={() => toggleIndividualMethod(methodKey)} className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${methodConfig[methodKey] ? 'bg-[#60A5FA]' : 'bg-[#162749]'}`}>
                       <div className={`w-3 h-3 bg-white rounded-full transition-transform ${methodConfig[methodKey] ? 'translate-x-4' : 'translate-x-0'}`}></div>
                     </button>
                  </div>
               ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#101726]/90 border border-[#162749] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#60A5FA]">
            <p className="text-[10px] text-[#6C84A3] uppercase font-bold tracking-widest mb-1">Total Transactions</p>
            <p className="text-2xl font-black text-[#F8FAFC]">{stats.totalRequests}</p>
          </div>
          <div className="bg-[#101726]/90 border border-[#162749] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#00D2FF]">
            <p className="text-[10px] text-[#6C84A3] uppercase font-bold tracking-widest mb-1">Pending Amount</p>
            <p className="text-2xl font-black text-[#00D2FF]">$ {stats.pendingAmount.toFixed(2)}</p>
          </div>
          <div className="bg-[#101726]/90 border border-[#162749] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#60A5FA]">
            <p className="text-[10px] text-[#6C84A3] uppercase font-bold tracking-widest mb-1">Total Paid</p>
            <p className="text-2xl font-black text-[#60A5FA]">$ {stats.paidAmount.toFixed(2)}</p>
          </div>
          <div className="bg-[#101726]/90 border border-[#162749] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#00D2FF]">
            <p className="text-[10px] text-[#6C84A3] uppercase font-bold tracking-widest mb-1">Users Unpaid Balance</p>
            <p className="text-2xl font-black text-[#00D2FF]">$ {stats.systemLiability?.toFixed(2) || "0.00"}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-[#101726]/90 p-4 rounded-2xl border border-[#162749]">
           <div className="flex items-center gap-2 bg-[#030816] p-1.5 rounded-xl border border-[#162749] overflow-x-auto w-full md:w-auto custom-scrollbar pb-2 md:pb-1.5">
             <button onClick={() => setActiveAdminTab("MANUAL_PENDING")} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${activeAdminTab === "MANUAL_PENDING" ? "bg-[#00D2FF] text-[#030816] shadow-lg" : "text-[#6C84A3] hover:text-[#F8FAFC]"}`}>Manual Pending</button>
             <button onClick={() => setActiveAdminTab("MANUAL_PROCESSING")} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${activeAdminTab === "MANUAL_PROCESSING" ? "bg-[#60A5FA] text-[#030816] shadow-lg" : "text-[#6C84A3] hover:text-[#F8FAFC]"}`}>Manual Processing</button>
             <button onClick={() => setActiveAdminTab("BINANCE_AUTO")} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-1 ${activeAdminTab === "BINANCE_AUTO" ? "bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] text-[#030816] shadow-[0_0_10px_rgba(0,210,255,0.5)] border border-[#00D2FF]/50" : "text-[#00D2FF] hover:text-[#F8FAFC] border border-transparent"}`}>⚡ Binance Auto</button>
             <button onClick={() => setActiveAdminTab("HISTORY")} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${activeAdminTab === "HISTORY" ? "bg-[#162749] text-white shadow-lg" : "text-[#6C84A3] hover:text-[#F8FAFC]"}`}>History</button>
           </div>

           <div className="flex w-full md:w-auto items-center gap-3">
             <button onClick={downloadPageCSV} className="hidden md:flex items-center gap-2 bg-[#030816] border border-[#162749] text-white hover:text-[#00D2FF] hover:border-[#00D2FF] font-bold px-3 py-2.5 rounded-xl text-xs transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> CSV Page
             </button>
             {(activeAdminTab !== "HISTORY") && selectedIds.length > 0 && (
               <button onClick={handleSmartBulkAction} className={`text-[#030816] font-black px-4 py-2.5 rounded-xl text-sm transition-shadow ${activeAdminTab === "MANUAL_PENDING" ? 'bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] shadow-[0_0_15px_rgba(0,210,255,0.4)]' : 'bg-gradient-to-r from-[#60A5FA] to-[#00D2FF] shadow-[0_0_15px_rgba(96,165,250,0.4)]'}`}>
                 {activeAdminTab === "MANUAL_PENDING" ? `Process (${selectedIds.length})` : `Pay All Selected (${selectedIds.length})`}
               </button>
             )}
             <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-56 bg-[#030816] border border-[#162749] text-white text-sm px-4 py-2.5 rounded-xl focus:border-[#00D2FF] outline-none" />
           </div>
        </div>

        <div className="bg-[#101726]/90 border border-[#162749] rounded-2xl shadow-lg overflow-x-auto min-h-[300px]">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[#0B152A] text-[#6C84A3] uppercase text-[10px] font-bold tracking-widest border-b border-[#162749]">
              <tr>
                {(activeAdminTab !== "HISTORY") && (
                  <th className="p-4 pl-6 w-10"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === dbRequests.length && dbRequests.length > 0} className="w-4 h-4 rounded bg-[#101726] border-[#162749] cursor-pointer" /></th>
                )}
                <th className="p-4 pl-6 font-bold">Ref ID & Date</th>
                <th className="p-4 font-bold">User Details</th>
                <th className="p-4 font-bold">Amount</th>
                <th className="p-4 font-bold">Account Info</th>
                <th className="p-4 pr-6 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#162749]/50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-[#00D2FF] font-bold">Loading Page {currentPage}...</td></tr>
              ) : dbRequests.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-[#6C84A3] font-medium tracking-tight">No requests found in {activeAdminTab}.</td></tr>
              ) : (
                dbRequests.map((req) => (
                  <tr key={req._id} className="hover:bg-[#030816] transition-colors">
                    {(activeAdminTab !== "HISTORY") && (
                      <td className="p-4 pl-6"><input type="checkbox" checked={selectedIds.includes(req._id)} onChange={(e) => {
                        if (e.target.checked) setSelectedIds([...selectedIds, req._id]);
                        else setSelectedIds(selectedIds.filter(id => id !== req._id));
                      }} className="w-4 h-4 cursor-pointer" /></td>
                    )}
                    
                    <td className="p-4 pl-6">
                       <div className="font-mono text-[#60A5FA] font-bold text-xs">{req.wid || 'ZX-PENDING'}</div>
                       <div className="text-[10px] font-medium text-[#6C84A3] mt-0.5">{req.date || new Date(req.createdAt).toLocaleDateString()}</div>
                    </td>

                    <td className="p-4"><p className="font-bold text-[#F8FAFC]">{req.name}</p><p className="text-[10px] text-[#6C84A3]">{req.email}</p></td>
                    <td className="p-4 font-black text-[#00D2FF] text-lg">$ {req.amount}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                         <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white ${req.method === 'Binance' ? 'bg-[#00D2FF] text-[#030816]' : 'bg-[#162749]'}`}>{req.method}</span>
                         <span className="font-mono text-[#F8FAFC] font-medium">{req.accountNumber}</span>
                         <button onClick={() => copyToClipboard(req.accountNumber)} className="text-[#6C84A3] hover:text-[#00D2FF] transition-colors" title="Copy Number">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                         </button>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex flex-col items-end justify-center gap-1.5">
                         {/* 💥 Status Buttons 💥 */}
                         <div className="flex items-center justify-end gap-2">
                            {req.status === "PENDING" ? (
                              <>
                                <button onClick={() => handleAdminStatusUpdate(req._id, "PROCESSING", req.method)} className="bg-[#60A5FA]/10 text-[#60A5FA] hover:bg-[#60A5FA] hover:text-[#030816] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Process</button>
                                <button onClick={() => handleAdminStatusUpdate(req._id, "REJECTED", req.method)} className="text-[#F43F5E] hover:underline text-xs font-bold px-2">Reject</button>
                              </>
                            ) : req.status === "PROCESSING" ? (
                              <>
                                  <button 
                                     onClick={() => handleAdminStatusUpdate(req._id, "PAID", req.method)} 
                                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        req.method === "Binance" 
                                          ? "bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] text-[#030816] shadow-lg border border-[#00D2FF]/50" 
                                          : "bg-[#00D2FF]/10 text-[#00D2FF] hover:bg-[#00D2FF] hover:text-[#030816]"
                                     }`}>
                                     {req.method === "Binance" ? "⚡ Auto Pay" : "Mark Paid"}
                                  </button>
                                  <button 
                                     onClick={() => handleAdminStatusUpdate(req._id, "REJECTED", req.method)} 
                                     className="text-[#F43F5E] bg-[#F43F5E]/10 hover:bg-[#F43F5E] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                     Reject
                                  </button>
                              </>
                            ) : (
                              <>
                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${req.status === 'PAID' ? 'bg-[#00D2FF]/20 text-[#00D2FF]' : 'bg-[#F43F5E]/20 text-[#F43F5E]'}`}>{req.status}</span>
                                <button onClick={() => handleAdminStatusUpdate(req._id, "PENDING", req.method)} className="text-[10px] text-[#60A5FA] hover:underline font-medium">Undo</button>
                              </>
                            )}
                         </div>
                         
                         {/* 💥 THE ROBOT BADGE (FIXED) 💥 */}
                         {req.adminNote && req.adminNote.includes("🤖") && (
                            <span className="text-[9px] font-bold text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded border border-[#00D2FF]/30 mt-1">
                               🤖 Auto-Approved
                            </span>
                         )}
                         {/* 💥 ADMIN ERROR NOTE (FIXED) 💥 */}
                         {req.adminNote && !req.adminNote.includes("🤖") && !req.adminNote.includes("Auto Paid") && req.status !== "PENDING" && req.status !== "PAID" && (
                            <span className="text-[8px] font-medium text-[#F43F5E] max-w-[150px] truncate" title={req.adminNote}>
                               {req.adminNote}
                            </span>
                         )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {totalPages > 1 && (
            <div className="p-4 border-t border-[#162749] bg-[#030816]/50 flex items-center justify-between">
               <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-[#101726] text-white text-xs font-bold rounded-lg border border-[#162749] disabled:opacity-50 hover:bg-[#162749] transition-colors">
                 ← Previous
               </button>
               <span className="text-xs font-semibold text-[#6C84A3]">
                 Page <span className="text-white">{currentPage}</span> of {totalPages}
               </span>
               <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-[#101726] text-white text-xs font-bold rounded-lg border border-[#162749] disabled:opacity-50 hover:bg-[#162749] transition-colors">
                 Next →
               </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}