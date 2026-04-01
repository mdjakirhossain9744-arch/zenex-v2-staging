"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout"; 

export default function Payment() {
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("user"); 
  const [balance, setBalance] = useState("0.00");
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // 💥 গ্লোবাল এবং মেথড কন্ট্রোলার 💥
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(true);
  const [methodConfig, setMethodConfig] = useState({
    bKash: true, Nagad: true, Rocket: true, Binance: true, TRC20: true
  });

  const [dbRequests, setDbRequests] = useState<any[]>([]);

  // 💥 Admin Filter States 💥
  const [activeAdminTab, setActiveAdminTab] = useState("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("ALL");

  const [selectedMethod, setSelectedMethod] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const paymentOptions = [
    { id: "bKash", type: "bKash", icon: "৳", color: "text-[#E2136E]" },
    { id: "Nagad", type: "Nagad", icon: "৳", color: "text-[#F7931E]" },
    { id: "Rocket", type: "Rocket", icon: "৳", color: "text-[#8C3494]" },
    { id: "Binance", type: "Binance", icon: "₿", color: "text-[#FCD535]" },
    { id: "TRC20", type: "TRC20", icon: "₮", color: "text-[#26A17B]" },
  ];

  // ==========================================
  // 🔄 INITIAL LOAD & AUTO-SYNC (Magic)
  // ==========================================
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setRole(parsed.role || "user");
      setUserEmail(parsed.email);
      setUserName(parsed.name || parsed.fullName);
      fetchRealData(parsed.email, parsed.role);
    }
    
    // পেজ লোড হলে একবার সেটিংস আনবে
    fetchPaymentSettings();

    // 💥 ম্যাজিক: প্রতি ১০ সেকেন্ড পরপর ব্যাকগ্রাউন্ডে চেক করবে এডমিন অফ করল কি না 💥
    const syncSettings = setInterval(() => {
      fetchPaymentSettings();
    }, 10000);

    return () => clearInterval(syncSettings);
  }, []);

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch("/api/payment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FETCH" })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setIsWithdrawOpen(data.data.isWithdrawOpen);
        setMethodConfig(data.data.methods);
      }
    } catch (err) {
      console.log("Failed to load settings");
    }
  };

  const fetchRealData = async (email: string, userRole: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FETCH", email, role: userRole })
      });
      const data = await res.json();
      if (data.success) {
        setDbRequests(data.data.reverse());
      }

      if (userRole !== "admin") {
         const userRes = await fetch("/api/get-user-details", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ email })
         });
         const userData = await userRes.json();
         if (userData.user) setBalance(userData.user.balance.toFixed(2));
      }
    } catch (error) {
      console.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // ==========================================
  // 📊 Admin Stats Calculation 
  // ==========================================
  const totalUsersRequested = dbRequests.length;
  const totalAmountRequested = dbRequests.reduce((sum, req) => sum + Number(req.amount), 0);
  const totalAmountPaid = dbRequests.filter(r => r.status === "PAID").reduce((sum, req) => sum + Number(req.amount), 0);
  const totalAmountPending = dbRequests.filter(r => r.status === "PENDING").reduce((sum, req) => sum + Number(req.amount), 0);

  // 💥 Smart Filtering Logic 💥
  const displayedRequests = dbRequests.filter(req => {
    if (activeAdminTab === "PENDING" && req.status !== "PENDING") return false;
    if (activeAdminTab === "HISTORY" && req.status === "PENDING") return false;

    const q = searchQuery.toLowerCase();
    if (q && !req.name?.toLowerCase().includes(q) && !req.email?.toLowerCase().includes(q) && !req.accountNumber?.toLowerCase().includes(q)) {
      return false;
    }

    if (timeFilter !== "ALL") {
      const reqDate = new Date(req.createdAt || req.date || Date.now());
      const diffDays = Math.ceil(Math.abs(Date.now() - reqDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (timeFilter === "TODAY" && diffDays > 1) return false;
      if (timeFilter === "7DAYS" && diffDays > 7) return false;
      if (timeFilter === "30DAYS" && diffDays > 30) return false;
    }

    return true;
  });

  // ==========================================
  // 👑 ADMIN ACTIONS
  // ==========================================
  const toggleGlobalWithdraw = async () => {
    const newState = !isWithdrawOpen;
    setIsWithdrawOpen(newState);
    showToast(newState ? "Withdrawal System OPENED Globally!" : "Withdrawal System CLOSED Globally!");
    
    await fetch("/api/payment-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE", isWithdrawOpen: newState, methods: methodConfig })
    });
  };

  const toggleSpecificMethod = async (method: keyof typeof methodConfig) => {
    const updated = { ...methodConfig, [method]: !methodConfig[method] };
    setMethodConfig(updated);
    showToast(`${method} is now ${updated[method] ? 'ON' : 'OFF'} Globally`);

    await fetch("/api/payment-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE", isWithdrawOpen, methods: updated })
    });
  };

  const handleAdminStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_STATUS", withdrawId: id, newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Payment marked as ${newStatus}!`);
        fetchRealData(userEmail, role);
      }
    } catch (error) {
      showToast("Error updating status.");
    }
  };

  // ==========================================
  // 👤 USER ACTION: SUBMIT WITHDRAW
  // ==========================================
  const handleWithdrawSubmit = async () => {
    if (!isWithdrawOpen) return showToast("Withdrawals are closed by Admin!");
    if (!selectedMethod) return showToast("Please select a payment method.");
    if (!accountNumber.trim()) return showToast(`Please enter your ${selectedMethod} Account/Address.`);
    
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 100) return showToast("Minimum withdraw is ৳ 100.00");
    if (amount > parseFloat(balance)) return showToast("Insufficient balance!");

    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          email: userEmail,
          name: userName,
          role: role,
          amount: amount,
          method: selectedMethod,
          accountNumber: accountNumber
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast("Withdraw request submitted!");
        setWithdrawAmount("");
        setAccountNumber("");
        setSelectedMethod("");
        fetchRealData(userEmail, role); 
      } else {
        showToast(data.message);
      }
    } catch (error) {
      showToast("Server error! Try again.");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full relative z-10 pb-20 font-sans">
        
        {toastMessage && (
          <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#10B981] text-white px-5 py-3 rounded-lg shadow-2xl font-bold flex items-center gap-3 animate-bounce-in border border-[#10B981]/50">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             {toastMessage}
          </div>
        )}

        {role === "admin" ? (
          /* ==========================================
             👑 ADMIN VIEW
          ========================================== */
          <div className="w-full">
            <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Withdrawal Management</h2>
                <p className="text-[#94A3B8] mt-1 text-sm font-medium">Control payment gates and process requests.</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 bg-[#0F172A] p-2 rounded-2xl border border-[#334155]">
                <div className="flex items-center gap-3 px-4 py-1 border-r border-[#334155]">
                   <span className="text-[10px] text-[#94A3B8] uppercase font-black">Main System</span>
                   <button onClick={toggleGlobalWithdraw} className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${isWithdrawOpen ? 'bg-[#10B981]' : 'bg-[#F43F5E]'}`}>
                     <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isWithdrawOpen ? 'translate-x-6' : 'translate-x-0'}`}></div>
                   </button>
                </div>
                
                {Object.keys(methodConfig).map((mKey) => (
                  <div key={mKey} className="flex items-center gap-2 px-2 py-1">
                    <span className="text-xs font-bold text-[#E2E8F0]">{mKey}</span>
                    <button onClick={() => toggleSpecificMethod(mKey as keyof typeof methodConfig)} className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${methodConfig[mKey as keyof typeof methodConfig] ? 'bg-[#3B82F6]' : 'bg-[#334155]'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-transform ${methodConfig[mKey as keyof typeof methodConfig] ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#3B82F6]">
                <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1">Total Requests</p>
                <p className="text-2xl font-black text-white">{totalUsersRequested}</p>
              </div>
              <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#EAB308]">
                <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1">Pending Amount</p>
                <p className="text-2xl font-black text-[#EAB308]">৳ {totalAmountPending.toFixed(2)}</p>
              </div>
              <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#10B981]">
                <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1">Total Paid</p>
                <p className="text-2xl font-black text-[#10B981]">৳ {totalAmountPaid.toFixed(2)}</p>
              </div>
              <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#8B5CF6]">
                <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1">Total Requested</p>
                <p className="text-2xl font-black text-white">৳ {totalAmountRequested.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-[#1E293B]/80 p-4 rounded-2xl border border-[#334155]">
               <div className="flex items-center gap-2 bg-[#0F172A] p-1.5 rounded-xl border border-[#334155]">
                 <button onClick={() => setActiveAdminTab("PENDING")} className={`px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-black transition-all ${activeAdminTab === "PENDING" ? "bg-[#3B82F6] text-white shadow-md" : "text-[#64748B] hover:text-white"}`}>
                   Live Pending
                 </button>
                 <button onClick={() => setActiveAdminTab("HISTORY")} className={`px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-black transition-all ${activeAdminTab === "HISTORY" ? "bg-[#3B82F6] text-white shadow-md" : "text-[#64748B] hover:text-white"}`}>
                   Resolved History
                 </button>
               </div>

               <div className="flex w-full md:w-auto items-center gap-3">
                 <input 
                   type="text" 
                   placeholder="Search user or account..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full md:w-64 bg-[#0F172A] border border-[#334155] text-white text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-[#3B82F6]"
                 />
                 <select 
                   value={timeFilter} 
                   onChange={(e) => setTimeFilter(e.target.value)}
                   className="bg-[#0F172A] border border-[#334155] text-white text-sm font-bold px-4 py-2.5 rounded-xl focus:outline-none focus:border-[#3B82F6]"
                 >
                   <option value="ALL">All Time</option>
                   <option value="TODAY">Today</option>
                   <option value="7DAYS">Last 7 Days</option>
                   <option value="30DAYS">This Month</option>
                 </select>
               </div>
            </div>

            <div className="bg-[#1E293B]/80 border border-[#334155] rounded-2xl shadow-lg overflow-x-auto min-h-[300px]">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-[#0F172A]/50 text-[#94A3B8] uppercase text-[10px] tracking-widest border-b border-[#334155]">
                  <tr>
                    <th className="p-4 pl-6 font-black">Date</th>
                    <th className="p-4 font-black">User Details</th>
                    <th className="p-4 font-black">Amount</th>
                    <th className="p-4 font-black">Method & Account Info</th>
                    <th className="p-4 pr-6 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/50">
                  {loading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-[#3B82F6] font-bold">Loading Database...</td></tr>
                  ) : displayedRequests.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-[#64748B] font-bold">No requests found matching your filter.</td></tr>
                  ) : (
                    displayedRequests.map((req) => (
                      <tr key={req._id} className={`transition-colors ${req.status !== "PENDING" ? 'bg-[#0F172A]/40 opacity-70' : 'hover:bg-[#334155]/20'}`}>
                        <td className="p-4 pl-6"><span className="text-xs font-black text-[#94A3B8] bg-[#334155]/50 px-2 py-1 rounded">{req.date || new Date(req.createdAt).toLocaleDateString()}</span></td>
                        <td className="p-4">
                          <p className="font-bold text-[#E2E8F0]">{req.name}</p>
                          <p className="text-[10px] text-[#64748B]">{req.email}</p>
                        </td>
                        <td className="p-4 font-black text-[#10B981] text-lg">৳ {req.amount}</td>
                        <td className="p-4">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded mr-2 bg-[#334155] text-white">{req.method}</span>
                          <span className="font-mono text-[#A855F7] font-bold tracking-wider">{req.accountNumber}</span>
                        </td>
                        
                        <td className="p-4 pr-6 text-right space-x-2">
                          {req.status === "PENDING" ? (
                            <>
                              <button onClick={() => handleAdminStatusUpdate(req._id, "PAID")} className="bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981] hover:text-white px-4 py-1.5 rounded-lg text-xs font-black transition-colors border border-[#10B981]/30">Paid</button>
                              <button onClick={() => handleAdminStatusUpdate(req._id, "REJECTED")} className="bg-[#F43F5E]/10 text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white px-4 py-1.5 rounded-lg text-xs font-black transition-colors border border-[#F43F5E]/30">Reject</button>
                            </>
                          ) : (
                            <div className="flex items-center justify-end gap-3">
                              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${req.status === 'PAID' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#F43F5E]/20 text-[#F43F5E]'}`}>{req.status}</span>
                              <button onClick={() => handleAdminStatusUpdate(req._id, "PENDING")} className="text-[10px] text-[#3B82F6] hover:text-[#3B82F6] underline font-bold">Undo</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ==========================================
             👤 USER / AGENT VIEW
          ========================================== */
          <>
            {!isWithdrawOpen && (
              <div className="bg-[#F43F5E]/10 border border-[#F43F5E]/30 rounded-2xl p-5 mb-8 flex items-start gap-4">
                 <div className="p-3 bg-[#F43F5E]/20 text-[#F43F5E] rounded-xl"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                 <div>
                   <h3 className="text-[#F43F5E] font-black text-lg">Withdrawals are Currently Offline</h3>
                   <p className="text-[#E2E8F0] text-sm mt-1">The system admin has temporarily paused all withdrawal requests.</p>
                 </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className={`flex flex-col gap-6 ${!isWithdrawOpen ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="bg-[#1E293B]/80 border border-[#334155] p-8 rounded-3xl shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
                     <span className="text-sm font-black text-[#94A3B8] uppercase tracking-widest mb-2">Available Balance</span>
                     <span className="text-5xl font-black text-white tracking-tight drop-shadow-md">৳ {balance}</span>
                  </div>

                  <div className="bg-[#1E293B]/80 border border-[#334155] p-6 rounded-3xl shadow-lg">
                     <label className="block text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-4">Select Payment Gate</label>
                     <div className="grid grid-cols-2 gap-3 mb-6">
                       {paymentOptions.filter(m => methodConfig[m.id as keyof typeof methodConfig]).map(method => (
                          <div key={method.id} onClick={() => setSelectedMethod(method.id)} className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${selectedMethod === method.id ? 'border-[#3B82F6] bg-[#3B82F6]/10' : 'border-[#334155] bg-[#0F172A] hover:border-[#64748B]'}`}>
                             <div className={`w-8 h-8 rounded-md flex items-center justify-center font-black ${method.color} bg-[#1E293B]`}>{method.icon}</div>
                             <span className="text-sm font-bold text-white">{method.type}</span>
                          </div>
                       ))}
                     </div>

                     {selectedMethod && (
                       <div className="mb-6 animate-fade-in">
                          <label className="block text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-2">
                            Enter your {selectedMethod} Number/Address
                          </label>
                          <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder={`e.g. 017XXXXXX / TXa1b2...`} className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-[#3B82F6] transition-all" />
                       </div>
                     )}

                     <div className="mb-6">
                        <label className="flex justify-between text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-2">
                          <span>Withdraw Amount</span> <span className="text-[#F43F5E]">Min: ৳ 100</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-[#64748B]">৳</span>
                          <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="100.00" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl pl-10 pr-20 py-4 text-white text-xl font-black focus:outline-none focus:border-[#10B981] transition-all" />
                          <button onClick={() => setWithdrawAmount(balance)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#334155] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#3B82F6] transition-colors">MAX</button>
                        </div>
                     </div>

                     <button onClick={handleWithdrawSubmit} disabled={!selectedMethod || parseFloat(withdrawAmount) < 100} className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-black text-lg py-4 rounded-xl transition-all disabled:opacity-50">
                       SUBMIT REQUEST
                     </button>
                  </div>
               </div>

               <div className="bg-[#1E293B]/80 border border-[#334155] rounded-3xl shadow-lg flex flex-col h-[650px]">
                  <div className="p-6 border-b border-[#334155] bg-[#0F172A]/50">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">My Recent Transactions</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                     {dbRequests.length === 0 ? (
                       <p className="text-[#64748B] text-center font-bold mt-10">No history found.</p>
                     ) : (
                       dbRequests.map((item) => (
                         <div key={item._id} className="bg-[#0F172A] border border-[#334155] p-4 rounded-xl mb-4 flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-bold text-white flex items-center gap-2">
                                {item.method} 
                                <span className="text-[9px] text-[#64748B] font-normal">{item.date || new Date(item.createdAt).toLocaleDateString()}</span>
                              </span>
                              <span className="text-[10px] text-[#A855F7] font-mono">{item.accountNumber}</span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-lg font-black text-white">৳ {item.amount}</span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${item.status === "PENDING" ? "bg-[#EAB308]/10 text-[#EAB308]" : item.status === "PAID" ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#F43F5E]/10 text-[#F43F5E]"}`}>{item.status}</span>
                            </div>
                         </div>
                       ))
                     )}
                  </div>
               </div>
            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
}