"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout"; 
import { useRouter } from "next/navigation";
// 🔥 The Boss Fix: Importing the Validation Engine in Frontend
import { validateSolanaAddress } from "../lib/binance"; 

export default function UserWithdrawal() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("user"); 
  const [balance, setBalance] = useState("0.00");
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(true);
  const [isManualWithdrawOpen, setIsManualWithdrawOpen] = useState(true); 
  const [binanceAutoPayActive, setBinanceAutoPayActive] = useState(true); 
  const [methodConfig, setMethodConfig] = useState({ bKash: true, Nagad: true, Rocket: true, Binance: true, TRC20: true });
  
  const [dbRequests, setDbRequests] = useState<any[]>([]);

  const [selectedMethod, setSelectedMethod] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPin, setWithdrawPin] = useState("");

  const [savedBinanceId, setSavedBinanceId] = useState("");
  const [isAutoWithdrawOn, setIsAutoWithdrawOn] = useState(false);
  const [isSavingAuto, setIsSavingAuto] = useState(false);
  const [autoPayPin, setAutoPayPin] = useState(""); 

  const paymentOptions = [
    { id: "bKash", type: "bKash", icon: "৳", color: "text-[#E2136E]" },
    { id: "Nagad", type: "Nagad", icon: "৳", color: "text-[#F7931E]" },
    { id: "Rocket", type: "Rocket", icon: "৳", color: "text-[#8C3494]" },
    { id: "Binance", type: "Binance", icon: "⚡", color: "text-[#FCD535]" },
  ];

  const minWithdrawAmount = selectedMethod === "Binance" ? 50 : 100;

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed.role === "admin") {
         router.push("/admin/payments"); 
         return;
      }
      setRole(parsed.role || "user");
      setUserEmail(parsed.email);
      setUserName(parsed.name || parsed.fullName);
      fetchRealData(parsed.email, parsed.role);
    }
    
    fetchPaymentSettings();
    const syncSettings = setInterval(() => { fetchPaymentSettings(); }, 10000);
    return () => clearInterval(syncSettings);
  }, [router]);

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch("/api/payment-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH" }) });
      const data = await res.json();
      if (data.success && data.data) {
        setIsWithdrawOpen(data.data.isWithdrawOpen);
        setIsManualWithdrawOpen(data.data.isManualWithdrawOpen ?? true); 
        setBinanceAutoPayActive(data.data.binanceAutoPayActive ?? true); 
        setMethodConfig(data.data.methods);
      }
    } catch (err) {}
  };

  const fetchRealData = async (email: string, userRole: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH", email, role: userRole }) });
      const data = await res.json();
      if (data.success) setDbRequests(data.data);

      const userRes = await fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const userData = await userRes.json();
      if (userData.user) {
         setBalance(userData.user.balance.toFixed(2));
         setSavedBinanceId(userData.user.binancePayId || "");
         setIsAutoWithdrawOn(userData.user.isAutoWithdraw || false);
      }
    } catch (error) {} finally { setLoading(false); }
  };

  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(""), 5000); };

  const handleSaveAutoSettings = async () => {
    if (!savedBinanceId.trim()) return showToast("Please enter a valid USDT (Solana) Address.");
    if (!autoPayPin.trim() || autoPayPin.length < 4) return showToast("Enter your 4-digit Security PIN to save!");

    // 🔥 THE BOSS FIX: Pre-flight Address Validation for Auto-Pay
    const addressCheck = validateSolanaAddress(savedBinanceId);
    if (!addressCheck.isValid) {
        return showToast(addressCheck.message);
    }

    setIsSavingAuto(true);
    try {
       const res = await fetch("/api/get-user-details", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "UPDATE_AUTO_PAY", email: userEmail, binancePayId: savedBinanceId, isAutoWithdraw: isAutoWithdrawOn, withdrawPin: autoPayPin })
       });
       const data = await res.json();
       if (data.success) {
           showToast("✅ Auto-Pay Settings Saved Successfully!");
           setAutoPayPin(""); 

           if (isAutoWithdrawOn) {
               showToast("Syncing Auto-Pay Engine...");
               try {
                   await fetch("/api/sync-orders"); 
                   setTimeout(() => { fetchRealData(userEmail, role); }, 2000);
               } catch (syncErr) {}
           }
       } else { 
           showToast(data.message || "Failed to save settings. Check your PIN."); 
       }
    } catch (err) { showToast("Server Error!"); } finally { setIsSavingAuto(false); }
  };

  const handleWithdrawSubmit = async () => {
    if (!isWithdrawOpen) return showToast("Withdrawals are closed by Admin!");
    if (!isManualWithdrawOpen) return showToast("Manual Withdrawals are currently paused.");
    if (!selectedMethod) return showToast("Please select a payment method.");
    if (!accountNumber.trim()) return showToast(`Please enter your ${selectedMethod} Account/Address.`);
    
    // 🔥 THE BOSS FIX: Pre-flight Address Validation for Manual Withdraw
    if (selectedMethod === "Binance") {
        const addressCheck = validateSolanaAddress(accountNumber);
        if (!addressCheck.isValid) {
            return showToast(addressCheck.message);
        }
    }

    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < minWithdrawAmount) return showToast(`Minimum withdraw is ৳ ${minWithdrawAmount}`);
    if (amount > parseFloat(balance)) return showToast("Insufficient balance!");
    if (!withdrawPin.trim()) return showToast("Please enter your 4-digit Withdraw PIN.");

    try {
      const res = await fetch("/api/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "CREATE", email: userEmail, name: userName, role: role, amount: amount, 
          method: selectedMethod, accountNumber: accountNumber, withdrawPin: withdrawPin 
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast("✅ Withdraw request submitted!");
        setWithdrawAmount(""); setAccountNumber(""); setSelectedMethod(""); setWithdrawPin("");
        fetchRealData(userEmail, role); 
      } else { showToast(data.message); }
    } catch (error) { showToast("Server error! Try again."); }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full relative z-10 pb-20 font-sans">
        {toastMessage && (
          <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#10B981] text-white px-5 py-3 rounded-lg shadow-2xl font-bold flex items-center gap-3 animate-bounce-in border border-[#10B981]/50 max-w-sm">
             <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             <span className="text-xs">{toastMessage}</span>
          </div>
        )}

        {!isWithdrawOpen && (
          <div className="bg-[#F43F5E]/10 border border-[#F43F5E]/30 rounded-2xl p-5 mb-8 flex items-start gap-4">
             <div className="p-3 bg-[#F43F5E]/20 text-[#F43F5E] rounded-xl"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
             <div>
               <h3 className="text-[#F43F5E] font-black text-lg">All Withdrawals Offline</h3>
               <p className="text-[#E2E8F0] text-sm mt-1">The system admin has temporarily paused ALL withdrawal requests.</p>
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className={`flex flex-col gap-6 ${!isWithdrawOpen ? 'opacity-50 pointer-events-none' : ''}`}>
              
              <div className="bg-[#1E293B]/80 border border-[#334155] p-8 rounded-3xl shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
                 <span className="text-sm font-black text-[#94A3B8] uppercase tracking-widest mb-2">Available Balance</span>
                 <span className="text-5xl font-black text-white tracking-tight drop-shadow-md">৳ {balance}</span>
              </div>

              {/* 💥 SMART BINANCE AUTO-PAY SETUP BOX 💥 */}
              <div className="bg-gradient-to-br from-[#1E293B]/80 to-[#F59E0B]/5 border border-[#F59E0B]/30 p-6 rounded-3xl shadow-[0_0_15px_rgba(245,158,11,0.05)] relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B] opacity-10 rounded-full blur-2xl"></div>
                 
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                       <div className="bg-[#F59E0B] p-2 rounded-lg"><svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0l-3.33 5.77h6.66L12 0zm-4.7 8.16L4 13.88l3.3 5.76h6.66l3.3-5.76-3.3-5.72H7.3zm4.7 2.3l1.83 3.16h-3.66L12 10.46zM20 13.88l-3.3 5.76h6.66l-3.3-5.76zm-8 10.12l3.33-5.77h-6.66L12 24z"/></svg></div>
                       <div>
                          <h3 className="text-lg font-black text-white">Binance Auto-Pay</h3>
                          <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest">Get paid instantly at 150 TK</p>
                       </div>
                    </div>
                 </div>

                 {!binanceAutoPayActive ? (
                   <div className="bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E] p-4 rounded-xl text-center font-bold text-sm">
                      ⚠️ Auto-Pay Engine is temporarily paused by Admin.
                   </div>
                 ) : (
                   <>
                     <div className="mb-4">
                        <label className="block text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-2">Binance USDT (Solana/SOL) Address</label>
                        <input type="text" value={savedBinanceId} onChange={(e) => setSavedBinanceId(e.target.value)} placeholder="e.g. HN7cAB... (Must be Solana Network)" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-[#F59E0B] transition-all" />
                     </div>

                     <div className="flex items-center justify-between mb-4 bg-[#0F172A] p-3 rounded-xl border border-[#334155]">
                        <span className="text-xs font-bold text-[#E2E8F0]">Auto-Withdraw at 150 TK</span>
                        <button onClick={() => setIsAutoWithdrawOn(!isAutoWithdrawOn)} className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${isAutoWithdrawOn ? 'bg-[#10B981]' : 'bg-[#334155]'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isAutoWithdrawOn ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                     </div>

                     <div className="mb-5">
                        <label className="block text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-2">Security PIN to Save</label>
                        <input 
                           type="password" maxLength={4} value={autoPayPin} 
                           onChange={(e) => setAutoPayPin(e.target.value.replace(/\D/g, ''))}
                           placeholder="****" 
                           className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white text-xl font-black tracking-[1em] text-center focus:outline-none focus:border-[#F59E0B] transition-all" 
                        />
                     </div>

                     <button onClick={handleSaveAutoSettings} disabled={isSavingAuto || !autoPayPin || autoPayPin.length < 4} className="w-full bg-[#0F172A] border border-[#F59E0B]/50 hover:bg-[#F59E0B]/10 text-[#F59E0B] font-black text-sm py-3 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                       {isSavingAuto ? "SAVING..." : "SAVE AUTO-PAY SETTINGS"}
                     </button>
                   </>
                 )}
              </div>

              {/* 💥 MANUAL WITHDRAW BOX 💥 */}
              <div className="bg-[#1E293B]/80 border border-[#334155] p-6 rounded-3xl shadow-lg relative overflow-hidden">
                 
                 {!isManualWithdrawOpen && (
                   <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#0F172A]/80 backdrop-blur-[2px] transition-all duration-500">
                     <div className="bg-[#F43F5E]/20 p-4 rounded-full mb-3 shadow-[0_0_25px_rgba(244,63,94,0.5)]">
                       <svg className="w-8 h-8 text-[#F43F5E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                       </svg>
                     </div>
                     <span className="bg-[#F43F5E] text-white font-black px-6 py-2 rounded-xl text-sm uppercase tracking-widest shadow-lg border border-[#F43F5E]">
                       Manual Payouts Paused
                     </span>
                   </div>
                 )}

                 <div className={`${!isManualWithdrawOpen ? 'opacity-40 pointer-events-none select-none' : ''} transition-all duration-500`}>
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-[#94A3B8] uppercase tracking-widest">Manual Withdraw</h3>
                        <span className="text-[10px] bg-[#1E293B] border border-[#334155] text-[#10B981] px-2 py-1 rounded font-bold">1 Hr Cooldown Active</span>
                     </div>
                     
                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                       {paymentOptions.map(method => {
                          const isActive = methodConfig[method.id as keyof typeof methodConfig];
                          
                          return (
                            <div 
                              key={method.id} 
                              onClick={() => {
                                 if (isActive) setSelectedMethod(method.id);
                                 else showToast(`⚠️ ${method.type} is currently Offline by Admin.`);
                              }} 
                              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 
                                ${isActive ? 'cursor-pointer' : 'cursor-not-allowed opacity-40 grayscale'} 
                                ${selectedMethod === method.id ? 'border-[#3B82F6] bg-[#3B82F6]/10' : 'border-[#334155] bg-[#0F172A] hover:border-[#64748B]'}`
                              }
                            >
                               <span className="text-[10px] font-bold text-white uppercase">{method.type}</span>
                               {!isActive && <span className="text-[8px] font-black text-[#F43F5E] tracking-widest mt-0.5">OFFLINE</span>}
                            </div>
                          );
                       })}
                     </div>

                     {selectedMethod && (
                       <div className="mb-6 animate-fade-in">
                          <label className="block text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-2">Enter your {selectedMethod} {selectedMethod === "Binance" ? "USDT (Solana) Address" : "Number"}</label>
                          <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder={selectedMethod === "Binance" ? "e.g. HN7cABqLq46..." : "e.g. 017XXXXXX"} className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-[#3B82F6] transition-all" />
                       </div>
                     )}

                     <div className="mb-6">
                        <label className="flex justify-between text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-2">
                          <span>Withdraw Amount</span> <span className="text-[#F43F5E]">Min: ৳ {minWithdrawAmount}</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-[#64748B]">৳</span>
                          <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder={`${minWithdrawAmount}.00`} className="w-full bg-[#0F172A] border border-[#334155] rounded-xl pl-10 pr-20 py-4 text-white text-xl font-black focus:outline-none focus:border-[#10B981] transition-all" />
                          <button onClick={() => setWithdrawAmount(balance)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#334155] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#3B82F6] transition-colors">MAX</button>
                        </div>
                     </div>

                     <div className="mb-6">
                        <label className="flex justify-between text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-2">
                          <span>Security PIN</span>
                        </label>
                        <input 
                          type="password" maxLength={4} value={withdrawPin} 
                          onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="****" 
                          className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-4 text-white text-xl font-black tracking-[1em] text-center focus:outline-none focus:border-[#3B82F6] transition-all" 
                        />
                     </div>

                     <button onClick={handleWithdrawSubmit} disabled={!selectedMethod || parseFloat(withdrawAmount) < minWithdrawAmount || !withdrawPin} className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white font-black text-sm py-4 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.3)] tracking-widest">
                       SUBMIT MANUAL REQUEST
                     </button>
                 </div>
              </div>
           </div>

           {/* 💥 SLIM & MINIMAL PREMIUM WITHDRAWAL HISTORY 💥 */}
           <div className="bg-[#1E293B]/80 border border-[#334155] rounded-3xl shadow-lg flex flex-col h-[650px] lg:h-auto">
              <div className="p-5 border-b border-[#334155] bg-[#0F172A]/50 shrink-0">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">My Recent Transactions</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                 {dbRequests.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 text-[#64748B]">
                      <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <p className="font-bold text-sm">No history found.</p>
                   </div>
                 ) : (
                   dbRequests.map((item) => (
                     <div key={item._id} className="bg-[#0F172A]/80 border-b border-[#334155]/60 hover:bg-[#1E293B] hover:border-[#3B82F6]/40 transition-colors rounded-lg mb-2 p-3 flex flex-col gap-1.5 group cursor-default">
                        
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-1.5 md:gap-2">
                              <span className="text-[11px] md:text-xs font-black text-white">{item.method}</span>
                              <span className="text-[9px] md:text-[10px] text-[#A855F7] font-mono truncate max-w-[120px] sm:max-w-[180px]" title={item.accountNumber}>
                                 {item.accountNumber}
                              </span>
                           </div>
                           <div className="flex items-center gap-2">
                              <span className="text-xs md:text-sm font-black text-white">৳{item.amount}</span>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                                 item.status === "PENDING" || item.status === "PROCESSING" ? "bg-[#EAB308]/10 text-[#EAB308] border border-[#EAB308]/20" : 
                                 item.status === "PAID" ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20" : 
                                 "bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/20"
                              }`}>
                                 {item.status}
                              </span>
                           </div>
                        </div>
                        
                        <div className="flex justify-between items-center border-t border-[#334155]/30 pt-1.5 mt-0.5">
                           <div className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-bold text-[#64748B]">
                              <span className="text-[#94A3B8] font-mono tracking-widest">{item.wid || "ZX-PENDING"}</span>
                              <span>•</span>
                              <span>{item.date || new Date(item.createdAt).toLocaleDateString()}</span>
                           </div>
                           <div className={`text-[8px] md:text-[9px] font-bold truncate max-w-[140px] sm:max-w-[200px] ${item.status === 'REJECTED' ? 'text-red-400' : item.status === 'PAID' ? 'text-green-400' : 'text-slate-400'}`} title={item.adminNote}>
                              {item.adminNote || (item.status === 'PENDING' ? "Processing..." : "")}
                           </div>
                        </div>
                        
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}