"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../DashboardLayout"; 

export default function UsersDirectoryPage() {
  const [role, setRole] = useState("user");
  const [userEmail, setUserEmail] = useState("");
  const [agentRate, setAgentRate] = useState<number>(0.70); 
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [myUsers, setMyUsers] = useState<any[]>([]);
  const [agentMaxLimit, setAgentMaxLimit] = useState(100);
  const [loading, setLoading] = useState(true);

  // 💥 NEW: Pagination State (40 Items / Page) 💥
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [stats, setStats] = useState({ activeUsers: 0, pendingUsers: 0, bannedUsers: 0 });
  const itemsPerPage = 40;

  const [newRate, setNewRate] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [isSaving, setIsSaving] = useState(false);

  // Search Debounce (Prevents API spam)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // 💥 THE MAGIC: Unified Paginated Fetcher 💥
  const fetchNetworkUsers = useCallback((email: string, userRole: string, isSilent = false) => {
    if (!isSilent) setLoading(true); 

    if (userRole === "admin") {
      fetch(`/api/get-all-users?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(debouncedSearch)}&t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data?.users && Array.isArray(data.users)) setMyUsers(data.users);
          if (data?.pagination) {
            setTotalPages(data.pagination.totalPages);
            setTotalUsersCount(data.pagination.total);
          }
          if (data?.stats) {
            // Admin stats format is slightly different, mapping it for UI
            setStats({ activeUsers: data.stats.activeAccounts, pendingUsers: 0, bannedUsers: data.stats.bannedAccounts });
          }
          setAgentMaxLimit(999999); 
          setLoading(false);
        })
        .catch(err => { console.error(err); setLoading(false); });
    } else {
      fetch(`/api/get-agent-users?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentEmail: email, page: currentPage, limit: itemsPerPage, search: debouncedSearch })
      })
        .then(res => res.json())
        .then(data => {
          if (data?.users && Array.isArray(data.users)) setMyUsers(data.users);
          if (data?.pagination) {
            setTotalPages(data.pagination.totalPages);
            setTotalUsersCount(data.pagination.total);
          }
          if (data?.stats) setStats(data.stats);
          if (data?.maxLimit) setAgentMaxLimit(Number(data.maxLimit)); 
          if (data?.agentRate) setAgentRate(Number(data.agentRate));
          setLoading(false);
        })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const currentRole = parsedUser?.role || "user";
        setRole(currentRole);

        if (currentRole === "agent" || currentRole === "admin") {
          setUserEmail(parsedUser.email); 
          fetchNetworkUsers(parsedUser.email, currentRole, false); 
          
          const interval = setInterval(() => {
             fetchNetworkUsers(parsedUser.email, currentRole, true); 
          }, 10000); // 10s auto sync
          
          return () => clearInterval(interval);
        }
      } catch (e) {
        console.error("Local Storage Error:", e);
      }
    }
  }, [fetchNetworkUsers]);

  const isSeatFull = role === "agent" && totalUsersCount >= agentMaxLimit;

  const openManageModal = (user: any) => {
    if(!user) return;
    setSelectedUser(user);
    
    const exactRate = (user?.rate !== undefined && user?.rate !== null) ? String(user.rate) : "0.00";
    setNewRate(exactRate);
    
    setNewStatus(String(user?.status || "active").toLowerCase()); 
    setNewPassword(""); 
    setNewPin(""); 
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (role === "agent" && Number(newRate) > Number(agentRate)) {
      alert(`🔴 ERROR: You cannot give a user more than your own limit! (Your Max Limit is ৳ ${Number(agentRate).toFixed(2)})`);
      setIsSaving(false);
      return; 
    }

    try {
      const res = await fetch("/api/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser?.id || selectedUser?._id,
          newPassword: newPassword,
          newPin: newPin, 
          newRate: newRate,
          newStatus: newStatus,
          requesterEmail: userEmail, 
          requesterRole: role        
        })
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

  const handleDeleteUser = async () => {
    const confirmDelete = window.confirm(`⚠️ DANGER ZONE!\nAre you absolutely sure you want to permanently delete "${selectedUser?.name || 'this user'}"?\nAll their data and balance will be lost. This CANNOT be undone!`);
    
    if (confirmDelete) {
      try {
        const res = await fetch("/api/delete-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: selectedUser?.email, requesterRole: role })
        });
        const data = await res.json();
        
        if (data.success) {
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

  if (role !== "agent" && role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white flex flex-col items-center justify-center font-black tracking-widest uppercase">
        <span className="text-[#F43F5E] text-4xl mb-2">⛔</span>
        Access Denied. Admins & Agents Only.
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full min-h-screen bg-[#0B0F1A] text-slate-200 pb-20">
        
        <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
               <h2 className={`text-2xl md:text-3xl font-black bg-gradient-to-r bg-clip-text text-transparent uppercase tracking-wider ${role === 'admin' ? 'from-[#F43F5E] to-[#EAB308]' : 'from-[#A855F7] to-[#EC4899]'}`}>
                 {role === "admin" ? "Global Users Directory" : "My Network Users"}
               </h2>
               <span className="flex h-3 w-3 relative">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
               </span>
            </div>
            <p className="text-sm text-[#94A3B8] mt-1">
              {role === "admin" ? "Master control panel for all registered users across the system." : "Manage your team, set custom OTP rates, and update passwords. (Max 40/Page)"}
            </p>
          </div>
          <div className="relative w-full lg:w-auto">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, Name or Email..." 
              className="w-full lg:min-w-[300px] bg-[#0F172A] border border-[#334155] text-white pl-10 pr-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:border-[#A855F7] transition-colors" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`bg-[#1E293B]/80 backdrop-blur-xl border border-[#334155] p-5 rounded-2xl shadow-lg relative overflow-hidden border-t-2 ${role === 'admin' ? 'border-t-[#F43F5E]' : 'border-t-[#A855F7]'}`}>
            <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider mb-1">Total Users</p>
            <h3 className="text-2xl md:text-3xl font-black text-white">
              {totalUsersCount} <span className="text-sm text-[#64748B] font-medium">{role === 'admin' ? '' : `/ ${agentMaxLimit}`}</span>
            </h3>
            {isSeatFull && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-[#F43F5E]/20 text-[#F43F5E] border border-[#F43F5E]/30 text-[10px] font-black uppercase tracking-widest rounded animate-pulse">
                Seat Full
              </span>
            )}
          </div>
          
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#10B981]/30 p-5 rounded-2xl shadow-lg border-t-2 border-t-[#10B981]">
            <p className="text-[#10B981] text-xs font-bold uppercase tracking-wider mb-1">Active Users</p>
            <h3 className="text-2xl md:text-3xl font-black text-[#10B981]">{stats.activeUsers}</h3>
          </div>
          
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#EAB308]/30 p-5 rounded-2xl shadow-lg border-t-2 border-t-[#EAB308]">
            <p className="text-[#EAB308] text-xs font-bold uppercase tracking-wider mb-1">Pending</p>
            <h3 className="text-2xl md:text-3xl font-black text-[#EAB308]">{stats.pendingUsers}</h3>
          </div>

          <div className="bg-red-500/5 backdrop-blur-xl border border-[#F43F5E]/30 p-5 rounded-2xl shadow-lg border-t-2 border-t-[#F43F5E] relative overflow-hidden">
            <p className="text-[#F43F5E] text-xs font-bold uppercase tracking-wider mb-1">Banned</p>
            <h3 className="text-2xl md:text-3xl font-black text-[#F43F5E]">
              {stats.bannedUsers}
            </h3>
          </div>
        </div>

        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#334155] rounded-2xl shadow-lg overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#0F172A]/50 text-[#94A3B8] uppercase text-[10px] tracking-widest border-b border-[#334155]">
              <tr>
                <th className="p-4 pl-6 font-black">User Identity</th>
                <th className="p-4 font-black text-center">Today's OTP</th>
                <th className="p-4 font-black">User Rate</th>
                <th className="p-4 font-black">User Balance</th>
                <th className="p-4 font-black">Status</th>
                <th className="p-4 pr-6 font-black text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/50">
              {loading ? (
                <tr><td colSpan={6} className="text-center p-8 text-[#A855F7] font-bold">Loading Page {currentPage}...</td></tr>
              ) : myUsers.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-8 text-[#64748B] font-bold">No users found.</td></tr>
              ) : (
                myUsers.map((u, i) => (
                  <tr key={u?.id || u?._id || i} className="hover:bg-[#334155]/20 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-[#E2E8F0]">{u?.name || "Unknown"}</p>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30">{u?.uid || "N/A"}</span>
                        {role === 'admin' && u?.role === 'agent' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-widest">AGENT</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#64748B]">{u?.email || "No Email"}</p>
                    </td>
                    <td className="p-4 text-center">
                       <p className="font-black text-white text-base">{u?.todayOTP || 0}</p>
                    </td>
                    <td className="p-4 font-black text-[#EAB308]">৳ {u?.rate !== undefined && u?.rate !== null ? Number(u.rate).toFixed(2) : "0.00"}</td>
                    <td className="p-4 font-black text-[#10B981]">৳ {u?.balance !== undefined && u?.balance !== null ? Number(u.balance).toFixed(2) : "0.00"}</td>
                    <td className="p-4">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${String(u?.status).toLowerCase() === 'active' ? 'bg-[#10B981]/10 text-[#10B981]' : String(u?.status).toLowerCase() === 'banned' ? 'bg-[#F43F5E]/10 text-[#F43F5E]' : 'bg-[#EAB308]/10 text-[#EAB308]'}`}>
                        {u?.status || "Pending"}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button onClick={() => openManageModal(u)} className={`px-4 py-2 rounded-lg text-xs font-black transition-colors border ${role === 'admin' ? 'bg-[#F43F5E]/10 hover:bg-[#F43F5E] text-[#F43F5E] hover:text-white border-[#F43F5E]/30' : 'bg-[#A855F7]/10 hover:bg-[#A855F7] text-[#A855F7] hover:text-white border-[#A855F7]/30'}`}>
                        Manage User
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* 💥 NEW: Server-Side Pagination Controls 💥 */}
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

        {/* User Manage Modal */}
        {isModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1E293B] border border-[#334155] rounded-3xl w-full max-w-md p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 text-[#94A3B8] hover:text-[#F43F5E] transition-colors font-black text-xl">✕</button>

              <div className="flex items-center gap-3 mb-5 border-b border-[#334155] pb-4">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black ${role === 'admin' ? 'bg-gradient-to-tr from-[#F43F5E] to-[#EAB308]' : 'bg-gradient-to-tr from-[#A855F7] to-[#EC4899]'}`}>
                   {selectedUser?.name ? selectedUser.name.charAt(0).toUpperCase() : "U"}
                 </div>
                 <div>
                   <h3 className="text-lg font-black text-white leading-tight">{selectedUser?.name || "Unknown"}</h3>
                   <p className="text-[10px] font-mono text-[#94A3B8] font-bold">{selectedUser?.email}</p>
                 </div>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">Account Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full bg-[#0F172A] border border-[#334155] text-white font-bold px-4 py-3 rounded-xl text-sm focus:outline-none">
                    <option value="active">Active (Can Work)</option>
                    <option value="pending">Pending (Waiting Approval)</option>
                    <option value="banned">Banned (Blocked)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-[#EAB308] uppercase font-bold mb-1">
                    Set User Pay Rate {role === "agent" ? `(Max: ৳ ${Number(agentRate || 0).toFixed(2)})` : `(Admin Override)`}
                  </label>
                  <input type="number" step="0.01" value={newRate} onChange={(e) => setNewRate(e.target.value)} required
                    className="w-full bg-[#0F172A] border border-[#334155] text-white font-black px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[#EAB308]" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#F43F5E] uppercase font-bold mb-1">Reset Password</label>
                    <input type="text" placeholder="New Password..." value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#0F172A] border border-[#334155] focus:border-[#F43F5E] text-white px-4 py-3 rounded-xl text-sm focus:outline-none placeholder-[#334155]" />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-[#10B981] uppercase font-bold mb-1">Reset Withdraw PIN</label>
                    <input type="text" placeholder="New 4-digit PIN..." value={newPin} maxLength={4} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[#0F172A] border border-[#334155] focus:border-[#10B981] text-white px-4 py-3 rounded-xl text-sm focus:outline-none placeholder-[#334155] text-center tracking-widest font-mono" />
                  </div>
                </div>
                
                <button type="submit" disabled={isSaving} className={`w-full py-3.5 mt-2 rounded-xl text-white font-black text-sm transition-transform hover:-translate-y-1 disabled:opacity-50 ${role === 'admin' ? 'bg-gradient-to-r from-[#F43F5E] to-[#EAB308] shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-[0_0_15px_rgba(168,85,247,0.4)]'}`}>
                  {isSaving ? "Saving..." : "Update User Details"}
                </button>

                <div className="pt-2 text-center">
                  <button type="button" onClick={handleDeleteUser} className="text-[10px] font-bold text-[#F43F5E] hover:text-white hover:underline transition-colors flex items-center justify-center w-full gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Permanently delete this user
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}