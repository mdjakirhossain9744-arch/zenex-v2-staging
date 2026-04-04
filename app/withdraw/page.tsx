"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout"; 
import { useRouter } from "next/navigation";

export default function UserWithdrawal() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("user"); 
  const [balance, setBalance] = useState("0.00");
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(true);
  const [methodConfig, setMethodConfig] = useState({ bKash: true, Nagad: true, Rocket: true, Binance: true, TRC20: true });
  const [dbRequests, setDbRequests] = useState<any[]>([]);

  const [selectedMethod, setSelectedMethod] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  
  // 💥 NEW: Withdraw PIN State 💥
  const [withdrawPin, setWithdrawPin] = useState("");

  const paymentOptions = [
    { id: "bKash", type: "bKash", icon: "৳", color: "text-[#E2136E]" },
    { id: "Nagad", type: "Nagad", icon: "৳", color: "text-[#F7931E]" },
    { id: "Rocket", type: "Rocket", icon: "৳", color: "text-[#8C3494]" },
    { id: "Binance", type: "Binance", icon: "₿", color: "text-[#FCD535]" },
    { id: "TRC20", type: "TRC20", icon: "₮", color: "text-[#26A17B]" },
  ];

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed.role === "admin") {
         router.push("/admin/payments"); // Admin protection
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
        setMethodConfig(data.data.methods);
      }
    } catch (err) {}
  };

  const fetchRealData = async (email: string, userRole: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH", email, role: userRole }) });
      const data = await res.json();
      if (data.success) setDbRequests(data.data.reverse());

      const userRes = await fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const userData = await userRes.json();
      if (userData.user) setBalance(userData.user.balance.toFixed(2));
    } catch (error) {} finally { setLoading(false); }
  };

  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(""), 3000); };

  const handleWithdrawSubmit = async () => {
    if (!isWithdrawOpen) return showToast("Withdrawals are closed by Admin!");
    if (!selectedMethod) return showToast("Please select a payment method.");
    if (!accountNumber.trim()) return showToast(`Please enter your ${selectedMethod} Account/Address.`);
    
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 100) return showToast("Minimum withdraw is ৳ 100.00");
    if (amount > parseFloat(balance)) return showToast("Insufficient balance!");
    
    // 💥 NEW: Check PIN Before Submit 💥
    if (!withdrawPin.trim()) return showToast("Please enter your 4-digit Withdraw PIN.");

    try {
      const res = await fetch("/api/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "CREATE", 
          email: userEmail, 
          name: userName, 
          role: role, 
          amount: amount, 
          method: selectedMethod, 
          accountNumber: accountNumber,
          withdrawPin: withdrawPin // 💥 Sending PIN to Backend
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast("Withdraw request submitted!");
        setWithdrawAmount(""); setAccountNumber(""); setSelectedMethod(""); setWithdrawPin("");
        fetchRealData(userEmail, role); 
      } else { showToast(data.message); }
    } catch (error) { showToast("Server error! Try again."); }
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
                      <label className="block text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-2">Enter your {selectedMethod} Number/Address</label>
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

                 {/* 💥 NEW: Security PIN Box 💥 */}
                 <div className="mb-6">
                    <label className="flex justify-between text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-2">
                      <span>Security PIN</span> <span className="text-[#A855F7]">Default: 1234</span>
                    </label>
                    <input 
                      type="password" 
                      maxLength={4} 
                      value={withdrawPin} 
                      onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, ''))} // Only Numbers Allowed
                      placeholder="****" 
                      className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-4 text-white text-xl font-black tracking-[1em] text-center focus:outline-none focus:border-[#A855F7] transition-all" 
                    />
                 </div>

                 <button onClick={handleWithdrawSubmit} disabled={!selectedMethod || parseFloat(withdrawAmount) < 100 || !withdrawPin} className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-black text-lg py-4 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
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
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${item.status === "PENDING" || item.status === "PROCESSING" ? "bg-[#EAB308]/10 text-[#EAB308]" : item.status === "PAID" ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#F43F5E]/10 text-[#F43F5E]"}`}>{item.status}</span>
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