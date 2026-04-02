"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState("0.00");
  const [isMaintenance, setIsMaintenance] = useState(false);

  // 💥 সিকিউর লগআউট ফাংশন ফিক্সড (কালো স্ক্রিন রিমুভড) 💥
  const handleLogout = useCallback(async () => {
    try {
      // ১. ব্যাকএন্ড থেকে কুকি ডিলিট করা
      await fetch("/api/logout", { method: "GET" });
    } catch (error) {
      console.error("Logout API failed:", error);
    } finally {
      // ২. লোকাল স্টোরেজ থেকে সব ডাটা একদম ক্লিন করা
      localStorage.removeItem("user");
      localStorage.removeItem("zenex_login_time");
      localStorage.removeItem("zenex_saved_range");
      
      // ৩. 💥 ম্যাজিক: router.push বাদ দিয়ে হার্ড রিলোড! কালো স্ক্রিন জীবনেও আর আসবে না! 💥
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    setIsAuthorized(true); 

    const checkActiveSession = async () => {
      try {
        const res = await fetch("/api/check-session", { method: "GET" });
        if (res.status === 401) {
          console.warn("🚨 Session expired or logged in from too many devices! Kicking out...");
          handleLogout(); 
        }
      } catch (e) {
        console.error("Session check failed");
      }
    };

    const checkMaintenance = async () => {
      try {
        const res = await fetch("/api/system-settings");
        if(res.ok){
          const data = await res.json();
          if (data && data.maintenance) {
             setIsMaintenance(true);
          } else {
             setIsMaintenance(false);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    const fetchRealBalance = async () => {
      if (parsedUser.role === "admin") return;
      
      try {
        const res = await fetch("/api/get-user-details", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ email: parsedUser.email })
        });
        if(res.ok){
          const data = await res.json();
          if (data && data.user) {
             setBalance(Number(data.user.balance || 0).toFixed(2));
          }
        }
      } catch (err) {
        console.error("Failed to load real balance");
      }
    };
    
    checkActiveSession();
    checkMaintenance();
    fetchRealBalance();

    const sessionInterval = setInterval(checkActiveSession, 30000); 
    const maintInterval = setInterval(checkMaintenance, 5000); 
    const balanceInterval = setInterval(fetchRealBalance, 5000); 
    
    return () => {
      clearInterval(sessionInterval);
      clearInterval(maintInterval);
      clearInterval(balanceInterval);
    }
  }, [router, handleLogout]);

  if (!mounted || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#334155] border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
      </div>
    );
  }

  if (isMaintenance && user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#F43F5E]/5 flex items-center justify-center pointer-events-none">
           <div className="w-[500px] h-[500px] bg-[#F43F5E] rounded-full blur-[150px] opacity-20"></div>
        </div>
        <svg className="w-20 h-20 text-[#F43F5E] mb-6 animate-pulse z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-widest z-10">System Offline</h1>
        <p className="text-[#94A3B8] font-bold mt-4 max-w-lg z-10 text-sm md:text-base leading-relaxed">
          The server is currently under maintenance for upgrades or security checks. Please check back later. Your data and balance are safe.
        </p>
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

  return (
    <div className="min-h-screen w-full bg-[#0F172A] text-[#E2E8F0] flex font-sans selection:bg-[#3B82F6] selection:text-white relative overflow-hidden">
      
      {isMaintenance && role === "admin" && (
        <div className="fixed top-0 left-0 w-full bg-[#F43F5E] text-white text-[10px] font-black uppercase tracking-widest text-center py-1 z-[100] animate-pulse">
          ⚠️ MAINTENANCE MODE IS ACTIVE - ALL USERS ARE BLOCKED ⚠️
        </div>
      )}

      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-[#3B82F6] rounded-full blur-[180px] opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-[#8B5CF6] rounded-full blur-[180px] opacity-[0.08] pointer-events-none"></div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      <aside className={`fixed md:relative top-0 left-0 h-full w-64 bg-[#1E293B]/95 md:bg-[#1E293B]/90 backdrop-blur-2xl border-r border-[#334155] z-[60] shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="h-20 flex items-center justify-between px-8 border-b border-[#334155]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00C6FF] to-[#3B82F6] flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.4)]">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className="text-xl font-black tracking-widest text-white">ZENEX</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-[#94A3B8] hover:text-white">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 custom-scrollbar">
          
          {role === "admin" && (
            <>
              <p className="px-4 text-[10px] font-bold tracking-widest text-[#F43F5E] mb-3 uppercase">Admin Controls</p>
              <Link href="/admin" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/admin' ? activeBlue : inactive}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Admin Panel
              </Link>
              <Link href="/users" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/users' ? activeBlue : inactive}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Users Directory
              </Link>
            </>
          )}

          {role === "agent" && (
            <>
              <p className="px-4 text-[10px] font-bold tracking-widest text-[#A855F7] mb-3 uppercase">Agent Controls</p>
              <Link href="/my-users" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/my-users' ? activeYellow : inactive}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                My Network Users
              </Link>
            </>
          )}

          <p className={`px-4 text-[10px] font-bold tracking-widest text-[#94A3B8] mb-3 uppercase ${(role === "admin" || role === "agent") ? "mt-4" : ""}`}>Main Menu</p>
          
          <Link href="/" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>Dashboard</Link>
          
          {role === "user" && (
            <>
              <Link href="/get-number" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/get-number' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>Get Number</Link>
            </>
          )}

          <Link href="/console" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/console' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>Console</Link>

          <Link href="/top-user" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/top-user' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>Top User</Link>
          <Link href="/summary" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/summary' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>Summary</Link>

          <p className="px-4 text-[10px] font-bold tracking-widest text-[#94A3B8] mt-4 mb-3 uppercase">Account & Tools</p>
          
          <Link href="/payment" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/payment' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>Payment</Link>
          <Link href="/access-list" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/access-list' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Access List</Link>
          <Link href="/profile" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/profile' ? activeBlue : inactive}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Profile</Link>

          <Link href="/notifications" className={`flex items-center gap-3 px-4 py-3 transition-all ${pathname === '/notifications' ? activeBlue : inactive}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </Link>
          
        </nav>
      </aside>

      <main className={`flex-1 flex flex-col h-screen overflow-hidden w-full relative ${isMaintenance && role === 'admin' ? 'mt-6' : ''}`}>
        <header className="h-16 md:h-20 bg-[#1E293B]/80 backdrop-blur-2xl border-b border-[#334155] flex items-center justify-between px-4 md:px-10 z-[50] w-full relative">
          <div className="flex items-center gap-3">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden w-8 h-8 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center border border-[#3B82F6]/30">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>
             <span className={`hidden md:flex px-3 py-1.5 border text-[10px] font-black rounded-md uppercase tracking-widest items-center gap-2 
               ${role === 'admin' ? 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20' : 
                 role === 'agent' ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20' : 
                 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse 
                  ${role === 'admin' ? 'bg-[#F43F5E]' : role === 'agent' ? 'bg-[#A855F7]' : 'bg-[#10B981]'}`}></span> 
                {role === 'admin' ? 'System Online' : role === 'agent' ? 'Agent Active' : 'Active'}
             </span>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6 relative">
            
            {role !== "admin" && (
              <div className="px-3 py-1.5 md:px-4 md:py-2 bg-[#0F172A] border border-[#334155] rounded-lg flex items-center gap-2 md:gap-3 shadow-inner">
                 <span className="text-[9px] md:text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Balance</span>
                 <span className="text-base md:text-lg font-black text-[#F8FAFC]">৳ {balance}</span>
              </div>
            )}

            <div className="relative">
              <button 
                 onClick={() => setIsNotifOpen(!isNotifOpen)} 
                 className="relative p-2 text-[#94A3B8] hover:text-white transition-colors"
              >
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                 </svg>
                 <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#F43F5E] border-2 border-[#1E293B] rounded-full animate-pulse"></span>
              </button>

              {isNotifOpen && (
                <div className="absolute top-12 right-0 w-80 bg-[#1E293B] border border-[#334155] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#334155]/50 flex justify-between items-center">
                    <Link href="/notifications" onClick={() => setIsNotifOpen(false)} className="text-white font-bold text-sm hover:text-[#3B82F6] transition-colors">Notifications</Link>
                    <Link href="/notifications" onClick={() => setIsNotifOpen(false)} className="text-[10px] text-[#3B82F6] cursor-pointer hover:underline">View All</Link>
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    <Link href="/notifications" onClick={() => setIsNotifOpen(false)} className="block p-4 border-b border-[#334155]/30 hover:bg-[#334155]/20 cursor-pointer transition-colors">
                       <p className="text-xs text-[#E2E8F0]"><span className="text-[#3B82F6] font-bold">System:</span> Welcome to ZENEX PREMIUM V3.0.1! Your network is highly secured.</p>
                       <span className="text-[9px] text-[#64748B] mt-1 block">Just now</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <div onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="w-8 h-8 md:w-10 md:h-10 rounded-full p-[2px] bg-gradient-to-tr from-[#00C6FF] to-[#3B82F6] cursor-pointer hover:scale-105 transition-transform flex items-center justify-center">
                 <div className="w-full h-full bg-[#1E293B] rounded-full flex items-center justify-center text-sm font-bold text-white tracking-wider">{userInitials}</div>
              </div>

              {isProfileMenuOpen && (
                <div className="absolute top-14 right-0 w-64 bg-[#1E293B] border border-[#334155] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#334155]/50">
                    <h4 className="text-white font-bold text-lg leading-tight truncate">{userName}</h4>
                    <p className={`text-[10px] font-bold tracking-widest uppercase mt-1 ${role === 'admin' ? 'text-[#F43F5E]' : role === 'agent' ? 'text-[#A855F7]' : 'text-[#94A3B8]'}`}>{userRoleText}</p>
                  </div>
                  <div className="border-t border-[#334155]/50">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-4 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors text-left">Logout</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar w-full relative z-[10]">
           {children}
        </div>
      </main>

      {/* 💥 Professional Version & Developer Tag (Fixed Bottom Right) 💥 */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100] group flex flex-col items-end">
        {/* Tooltip Content (Hidden, shown on hover) */}
        <div className="absolute bottom-full right-0 mb-3 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto w-56 md:w-64 bg-[#1E293B]/95 backdrop-blur-xl border border-[#334155] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="p-4 border-b border-[#334155]/50 bg-gradient-to-br from-[#1E293B] to-[#0F172A]">
            <div className="flex items-center justify-between mb-1">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]"></div>
                 <span className="text-xs font-bold text-white tracking-widest uppercase">System Core</span>
               </div>
               <span className="text-[9px] bg-[#334155] text-white px-2 py-0.5 rounded-md font-mono">B:3.1.5</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] font-mono mt-2">ZENEX PREMIUM V3.0.1</p>
          </div>
          
          <div className="p-4 bg-[#0F172A]/80 flex flex-col items-center">
            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1 w-full text-center border-b border-[#334155] pb-2">Developed By</p>
            
            {/* 💥 Zenex Team with Email Hover Magic 💥 */}
            <a href="mailto:zenexpart44@gmail.com" className="relative block w-full text-center group/team cursor-pointer py-2">
               <p className="text-base md:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00C6FF] to-[#3B82F6] transition-all duration-300 group-hover/team:-translate-y-1 group-hover/team:opacity-0">
                  Zenex Team
               </p>
               <p className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#00C6FF] opacity-0 translate-y-1 group-hover/team:translate-y-0 group-hover/team:opacity-100 transition-all duration-300 underline underline-offset-2">
                  zenexpart44@gmail.com
               </p>
            </a>
            
            <p className="text-[9px] text-center text-[#94A3B8]">Secure Next.js B2B Engine</p>
          </div>
        </div>

        {/* Visible Badge */}
        <div className="bg-[#1E293B]/80 backdrop-blur-md border border-[#334155] text-[10px] md:text-xs font-mono font-bold text-[#94A3B8] px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-lg transition-all duration-300 hover:text-white hover:border-[#10B981] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer flex items-center gap-2">
          <span>V3.0.1 (Secured)</span>
          <svg className="w-3 h-3 md:w-4 md:h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      </div>

    </div>
  );
}