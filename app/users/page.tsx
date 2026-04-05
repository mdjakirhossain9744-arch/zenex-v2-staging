"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../DashboardLayout"; 

export default function UsersManagementPage() {
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
  const [newApiStatus, setNewApiStatus] = useState(false);

  // Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUsers = useCallback((isSilent = false) => {
    if (!isSilent) setLoading(true);
    fetch(`/api/get-all-users?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(debouncedSearch)}&t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.users) setAllUsers(data.users);
        if (data.pagination) setTotalPages(data.pagination.totalPages);
        if (data.stats) setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setRole(parsedUser.role);
      if (parsedUser.role === "admin") {
        fetchUsers(false);
        const interval = setInterval(() => { fetchUsers(true); }, 10000);
        return () => clearInterval(interval);
      }
    }
  }, [fetchUsers]);

  const openManageModal = (user: any) => {
    setSelectedUser(user);
    setNewRate(user.rate);
    setNewStatus(user.status.toLowerCase());
    setNewPassword(""); 
    setNewPin(""); 
    setNewApiStatus(user.isApiActive || false); 
    
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

    const res = await fetch("/api/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        requesterEmail: adminEmail,
        requesterRole: adminRole
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Successfully Updated!");
      setIsModalOpen(false);
      fetchUsers(true); 
    } else alert(data.message);
  };

  const handleQuickUnban = async (user: any) => {
    if (!confirm(`Are you sure you want to UNBAN ${user.name}?`)) return;
    
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
        isApiActive: user.isApiActive || false
      })
    });
    
    if (res.ok) {
      alert("✅ User has been Unbanned and is now Active!");
      fetchUsers(true); 
    } else {
      alert("Failed to unban user.");
    }
  };

  if (role !== "admin") return <div className="min-h-screen bg-[#0B0F1A] text-white flex items-center justify-center">Access Denied. Admins Only.</div>;

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
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                 setSearchQuery(e.target.value);
                 setCurrentPage(1); // 💥 FATAL BUG FIX: Force page 1 instantly on typing
              }}
              placeholder="Search by Name or Email..." 
              className="w-full lg:min-w-[300px] bg-[#0F172A] border border-[#334155] text-white pl-10 pr-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:border-[#3B82F6]" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#334155] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#8B5CF6]">
            <p className="text-[#94A3B8] text-[10px] font-black uppercase tracking-widest mb-1">Total Agents</p>
            <h3 className="text-3xl font-black text-[#8B5CF6]">{stats.totalAgents}</h3>
          </div>
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#334155] p-5 rounded-2xl shadow-lg border-t-2 border-t-[#3B82F6]">
            <p className="text-[#94A3B8] text-[10px] font-black uppercase tracking-widest mb-1">Total Users</p>
            <h3 className="text-3xl font-black text-[#3B82F6]">{stats.totalUsers}</h3>
          </div>
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#10B981]/30 p-5 rounded-2xl shadow-lg border-t-2 border-t-[#10B981]">
            <p className="text-[#10B981] text-[10px] font-black uppercase tracking-widest mb-1">Active Accounts</p>
            <h3 className="text-3xl font-black text-[#10B981]">{stats.activeAccounts}</h3>
          </div>
          <div className="bg-red-500/5 backdrop-blur-xl border border-red-500/30 p-5 rounded-2xl shadow-lg border-t-2 border-t-red-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full"></div>
            <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-1">Banned Accounts</p>
            <h3 className="text-3xl font-black text-red-500">{stats.bannedAccounts}</h3>
          </div>
        </div>

        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#334155] rounded-2xl shadow-lg overflow-x-auto min-h-[400px]">
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
                <tr><td colSpan={7} className="text-center p-8 text-[#3B82F6] font-bold">Loading Page {currentPage}...</td></tr>
              ) : allUsers.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-8 text-[#64748B] font-bold">No users found.</td></tr>
              ) : (
                allUsers.map((u) => (
                  <tr key={u.id} className={`hover:bg-[#334155]/20 transition-colors ${u.role === 'agent' ? 'bg-[#8B5CF6]/5' : ''} ${u.status.toLowerCase() === 'banned' ? 'bg-red-500/5' : ''}`}>
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`font-bold ${u.status.toLowerCase() === 'banned' ? 'text-red-400 line-through' : 'text-[#E2E8F0]'}`}>{u.name}</p>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/30">{u.uid}</span>
                        {u.isApiActive && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.3)]">API</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#64748B]">{u.email}</p>
                    </td>
                    <td className="p-4">
                      {u.role === 'admin' ? (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-[#F43F5E]/10 text-[#F43F5E] rounded border border-[#F43F5E]/30 uppercase">Super Admin</span>
                      ) : u.role === 'agent' ? (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded border border-[#8B5CF6]/30 uppercase tracking-widest shadow-[0_0_10px_rgba(139,92,246,0.2)]">Agent 👑</span>
                      ) : (
                        <span className="text-xs font-medium text-[#3B82F6]">{u.agentEmail}</span>
                      )}
                    </td>
                    <td className="p-4 text-center text-[12px] font-bold text-[#EAB308]">৳ {u.rate}</td>
                    <td className="p-4 font-black text-[#10B981]">৳ {u.balance}</td>
                    <td className="p-4 text-center font-black text-[#00C6FF]">{u.todayOTP}</td>
                    <td className="p-4">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${u.status.toLowerCase() === 'active' ? 'bg-[#10B981]/10 text-[#10B981]' : u.status.toLowerCase() === 'banned' ? 'bg-[#F43F5E]/10 text-[#F43F5E] border border-red-500/50' : 'bg-[#EAB308]/10 text-[#EAB308]'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      {u.status.toLowerCase() === 'banned' && (
                        <button onClick={() => handleQuickUnban(u)} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 py-1.5 rounded-lg mr-2 text-xs font-black transition-colors border border-red-500/30">
                          Unban
                        </button>
                      )}
                      <button onClick={() => openManageModal(u)} className="bg-[#3B82F6]/10 hover:bg-[#3B82F6] text-[#3B82F6] hover:text-white px-4 py-1.5 rounded-lg text-xs font-black transition-colors border border-[#3B82F6]/30 shadow-sm">
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

        {/* Modal Logic remains untouched */}
        {isModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1E293B] border border-[#334155] rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 text-[#94A3B8] hover:text-[#F43F5E] transition-colors font-black text-xl">✕</button>

              <div className="flex items-center gap-3 mb-5 border-b border-[#334155] pb-4">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#00C6FF] flex items-center justify-center text-white font-black">
                   {selectedUser.name.charAt(0)}
                 </div>
                 <div>
                   <h3 className="text-lg font-black text-white leading-tight">{selectedUser.name} <span className="text-[10px] text-[#8B5CF6] uppercase ml-1 border border-[#8B5CF6]/50 px-1 rounded">{selectedUser.role}</span></h3>
                   <p className="text-[10px] font-mono text-[#3B82F6] font-bold">{selectedUser.email}</p>
                 </div>
              </div>
              
              <div className="mb-5 bg-[#0F172A] border border-[#334155] p-4 rounded-xl flex items-center justify-between">
                 <div>
                   <p className="text-sm font-black text-purple-400">Developer API Access</p>
                   <p className="text-[9px] text-[#64748B] mt-1 font-bold">Allow user to generate numbers via bot/software</p>
                 </div>
                 <button 
                   type="button"
                   onClick={() => setNewApiStatus(!newApiStatus)} 
                   className={`relative w-12 h-6 rounded-full flex items-center p-1 transition-colors duration-300 ${newApiStatus ? 'bg-[#10B981]' : 'bg-[#334155]'}`}
                 >
                   <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${newApiStatus ? 'translate-x-6' : 'translate-x-0'}`}></div>
                 </button>
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
                <div className="mb-4">
                   <button onClick={(e) => handleSaveUser(e, "user")} className="w-full py-2 bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E] text-xs font-black rounded-lg hover:bg-[#F43F5E] hover:text-white transition-colors">
                    Remove Agent Access (Make Normal User)
                  </button>
                </div>
              )}

              <form onSubmit={(e) => handleSaveUser(e, isMakingAgent ? "agent" : selectedUser.role)} className={isMakingAgent ? "space-y-3 border border-[#8B5CF6]/50 bg-[#0F172A] p-5 rounded-xl" : "space-y-4"}>
                
                {isMakingAgent && <h4 className="text-sm font-black text-[#8B5CF6] uppercase mb-1">Agent Details</h4>}
                
                <div>
                  <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">Account Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={`w-full bg-[#1E293B] border text-white font-bold px-3 py-2.5 rounded-lg text-sm focus:outline-none ${newStatus === 'banned' ? 'border-red-500 text-red-400' : 'border-[#334155]'}`}>
                    <option value="active">Active (Can Work)</option>
                    <option value="pending">Pending (Waiting Approval)</option>
                    <option value="banned">Banned (Blocked for Spam)</option>
                  </select>
                </div>

                {isMakingAgent && (
                  <>
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">Custom Agent Mail</label>
                      <input type="email" required placeholder="agent_name@zenex.com" value={customMail} onChange={(e) => setCustomMail(e.target.value)}
                        className="w-full bg-[#1E293B] border border-[#334155] text-white px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#8B5CF6]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">Telegram Contact Link</label>
                      <input type="text" required placeholder="t.me/agent_username" value={contactLink} onChange={(e) => setContactLink(e.target.value)}
                        className="w-full bg-[#1E293B] border border-[#334155] text-white px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#8B5CF6]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#3B82F6] uppercase font-bold mb-1">Max Users Limit (Seat)</label>
                      <input type="number" required placeholder="e.g. 100, 200, 500" value={maxLimit} onChange={(e) => setMaxLimit(e.target.value)}
                        className="w-full bg-[#1E293B] border border-[#3B82F6] focus:border-[#00C6FF] text-[#3B82F6] font-black px-3 py-2.5 rounded-lg text-sm focus:outline-none shadow-[0_0_15px_rgba(59,130,246,0.15)]" />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] text-[#EAB308] uppercase font-bold mb-1">{isMakingAgent ? "Agent Pay Rate (BDT)" : "Pay Rate (BDT per OTP)"}</label>
                  <input type="number" step="0.01" required value={newRate} onChange={(e) => setNewRate(e.target.value)}
                    className="w-full bg-[#1E293B] border border-[#334155] text-[#10B981] font-black px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#8B5CF6]" />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-[10px] text-[#F43F5E] uppercase font-bold mb-1">Reset Password</label>
                    <input type="text" placeholder="New Pass..." value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#1E293B] border border-[#334155] focus:border-[#F43F5E] text-white px-3 py-2.5 rounded-lg text-sm focus:outline-none placeholder-[#475569]" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#10B981] uppercase font-bold mb-1">Reset PIN</label>
                    <input type="text" placeholder="New PIN..." maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[#1E293B] border border-[#334155] focus:border-[#10B981] text-white px-3 py-2.5 rounded-lg text-sm focus:outline-none placeholder-[#475569] text-center tracking-widest font-mono" />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-3">
                  {selectedUser.role === "user" && isMakingAgent && (
                    <button type="button" onClick={() => setIsMakingAgent(false)} className="flex-1 py-2.5 bg-[#334155] text-white text-xs font-bold rounded-lg hover:bg-[#475569]">Cancel</button>
                  )}
                  <button type="submit" className="w-full flex-1 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#00C6FF] text-white text-xs font-black rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                    Save Changes
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