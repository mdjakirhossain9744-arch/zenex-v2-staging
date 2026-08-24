"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation"; 

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
    <div className="p-4 md:p-6 lg:p-8 w-full min-h-screen bg-[#030816] text-[#F8FAFC] font-sans tracking-tight pb-20">
      
      <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 max-w-[1600px] mx-auto">
        <div>
          <div className="flex items-center gap-3">
             <h2 className="text-2xl md:text-3xl font-bold text-[#00D2FF] tracking-wide">
               Global Users Directory
             </h2>
             <span className="flex h-3 w-3 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00D2FF]"></span>
             </span>
          </div>
          <p className="text-xs text-[#6C84A3] mt-1 font-medium tracking-wide">Enterprise Pagination Active (Max 50 per page).</p>
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
            className="w-full lg:min-w-[350px] bg-[#101726] border border-[#162749] text-[#F8FAFC] px-4 py-3 rounded-lg text-sm font-semibold focus:outline-none focus:border-[#00D2FF] placeholder:text-[#6C84A3]/50 transition-colors shadow-inner tracking-wide" 
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 max-w-[1600px] mx-auto">
        <div className="bg-[#101726] border border-[#162749] p-5 rounded-xl flex flex-col justify-center relative overflow-hidden group">
          <p className="text-[#6C84A3] text-[10px] font-semibold uppercase tracking-widest mb-1">Total Agents</p>
          <h3 className="text-2xl font-bold tracking-tight text-[#60A5FA]">{stats.totalAgents}</h3>
        </div>
        <div className="bg-[#101726] border border-[#162749] p-5 rounded-xl flex flex-col justify-center relative overflow-hidden group">
          <p className="text-[#6C84A3] text-[10px] font-semibold uppercase tracking-widest mb-1">Total Users</p>
          <h3 className="text-2xl font-bold tracking-tight text-[#00D2FF]">{stats.totalUsers}</h3>
        </div>
        <div className="bg-[#101726] border border-[#162749] p-5 rounded-xl flex flex-col justify-center relative overflow-hidden group">
          <p className="text-[#00D2FF] text-[10px] font-semibold uppercase tracking-widest mb-1">Active Accounts</p>
          <h3 className="text-2xl font-bold tracking-tight text-[#00D2FF]">{stats.activeAccounts}</h3>
        </div>
        <div className="bg-[#101726] border border-[#162749] p-5 rounded-xl flex flex-col justify-center relative overflow-hidden group">
          <p className="text-[#F43F5E] text-[10px] font-semibold uppercase tracking-widest mb-1">Banned Accounts</p>
          <h3 className="text-2xl font-bold tracking-tight text-[#F43F5E]">{stats.bannedAccounts}</h3>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#0B152A] border border-[#162749] p-4 rounded-xl max-w-[1600px] mx-auto shadow-sm">
        <div>
          <label className="block text-[10px] text-[#6C84A3] uppercase font-semibold tracking-widest mb-2">Filter by Status</label>
          <select 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-[#101726] border border-[#162749] text-[#F8FAFC] font-semibold px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#00D2FF] transition-colors"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="banned">Banned</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-[#6C84A3] uppercase font-semibold tracking-widest mb-2">Filter by Agent (View Network)</label>
          <select 
            value={agentFilter} 
            onChange={(e) => { setAgentFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-[#101726] border border-[#162749] text-[#F8FAFC] font-semibold px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#60A5FA] transition-colors"
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

      <div className="bg-[#0B152A] border border-[#162749] rounded-xl shadow-sm overflow-x-auto max-w-[1600px] mx-auto min-h-[400px]">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#101726] text-[#6C84A3] uppercase text-[10px] font-semibold tracking-widest border-b border-[#162749]">
            <tr>
              <th className="p-4 pl-6">User Identity</th>
              <th className="p-4">Role / Agent</th>
              <th className="p-4 text-center">Rate (USD)</th>
              <th className="p-4">Balance (USD)</th>
              <th className="p-4 text-center">Today OTP</th>
              <th className="p-4">Status</th>
              <th className="p-4 pr-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#162749]">
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="animate-pulse bg-[#0B152A]">
                  <td className="p-4 pl-6">
                    <div className="h-4 bg-[#162749] rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-[#101726] rounded w-1/2"></div>
                  </td>
                  <td className="p-4"><div className="h-5 bg-[#162749] rounded w-20"></div></td>
                  <td className="p-4 text-center"><div className="h-4 bg-[#162749] rounded w-10 mx-auto"></div></td>
                  <td className="p-4"><div className="h-4 bg-[#162749] rounded w-16"></div></td>
                  <td className="p-4 text-center"><div className="h-4 bg-[#162749] rounded w-8 mx-auto"></div></td>
                  <td className="p-4"><div className="h-5 bg-[#162749] rounded w-16"></div></td>
                  <td className="p-4 pr-6 text-right"><div className="h-8 bg-[#162749] rounded w-20 ml-auto"></div></td>
                </tr>
              ))
            ) : allUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-[#6C84A3] font-semibold tracking-wide">No users found.</td>
              </tr>
            ) : (
              allUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[#101726] transition-colors bg-[#0B152A]">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-[#F8FAFC] tracking-wide">{u.name || "Unknown User"}</p>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/30">
                        {u.uid}
                      </span>
                      {u.isApiActive && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#60A5FA]/10 text-[#60A5FA] border border-[#60A5FA]/30 uppercase tracking-widest">API</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6C84A3] font-medium tracking-wide">{u.email || "No Email Provided"}</p>
                  </td>
                  <td className="p-4">
                    {u.role === 'admin' ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-[#00D2FF]/10 text-[#00D2FF] rounded border border-[#00D2FF]/30 uppercase tracking-widest">Super Admin</span>
                    ) : u.role === 'agent' ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-[#60A5FA]/10 text-[#60A5FA] rounded border border-[#60A5FA]/30 uppercase tracking-widest">Agent</span>
                    ) : (
                      <span className="text-xs font-semibold text-[#6C84A3]">{u.agentEmail || "Admin"}</span>
                    )}
                  </td>
                  <td className="p-4 text-center text-[12px] font-bold text-[#F8FAFC] font-mono">$ {u.rate}</td>
                  <td className="p-4 font-bold text-[#00D2FF] font-mono">$ {u.balance}</td>
                  <td className="p-4 text-center font-bold text-[#F8FAFC]">{u.todayOTP}</td>
                  <td className="p-4">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border ${
                      u.status?.toLowerCase() === 'active' ? 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/30' : 
                      u.status?.toLowerCase() === 'banned' ? 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30' : 
                      'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/30'
                    }`}>
                      {u.status || "Unknown"}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right flex justify-end gap-2">
                    {u.role === 'agent' && (
                       <button 
                         onClick={() => { setAgentFilter(u.customAgentMail || u.email); setCurrentPage(1); }} 
                         className="bg-[#60A5FA]/10 hover:bg-[#60A5FA] text-[#60A5FA] hover:text-[#030816] px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors border border-[#60A5FA]/30 shadow-sm"
                       >
                         View Team
                       </button>
                    )}
                    {u.status?.toLowerCase() === 'banned' && (
                      <button 
                        onClick={() => handleQuickUnban(u)} 
                        className="bg-[#F43F5E]/10 hover:bg-[#F43F5E] text-[#F43F5E] hover:text-[#030816] px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors border border-[#F43F5E]/30"
                      >
                        Unban
                      </button>
                    )}
                    <button 
                      onClick={() => openManageModal(u)} 
                      className="bg-[#00D2FF]/10 hover:bg-[#00D2FF] text-[#00D2FF] hover:text-[#030816] px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors border border-[#00D2FF]/30 shadow-sm"
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
          <div className="p-4 border-t border-[#162749] bg-[#101726] flex items-center justify-between">
             <button 
               onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
               disabled={currentPage === 1} 
               className="px-4 py-2 bg-[#0B152A] text-[#F8FAFC] text-[11px] uppercase tracking-widest font-bold rounded-lg border border-[#162749] disabled:opacity-50 hover:bg-[#162749] transition-colors"
             >
               ← Previous
             </button>
             <span className="text-[11px] uppercase tracking-widest font-bold text-[#6C84A3]">
               Page <span className="text-[#00D2FF]">{currentPage}</span> of {totalPages}
             </span>
             <button 
               onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
               disabled={currentPage === totalPages} 
               className="px-4 py-2 bg-[#0B152A] text-[#F8FAFC] text-[11px] uppercase tracking-widest font-bold rounded-lg border border-[#162749] disabled:opacity-50 hover:bg-[#162749] transition-colors"
             >
               Next →
             </button>
          </div>
        )}
      </div>

      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#030816]/80 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
          
          <div className="bg-[#0B152A] border border-[#162749] rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
            
            <div className="flex justify-between items-center p-4 border-b border-[#162749] bg-[#101726] rounded-t-xl shrink-0">
               <div className="flex items-center gap-3 overflow-hidden">
                 <div className="w-10 h-10 rounded-full bg-[#00D2FF]/10 border border-[#00D2FF]/30 flex items-center justify-center text-[#00D2FF] shrink-0">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                 </div>
                 <div className="overflow-hidden">
                   <h3 className="text-sm font-bold text-[#F8FAFC] leading-tight flex items-center gap-2">
                     <span className="truncate">{selectedUser?.name || "Unknown"}</span>
                     <span className="text-[9px] font-bold bg-[#60A5FA]/10 text-[#60A5FA] uppercase tracking-widest border border-[#60A5FA]/30 px-1.5 py-0.5 rounded shrink-0">{selectedUser?.role || "user"}</span>
                   </h3>
                   <p className="text-[10px] font-medium text-[#6C84A3] truncate tracking-wide">{selectedUser?.email || "No Email"}</p>
                 </div>
               </div>
               
               <button 
                 onClick={() => setIsModalOpen(false)} 
                 className="w-8 h-8 min-w-[2rem] bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E] rounded hover:bg-[#F43F5E] hover:text-[#030816] flex items-center justify-center transition-colors font-bold text-lg shrink-0"
               >
                 ✕
               </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar rounded-b-xl">
              
              <div className="mb-5 bg-[#101726] border border-[#162749] p-4 rounded-xl flex flex-col gap-3 shadow-inner">
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-[11px] font-bold text-[#00D2FF] uppercase tracking-widest">Developer API Access</p>
                     <p className="text-[9px] text-[#6C84A3] mt-1 font-semibold tracking-wide">Allow user to generate numbers via API</p>
                   </div>
                   <button 
                     type="button"
                     onClick={() => setNewApiStatus(!newApiStatus)} 
                     className={`relative w-10 h-5 rounded-full flex items-center p-1 transition-colors duration-300 ${newApiStatus ? 'bg-[#00D2FF]' : 'bg-[#162749]'}`}
                   >
                     <div className={`w-3.5 h-3.5 bg-[#F8FAFC] rounded-full transition-transform duration-300 shadow-md ${newApiStatus ? 'translate-x-5' : 'translate-x-0'}`}></div>
                   </button>
                 </div>
                 
                 {selectedUser.role !== 'agent' && (
                    <div className="border-t border-[#162749] pt-3 mt-1 flex justify-between items-center">
                      <span className="text-[10px] text-[#6C84A3] font-semibold tracking-wide">Compromised Key?</span>
                      <button 
                        type="button"
                        onClick={handleGenerateNewKey}
                        className="bg-[#F43F5E]/10 hover:bg-[#F43F5E] hover:text-[#030816] border border-[#F43F5E]/30 text-[#F43F5E] px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Regenerate Key
                      </button>
                    </div>
                 )}
              </div>
              
              {selectedUser.role === 'user' && !isMakingAgent && (
                <div className="border border-[#60A5FA]/30 bg-[#60A5FA]/10 p-4 rounded-xl text-center mb-5">
                  <p className="text-[11px] text-[#F8FAFC] mb-3 font-semibold tracking-wide">Promote this user to an Agent?</p>
                  <button onClick={() => setIsMakingAgent(true)} className="w-full py-2 bg-[#60A5FA] text-[#030816] text-[11px] uppercase tracking-widest font-bold rounded shadow-[0_0_15px_rgba(96,165,250,0.4)] hover:shadow-[0_0_20px_rgba(96,165,250,0.6)] transition-all">
                    Make Agent
                  </button>
                </div>
              )}

              {selectedUser.role === 'agent' && isMakingAgent && (
                <div className="mb-5 p-4 border border-[#F43F5E]/30 bg-[#F43F5E]/10 rounded-xl">
                  <h4 className="text-[10px] font-bold text-[#F43F5E] mb-2 uppercase tracking-widest">Handover Network / Demote</h4>
                  <div className="mb-3">
                    <label className="block text-[10px] text-[#F8FAFC] uppercase font-semibold tracking-widest mb-1">Transfer Ownership To (Email)</label>
                    <input 
                      type="email" 
                      placeholder="new_owner@email.com" 
                      value={handoverEmail} 
                      onChange={(e) => setHandoverEmail(e.target.value)}
                      className="w-full bg-[#030816] border border-[#162749] text-[#F8FAFC] px-3 py-2 rounded text-xs font-semibold focus:outline-none focus:border-[#F43F5E] transition-colors placeholder:text-[#6C84A3]/50" 
                    />
                    <p className="text-[9px] text-[#6C84A3] mt-1.5 font-medium tracking-wide leading-tight">Provide an existing User's Email. They will become the Agent, and this profile will become a normal user.</p>
                  </div>
                  <button onClick={(e) => handleSaveUser(e, "user")} className="w-full py-2 bg-[#F43F5E]/20 border border-[#F43F5E]/50 text-[#F43F5E] text-[10px] uppercase font-bold rounded hover:bg-[#F43F5E] hover:text-[#030816] transition-all">
                    Execute Handover
                  </button>
                </div>
              )}

              <form onSubmit={(e) => handleSaveUser(e, isMakingAgent ? "agent" : selectedUser.role)} className={isMakingAgent ? "space-y-4 border border-[#60A5FA]/30 bg-[#101726] p-5 rounded-xl" : "space-y-4"}>
                
                {isMakingAgent && <h4 className="text-[11px] font-bold text-[#60A5FA] uppercase tracking-widest mb-1 border-b border-[#60A5FA]/20 pb-2">Agent Config</h4>}
                
                <div>
                  <label className="block text-[10px] text-[#6C84A3] uppercase font-semibold tracking-widest mb-1.5">Account Status</label>
                  <select 
                    value={newStatus} 
                    onChange={(e) => setNewStatus(e.target.value)} 
                    className={`w-full bg-[#030816] border text-[#F8FAFC] font-semibold px-3 py-2.5 rounded text-sm focus:outline-none transition-colors ${newStatus === 'banned' ? 'border-[#F43F5E] text-[#F43F5E]' : 'border-[#162749] focus:border-[#00D2FF]'}`}
                  >
                    <option value="active">Active (Can Work)</option>
                    <option value="pending">Pending (Waiting Approval)</option>
                    <option value="banned">Banned (Global Lock)</option> 
                  </select>
                </div>

                {role === 'admin' && !isMakingAgent && selectedUser.role === 'user' && (
                  <div>
                    <label className="block text-[10px] text-[#00D2FF] uppercase font-semibold tracking-widest mb-1.5">Transfer to Agent (Email)</label>
                    <input 
                      type="email" 
                      value={newAgentEmail} 
                      onChange={(e) => setNewAgentEmail(e.target.value)}
                      placeholder="admin@zenex.com"
                      className="w-full bg-[#030816] border border-[#00D2FF]/30 text-[#00D2FF] font-semibold px-3 py-2.5 rounded text-sm focus:outline-none focus:border-[#00D2FF] placeholder:text-[#00D2FF]/30 transition-colors" 
                    />
                    <p className="text-[9px] text-[#6C84A3] mt-1.5 font-medium tracking-wide">Leave as is to keep under current agent.</p>
                  </div>
                )}

                {isMakingAgent && (
                  <>
                    <div>
                      <label className="block text-[10px] text-[#6C84A3] uppercase font-semibold tracking-widest mb-1.5">Custom Agent Mail</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="agent_name@zenex.com" 
                        value={customMail} 
                        onChange={(e) => setCustomMail(e.target.value)}
                        className="w-full bg-[#030816] border border-[#162749] text-[#F8FAFC] px-3 py-2.5 rounded text-sm focus:outline-none focus:border-[#60A5FA] placeholder:text-[#6C84A3]/50 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#6C84A3] uppercase font-semibold tracking-widest mb-1.5">Telegram Contact Link</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="t.me/agent_username" 
                        value={contactLink} 
                        onChange={(e) => setContactLink(e.target.value)}
                        className="w-full bg-[#030816] border border-[#162749] text-[#F8FAFC] px-3 py-2.5 rounded text-sm focus:outline-none focus:border-[#60A5FA] placeholder:text-[#6C84A3]/50 transition-colors" 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-[#162749]">
                      <div>
                         <label className="block text-[10px] text-[#60A5FA] uppercase font-bold tracking-widest">API Manager Access</label>
                         <p className="text-[9px] text-[#6C84A3] mt-1 font-medium tracking-wide">Can this agent enable API for users?</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setCanManageApi(!canManageApi)} 
                        className={`relative w-10 h-5 rounded-full flex items-center p-1 transition-colors duration-300 ${canManageApi ? 'bg-[#60A5FA]' : 'bg-[#162749]'}`}
                      >
                         <div className={`w-3.5 h-3.5 bg-[#F8FAFC] rounded-full transition-transform duration-300 shadow-md ${canManageApi ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#00D2FF] uppercase font-bold tracking-widest mb-1.5">Max Users Limit (Seat)</label>
                      <input 
                        type="number" 
                        required 
                        placeholder="e.g. 100, 200, 500" 
                        value={maxLimit} 
                        onChange={(e) => setMaxLimit(e.target.value)}
                        className="w-full bg-[#030816] border border-[#00D2FF]/50 text-[#00D2FF] font-bold px-3 py-2.5 rounded text-sm focus:outline-none focus:border-[#00D2FF] shadow-[0_0_10px_rgba(0,210,255,0.1)] placeholder:text-[#00D2FF]/30 transition-colors" 
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] text-[#00D2FF] uppercase font-bold tracking-widest mb-1.5">
                    {isMakingAgent ? "Agent Pay Rate (USD)" : "Pay Rate (USD per OTP)"}
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={newRate} 
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full bg-[#030816] border border-[#162749] text-[#00D2FF] font-mono font-bold px-3 py-2.5 rounded text-sm focus:outline-none focus:border-[#00D2FF] transition-colors" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-[10px] text-[#6C84A3] uppercase font-semibold tracking-widest mb-1.5">Reset Password</label>
                    <input 
                      type="text" 
                      placeholder="New Pass..." 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#030816] border border-[#162749] text-[#F8FAFC] px-3 py-2.5 rounded text-sm focus:outline-none focus:border-[#00D2FF] placeholder:text-[#6C84A3]/50 transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#6C84A3] uppercase font-semibold tracking-widest mb-1.5">Reset PIN</label>
                    <input 
                      type="text" 
                      placeholder="New PIN..." 
                      maxLength={4} 
                      value={newPin} 
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[#030816] border border-[#162749] text-[#F8FAFC] px-3 py-2.5 rounded text-sm focus:outline-none focus:border-[#00D2FF] placeholder:text-[#6C84A3]/50 text-center tracking-widest font-mono transition-colors" 
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  {selectedUser?.role === "user" && isMakingAgent && (
                    <button 
                      type="button" 
                      onClick={() => setIsMakingAgent(false)} 
                      className="flex-1 py-2.5 bg-[#162749] text-[#6C84A3] text-[11px] uppercase tracking-widest font-bold rounded hover:bg-[#101726] hover:text-[#F8FAFC] transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="w-full flex-1 py-2.5 bg-[#00D2FF] text-[#030816] text-[11px] uppercase tracking-widest font-bold rounded shadow-[0_0_15px_rgba(0,210,255,0.4)] hover:shadow-[0_0_25px_rgba(0,210,255,0.6)] transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>

              {selectedUser?.role !== 'admin' && selectedUser?.role !== 'agent' && (
                <div className="pt-4 border-t border-[#162749] mt-4 text-center">
                  <button 
                    type="button" 
                    onClick={handleDeleteUser} 
                    className="text-[10px] font-bold text-[#F43F5E] hover:text-[#F8FAFC] uppercase tracking-widest transition-colors flex items-center justify-center w-full gap-2 py-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Permanently delete this user
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}