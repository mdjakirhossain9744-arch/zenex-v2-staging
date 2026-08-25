"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// 🔥 The Boss Fix: Importing the Validation Engine in Frontend
import { validateSolanaAddress } from "../../lib/binance"; 

export default function UserWithdrawal() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("user"); 
  // 💥 THE GREAT USDT MIGRATION: 4-Decimal Balance 💥
  const [balance, setBalance] = useState("0.0000");
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

  // 💥 VIEW DETAILS MODAL STATE 💥
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const paymentOptions = [
    { id: "bKash", type: "bKash", icon: "$" },
    { id: "Nagad", type: "Nagad", icon: "$" },
    { id: "Rocket", type: "Rocket", icon: "$" },
    { id: "Binance", type: "Binance", icon: "⚡" },
  ];

  // 💥 THE GREAT USDT MIGRATION: 0.50 for Binance, 1.00 for Others 💥
  const minWithdrawAmount = selectedMethod === "Binance" ? 0.50 : 1.00;

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
         setBalance(userData.user.balance.toFixed(4));
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
               showToast("Syncing Automated Settlement Engine...");
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
    if (!amount || amount < minWithdrawAmount) return showToast(`Minimum withdraw is $ ${minWithdrawAmount.toFixed(4)}`);
    if (amount > parseFloat(balance)) return showToast("Insufficient liquidity!");
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
        showToast("✅ Settlement request submitted!");
        setWithdrawAmount(""); setAccountNumber(""); setSelectedMethod(""); setWithdrawPin("");
        fetchRealData(userEmail, role); 
      } else { showToast(data.message); }
    } catch (error) { showToast("Server error! Try again."); }
  };

  // 💥 TIME FORMATTER FOR VIEW MODAL 💥
  const formatTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  };

  return (
    <div className="p-4 md:p-8 w-full relative z-10 pb-20 font-sans min-h-screen">
      
      {/* 💥 GLOBAL NOTIFICATION 💥 */}
      {toastMessage && (
        <div className="fixed top-24 right-5 md:right-10 z-[100] bg-[#0B152A] border-l-4 border-[#00D2FF] text-[#F8FAFC] px-5 py-3 rounded shadow-[0_10px_40px_-10px_rgba(0,210,255,0.3)] font-semibold flex items-center gap-3 animate-bounce-in max-w-sm">
           <div className="w-6 h-6 bg-[#00D2FF]/10 rounded-full flex items-center justify-center border border-[#00D2FF]/20 shrink-0">
              <svg className="w-3.5 h-3.5 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
           </div>
           <span className="text-xs tracking-wide">{toastMessage}</span>
        </div>
      )}

      {/* 💥 SYSTEM OFFLINE WARNING 💥 */}
      {!isWithdrawOpen && (
        <div className="bg-[#F43F5E]/10 border border-[#F43F5E]/30 rounded-2xl p-5 mb-6 flex items-start gap-4">
           <div className="p-3 bg-[#F43F5E]/20 text-[#F43F5E] rounded-xl shrink-0"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
           <div>
             <h3 className="text-[#F43F5E] font-bold text-lg tracking-wide">Financial Engine Offline</h3>
             <p className="text-[#F8FAFC] text-sm mt-1 font-medium">The system administrator has temporarily suspended all network payouts.</p>
           </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] bg-clip-text text-transparent uppercase tracking-wider">
          Liquidity Management
        </h2>
        <p className="text-xs text-[#6C84A3] mt-1.5 font-medium tracking-wide">
          Manage your network earnings, automated settlements, and manual payouts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
         <div className={`flex flex-col gap-6 ${!isWithdrawOpen ? 'opacity-50 pointer-events-none' : ''}`}>
            
            {/* 💥 LIQUIDITY BALANCE CARD 💥 */}
            <div className="bg-[#0B152A] border border-[#162749] p-8 rounded-3xl shadow-[inset_0_1px_4px_rgba(0,210,255,0.02)] flex flex-col items-center justify-center relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] opacity-50 group-hover:opacity-100 transition-opacity"></div>
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#00D2FF] opacity-[0.03] rounded-full blur-3xl"></div>
               
               <span className="text-xs font-semibold text-[#6C84A3] uppercase tracking-widest mb-3">Available Liquidity</span>
               <div className="flex items-center gap-2">
                 {/* 💥 THE GREAT USDT MIGRATION: 4-Decimal Balance 💥 */}
                 <span className="text-5xl font-black text-[#F8FAFC] tracking-tighter drop-shadow-md">${balance}</span>
               </div>
            </div>

            {/* 💥 AUTOMATED SETTLEMENT (AUTO-PAY) ENGINE 💥 */}
            <div className="bg-[#0B152A] border border-[#162749] p-6 md:p-8 rounded-3xl shadow-[inset_0_1px_4px_rgba(0,210,255,0.02)] relative overflow-hidden">
               <div className="absolute top-0 left-0 w-[2px] h-full bg-[#00D2FF] shadow-[0_0_15px_#00D2FF]"></div>
               
               <div className="flex items-center justify-between mb-6 pl-2">
                  <div className="flex items-center gap-4">
                     <div className="bg-[#00D2FF]/10 border border-[#00D2FF]/30 p-2.5 rounded-xl shadow-[0_0_10px_rgba(0,210,255,0.1)]">
                        <svg className="w-5 h-5 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                     </div>
                     <div>
                        <h3 className="text-base font-bold text-[#F8FAFC] uppercase tracking-wide">Automated Settlement</h3>
                        {/* 💥 THE GREAT USDT MIGRATION: $2.00 Auto-Withdraw Text 💥 */}
                        <p className="text-[10px] text-[#60A5FA] uppercase tracking-widest font-semibold mt-1">Instant Payouts at $2.00</p>
                     </div>
                  </div>
               </div>

               {!binanceAutoPayActive ? (
                 <div className="bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E] p-4 rounded-xl text-center font-semibold text-xs tracking-wide">
                    ⚠️ Automated Settlement Engine is currently disabled by Admin.
                 </div>
               ) : (
                 <div className="pl-2">
                   {/* 💥 BOSS EYECATCHING WARNING: AUTO WITHDRAW 💥 */}
                   <div className="mb-5 bg-gradient-to-r from-[#101726] to-[#0B152A] p-4 rounded-xl border-l-4 border-l-[#F59E0B] border-t border-r border-b border-[#162749] shadow-md">
                     <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">💰</span>
                        <h4 className="text-xs font-bold text-[#F8FAFC] tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#FCD34D] to-[#F59E0B]">Conversion Rate: 1 USD = 110 TK</h4>
                     </div>
                     <div className="flex items-start gap-2 mt-2 pt-2 border-t border-[#162749]">
                        <span className="text-[#F43F5E] mt-0.5">⚠️</span>
                        <p className="text-[9px] md:text-[10px] text-[#6C84A3] font-medium leading-relaxed">
                          <strong className="text-[#F43F5E]">CRITICAL:</strong> You MUST use a <strong className="text-[#00D2FF]">Binance SOL (Solana) Address</strong>. 0% Fee from our side. If you use other wallets, the blockchain may deduct up to <strong className="text-[#F43F5E]">80% Network Fee</strong>. We are not responsible for lost funds due to wrong network usage!
                        </p>
                     </div>
                   </div>

                   <div className="mb-5">
                      <label className="block text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">USDT (Solana) Target Address</label>
                      <input type="text" value={savedBinanceId} onChange={(e) => setSavedBinanceId(e.target.value)} placeholder="e.g. HN7cAB... (Must be Solana Network)" className="w-full bg-[#101726] border border-[#162749] rounded-xl px-4 py-3 text-[#F8FAFC] font-mono text-sm focus:outline-none focus:border-[#00D2FF] transition-all placeholder:text-[#6C84A3]/50" />
                   </div>

                   <div className="flex items-center justify-between mb-5 bg-[#101726] p-3.5 rounded-xl border border-[#162749]">
                      <span className="text-xs font-bold text-[#F8FAFC] tracking-wide">Engage Auto-Withdraw at $2.00</span>
                      <button onClick={() => setIsAutoWithdrawOn(!isAutoWithdrawOn)} className={`relative w-12 h-6 rounded-full flex items-center p-1 transition-colors duration-300 ${isAutoWithdrawOn ? 'bg-[#00D2FF]' : 'bg-[#162749]'}`}>
                        <div className={`w-4 h-4 bg-[#F8FAFC] rounded-full transition-transform duration-300 shadow-md ${isAutoWithdrawOn ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                   </div>

                   <div className="mb-6">
                      <label className="block text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">Security Authorization PIN</label>
                      <input 
                         type="password" maxLength={4} value={autoPayPin} 
                         onChange={(e) => setAutoPayPin(e.target.value.replace(/\D/g, ''))}
                         placeholder="****" 
                         className="w-full bg-[#101726] border border-[#162749] rounded-xl px-4 py-3 text-[#F8FAFC] text-xl font-bold tracking-[1em] text-center focus:outline-none focus:border-[#00D2FF] transition-all" 
                      />
                   </div>

                   <button onClick={handleSaveAutoSettings} disabled={isSavingAuto || !autoPayPin || autoPayPin.length < 4} className="w-full bg-[#101726] border border-[#00D2FF]/40 hover:bg-[#00D2FF]/10 text-[#00D2FF] hover:text-[#00D2FF] font-bold text-xs py-3.5 rounded-xl uppercase tracking-widest transition-all disabled:opacity-50 shadow-[0_0_10px_rgba(0,210,255,0.05)]">
                     {isSavingAuto ? "SYNCING..." : "COMMIT AUTO-PAY SETTINGS"}
                   </button>
                 </div>
               )}
            </div>

            {/* 💥 MANUAL WITHDRAW BOX 💥 */}
            <div className="bg-[#0B152A] border border-[#162749] p-6 md:p-8 rounded-3xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] relative overflow-hidden">
               
               {!isManualWithdrawOpen && (
                 <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#030816]/80 backdrop-blur-[4px] transition-all duration-500">
                   <div className="bg-[#F43F5E]/10 p-4 rounded-full mb-4 border border-[#F43F5E]/30 shadow-[0_0_25px_rgba(244,63,94,0.3)]">
                     <svg className="w-8 h-8 text-[#F43F5E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                     </svg>
                   </div>
                   <span className="bg-[#F43F5E] text-[#030816] font-bold px-6 py-2 rounded-lg text-xs uppercase tracking-widest shadow-lg">
                     Manual Protocol Suspended
                   </span>
                 </div>
               )}

               <div className={`${!isManualWithdrawOpen ? 'opacity-30 pointer-events-none select-none' : ''} transition-all duration-500`}>
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-semibold text-[#F8FAFC] uppercase tracking-widest">Manual Payout</h3>
                      <span className="text-[9px] bg-[#101726] border border-[#162749] text-[#60A5FA] px-2 py-1 rounded font-semibold uppercase tracking-widest">1 Hr Cooldown</span>
                   </div>
                   
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                     {paymentOptions.map(method => {
                        const isActive = methodConfig[method.id as keyof typeof methodConfig];
                        
                        return (
                          <div 
                            key={method.id} 
                            onClick={() => {
                               if (isActive) setSelectedMethod(method.id);
                               else showToast(`⚠️ ${method.type} is offline in the network.`);
                            }} 
                            className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 
                              ${isActive ? 'cursor-pointer' : 'cursor-not-allowed opacity-40 grayscale'} 
                              ${selectedMethod === method.id ? 'border-[#00D2FF] bg-[#00D2FF]/10 shadow-[0_0_10px_rgba(0,210,255,0.1)]' : 'border-[#162749] bg-[#101726] hover:border-[#6C84A3]/50'}`
                            }
                          >
                             <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedMethod === method.id ? 'text-[#00D2FF]' : 'text-[#F8FAFC]'}`}>{method.type}</span>
                             {!isActive && <span className="text-[8px] font-bold text-[#F43F5E] tracking-widest mt-0.5">OFFLINE</span>}
                          </div>
                        );
                     })}
                   </div>

                   {/* 💥 BOSS EYECATCHING WARNING: MANUAL WITHDRAW (BINANCE ONLY) 💥 */}
                   {selectedMethod === "Binance" && (
                     <div className="mb-5 bg-gradient-to-r from-[#101726] to-[#0B152A] p-4 rounded-xl border-l-4 border-l-[#F59E0B] border-t border-r border-b border-[#162749] shadow-md animate-fade-in">
                       <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">💰</span>
                          <h4 className="text-xs font-bold text-[#F8FAFC] tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#FCD34D] to-[#F59E0B]">Conversion Rate: 1 USD = 110 TK</h4>
                       </div>
                       <div className="flex items-start gap-2 mt-2 pt-2 border-t border-[#162749]">
                          <span className="text-[#F43F5E] mt-0.5">⚠️</span>
                          <p className="text-[9px] md:text-[10px] text-[#6C84A3] font-medium leading-relaxed">
                            <strong className="text-[#F43F5E]">CRITICAL:</strong> You MUST use a <strong className="text-[#00D2FF]">Binance SOL (Solana) Address</strong>. 0% Fee from our side. If you use other wallets, the blockchain may deduct up to <strong className="text-[#F43F5E]">80% Network Fee</strong>. We are not responsible for lost funds due to wrong network usage!
                          </p>
                       </div>
                     </div>
                   )}

                   {selectedMethod && (
                     <div className="mb-6 animate-fade-in">
                        <label className="block text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">Target {selectedMethod} {selectedMethod === "Binance" ? "USDT (Solana) Address" : "Number"}</label>
                        <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder={selectedMethod === "Binance" ? "e.g. HN7cABqLq46..." : "e.g. 017XXXXXX"} className="w-full bg-[#101726] border border-[#162749] rounded-xl px-4 py-3 text-[#F8FAFC] font-mono text-sm focus:outline-none focus:border-[#00D2FF] transition-all placeholder:text-[#6C84A3]/50" />
                     </div>
                   )}

                   <div className="mb-6">
                      <label className="flex justify-between text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">
                        {/* 💥 THE GREAT USDT MIGRATION: 4-Decimal Limit Display 💥 */}
                        <span>Withdrawal Amount</span> <span className="text-[#60A5FA]">Min: $ {minWithdrawAmount.toFixed(4)}</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[#6C84A3]">$</span>
                        <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder={`${minWithdrawAmount.toFixed(4)}`} className="w-full bg-[#101726] border border-[#162749] rounded-xl pl-10 pr-20 py-3.5 text-[#F8FAFC] text-lg font-bold focus:outline-none focus:border-[#00D2FF] transition-all placeholder:text-[#6C84A3]/40" />
                        <button onClick={() => setWithdrawAmount(balance)} className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-[#162749] text-[#F8FAFC] text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg hover:bg-[#60A5FA] hover:text-[#030816] transition-colors">MAX</button>
                      </div>
                   </div>

                   <div className="mb-6">
                      <label className="flex justify-between text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest mb-2">
                        <span>Security Authorization PIN</span>
                      </label>
                      <input 
                        type="password" maxLength={4} value={withdrawPin} 
                        onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="****" 
                        className="w-full bg-[#101726] border border-[#162749] rounded-xl px-4 py-3.5 text-[#F8FAFC] text-xl font-bold tracking-[1em] text-center focus:outline-none focus:border-[#00D2FF] transition-all placeholder:text-[#6C84A3]/40" 
                      />
                   </div>

                   <button onClick={handleWithdrawSubmit} disabled={!selectedMethod || parseFloat(withdrawAmount) < minWithdrawAmount || !withdrawPin} className="w-full bg-[#00D2FF] hover:bg-[#60A5FA] text-[#030816] font-bold text-xs py-4 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(0,210,255,0.3)] tracking-widest uppercase">
                     Execute Manual Transfer
                   </button>
               </div>
            </div>
         </div>

         {/* 💥 LEDGER / WITHDRAWAL HISTORY 💥 */}
         <div className="bg-[#0B152A] border border-[#162749] rounded-3xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] flex flex-col h-[650px] lg:h-auto overflow-hidden">
            <div className="p-5 border-b border-[#162749] bg-[#101726] shrink-0">
              <h3 className="text-xs font-semibold text-[#F8FAFC] uppercase tracking-widest flex items-center gap-2">
                 <svg className="w-4 h-4 text-[#60A5FA]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 Network Ledger History
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#030816]">
               {dbRequests.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-24 text-[#6C84A3]">
                    <svg className="w-10 h-10 mb-4 text-[#162749]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    <p className="font-medium text-sm tracking-wide">No ledger entries found.</p>
                 </div>
               ) : (
                 dbRequests.map((item) => (
                   <div key={item._id} className="bg-[#101726] border border-[#162749] hover:border-[#60A5FA]/40 transition-colors rounded-xl mb-3 p-4 flex flex-col gap-2 group cursor-default shadow-sm">
                      
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#F8FAFC] uppercase tracking-wider">{item.method}</span>
                            <span className="text-[10px] text-[#6C84A3] font-mono truncate max-w-[120px] sm:max-w-[180px] bg-[#030816] px-2 py-0.5 rounded border border-[#162749]" title={item.accountNumber}>
                               {item.accountNumber}
                            </span>
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-[#F8FAFC] tracking-wide">${Number(item.amount).toFixed(4)}</span>
                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border ${
                               item.status === "PENDING" || item.status === "PROCESSING" ? "bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20" : 
                               item.status === "PAID" ? "bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/20" : 
                               "bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20"
                            }`}>
                               {item.status}
                            </span>
                         </div>
                      </div>
                      
                      <div className="flex justify-between items-center border-t border-[#162749] pt-2 mt-1">
                         <div className="flex items-center gap-2 text-[9px] font-semibold text-[#6C84A3] uppercase tracking-widest">
                            <span className="font-mono">{item.wid || "ZX-PENDING"}</span>
                            <span>•</span>
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                         </div>
                         {/* 💥 BOSS VIEW BUTTON: Opens the Premium Modal 💥 */}
                         <button 
                            onClick={() => setSelectedEntry(item)}
                            className="bg-[#60A5FA]/10 hover:bg-[#60A5FA]/20 text-[#60A5FA] border border-[#60A5FA]/30 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all"
                         >
                            View
                         </button>
                      </div>
                      
                   </div>
                 ))
               )}
            </div>
         </div>
      </div>

      {/* 💥 PREMIUM VIEW DETAILS MODAL 💥 */}
      {selectedEntry && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
             className="absolute inset-0 bg-[#030816]/80 backdrop-blur-sm cursor-pointer"
             onClick={() => setSelectedEntry(null)}
          ></div>
          
          {/* Modal Content */}
          <div className="relative bg-[#0B152A] border border-[#162749] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md animate-fade-in overflow-hidden">
             
             {/* Dynamic Top Border based on status */}
             <div className={`h-1 w-full ${selectedEntry.status === 'PAID' ? 'bg-[#00D2FF]' : selectedEntry.status === 'REJECTED' ? 'bg-[#F43F5E]' : 'bg-[#60A5FA]'}`}></div>

             <div className="p-6">
                <div className="flex justify-between items-start mb-6 border-b border-[#162749] pb-4">
                   <div>
                      <h2 className="text-lg font-bold text-[#F8FAFC] tracking-wide uppercase">Transaction Details</h2>
                      <p className="text-[10px] font-mono text-[#6C84A3] mt-1">{selectedEntry.wid || "ZX-PENDING"}</p>
                   </div>
                   <button onClick={() => setSelectedEntry(null)} className="text-[#6C84A3] hover:text-[#F43F5E] transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                </div>

                <div className="space-y-4 mb-6">
                   <div className="flex justify-between items-center bg-[#101726] p-3 rounded-lg border border-[#162749]">
                      <span className="text-[10px] text-[#6C84A3] uppercase tracking-widest font-semibold">Amount Requested</span>
                      <span className="text-lg font-black text-[#F8FAFC] drop-shadow-md">${Number(selectedEntry.amount).toFixed(4)}</span>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#101726] p-3 rounded-lg border border-[#162749]">
                         <span className="block text-[10px] text-[#6C84A3] uppercase tracking-widest font-semibold mb-1">Method</span>
                         <span className="text-xs font-bold text-[#F8FAFC] tracking-wider">{selectedEntry.method}</span>
                      </div>
                      <div className="bg-[#101726] p-3 rounded-lg border border-[#162749]">
                         <span className="block text-[10px] text-[#6C84A3] uppercase tracking-widest font-semibold mb-1">Status</span>
                         <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest border ${
                               selectedEntry.status === "PENDING" || selectedEntry.status === "PROCESSING" ? "bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20" : 
                               selectedEntry.status === "PAID" ? "bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/20" : 
                               "bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20"
                            }`}>
                               {selectedEntry.status}
                         </span>
                      </div>
                   </div>

                   <div className="bg-[#101726] p-3 rounded-lg border border-[#162749]">
                      <span className="block text-[10px] text-[#6C84A3] uppercase tracking-widest font-semibold mb-1">Target Account / Address</span>
                      <span className="text-xs font-mono font-bold text-[#60A5FA] break-all">{selectedEntry.accountNumber}</span>
                   </div>

                   <div className="bg-[#101726] p-3 rounded-lg border border-[#162749]">
                      <span className="block text-[10px] text-[#6C84A3] uppercase tracking-widest font-semibold mb-1">System Remarks</span>
                      <span className={`text-xs font-semibold ${selectedEntry.status === 'REJECTED' ? 'text-[#F43F5E]' : selectedEntry.status === 'PAID' ? 'text-[#00D2FF]' : 'text-[#6C84A3]'}`}>
                         {selectedEntry.adminNote || (selectedEntry.status === 'PENDING' ? "Processing your request securely..." : "No remarks.")}
                      </span>
                   </div>

                   <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                         <span className="block text-[9px] text-[#6C84A3] uppercase tracking-widest font-semibold mb-0.5">Requested At</span>
                         <span className="text-[10px] font-mono text-[#F8FAFC]">{formatTime(selectedEntry.createdAt)}</span>
                      </div>
                      {selectedEntry.status === "PAID" && (
                         <div className="text-right">
                            <span className="block text-[9px] text-[#6C84A3] uppercase tracking-widest font-semibold mb-0.5">Completed At</span>
                            <span className="text-[10px] font-mono text-[#00D2FF]">{formatTime(selectedEntry.updatedAt)}</span>
                         </div>
                      )}
                   </div>
                </div>

                <button onClick={() => setSelectedEntry(null)} className="w-full bg-[#162749] hover:bg-[#60A5FA] text-[#F8FAFC] hover:text-[#030816] font-bold text-xs py-3 rounded-xl transition-all uppercase tracking-widest">
                   Close Details
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}