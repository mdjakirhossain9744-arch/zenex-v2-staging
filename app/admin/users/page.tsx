"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation"; 
import DashboardLayout from "../../DashboardLayout"; 

export default function AdminUsersManagementPage() {
  const router = useRouter(); 

  const [role, setRole] = useState("user");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ totalUsers: 0, totalAgents: 0, activeAccounts: 0, bannedAccounts: 0 });
  const itemsPerPage = 50;

  const [isMakingAgent, setIsMakingAgent] = useState(false);
  const [newRate, setNewRate] = useState("");
  
  const [newPassword, setNewPassword] = useState(""); 
  const [newPin, setNewPin] = useState(""); 
  const [newStatus, setNewStatus] = useState("active"); 
  const [customMail, setCustomMail] = useState("");
  const [contactLink, setContactLink] = useState("");
  const [maxLimit, setMaxLimit] = useState("100"); 
  
  // API States
  const [newApiStatus, setNewApiStatus] = useState(false);
  const [canManageApi, setCanManageApi] = useState(false); 
  
  const [newAgentEmail, setNewAgentEmail] = useState(""); 
  const [handoverEmail, setHandoverEmail] = useState(""); 

  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [cachedAgentOptions, setCachedAgentOptions] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUsers = useCallback((isSilent = false) => {
    if (!isSilent) setLoading(true);
    
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("limit", itemsPerPage.toString());
    params.set("search", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (agentFilter !== "all") params.set("agent", agentFilter);
    params.set("t", Date.now().toString());

    fetch(`/api/get-all-users?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.users) setAllUsers(data.users);
        if (data.pagination) setTotalPages(data.pagination.totalPages);
        if (data.stats) setStats(data.stats);
        
        if (cachedAgentOptions.length === 0 && data.users) {
           const agents = data.users.filter((u: any) => u.role === 'agent');
           if (agents.length > 0) {
             setCachedAgentOptions(agents);
           }
        }
        
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentPage, debouncedSearch, statusFilter, agentFilter, cachedAgentOptions.length]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      
      if (parsedUser.role === "agent") { router.push("/manager/users"); return; }
      if (parsedUser.role !== "admin") { router.push("/dashboard"); return; }

      setRole(parsedUser.role);
      fetchUsers(false);
      const interval = setInterval(() => { fetchUsers(true); }, 10000);
      return () => clearInterval(interval);
    } else {
      router.push("/login");
    }
  }, [fetchUsers, router]);

  const openManageModal = (user: any) => {
    setSelectedUser(user);
    setNewRate(user.rate);
    setNewStatus(user.status?.toLowerCase() || "active");
    setNewPassword(""); 
    setNewPin(""); 
    setNewApiStatus(user.isApiActive || false); 
    setCanManageApi(user.canManageApi || false); 
    setNewAgentEmail(user.agentEmail || ""); 
    setHandoverEmail(""); 
    
    if (user.role === "agent") {
      setCustomMail(user.customAgentMail || ""); 
      setContactLink(user.telegramLink || "");
      setMaxLimit(user.agentMaxUsers?.toString() || "100"); 
      setIsMakingAgent(true); 
    } else {
      setCustomMail(""); 
      setContactLink("");
      setMaxLimit("100"); 
      setIsMakingAgent(false); 
    }

    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent, makeRole: string) => {
    e.preventDefault();
    
    const storedUser = localStorage.getItem("user");
    const adminEmail = storedUser ? JSON.parse(storedUser).email : "";
    const adminRole = storedUser ? JSON.parse(storedUser).role : "";

    const payload = {
      userId: selectedUser.id,
      newPassword: newPassword,
      newPin: newPin, 
      newRate: newRate,
      newStatus: newStatus,
      newRole: makeRole, 
      customMail: makeRole === "agent" ? customMail : "",   
      contactLink: makeRole === "agent" ? contactLink : "",
      maxLimit: makeRole === "agent" ? maxLimit : 100,
      isApiActive: newApiStatus, 
      canManageApi: canManageApi,
      newAgentEmail: newAgentEmail !== selectedUser.agentEmail ? newAgentEmail : undefined,
      handoverToEmail: handoverEmail, 
      requesterEmail: adminEmail,
      requesterRole: adminRole
    };

    const res = await fetch("/api/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (res.ok) {
      alert("✅ Successfully Updated!");
      setIsModalOpen(false);
      fetchUsers(true); 
    } else alert(data.message);
  };

  const handleGenerateNewKey = async () => {
    if (!confirm("⚠️ DANGER: Are you sure you want to generate a new API key? The old key will immediately stop working!")) return;
    
    const res = await fetch("/api/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUser.id,
        generateNewKey: true 
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Success! A new API Key has been generated and saved.");
      fetchUsers(true);
      setIsModalOpen(false); 
    } else {
      alert(data.message);
    }
  };

  const handleQuickUnban = async (user: any) => {
    if (!confirm(`Are you sure you want to UNBAN ${user.name || "this user"}?`)) return;
    
    const res = await fetch("/api/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        newStatus: "active",
        newRole: user.role,
        newRate: user.rate || user.otpRate,
        customMail: user.customAgentMail || "",
        contactLink: user.telegramLink || "",
        maxLimit: user.agentMaxUsers || 100,
        isApiActive: user.isApiActive || false,
        canManageApi: user.canManageApi || false
      })
    });
    
    if (res.ok) {
      alert("✅ User has been Unbanned and is now Active!");
      fetchUsers(true); 
    } else {
      alert("Failed to unban user.");
    }
  };

  const handleDeleteUser = async () => {
    const confirmDelete = window.confirm(`⚠️ DANGER ZONE!\nAre you absolutely sure you want to permanently delete "${selectedUser?.name || 'this Unknown user'}"?\nAll their data and balance will be lost. This CANNOT be undone!`);
    
    if (confirmDelete) {
      try {
        const storedUser = localStorage.getItem("user");
        const adminEmail = storedUser ? JSON.parse(storedUser).email : "";

        const deleteUrl = selectedUser?.email 
           ? `/api/admin/delete-user?email=${selectedUser.email}` 
           : `/api/admin/delete-user?id=${selectedUser.id}`;

        const res = await fetch(deleteUrl, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": adminEmail,
            "X-User-Role": "admin"
          }
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
          alert(`✅ User has been permanently removed!`);
          setIsModalOpen(false);
          fetchUsers(true); 
        } else {
          alert(`❌ Failed: ${data.message}`);
        }
      } catch (err) {
        alert("Server Error! Could not delete.");
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full min-h-screen bg-[#0B0F1A] text-slate-200 pb-20">
        
        <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
               <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent uppercase tracking-wider">
                 Global Users Directory
               </h2>
               <span className="flex h-3 w-3 relative">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
               </span>
            </div>
            <p className="text-sm text-[#94A3B8] mt-1">Enterprise Pagination Active (Max 50 per page).</p>
          </div>
          <div className="relative w-full lg:w-auto">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                 setSearchQuery(e.target.value);
                 setCurrentPage(1);
              }}
              placeholder="Search by Name, Email, UID (ZX-...), Agent..." 
              className="w-full lg:min-w-[350px] bg-[#0F172A] border border-[#334155] text-white px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:border-[#3B82F6]" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#8B5CF6]">
            <p className="text-[#94A3B8] text-[10px] font-black uppercase tracking-widest mb-1">Total Agents</p>
            <h3 className="text-3xl font-black text-[#8B5CF6]">{stats.totalAgents}</h3>
          </div>
          <div className="bg-[#1E293B]/80 border border-[#334155] p-5 rounded-2xl border-t-2 border-t-[#3B82F6]">
            <p className="text-[#94A3B8] text-[10px] font-black uppercase tracking-widest mb-1">Total Users</p>
            <h3 className="text-3xl font-black text-[#3B82F6]">{stats.totalUsers}</h3>
          </div>
          <div className="bg-[#1E293B]/80 border border-[#10B981]/30 p-5 rounded-2xl border-t-2 border-t-[#10B981]">
            <p className="text-[#10B981] text-[10px] font-black uppercase tracking-widest mb-1">Active Accounts</p>
            <h3 className="text-3xl font-black text-[#10B981]">{stats.activeAccounts}</h3>
          </div>
          <div className="bg-red-500/5 border border-red-500/30 p-5 rounded-2xl border-t-2 border-t-red-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full"></div>
            <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-1">Banned Accounts</p>
            <h3 className="text-3xl font-black text-red-500">{stats.bannedAccounts}</h3>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#1E293B]/50 border border-[#334155] p-4 rounded-xl">
          <div>
            <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">Filter by Status</label>
            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#0F172A] border border-[#334155] text-white font-bold px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="banned">Banned</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">Filter by Agent (View Network)</label>
            <select 
              value={agentFilter} 
              onChange={(e) => { setAgentFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#0F172A] border border-[#334155] text-white font-bold px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="all">All Agents</option>
              {cachedAgentOptions.map(ag => (
                <option key={ag.id} value={ag.customAgentMail || ag.email}>
                  {ag.name || "Unknown"} ({ag.customAgentMail || ag.email || "No Email"})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-[#1E293B]/80 border border-[#334155] rounded-2xl shadow-lg overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#0F172A]/50 text-[#94A3B8] uppercase text-[10px] tracking-widest border-b border-[#334155]">
              <tr>
                <th className="p-4 pl-6 font-black">User Identity</th>
                <th className="p-4 font-black">Role / Agent</th>
                <th className="p-4 font-black text-center">Rate</th>
                <th className="p-4 font-black">Balance</th>
                <th className="p-4 font-black text-center">Today OTP</th>
                <th className="p-4 font-black">Status</th>
                <th className="p-4 pr-6 font-black text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/50">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4 pl-6">
                      <div className="h-4 bg-[#334155] rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-[#334155]/50 rounded w-1/2"></div>
                    </td>
                    <td className="p-4"><div className="h-5 bg-[#334155] rounded w-20"></div></td>
                    <td className="p-4 text-center"><div className="h-4 bg-[#334155] rounded w-10 mx-auto"></div></td>
                    <td className="p-4"><div className="h-4 bg-[#334155] rounded w-16"></div></td>
                    <td className="p-4 text-center"><div className="h-4 bg-[#334155] rounded w-8 mx-auto"></div></td>
                    <td className="p-4"><div className="h-5 bg-[#334155] rounded w-16"></div></td>
                    <td className="p-4 pr-6 text-right"><div className="h-8 bg-[#334155] rounded w-20 ml-auto"></div></td>
                  </tr>
                ))
              ) : allUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-[#64748B] font-bold">No users found.</td>
                </tr>
              ) : (
                allUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#334155]/20 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-[#E2E8F0]">{u.name || "Unknown User"}</p>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/30">
                          {u.uid}
                        </span>
                        {u.isApiActive && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-widest">API</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#64748B]">{u.email || "No Email Provided"}</p>
                    </td>
                    <td className="p-4">
                      {u.role === 'admin' ? (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-[#F43F5E]/10 text-[#F43F5E] rounded border border-[#F43F5E]/30 uppercase">Super Admin</span>
                      ) : u.role === 'agent' ? (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded border border-[#8B5CF6]/30 uppercase tracking-widest">Agent 👑</span>
                      ) : (
                        <span className="text-xs font-medium text-[#3B82F6]">{u.agentEmail || "Admin"}</span>
                      )}
                    </td>
                    <td className="p-4 text-center text-[12px] font-bold text-[#EAB308]">৳ {u.rate}</td>
                    <td className="p-4 font-black text-[#10B981]">৳ {u.balance}</td>
                    <td className="p-4 text-center font-black text-[#00C6FF]">{u.todayOTP}</td>
                    <td className="p-4">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${u.status?.toLowerCase() === 'active' ? 'bg-[#10B981]/10 text-[#10B981]' : u.status?.toLowerCase() === 'banned' ? 'bg-[#F43F5E]/10 text-[#F43F5E]' : 'bg-[#EAB308]/10 text-[#EAB308]'}`}>
                        {u.status || "Unknown"}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right flex justify-end gap-2">
                      {u.role === 'agent' && (
                         <button 
                           onClick={() => { setAgentFilter(u.customAgentMail || u.email); setCurrentPage(1); }} 
                           className="bg-[#8B5CF6]/10 hover:bg-[#8B5CF6] text-[#8B5CF6] hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition-colors border border-[#8B5CF6]/30 shadow-sm"
                         >
                           👁️ View Team
                         </button>
                      )}
                      {u.status?.toLowerCase() === 'banned' && (
                        <button 
                          onClick={() => handleQuickUnban(u)} 
                          className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition-colors border border-red-500/30"
                        >
                          Unban
                        </button>
                      )}
                      <button 
                        onClick={() => openManageModal(u)} 
                        className="bg-[#3B82F6]/10 hover:bg-[#3B82F6] text-[#3B82F6] hover:text-white px-4 py-1.5 rounded-lg text-xs font-black transition-colors border border-[#3B82F6]/30 shadow-sm"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="p-4 border-t border-[#334155] bg-[#0F172A]/50 flex items-center justify-between">
               <button 
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                 disabled={currentPage === 1} 
                 className="px-4 py-2 bg-[#1E293B] text-white text-xs font-bold rounded-lg border border-[#334155] disabled:opacity-50 hover:bg-[#334155] transition-colors"
               >
                 ← Previous
               </button>
               <span className="text-xs font-black text-[#94A3B8]">
                 Page <span className="text-white">{currentPage}</span> of {totalPages}
               </span>
               <button 
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                 disabled={currentPage === totalPages} 
                 className="px-4 py-2 bg-[#1E293B] text-white text-xs font-bold rounded-lg border border-[#334155] disabled:opacity-50 hover:bg-[#334155] transition-colors"
               >
                 Next →
               </button>
            </div>
          )}
        </div>

        {isModalOpen && selectedUser && (
          /* 💥 Z-INDEX 9999 + OVERFLOW HIDDEN - MODAL WILL NEVER GO BEHIND THE HEADER 💥 */
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
            
            {/* 💥 MAX HEIGHT 85VH + FLEX COL - ENSURES THE MODAL STAYS ON SCREEN 💥 */}
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
              
              {/* 💥 STICKY HEADER WITH CLOSE BUTTON - ALWAYS VISIBLE AT THE TOP 💥 */}
              <div className="flex justify-between items-center p-4 border-b border-[#334155] bg-[#0F172A] rounded-t-2xl shrink-0">
                 <div className="flex items-center gap-3 overflow-hidden">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#00C6FF] flex items-center justify-center text-white font-black shrink-0">
                     {selectedUser?.name ? selectedUser.name.charAt(0).toUpperCase() : "U"}
                   </div>
                   <div className="overflow-hidden">
                     <h3 className="text-base font-black text-white leading-tight flex items-center gap-1">
                       <span className="truncate">{selectedUser?.name || "Unknown"}</span>
                       <span className="text-[9px] text-[#8B5CF6] uppercase border border-[#8B5CF6]/50 px-1 rounded shrink-0">{selectedUser?.role || "user"}</span>
                     </h3>
                     <p className="text-[10px] font-mono text-[#3B82F6] font-bold truncate">{selectedUser?.email || "No Email"}</p>
                   </div>
                 </div>
                 
                 <button 
                   onClick={() => setIsModalOpen(false)} 
                   className="w-8 h-8 min-w-[2rem] bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors font-black text-lg shrink-0"
                 >
                   ✕
                 </button>
              </div>

              {/* 💥 SCROLLABLE BODY - USER SCROLLS ONLY INSIDE THIS AREA 💥 */}
              <div className="p-5 overflow-y-auto custom-scrollbar rounded-b-2xl">
                
                <div className="mb-5 bg-[#0F172A] border border-[#334155] p-4 rounded-xl flex flex-col gap-3">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-black text-purple-400">Developer API Access</p>
                       <p className="text-[9px] text-[#64748B] mt-1 font-bold">Allow user to generate numbers via API</p>
                     </div>
                     <button 
                       type="button"
                       onClick={() => setNewApiStatus(!newApiStatus)} 
                       className={`relative w-12 h-6 rounded-full flex items-center p-1 transition-colors duration-300 ${newApiStatus ? 'bg-[#10B981]' : 'bg-[#334155]'}`}
                     >
                       <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${newApiStatus ? 'translate-x-6' : 'translate-x-0'}`}></div>
                     </button>
                   </div>
                   
                   {selectedUser.role !== 'agent' && (
                      <div className="border-t border-[#334155] pt-3 mt-1 flex justify-between items-center">
                        <span className="text-[10px] text-[#64748B] font-bold">Compromised Key?</span>
                        <button 
                          type="button"
                          onClick={handleGenerateNewKey}
                          className="bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6] text-[#3B82F6] px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Generate New Key
                        </button>
                      </div>
                   )}
                </div>
                
                {selectedUser.role === 'user' && !isMakingAgent && (
                  <div className="border border-[#8B5CF6]/30 bg-[#8B5CF6]/5 p-4 rounded-xl text-center mb-5">
                    <p className="text-xs text-[#94A3B8] mb-3 font-medium">Promote this user to an Agent?</p>
                    <button onClick={() => setIsMakingAgent(true)} className="w-full py-2 bg-[#8B5CF6] text-white text-sm font-black rounded-lg hover:bg-[#7C3AED] transition-colors">
                      Make Agent 👑
                    </button>
                  </div>
                )}

                {selectedUser.role === 'agent' && isMakingAgent && (
                  <div className="mb-5 p-4 border border-[#F43F5E]/50 bg-[#F43F5E]/5 rounded-xl">
                    <h4 className="text-[11px] font-black text-[#F43F5E] mb-2 uppercase tracking-wider">Handover Network / Demote Agent</h4>
                    <div className="mb-3">
                      <label className="block text-[10px] text-[#E2E8F0] font-bold mb-1">Transfer Ownership To (User Email)</label>
                      <input 
                        type="email" 
                        placeholder="new_owner@email.com" 
                        value={handoverEmail} 
                        onChange={(e) => setHandoverEmail(e.target.value)}
                        className="w-full bg-[#0F172A] border border-[#334155] text-white px-3 py-2.5 rounded-lg text-xs font-bold focus:outline-none focus:border-[#F43F5E]" 
                      />
                      <p className="text-[9px] text-[#94A3B8] mt-1 font-bold">Provide an existing User's Email. They will become the Agent, and this profile will become a normal user.</p>
                    </div>
                    <button onClick={(e) => handleSaveUser(e, "user")} className="w-full py-2 bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E] text-xs font-black rounded-lg hover:bg-[#F43F5E] hover:text-white transition-colors shadow-sm">
                      Execute Handover & Demote to Normal User
                    </button>
                  </div>
                )}

                <form onSubmit={(e) => handleSaveUser(e, isMakingAgent ? "agent" : selectedUser.role)} className={isMakingAgent ? "space-y-3 border border-[#8B5CF6]/50 bg-[#0F172A] p-5 rounded-xl" : "space-y-4"}>
                  
                  {isMakingAgent && <h4 className="text-sm font-black text-[#8B5CF6] uppercase mb-1">Agent Details</h4>}
                  
                  <div>
                    <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">Account Status</label>
                    <select 
                      value={newStatus} 
                      onChange={(e) => setNewStatus(e.target.value)} 
                      className={`w-full bg-[#1E293B] border text-white font-bold px-3 py-2.5 rounded-lg text-sm focus:outline-none ${newStatus === 'banned' ? 'border-red-500 text-red-400' : 'border-[#334155]'}`}
                    >
                      <option value="active">Active (Can Work)</option>
                      <option value="pending">Pending (Waiting Approval)</option>
                      <option value="banned">Banned (Global Session Wipe)</option> 
                    </select>
                  </div>

                  {role === 'admin' && !isMakingAgent && selectedUser.role === 'user' && (
                    <div>
                      <label className="block text-[10px] text-teal-400 uppercase font-black mb-1">Transfer to Agent (Email)</label>
                      <input 
                        type="email" 
                        value={newAgentEmail} 
                        onChange={(e) => setNewAgentEmail(e.target.value)}
                        placeholder="admin@zenex.com"
                        className="w-full bg-[#1E293B] border border-teal-500/30 text-teal-300 font-bold px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-teal-400" 
                      />
                      <p className="text-[9px] text-[#64748B] mt-1 font-bold">Leave as is to keep under current agent.</p>
                    </div>
                  )}

                  {isMakingAgent && (
                    <>
                      <div>
                        <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">Custom Agent Mail</label>
                        <input 
                          type="email" 
                          required 
                          placeholder="agent_name@zenex.com" 
                          value={customMail} 
                          onChange={(e) => setCustomMail(e.target.value)}
                          className="w-full bg-[#1E293B] border border-[#334155] text-white px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#8B5CF6]" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">Telegram Contact Link</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="t.me/agent_username" 
                          value={contactLink} 
                          onChange={(e) => setContactLink(e.target.value)}
                          className="w-full bg-[#1E293B] border border-[#334155] text-white px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#8B5CF6]" 
                        />
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#334155]">
                        <div>
                           <label className="block text-[10px] text-purple-400 uppercase font-bold">API Manager Access</label>
                           <p className="text-[8px] text-[#64748B]">Can this agent enable API for their users?</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setCanManageApi(!canManageApi)} 
                          className={`relative w-10 h-5 rounded-full flex items-center p-1 transition-colors duration-300 ${canManageApi ? 'bg-[#A855F7]' : 'bg-[#334155]'}`}
                        >
                           <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform duration-300 shadow-md ${canManageApi ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#3B82F6] uppercase font-bold mb-1">Max Users Limit (Seat)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="e.g. 100, 200, 500" 
                          value={maxLimit} 
                          onChange={(e) => setMaxLimit(e.target.value)}
                          className="w-full bg-[#1E293B] border border-[#3B82F6] focus:border-[#00C6FF] text-[#3B82F6] font-black px-3 py-2.5 rounded-lg text-sm focus:outline-none shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] text-[#EAB308] uppercase font-bold mb-1">
                      {isMakingAgent ? "Agent Pay Rate (BDT)" : "Pay Rate (BDT per OTP)"}
                    </label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={newRate} 
                      onChange={(e) => setNewRate(e.target.value)}
                      className="w-full bg-[#1E293B] border border-[#334155] text-[#10B981] font-black px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#8B5CF6]" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-[10px] text-[#F43F5E] uppercase font-bold mb-1">Reset Password</label>
                      <input 
                        type="text" 
                        placeholder="New Pass..." 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[#1E293B] border border-[#334155] focus:border-[#F43F5E] text-white px-3 py-2.5 rounded-lg text-sm focus:outline-none placeholder-[#475569]" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#10B981] uppercase font-bold mb-1">Reset PIN</label>
                      <input 
                        type="text" 
                        placeholder="New PIN..." 
                        maxLength={4} 
                        value={newPin} 
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-[#1E293B] border border-[#334155] focus:border-[#10B981] text-white px-3 py-2.5 rounded-lg text-sm focus:outline-none placeholder-[#475569] text-center tracking-widest font-mono" 
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-3">
                    {selectedUser?.role === "user" && isMakingAgent && (
                      <button 
                        type="button" 
                        onClick={() => setIsMakingAgent(false)} 
                        className="flex-1 py-2.5 bg-[#334155] text-white text-xs font-bold rounded-lg hover:bg-[#475569]"
                      >
                        Cancel
                      </button>
                    )}
                    <button 
                      type="submit" 
                      className="w-full flex-1 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#00C6FF] text-white text-xs font-black rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>

                {selectedUser?.role !== 'admin' && selectedUser?.role !== 'agent' && (
                  <div className="pt-4 border-t border-[#334155]/50 mt-4 text-center">
                    <button 
                      type="button" 
                      onClick={handleDeleteUser} 
                      className="text-xs font-bold text-[#F43F5E] hover:text-white hover:underline transition-colors flex items-center justify-center w-full gap-1.5 py-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Permanently delete this user
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}