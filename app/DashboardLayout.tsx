"use client";

import Link from "next/link";
import Image from "next/image"; 
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import GlobalFooter from "./components/GlobalFooter"; 

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isBadgeOpen, setIsBadgeOpen] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState("0.00");
  const [isMaintenance, setIsMaintenance] = useState(false);
  
  const [headerNotifs, setHeaderNotifs] = useState<any[]>([]);
  const [globalToast, setGlobalToast] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const pendingOrdersRef = useRef<any[]>([]);
  const isCheckingOTPRef = useRef(false);

  const showGlobalToast = useCallback((msg: string) => {
    setGlobalToast(msg);
    setTimeout(() => setGlobalToast(""), 4000); 
  }, []);

  const handleLogout = useCallback(async () => {
    try { await fetch("/api/logout", { method: "GET" }); } catch (error) {} 
    finally {
      localStorage.removeItem("user");
      localStorage.removeItem("zenex_login_time");
      localStorage.removeItem("zenex_saved_range");
      window.location.href = "/login";
    }
  }, []);

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return "Just now";
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Just Now";
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { router.push("/login"); return; }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    setIsAuthorized(true); 

    const syncLogout = (e: StorageEvent) => { if (e.key === "user" && !e.newValue) { window.location.href = "/login"; } };
    window.addEventListener("storage", syncLogout);

    const checkActiveSession = async () => { try { const res = await fetch("/api/check-session", { method: "GET" }); if (res.status === 401) handleLogout(); } catch (e) {} };
    const fetchSystemSettings = async () => { try { const res = await fetch("/api/system-settings"); if(res.ok){ const data = await res.json(); setIsMaintenance(!!(data && data.maintenance)); } } catch (e) {} };
    const fetchRealBalance = async () => {
      if (parsedUser.role === "admin") return;
      try { const res = await fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }); if(res.ok){ const data = await res.json(); if (data && data.user) setBalance(Number(data.user.balance || 0).toFixed(2)); } } catch (err) {}
    };
    const fetchHeaderNotifications = async () => { try { const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH_HEADER", email: parsedUser.email }) }); if(res.ok){ const data = await res.json(); if (data && data.success) setHeaderNotifs(data.data); } } catch (err) {} };
    
    checkActiveSession(); fetchSystemSettings(); fetchRealBalance(); fetchHeaderNotifications();

    const sessionInterval = setInterval(checkActiveSession, 30000); 
    const maintInterval = setInterval(fetchSystemSettings, 10000); 
    const balanceInterval = setInterval(fetchRealBalance, 5000); 
    const notifInterval = setInterval(fetchHeaderNotifications, 30000); 
    
    return () => { clearInterval(sessionInterval); clearInterval(maintInterval); clearInterval(balanceInterval); clearInterval(notifInterval); window.removeEventListener("storage", syncLogout); }
  }, [router, handleLogout]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[now.getUTCMonth()];
      setCurrentTime(`${hours}:${minutes}:${seconds} UTC - ${day} ${month}`);
    };
    updateClock(); const clockInterval = setInterval(updateClock, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    if (!user?.email) return;

    const fetchPendingOrders = async () => {
       try {
         const res = await fetch("/api/sync-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH", email: user.email }) });
         const data = await res.json();
         if (data.success && data.orders) { pendingOrdersRef.current = data.orders.filter((o: any) => o.status === "WAIT" || (o.status === "DONE" && (Date.now() - o.createdAt < 900000))); }
       } catch(e) {}
    };

    const checkGlobalOtps = async () => {
       if (isCheckingOTPRef.current || pendingOrdersRef.current.length === 0) return;
       isCheckingOTPRef.current = true;
       try {
         const res = await fetch(`/api/check-otp?t=${Date.now()}`);
         const result = await res.json();
         if (result.success && result.otps) {
           let updatedPending = [...pendingOrdersRef.current];
           let hasUpdates = false;
           
           for (let i = 0; i < updatedPending.length; i++) {
             let item = updatedPending[i];
             
             if (item.status === "WAIT" && Date.now() - item.createdAt > 1200000) {
                await fetch("/api/sync-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "UPDATE", email: user.email, orderData: { searchNumber: item.searchNumber, status: "FAIL", otp: "Timeout" } }) });
                updatedPending.splice(i, 1); i--; hasUpdates = true; continue;
             }

             const cleanSearch = String(item.searchNumber).replace(/\D/g, "");
             const last6 = cleanSearch.slice(-6);
             const matches = result.otps.filter((o:any) => String(o.number).replace(/\D/g, "").endsWith(last6));

             if (matches.length > 0) {
                const processedMatches = matches.map((m: any) => {
                   let rTime = Date.now();
                   let uKey = (m.otp || m.msg || m.sms || "").trim(); 

                   if (m.time) { rTime = new Date(m.time).getTime() || Date.now(); uKey = String(m.time); }
                   else if (m.date) { rTime = new Date(m.date).getTime() || Date.now(); uKey = String(m.date); }
                   else if (m.timestamp) { 
                       const ts = Number(m.timestamp); 
                       rTime = ts < 10000000000 ? ts * 1000 : ts; 
                       uKey = String(rTime); 
                   }
                   return { ...m, realApiTime: rTime, uniqueKey: uKey };
                });

                if (item.status === "DONE" && !item.seenKeys) {
                   item.seenKeys = [];
                   if (item.seenMessages) {
                       item.seenMessages.forEach((msg: string) => {
                           const found = processedMatches.find((m: any) => (m.otp || m.msg || m.sms || "").trim() === msg.trim() && !item.seenKeys.includes(m.uniqueKey));
                           if (found) item.seenKeys.push(found.uniqueKey);
                       });
                   }
                }

                if (item.status === "WAIT") {
                   const matchedObj = processedMatches[0];
                   const firstMsg = matchedObj.otp || matchedObj.msg || matchedObj.sms || "";
                   const codeMatch = firstMsg.match(/\b\d{4,8}\b/);
                   const finalCode = codeMatch ? codeMatch[0] : firstMsg;

                   window.dispatchEvent(new CustomEvent('otp-received-instant', { detail: { searchNumber: item.searchNumber, otp: finalCode, fullMessage: firstMsg, isMulti: false } }));
                   showGlobalToast(`${finalCode} (New OTP)`);

                   await fetch("/api/sync-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "UPDATE", email: user.email, orderData: { searchNumber: item.searchNumber, status: "DONE", otp: finalCode, fullMessage: firstMsg, receivedAt: matchedObj.realApiTime } }) });

                   item.status = "DONE"; 
                   item.fullMessage = firstMsg; 
                   item.seenMessages = [firstMsg]; 
                   item.seenKeys = [matchedObj.uniqueKey]; 
                   hasUpdates = true;
                } 
                else if (item.status === "DONE") {
                   const alreadySeenKeys = item.seenKeys || [];
                   const newMatches = processedMatches.filter((mObj: any) => !alreadySeenKeys.includes(mObj.uniqueKey));

                   if (newMatches.length > 0) {
                      for (const newMatch of newMatches) {
                         const newMsg = newMatch.otp || newMatch.msg || newMatch.sms || "";
                         const codeMatch = newMsg.match(/\b\d{4,8}\b/); 
                         const finalCode = codeMatch ? codeMatch[0] : newMsg;

                         window.dispatchEvent(new CustomEvent('otp-received-instant', { detail: { searchNumber: item.searchNumber, otp: finalCode, fullMessage: newMsg, isMulti: true } }));
                         showGlobalToast(`${finalCode} (Multi OTP)`);

                         await fetch("/api/sync-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "UPDATE", email: user.email, orderData: { searchNumber: item.searchNumber, status: "DONE", otp: finalCode, fullMessage: newMsg, receivedAt: newMatch.realApiTime } }) });
                         
                         item.seenMessages.push(newMsg);
                         item.seenKeys.push(newMatch.uniqueKey); 
                      }
                      hasUpdates = true;
                   }
                }
             }
           }
           if (hasUpdates) pendingOrdersRef.current = updatedPending;
         }
       } catch (e) {} finally { isCheckingOTPRef.current = false; }
    };

    fetchPendingOrders();

    const workerCode = `let tick3, tick10; self.onmessage = function(e) { if (e.data === 'start') { tick3 = setInterval(() => self.postMessage('tick3'), 3000); tick10 = setInterval(() => self.postMessage('tick10'), 10000); } else if (e.data === 'stop') { clearInterval(tick3); clearInterval(tick10); } };`;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => { if (e.data === 'tick3') checkGlobalOtps(); if (e.data === 'tick10') fetchPendingOrders(); };
    worker.postMessage('start');

    return () => { worker.postMessage('stop'); worker.terminate(); };
  }, [user?.email, showGlobalToast]);

  if (!mounted || !isAuthorized) {
    return (<div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center"><div className="w-10 h-10 border-4 border-[#334155] border-t-[#3B82F6] rounded-full animate-spin mb-4"></div></div>);
  }

  if (isMaintenance && user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#F43F5E]/5 flex items-center justify-center pointer-events-none"><div className="w-[500px] h-[500px] bg-[#F43F5E] rounded-full blur-[150px] opacity-20"></div></div>
        <svg className="w-20 h-20 text-[#F43F5E] mb-6 animate-pulse z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-widest z-10">System Offline</h1>
        <p className="text-[#94A3B8] font-bold mt-4 max-w-lg z-10 text-sm md:text-base leading-relaxed">The server is currently under maintenance for upgrades or security checks. Please check back later. Your data and balance are safe.</p>
        <button onClick={() => window.location.reload()} className="mt-8 bg-[#1E293B] border border-[#334155] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#334155] transition z-10">Refresh Page</button>
      </div>
    );
  }

  const role = user?.role || "user"; 
  const userName = user?.name || "User";
  const userRoleText = role === "admin" ? "SUPER ADMIN" : role === "agent" ? "AGENT ACCOUNT" : "VERIFIED ACCOUNT";
  const userInitials = userName.substring(0, 2).toUpperCase();

  const activeBlue = "bg-[#3B82F6]/10 border-l-2 border-[#3B82F6] rounded-r-xl text-[#3B82F6] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
  const activeYellow = "bg-[#EAB308]/10 border-l-2 border-[#EAB308] rounded-r-xl text-[#EAB308] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
  const inactive = "hover:bg-white/5 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] font-medium";

  const dashboardUrl = role === "admin" ? "/admin/dashboard" : role === "agent" ? "/manager/dashboard" : "/dashboard";
  const summaryUrl = role === "admin" ? "/admin/summary" : role === "agent" ? "/manager/summary" : "/summary";
  
  const isDashboardActive = pathname === dashboardUrl;
  const isSummaryActive = pathname === summaryUrl;

  return (
    <div className="min-h-screen w-full bg-[#0F172A] text-[#E2E8F0] flex font-sans selection:bg-[#3B82F6] selection:text-white relative overflow-hidden">
      
      {globalToast && (
        <div className="fixed top-6 md:top-8 left-1/2 -translate-x-1/2 z-[9999] bg-[#1E293B]/80 backdrop-blur-xl text-white px-5 py-2.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] font-bold text-xs md:text-sm flex items-center gap-3 animate-bounce-in border border-[#334155]/50 transition-all">
           <div className="w-5 h-5 rounded-full bg-[#10B981]/20 flex items-center justify-center"><span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse shadow-[0_0_8px_#10B981]"></span></div>
           <span className="tracking-wider">{globalToast}</span>
        </div>
      )}

      {isMaintenance && role === "admin" && (<div className="fixed top-0 left-0 w-full bg-[#F43F5E] text-white text-[10px] font-black uppercase tracking-widest text-center py-1 z-[100] animate-pulse">⚠️ MAINTENANCE MODE IS ACTIVE - ALL USERS ARE BLOCKED ⚠️</div>)}

      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-[#3B82F6] rounded-full blur-[180px] opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-[#8B5CF6] rounded-full blur-[180px] opacity-[0.08] pointer-events-none"></div>

      {isMobileMenuOpen && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>)}

      <aside className={`fixed md:relative top-0 left-0 h-full w-64 bg-[#1E293B]/95 md:bg-[#1E293B]/90 backdrop-blur-2xl border-r border-[#334155] z-[60] shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="h-20 flex items-center justify-between px-5 border-b border-[#334155] shrink-0">
          
          <Link href={dashboardUrl} className="flex items-center gap-2 group">
            <Image src="/zenex-logo.png?v=4.0.1" alt="ZENEX" width={26} height={26} className="object-contain drop-shadow-[0_0_5px_rgba(59,130,246,0.4)] group-hover:scale-105 transition-transform duration-300" priority unoptimized />
            <h1 className="text-[20px] font-black tracking-widest bg-gradient-to-r from-[#FFFFFF] via-[#E2E8F0] to-[#3B82F6] text-transparent bg-clip-text leading-none group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all">ZENEX</h1>
          </Link>

          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-[#94A3B8] hover:text-white"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        
        <nav className="flex-1 flex flex-col overflow-y-auto px-4 py-6 custom-scrollbar">
          <div className="space-y-1.5 flex-1">
            {role === "admin" && (
              <>
                <p className="px-4 text-[10px] font-bold tracking-widest text-[#F43F5E] mb-3 uppercase">Admin Controls</p>
                <Link href="/admin" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/admin' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>Control Room</Link>
                <Link href="/admin/users" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/admin/users' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Users Directory</Link>
                <Link href="/admin/realtime" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/admin/realtime' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>Global Realtime</Link>
              </>
            )}

            {role === "agent" && (
              <>
                <p className="px-4 text-[10px] font-bold tracking-widest text-[#A855F7] mb-3 uppercase">Agent Controls</p>
                <Link href="/manager/users" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/manager/users' ? activeYellow : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>My Network Users</Link>
                <Link href="/manager/realtime" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/manager/realtime' ? activeYellow : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>Realtime</Link>
                <Link href="/manager/payments" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/manager/payments' ? activeYellow : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>User Payments</Link>
              </>
            )}

            <p className={`px-4 text-[10px] font-bold tracking-widest text-[#94A3B8] mb-3 uppercase ${(role === "admin" || role === "agent") ? "mt-4" : ""}`}>Main Menu</p>
            
            <Link href={dashboardUrl} className={`flex items-center gap-3 px-4 py-3 transition-all ${isDashboardActive ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>Dashboard</Link>
            
            {role === "user" && (
              <Link href="/get-number" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/get-number' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>Get Number</Link>
            )}

            <Link href="/console" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/console' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>Console</Link>
            <Link href="/top-user" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/top-user' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>Top User</Link>
            <Link href={summaryUrl} className={`flex items-center gap-3 px-4 py-3 transition-all ${isSummaryActive ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>Summary</Link>

            <p className="px-4 text-[10px] font-bold tracking-widest text-[#94A3B8] mt-4 mb-3 uppercase">Account & Tools</p>
            
            {role === "admin" ? (
               <Link href="/admin/payments" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/admin/payments' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>Payments</Link>
            ) : (
               <Link href="/withdraw" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/withdraw' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>Withdraw</Link>
            )}

            <Link href="/access-list" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/access-list' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Access List</Link>
            <Link href="/profile" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/profile' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Profile</Link>
            <Link href="/notifications" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/notifications' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>Notifications</Link>
          </div>
          
          <div className="mt-8 pt-4">
             <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-[#3B82F6]/30 rounded-2xl p-4 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#3B82F6]/10 rounded-bl-full pointer-events-none group-hover:bg-[#3B82F6]/20 transition-colors"></div>
                <svg className="w-6 h-6 text-[#3B82F6] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                <h4 className="text-[13px] font-black text-white mb-1">Are you a Developer?</h4>
                <p className="text-[9px] text-[#94A3B8] font-bold mb-3 leading-relaxed">Integrate our premium SaaS API for your automated bots & software.</p>
                <Link href="/profile#api-access" className="block w-full py-2 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 rounded-lg text-center text-[10px] font-black tracking-widest text-[#3B82F6] uppercase transition-colors">Get API Access</Link>
             </div>
          </div>
        </nav>
      </aside>

      <main className={`flex-1 flex flex-col h-screen overflow-hidden w-full relative ${isMaintenance && role === 'admin' ? 'mt-6' : ''}`}>
        <header className="h-16 md:h-20 bg-[#1E293B]/80 backdrop-blur-2xl border-b border-[#334155] flex items-center justify-between px-3 sm:px-4 md:px-10 z-[50] w-full shrink-0 relative">
          <div className="flex items-center gap-2 sm:gap-3">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden w-8 h-8 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center border border-[#3B82F6]/30 shrink-0"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
             
             {/* 💥 MOBILE LOGO PERFECTLY CENTERED (No margins) 💥 */}
             <Link href={dashboardUrl} className="md:hidden flex items-center gap-1.5 group shrink-0">
               <Image src="/zenex-logo.png?v=4.0.1" alt="ZENEX" width={22} height={22} className="object-contain drop-shadow-[0_0_5px_rgba(59,130,246,0.4)]" priority unoptimized />
               <h1 className="text-[18px] font-black tracking-widest bg-gradient-to-r from-[#FFFFFF] to-[#3B82F6] text-transparent bg-clip-text leading-none">ZENEX</h1>
             </Link>

             <span className={`hidden md:flex px-3 py-1.5 border text-[10px] font-black rounded-md uppercase tracking-widest items-center gap-2 ${role === 'admin' ? 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20' : role === 'agent' ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20' : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${role === 'admin' ? 'bg-[#F43F5E]' : role === 'agent' ? 'bg-[#A855F7]' : 'bg-[#10B981]'}`}></span> 
                {role === 'admin' ? 'System Online' : role === 'agent' ? 'Agent Active' : 'Active'}
             </span>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-6 relative shrink-0">
            {role !== "admin" && (
              <div className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 md:px-4 md:py-2 bg-[#0F172A] border border-[#334155] rounded-md md:rounded-lg flex items-center md:gap-3 shadow-inner">
                 <span className="hidden md:block text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Balance</span>
                 <span className="text-[11px] sm:text-xs md:text-lg font-black text-[#10B981] md:text-[#F8FAFC]">৳{balance}</span>
              </div>
            )}
            <div className="relative">
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative p-1 md:p-2 text-[#94A3B8] hover:text-white transition-colors">
                 <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                 {headerNotifs.length > 0 && <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 w-2 h-2 md:w-2.5 md:h-2.5 bg-[#F43F5E] border-2 border-[#1E293B] rounded-full animate-pulse"></span>}
              </button>
              {isNotifOpen && (
                <div className="absolute top-10 right-0 w-72 md:w-80 bg-[#1E293B] border border-[#334155] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#334155]/50 flex justify-between items-center"><span className="text-white font-bold text-sm">Notifications</span><Link href="/notifications?tab=personal" onClick={() => setIsNotifOpen(false)} className="text-[10px] text-[#3B82F6] cursor-pointer hover:underline uppercase font-bold tracking-widest">View All</Link></div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {headerNotifs.length > 0 ? ( headerNotifs.map((notif: any) => ( <Link href="/notifications?tab=personal" key={notif._id} onClick={() => setIsNotifOpen(false)} className="block p-4 border-b border-[#334155]/30 hover:bg-[#334155]/20 cursor-pointer transition-colors"><p className="text-xs text-[#E2E8F0] leading-relaxed"><span className={`${notif.type === 'PERSONAL' ? 'text-[#10B981]' : 'text-[#3B82F6]'} font-bold`}>{notif.type === 'PERSONAL' ? 'Alert: ' : 'System: '}</span>{notif.title || notif.description}</p><span className="text-[9px] text-[#64748B] mt-1 block">{timeAgo(notif.createdAt)}</span></Link> )) ) : (<div className="p-4 text-center text-xs text-[#64748B]">No recent notifications</div>)}
                  </div>
                </div>
              )}
            </div>
            <div className="relative shrink-0">
              <div onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full p-[2px] bg-gradient-to-tr from-[#00C6FF] to-[#3B82F6] cursor-pointer hover:scale-105 transition-transform flex items-center justify-center"><div className="w-full h-full bg-[#1E293B] rounded-full flex items-center justify-center text-xs md:text-sm font-bold text-white tracking-wider">{userInitials}</div></div>
              {isProfileMenuOpen && (
                <div className="absolute top-12 right-0 w-64 bg-[#1E293B] border border-[#334155] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#334155]/50"><h4 className="text-white font-bold text-lg leading-tight truncate">{userName}</h4><p className={`text-[10px] font-bold tracking-widest uppercase mt-1 ${role === 'admin' ? 'text-[#F43F5E]' : role === 'agent' ? 'text-[#A855F7]' : 'text-[#94A3B8]'}`}>{userRoleText}</p></div>
                  <div className="border-t border-[#334155]/50"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-4 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors text-left">Logout</button></div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar w-full relative z-[10] flex flex-col">
           <div className="w-full min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-5rem)] flex-shrink-0">{children}</div>
           <GlobalFooter />
        </div>
      </main>

      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100] flex items-end md:items-center justify-end group">
        <div className={`absolute bottom-full mb-3 right-0 md:bottom-auto md:mb-0 md:right-full md:mr-3 flex items-center bg-[#1E293B]/95 backdrop-blur-xl border border-[#334155] rounded-xl md:rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 origin-bottom-right md:origin-right ${isBadgeOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'} md:group-hover:scale-100 md:group-hover:opacity-100 md:group-hover:pointer-events-auto`}>
           <div className="flex flex-col md:flex-row items-center md:gap-4 px-4 py-3 md:py-2.5 whitespace-nowrap">
              <div className="flex items-center gap-2 md:border-r border-[#334155] pb-2 md:pb-0 border-b md:border-b-0 w-full md:w-auto md:pr-4 justify-center md:justify-start"><div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]"></div><span className="text-[10px] font-black text-white tracking-widest uppercase">System Core <span className="text-[#94A3B8]">B:4.0.1</span></span></div>
              <div className="pt-2 md:pt-0 flex flex-col items-center md:items-start"><span className="text-[10px] font-black text-[#10B981] md:hidden uppercase mb-1">V4.0.1 (Secured)</span><a href="mailto:zenexpart44@gmail.com" className="text-[10px] font-black text-[#00C6FF] hover:text-white transition-colors underline underline-offset-2">Developed by Zenex Team</a></div>
           </div>
        </div>
        <div onClick={() => setIsBadgeOpen(!isBadgeOpen)} className="bg-[#1E293B]/90 backdrop-blur-md border border-[#334155] text-[#94A3B8] p-2.5 md:px-4 md:py-2.5 rounded-full shadow-lg transition-all duration-300 hover:text-white hover:border-[#10B981] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer flex items-center justify-center gap-2">
          <svg className="w-5 h-5 text-[#10B981] md:hidden block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          <span className="hidden md:block text-[10px] md:text-xs font-mono font-bold">V4.0.1 (Secured)</span>
          <svg className={`hidden md:block w-4 h-4 text-[#10B981] transition-transform duration-300 ${isBadgeOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
      </div>
    </div>
  )
}