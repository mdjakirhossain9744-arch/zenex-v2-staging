"use client";

import Link from "next/link";
import Image from "next/image"; 
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import GlobalFooter from "../components/GlobalFooter";

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
  const [hasNewNotif, setHasNewNotif] = useState(false); 
  const [currentTime, setCurrentTime] = useState("");

  const pendingOrdersRef = useRef<any[]>([]);
  const isCheckingOTPRef = useRef(false);
  const isFetchingOrdersRef = useRef(false);
  const isFetchingSettingsRef = useRef(false);
  const isFetchingBalanceRef = useRef(false);
  const isFetchingNotifsRef = useRef(false);
  const isCheckingSessionRef = useRef(false);

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

    const checkActiveSession = async () => { 
      if (isCheckingSessionRef.current) return;
      isCheckingSessionRef.current = true;
      try { const res = await fetch("/api/check-session", { method: "GET" }); if (res.status === 401) handleLogout(); } catch (e) {} 
      finally { isCheckingSessionRef.current = false; }
    };

    const fetchSystemSettings = async () => { 
      if (isFetchingSettingsRef.current) return;
      isFetchingSettingsRef.current = true;
      try { const res = await fetch("/api/system-settings"); if(res.ok){ const data = await res.json(); setIsMaintenance(!!(data && data.maintenance)); } } catch (e) {} 
      finally { isFetchingSettingsRef.current = false; }
    };

    const fetchRealBalance = async () => {
      if (parsedUser.role === "admin" || isFetchingBalanceRef.current) return;
      isFetchingBalanceRef.current = true;
      try { const res = await fetch("/api/get-user-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsedUser.email }) }); if(res.ok){ const data = await res.json(); if (data && data.user) setBalance(Number(data.user.balance || 0).toFixed(2)); } } catch (err) {}
      finally { isFetchingBalanceRef.current = false; }
    };
    
    const fetchHeaderNotifications = async () => { 
      if (isFetchingNotifsRef.current) return;
      isFetchingNotifsRef.current = true;
      try { 
        const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH_HEADER", email: parsedUser.email }) }); 
        if(res.ok){ 
          const data = await res.json(); 
          if (data && data.success && data.data) { 
            setHeaderNotifs(data.data); 
            if (data.data.length > 0) {
               const latestNotifTime = new Date(data.data[0].createdAt).getTime();
               const lastSeenTime = Number(localStorage.getItem(`zenex_last_notif_${parsedUser.email}`) || 0);
               if (latestNotifTime > lastSeenTime) {
                  setHasNewNotif(true);
               }
            }
          } 
        } 
      } catch (err) {} 
      finally { isFetchingNotifsRef.current = false; }
    };
    
    checkActiveSession(); fetchSystemSettings(); fetchRealBalance(); fetchHeaderNotifications();

    const handleLiveNotification = () => {
      fetchHeaderNotifications(); 
    };
    window.addEventListener("NEW_LIVE_NOTIFICATION", handleLiveNotification);

    let sessionInterval: NodeJS.Timeout;
    let maintInterval: NodeJS.Timeout;
    let balanceInterval: NodeJS.Timeout;
    let notifInterval: NodeJS.Timeout;

    const startUIUpdates = () => {
      sessionInterval = setInterval(checkActiveSession, 30000); 
      maintInterval = setInterval(fetchSystemSettings, 10000); 
      balanceInterval = setInterval(fetchRealBalance, 5000); 
      notifInterval = setInterval(fetchHeaderNotifications, 30000); 
    };

    const stopUIUpdates = () => {
      clearInterval(sessionInterval);
      clearInterval(maintInterval);
      clearInterval(balanceInterval);
      clearInterval(notifInterval);
    };

    startUIUpdates();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopUIUpdates();
      } else {
        fetchRealBalance();
        startUIUpdates();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => { 
      stopUIUpdates(); 
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", syncLogout); 
      window.removeEventListener("NEW_LIVE_NOTIFICATION", handleLiveNotification); 
    };
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
       if (isFetchingOrdersRef.current) return;
       isFetchingOrdersRef.current = true;
       try {
         const res = await fetch("/api/sync-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "FETCH", email: user.email }) });
         const data = await res.json();
         if (data.success && data.orders) { pendingOrdersRef.current = data.orders.filter((o: any) => o.status === "WAIT" || (o.status === "DONE" && (Date.now() - o.createdAt < 900000))); }
       } catch(e) {} 
       finally { isFetchingOrdersRef.current = false; }
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

    worker.onmessage = (e) => { 
       if (e.data === 'tick3') checkGlobalOtps(); 
       if (e.data === 'tick10') fetchPendingOrders(); 
    };
    worker.postMessage('start');

    return () => { worker.postMessage('stop'); worker.terminate(); };
  }, [user?.email]);

  // If layout is re-mounting, it might show this briefly. Ensuring background perfectly matches main bg to prevent black flash.
  if (!mounted || !isAuthorized) {
    return (<div className="min-h-screen bg-[#030816] flex flex-col items-center justify-center"><div className="w-10 h-10 border-4 border-[#162749] border-t-[#00D2FF] rounded-full animate-spin mb-4"></div></div>);
  }

  if (isMaintenance && user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#030816] flex flex-col items-center justify-center text-center p-6 relative">
        <svg className="w-16 h-16 text-[#F43F5E] mb-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <h1 className="text-3xl font-semibold text-[#F8FAFC] uppercase tracking-widest">System Offline</h1>
        <p className="text-[#6C84A3] font-medium mt-4 max-w-lg text-sm md:text-base tracking-wide leading-relaxed">The server is currently under maintenance. Please check back later. Your data and balance are safe.</p>
        <button onClick={() => window.location.reload()} className="mt-8 bg-[#101726] border border-[#162749] text-[#F8FAFC] px-6 py-2.5 rounded-lg font-semibold hover:bg-[#162749] transition-colors tracking-wide">Refresh Page</button>
      </div>
    );
  }

  const handleNotifClick = () => {
    const opening = !isNotifOpen;
    setIsNotifOpen(opening);
    if (opening && headerNotifs.length > 0) {
      setHasNewNotif(false);
      const latestNotifTime = new Date(headerNotifs[0].createdAt).getTime();
      localStorage.setItem(`zenex_last_notif_${user?.email}`, latestNotifTime.toString());
    }
  };

  const role = user?.role || "user"; 
  const userName = user?.name || "User";
  const userRoleText = role === "admin" ? "SUPER ADMIN" : role === "agent" ? "AGENT ACCOUNT" : "VERIFIED ACCOUNT";
  const userInitials = userName.substring(0, 2).toUpperCase();

  // 💥 V2 COMPACT BUTTONS WITH SLIDE-RIGHT HOVER EFFECT 💥
  const activeNav = "bg-gradient-to-r from-[#00D2FF]/10 to-transparent border border-[#162749] border-l-[3px] border-l-[#00D2FF] rounded-xl text-[#00D2FF] font-semibold pl-4";
  const inactiveNav = "border border-transparent border-l-[3px] hover:border-[#162749] hover:bg-[#101726]/80 rounded-xl text-[#6C84A3] hover:text-[#F8FAFC] font-medium transition-all duration-300 hover:pl-5";

  const dashboardUrl = role === "admin" ? "/admin/dashboard" : role === "agent" ? "/manager/dashboard" : "/dashboard";
  const summaryUrl = role === "admin" ? "/admin/summary" : role === "agent" ? "/manager/summary" : "/summary";
  
  const isDashboardActive = pathname === dashboardUrl;
  const isSummaryActive = pathname === summaryUrl;

  return (
    <div className="min-h-screen w-full bg-[#030816] text-[#F8FAFC] flex font-sans selection:bg-[#00D2FF] selection:text-[#030816]" style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', sans-serif" }}>
      
      {isMaintenance && role === "admin" && (<div className="fixed top-0 left-0 w-full bg-[#F43F5E] text-white text-[10px] font-bold uppercase tracking-widest text-center py-1 z-[100] animate-pulse">⚠️ MAINTENANCE MODE IS ACTIVE - ALL USERS ARE BLOCKED ⚠️</div>)}

      {isMobileMenuOpen && (<div className="fixed inset-0 bg-[#030816]/80 backdrop-blur-sm z-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>)}

      {/* SIDEBAR */}
      <aside className={`fixed md:relative top-0 left-0 h-screen w-64 bg-[#0B152A] border-r border-[#162749] z-[60] transition-transform duration-300 ease-in-out flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="h-16 md:h-20 flex items-center justify-between px-5 border-b border-[#162749] shrink-0">
          <Link href={dashboardUrl} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 group">
            <Image src="/zenex-logo.png?v=4.0.1" alt="ZENEX" width={26} height={26} className="object-contain drop-shadow-[0_0_5px_rgba(59,130,246,0.4)] group-hover:scale-105 transition-transform duration-300" priority unoptimized />
            <h1 className="text-[20px] font-black tracking-widest bg-gradient-to-r from-[#FFFFFF] via-[#E2E8F0] to-[#3B82F6] text-transparent bg-clip-text leading-none group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all">ZENEX</h1>
          </Link>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-[#6C84A3] hover:text-[#F8FAFC]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        
        {/* HIDDEN SCROLLBAR */}
        <nav className="flex-1 flex flex-col overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="space-y-0"> 
            
            {role === "admin" && (
              <>
                <p className="px-4 text-[10px] font-bold tracking-widest text-[#00D2FF] mb-2 uppercase mt-2">Admin Controls</p>
                <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/admin' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>Control Room</Link>
                <Link href="/admin/users" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/admin/users' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Users Directory</Link>
                <Link href="/admin/realtime" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/admin/realtime' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>Global Realtime</Link>
              </>
            )}

            {role === "agent" && (
              <>
                <p className="px-4 text-[10px] font-bold tracking-widest text-[#60A5FA] mb-2 uppercase mt-2">Agent Controls</p>
                <Link href="/manager/users" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/manager/users' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>My Network Users</Link>
                <Link href="/manager/realtime" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/manager/realtime' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>Realtime</Link>
                <Link href="/manager/payments" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/manager/payments' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>User Payments</Link>
              </>
            )}

            <p className={`px-4 text-[10px] font-bold tracking-widest text-[#6C84A3] mb-2 uppercase ${(role === "admin" || role === "agent") ? "mt-5" : "mt-2"}`}>Main Menu</p>
            
            <Link href={dashboardUrl} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${isDashboardActive ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>Dashboard</Link>
            
            {role === "user" && (
              <Link href="/get-number" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/get-number' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>Get Number</Link>
            )}

            <Link href="/console" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/console' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>Console</Link>
            
            <Link href={summaryUrl} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${isSummaryActive ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>Summary</Link>

            {/* 💥 MOVED ACCESS LIST HERE 💥 */}
            <Link href="/access-list" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/access-list' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Access List</Link>

            <p className="px-4 text-[10px] font-bold tracking-widest text-[#6C84A3] mt-5 mb-2 uppercase">Account & Tools</p>
            
            {role === "admin" ? (
               <Link href="/admin/payments" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/admin/payments' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>Payments</Link>
            ) : (
               <Link href="/withdraw" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/withdraw' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>Withdraw</Link>
            )}

            <Link href="/master-range" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/master-range' ? activeNav : inactiveNav}`}>
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              Master Range
            </Link>

            <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/profile' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Profile</Link>
            <Link href="/notifications" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${pathname === '/notifications' ? activeNav : inactiveNav}`}><svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>Notifications</Link>
          </div>
          
          <div className="mt-auto pt-6 pb-2 shrink-0">
             <div className="bg-[#101726] mx-2 border border-[#162749] rounded-lg p-3">
                <svg className="w-4 h-4 text-[#00D2FF] mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <h4 className="text-xs font-semibold text-[#F8FAFC] mb-0.5 tracking-tight">Are you a Developer?</h4>
                <p className="text-[10px] text-[#6C84A3] font-medium mb-3 leading-tight tracking-wide">Integrate premium API for bots.</p>
                <Link href="/api-docs" onClick={() => setIsMobileMenuOpen(false)} className="block w-full py-1.5 bg-[#00D2FF]/10 hover:bg-[#00D2FF]/20 rounded-md text-center text-[10px] font-bold tracking-widest text-[#00D2FF] uppercase transition-colors">
                   View API Docs
                </Link>
             </div>
          </div>
        </nav>
      </aside>

      <main className={`flex-1 flex flex-col h-screen overflow-hidden w-full relative ${isMaintenance && role === 'admin' ? 'mt-6' : ''}`}>
        <header className="h-16 md:h-20 bg-[#0B152A] border-b border-[#162749] flex items-center justify-between px-4 md:px-8 z-[50] w-full shrink-0">
          <div className="flex items-center gap-3">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden w-8 h-8 rounded-lg bg-[#00D2FF]/10 text-[#00D2FF] flex items-center justify-center shrink-0"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
             
             <Link href={dashboardUrl} className="md:hidden flex items-center gap-2 shrink-0">
               <Image src="/zenex-logo.png?v=4.0.1" alt="ZENEX" width={22} height={22} className="object-contain" priority unoptimized />
               <h1 className="text-[18px] font-black tracking-widest bg-gradient-to-r from-[#FFFFFF] via-[#E2E8F0] to-[#3B82F6] text-transparent bg-clip-text leading-none mt-1">ZENEX</h1>
             </Link>

             <span className={`hidden md:flex px-2.5 py-1 text-[9px] font-bold rounded uppercase tracking-widest items-center gap-2 ${role === 'admin' ? 'bg-[#00D2FF]/10 text-[#00D2FF]' : role === 'agent' ? 'bg-[#60A5FA]/10 text-[#60A5FA]' : 'bg-[#00D2FF]/10 text-[#00D2FF]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${role === 'admin' ? 'bg-[#00D2FF]' : role === 'agent' ? 'bg-[#60A5FA]' : 'bg-[#00D2FF]'}`}></span> 
                {role === 'admin' ? 'System Online' : role === 'agent' ? 'Agent Active' : 'Active'}
             </span>
          </div>
          
          <div className="flex items-center relative shrink-0">
            {/* THE PREMIUM PILL SHAPE */}
            <div className="flex items-center bg-[#030816] border border-[#162749] rounded-xl md:rounded-full p-1 md:pl-4 shadow-sm h-10 md:h-11">
               
               {role !== "admin" && (
                 <div className="flex items-center gap-2 border-r border-[#162749] pr-3 mr-2 pl-2 md:pl-0">
                   <span className="hidden md:block text-[9px] font-bold text-[#6C84A3] uppercase tracking-widest">Balance</span>
                   <span className="text-xs md:text-sm font-bold text-[#F8FAFC] tracking-tight">${balance}</span>
                 </div>
               )}

               <div className="relative flex items-center justify-center h-full px-2">
                 <button onClick={handleNotifClick} className="relative w-8 h-8 flex items-center justify-center text-[#6C84A3] hover:text-[#00D2FF] transition-colors rounded-full hover:bg-[#101726]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    {hasNewNotif && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F43F5E] border-2 border-[#030816] rounded-full animate-pulse"></span>}
                 </button>
                 {isNotifOpen && (
                   <div className="absolute top-12 right-0 w-72 md:w-80 bg-[#0B152A] border border-[#162749] rounded-xl shadow-2xl z-50 overflow-hidden">
                     <div className="px-4 py-3 border-b border-[#162749] flex justify-between items-center"><span className="text-[#F8FAFC] font-bold text-sm">Notifications</span><Link href="/notifications?tab=personal" onClick={() => setIsNotifOpen(false)} className="text-[10px] text-[#00D2FF] cursor-pointer hover:underline uppercase font-bold tracking-widest">View All</Link></div>
                     <div className="max-h-64 overflow-y-auto custom-scrollbar">
                       {headerNotifs.length > 0 ? ( headerNotifs.map((notif: any) => ( <Link href="/notifications?tab=personal" key={notif._id} onClick={() => setIsNotifOpen(false)} className="block p-4 border-b border-[#162749]/50 hover:bg-[#101726] cursor-pointer transition-colors"><p className="text-xs text-[#E2E8F0] tracking-wide leading-relaxed"><span className={`${notif.type === 'PERSONAL' ? 'text-[#00D2FF]' : 'text-[#60A5FA]'} font-bold`}>{notif.type === 'PERSONAL' ? 'Alert: ' : 'System: '}</span>{notif.title || notif.description}</p><span className="text-[10px] text-[#6C84A3] font-medium mt-1.5 block">{timeAgo(notif.createdAt)}</span></Link> )) ) : (<div className="p-4 text-center text-xs text-[#6C84A3] font-medium">No recent notifications</div>)}
                     </div>
                   </div>
                 )}
               </div>
               
               <div className="relative shrink-0 h-full flex items-center pr-1">
                 <div onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#101726] border border-[#162749] cursor-pointer hover:border-[#00D2FF]/50 transition-colors flex items-center justify-center"><div className="text-xs font-bold text-[#F8FAFC] tracking-wider">{userInitials}</div></div>
                 
                 {isProfileMenuOpen && (
                   <div className="absolute top-12 right-0 w-56 bg-[#0B152A] border border-[#162749] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                     <div className="px-5 py-4 border-b border-[#162749]">
                       <h4 className="text-[#F8FAFC] font-bold text-sm leading-tight truncate tracking-wide">{userName}</h4>
                       <p className={`text-[10px] font-bold tracking-widest uppercase mt-1 ${role === 'admin' ? 'text-[#00D2FF]' : role === 'agent' ? 'text-[#60A5FA]' : 'text-[#6C84A3]'}`}>{userRoleText}</p>
                     </div>
                     
                     <Link href="/profile" onClick={() => setIsProfileMenuOpen(false)} className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium text-[#F8FAFC] hover:bg-[#101726] transition-colors tracking-wide">
                       <svg className="w-4 h-4 text-[#6C84A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                       My Profile
                     </Link>

                     <div className="border-t border-[#162749]">
                       <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium text-[#F43F5E] hover:bg-[#F43F5E]/10 transition-colors text-left tracking-wide">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                         Logout
                       </button>
                     </div>
                   </div>
                 )}
               </div>

            </div>
          </div>
        </header>

        {/* 💥 PURE SMOOTH CONTAINER: REMOVED KEY={PATHNAME} TO STOP JOLT 💥 */}
        <div className="flex-1 overflow-y-scroll overflow-x-hidden custom-scrollbar w-full relative z-[10] flex flex-col bg-[#030816]">
           <div className="w-full flex-1 flex flex-col">
             {children}
           </div>
           <div className="w-full shrink-0 mt-auto">
             <GlobalFooter />
           </div>
        </div>
      </main>

      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100] flex items-end md:items-center justify-end group">
        <div className={`absolute bottom-full mb-3 right-0 md:bottom-auto md:mb-0 md:right-full md:mr-3 flex items-center bg-[#0B152A] border border-[#162749] rounded-xl md:rounded-full shadow-lg overflow-hidden transition-all duration-300 origin-bottom-right md:origin-right ${isBadgeOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'} md:group-hover:scale-100 md:group-hover:opacity-100 md:group-hover:pointer-events-auto`}>
           <div className="flex flex-col md:flex-row items-center md:gap-4 px-4 py-3 md:py-2 whitespace-nowrap">
              <div className="flex items-center gap-2 md:border-r border-[#162749] pb-2 md:pb-0 border-b md:border-b-0 w-full md:w-auto md:pr-4 justify-center md:justify-start"><div className="w-1.5 h-1.5 rounded-full bg-[#00D2FF] animate-pulse"></div><span className="text-[10px] font-bold text-[#F8FAFC] tracking-widest uppercase">System Core <span className="text-[#6C84A3]">B:4.0.1</span></span></div>
              <div className="pt-2 md:pt-0 flex flex-col items-center md:items-start"><span className="text-[10px] font-bold text-[#00D2FF] md:hidden uppercase mb-1 tracking-widest">V4.0.1 (Secured)</span><a href="mailto:zenexpart44@gmail.com" className="text-[10px] font-bold text-[#60A5FA] hover:text-[#00D2FF] transition-colors underline underline-offset-2 tracking-wider">Developed by Zenex Team</a></div>
           </div>
        </div>
        <div onClick={() => setIsBadgeOpen(!isBadgeOpen)} className="bg-[#0B152A] border border-[#162749] text-[#6C84A3] p-2.5 md:px-4 md:py-2 rounded-xl md:rounded-full shadow-lg transition-all duration-300 hover:text-[#F8FAFC] hover:border-[#00D2FF] cursor-pointer flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-[#00D2FF] md:hidden block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          <span className="hidden md:block text-[10px] font-bold tracking-wide text-[#00D2FF]">V4.0.1 (Secured)</span>
          <svg className={`hidden md:block w-3.5 h-3.5 text-[#00D2FF] transition-transform duration-300 ${isBadgeOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
      </div>
    </div>
  )
}