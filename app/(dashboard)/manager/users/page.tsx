"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation"; 

export default function ManagerUsersDirectoryPage() {
  const router = useRouter(); 

  const [role, setRole] = useState("user");
  const [userEmail, setUserEmail] = useState("");
  const [agentRate, setAgentRate] = useState<number>(0.70); 
  
  // 💥 NEW: Agent's Real-Time API Permission State 💥
  const [hasApiPermission, setHasApiPermission] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [myUsers, setMyUsers] = useState<any[]>([]);
  const [agentMaxLimit, setAgentMaxLimit] = useState(100);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [stats, setStats] = useState({ activeUsers: 0, pendingUsers: 0, bannedUsers: 0 });
  const itemsPerPage = 40;

  const [newRate, setNewRate] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [newApiStatus, setNewApiStatus] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // 💥 REAL-TIME PERMISSION CHECKER 💥
  const checkAgentPermission = useCallback(async (email: string) => {
    try {
      const res = await fetch("/api/get-user-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data?.user) {
        setHasApiPermission(data.user.canManageApi || false);
      }
    } catch (e) {}
  }, []);

  const fetchNetworkUsers = useCallback((email: string, userRole: string, isSilent = false) => {
    if (!isSilent) setLoading(true); 

    fetch(`/api/get-agent-users?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentEmail: email, page: currentPage, limit: itemsPerPage, search: debouncedSearch, status: statusFilter })
    })
      .then(res => res.json())
      .then(data => {
        if (data?.users && Array.isArray(data.users)) {
          const sortedUsers = [...data.users].sort((a, b) => {
            const valA = a.createdAt ? new Date(a.createdAt).getTime() : (a._id ? a._id.toString() : "");
            const valB = b.createdAt ? new Date(b.createdAt).getTime() : (b._id ? b._id.toString() : "");
            if (valA > valB) return -1;
            if (valA < valB) return 1;
            return 0;
          });
          setMyUsers(sortedUsers);
        }
        
        if (data?.pagination) {
          setTotalPages(data.pagination.totalPages);
        }

        if (data?.stats) {
          setStats(data.stats);
          setTotalUsersCount(data.stats.globalTotal || 0); 
        }

        if (data?.maxLimit) setAgentMaxLimit(Number(data.maxLimit)); 
        if (data?.agentRate) setAgentRate(Number(data.agentRate));
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });
  }, [currentPage, debouncedSearch, statusFilter]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        
        if (parsedUser.role === "admin") { router.push("/admin/users"); return; }
        if (parsedUser.role !== "agent") { router.push("/dashboard"); return; }

        setRole(parsedUser.role);
        setUserEmail(parsedUser.email); 
        
        // Initial Fetch
        fetchNetworkUsers(parsedUser.email, parsedUser.role, false); 
        checkAgentPermission(parsedUser.email);
        
        const interval = setInterval(() => {
           fetchNetworkUsers(parsedUser.email, parsedUser.role, true); 
           checkAgentPermission(parsedUser.email); // Keeps permission updated real-time
        }, 10000); 
        
        return () => clearInterval(interval);
      } catch (e) {
        console.error("Local Storage Error:", e);
      }
    } else {
      router.push("/login");
    }
  }, [fetchNetworkUsers, checkAgentPermission, router]);

  const isSeatFull = role === "agent" && stats.activeUsers >= agentMaxLimit;

  const openManageModal = (user: any) => {
    if(!user) return;
    setSelectedUser(user);
    const exactRate = (user?.rate !== undefined && user?.rate !== null) ? String(user.rate) : "0.00";
    setNewRate(exactRate);
    setNewStatus(String(user?.status || "active").toLowerCase()); 
    setNewPassword(""); 
    setNewPin(""); 
    setNewApiStatus(user?.isApiActive || false); 
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (role === "agent" && Number(newRate) > Number(agentRate)) {
      alert(`🔴 ERROR: You cannot give a user more than your own limit! (Your Max Limit is $ ${Number(agentRate).toFixed(2)})`);
      setIsSaving(false);
      return; 
    }

    try {
      const payload: any = {
        userId: selectedUser?.id || selectedUser?._id,
        newPassword: newPassword,
        newPin: newPin, 
        newRate: newRate,
        newStatus: newStatus,
        requesterEmail: userEmail, 
        requesterRole: role        
      };

      // Only send API status if agent has permission
      if (hasApiPermission) {
        payload.isApiActive = newApiStatus;
      }

      const res = await fetch("/api/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        alert("✅ Successfully Updated User!");
        setIsModalOpen(false);
        fetchNetworkUsers(userEmail, role, true); 
      } else {
        alert(data.message || "Failed to update user!");
      }
    } catch (error) {
      alert("Network Error!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateNewKey = async () => {
    if (!confirm("⚠️ Are you sure you want to generate a new API key? The old key will immediately stop working!")) return;
    
    const res = await fetch("/api/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        userId: selectedUser?.id || selectedUser?._id, 
        generateNewKey: true 
      })
    });
    
    const data = await res.json();
    if (res.ok) { 
      alert("✅ Success! New API Key generated."); 
      fetchNetworkUsers(userEmail, role, true); 
      setIsModalOpen(false); 
    } else {
      alert(data.message);
    }
  };

  const handleDeleteUser = async () => {
    const confirmDelete = window.confirm(`⚠️ DANGER ZONE!\nAre you absolutely sure you want to permanently delete "${selectedUser?.name || 'this user'}"?\nAll their data and balance will be lost. This CANNOT be undone!`);
    
    if (confirmDelete) {
      try {
        const res = await fetch(`/api/admin/delete-user?email=${selectedUser?.email}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": userEmail,
            "X-User-Role": role
          }
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
          alert(`✅ User has been permanently removed!`);
          setIsModalOpen(false);
          fetchNetworkUsers(userEmail, role, true); 
        } else {
          alert(`❌ Failed: ${data.message}`);
        }
      } catch (err) {
        alert("Server Error! Could not delete.");
      }
    }
  };

  return (
    <div className="p-4 md:p-8 w-full relative z-10 pb-20 font-sans">
        
        <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
               <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] bg-clip-text text-transparent uppercase tracking-wider">
                 Network Operators
               </h2>
               <span className="flex h-2.5 w-2.5 relative">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00D2FF]"></span>
               </span>
            </div>
            <p className="text-xs text-[#6C84A3] mt-1.5 font-medium tracking-wide">
              Control roster, OTP rates, and credentials. (Max 40 / page)
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:min-w-[300px]">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6C84A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Trace ID, name or email..." 
                className="w-full bg-[#0B152A] border border-[#162749] text-[#F8FAFC] pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:border-[#00D2FF] transition-colors placeholder:text-[#6C84A3]/60" 
              />
            </div>
            
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0B152A] border border-[#162749] text-[#F8FAFC] font-semibold px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#00D2FF] transition-colors cursor-pointer"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-[#0B152A] border border-[#162749] p-4 md:p-5 rounded-2xl shadow-[inset_0_1px_4px_rgba(255,255,255,0.02)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#6C84A3] opacity-30 group-hover:opacity-100 transition-opacity"></div>
            <p className="text-[#6C84A3] text-[10px] font-semibold uppercase tracking-widest mb-1.5">Total Operators</p>
            <h3 className="text-2xl md:text-3xl font-bold text-[#F8FAFC]">{totalUsersCount}</h3>
          </div>
          
          <div className="bg-[#0B152A] border border-[#162749] p-4 md:p-5 rounded-2xl shadow-[inset_0_1px_4px_rgba(0,210,255,0.02)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#00D2FF] opacity-50 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_#00D2FF]"></div>
            <p className="text-[#00D2FF] text-[10px] font-semibold uppercase tracking-widest mb-1.5">Active Seats</p>
            <h3 className="text-2xl md:text-3xl font-bold text-[#00D2FF]">
              {stats.activeUsers} <span className="text-sm text-[#6C84A3] font-medium ml-1">/ {agentMaxLimit}</span>
            </h3>
            {isSeatFull && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/30 text-[9px] font-semibold uppercase tracking-widest rounded animate-pulse">Seat Full</span>
            )}
          </div>
          
          <div className="bg-[#0B152A] border border-[#162749] p-4 md:p-5 rounded-2xl shadow-[inset_0_1px_4px_rgba(96,165,250,0.02)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#60A5FA] opacity-50 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_#60A5FA]"></div>
            <p className="text-[#60A5FA] text-[10px] font-semibold uppercase tracking-widest mb-1.5">Pending</p>
            <h3 className="text-2xl md:text-3xl font-bold text-[#60A5FA]">{stats.pendingUsers}</h3>
          </div>

          <div className="bg-[#0B152A] border border-[#162749] p-4 md:p-5 rounded-2xl shadow-[inset_0_1px_4px_rgba(244,63,94,0.02)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#F43F5E] opacity-50 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_#F43F5E]"></div>
            <p className="text-[#F43F5E] text-[10px] font-semibold uppercase tracking-widest mb-1.5">Banned</p>
            <h3 className="text-2xl md:text-3xl font-bold text-[#F43F5E]">{stats.bannedUsers}</h3>
          </div>
        </div>

        <div className="bg-[#0B152A] border border-[#162749] rounded-2xl shadow-lg overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[780px]">
              <thead className="bg-[#030816] text-[#6C84A3] uppercase text-[10px] tracking-widest border-b border-[#162749]">
                <tr>
                  <th className="p-4 pl-6 font-semibold">Operator Identity</th>
                  <th className="p-4 font-semibold text-center">Today's OTP</th>
                  <th className="p-4 font-semibold">User Rate</th>
                  <th className="p-4 font-semibold">Balance</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 pr-6 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162749]/50">
                {loading ? (
                  Array.from({ length: 7 }).map((_, idx) => (
                    <tr key={idx} className="bg-transparent">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-4 w-32 bg-[#162749] rounded animate-pulse"></div>
                          <div className="h-4 w-16 bg-[#162749] rounded animate-pulse"></div>
                        </div>
                        <div className="h-3 w-40 bg-[#162749] rounded animate-pulse"></div>
                      </td>
                      <td className="p-4 text-center">
                         <div className="h-6 w-8 bg-[#162749] rounded animate-pulse mx-auto"></div>
                      </td>
                      <td className="p-4"><div className="h-5 w-16 bg-[#162749] rounded animate-pulse"></div></td>
                      <td className="p-4"><div className="h-5 w-20 bg-[#162749] rounded animate-pulse"></div></td>
                      <td className="p-4"><div className="h-5 w-16 bg-[#162749] rounded-md animate-pulse"></div></td>
                      <td className="p-4 pr-6 text-right">
                        <div className="h-8 w-24 bg-[#162749] rounded-lg animate-pulse ml-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : myUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-12 text-[#6C84A3] font-semibold">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-10 h-10 text-[#162749]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        No operators found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  myUsers.map((u, i) => (
                    <tr key={u?.id || u?._id || i} className="hover:bg-[#101726] transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-[#F8FAFC]">{u?.name || "Unknown"}</p>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/30">{u?.uid || "N/A"}</span>
                          {u?.isApiActive && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#60A5FA]/10 text-[#60A5FA] border border-[#60A5FA]/30 uppercase tracking-widest">API</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#6C84A3] font-medium">{u?.email || "No Email"}</p>
                      </td>
                      <td className="p-4 text-center">
                         <p className="font-bold text-[#F8FAFC] text-base">{u?.todayOTP || 0}</p>
                      </td>
                      <td className="p-4 font-semibold text-[#60A5FA]">$ {u?.rate !== undefined && u?.rate !== null ? Number(u.rate).toFixed(2) : "0.00"}</td>
                      <td className="p-4 font-semibold text-[#00D2FF]">$ {u?.balance !== undefined && u?.balance !== null ? Number(u.balance).toFixed(2) : "0.00"}</td>
                      <td className="p-4">
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded uppercase tracking-widest ${String(u?.status).toLowerCase() === 'active' ? 'bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20' : String(u?.status).toLowerCase() === 'banned' ? 'bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/20' : 'bg-[#60A5FA]/10 text-[#60A5FA] border border-[#60A5FA]/20'}`}>
                          {u?.status || "Pending"}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <button 
                          onClick={() => openManageModal(u)} 
                          className="px-4 py-2 rounded-lg text-xs font-semibold transition-all border bg-[#00D2FF]/10 hover:bg-[#00D2FF] text-[#00D2FF] hover:text-[#030816] border-[#00D2FF]/30"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="p-4 border-t border-[#162749] bg-[#101726] flex items-center justify-between">
               <button 
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                 disabled={currentPage === 1} 
                 className="px-4 py-2 bg-[#0B152A] text-[#F8FAFC] text-xs font-semibold rounded-lg border border-[#162749] disabled:opacity-40 hover:border-[#00D2FF]/40 hover:text-[#00D2FF] transition-colors"
               >
                 ← Previous
               </button>
               <span className="text-xs font-semibold text-[#6C84A3] tracking-wide">
                 Page <span className="text-[#F8FAFC]">{currentPage}</span> of {totalPages}
               </span>
               <button 
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                 disabled={currentPage === totalPages} 
                 className="px-4 py-2 bg-[#0B152A] text-[#F8FAFC] text-xs font-semibold rounded-lg border border-[#162749] disabled:opacity-40 hover:border-[#00D2FF]/40 hover:text-[#00D2FF] transition-colors"
               >
                 Next →
               </button>
            </div>
          )}
        </div>

        {isModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#030816]/80 backdrop-blur-sm p-4">
            <div className="bg-[#0B152A] border border-[#162749] rounded-2xl w-full max-w-md p-6 shadow-[0_20px_60px_-15px_rgba(0,210,255,0.15)] relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="absolute top-5 right-5 text-[#6C84A3] hover:text-[#F43F5E] transition-colors font-semibold text-lg"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-5 border-b border-[#162749] pb-4">
                 <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#101726] border border-[#162749] text-[#00D2FF] shadow-[inset_0_1px_4px_rgba(0,210,255,0.06)]">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                   </svg>
                 </div>
                 <div>
                   <h3 className="text-base font-bold text-[#F8FAFC] leading-tight tracking-tight">{selectedUser?.name || "Unknown"}</h3>
                   <p className="text-[10px] font-mono text-[#6C84A3] font-medium mt-0.5">{selectedUser?.email}</p>
                 </div>
              </div>

              {hasApiPermission && (
                <div className="mb-5 bg-[#101726] border border-[#162749] p-4 rounded-xl flex flex-col gap-3">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-semibold text-[#00D2FF]">Developer API Access</p>
                       <p className="text-[9px] text-[#6C84A3] mt-1 font-medium">Allow operator to generate numbers via API</p>
                     </div>
                     <button 
                       type="button" 
                       onClick={() => setNewApiStatus(!newApiStatus)} 
                       className={`relative w-12 h-6 rounded-full flex items-center p-1 transition-colors duration-300 ${newApiStatus ? 'bg-[#00D2FF]' : 'bg-[#162749]'}`}
                     >
                       <div className={`w-4 h-4 bg-[#F8FAFC] rounded-full transition-transform duration-300 shadow-md ${newApiStatus ? 'translate-x-6' : 'translate-x-0'}`}></div>
                     </button>
                   </div>
                   <div className="border-t border-[#162749] pt-3 mt-1 flex justify-between items-center">
                     <span className="text-[10px] text-[#6C84A3] font-semibold">Compromised Key?</span>
                     <button 
                       type="button" 
                       onClick={handleGenerateNewKey} 
                       className="bg-[#00D2FF]/10 hover:bg-[#00D2FF]/20 border border-[#00D2FF]/40 text-[#00D2FF] px-3 py-1.5 rounded-lg font-semibold text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5"
                     >
                       <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                       Generate Key
                     </button>
                   </div>
                </div>
              )}

              <form onSubmit={handleSaveUser} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-[#6C84A3] uppercase font-semibold mb-1.5 tracking-widest">Account Status</label>
                  <select 
                    value={newStatus} 
                    onChange={(e) => setNewStatus(e.target.value)} 
                    className="w-full bg-[#101726] border border-[#162749] text-[#F8FAFC] font-semibold px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[#00D2FF] cursor-pointer"
                  >
                    <option value="active">Active (Can Work)</option>
                    <option value="pending">Pending (Waiting Approval)</option>
                    <option value="banned">Banned (Blocked)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-[#60A5FA] uppercase font-semibold mb-1.5 tracking-widest">
                    Set User Pay Rate (Max: $ {Number(agentRate || 0).toFixed(2)})
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={newRate} 
                    onChange={(e) => setNewRate(e.target.value)} 
                    required 
                    className="w-full bg-[#101726] border border-[#162749] text-[#F8FAFC] font-bold px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[#60A5FA]" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#F43F5E] uppercase font-semibold mb-1.5 tracking-widest">Reset Password</label>
                    <input 
                      type="text" 
                      placeholder="New Password..." 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      className="w-full bg-[#101726] border border-[#162749] focus:border-[#F43F5E] text-[#F8FAFC] px-4 py-3 rounded-xl text-sm focus:outline-none placeholder-[#6C84A3]/40" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-[#00D2FF] uppercase font-semibold mb-1.5 tracking-widest">Reset Withdraw PIN</label>
                    <input 
                      type="text" 
                      placeholder="4-digit PIN..." 
                      value={newPin} 
                      maxLength={4} 
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} 
                      className="w-full bg-[#101726] border border-[#162749] focus:border-[#00D2FF] text-[#F8FAFC] px-4 py-3 rounded-xl text-sm focus:outline-none placeholder-[#6C84A3]/40 text-center tracking-widest font-mono" 
                    />
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="w-full py-3.5 mt-1 rounded-xl text-[#030816] font-bold text-sm uppercase tracking-widest transition-all hover:-translate-y-0.5 disabled:opacity-50 bg-[#00D2FF] hover:bg-[#60A5FA] shadow-[0_0_18px_rgba(0,210,255,0.35)]"
                >
                  {isSaving ? "Saving..." : "Commit Changes"}
                </button>

                <div className="pt-1 text-center">
                  <button 
                    type="button" 
                    onClick={handleDeleteUser} 
                    className="text-[10px] font-semibold text-[#F43F5E] hover:text-[#F8FAFC] hover:underline transition-colors flex items-center justify-center w-full gap-1.5"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Permanently delete this operator
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

    </div>
  );
}