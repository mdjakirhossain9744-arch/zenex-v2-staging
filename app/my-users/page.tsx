"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout"; 

export default function AgentUsersPage() {
  const [role, setRole] = useState("user");
  const [agentMail, setAgentMail] = useState("");
  
  // 💥 ডাটাবেস থেকে আসা রিয়েল লিমিট 💥
  const [agentRate, setAgentRate] = useState<number>(0.70); 
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [myUsers, setMyUsers] = useState<any[]>([]);
  const [agentMaxLimit, setAgentMaxLimit] = useState(100);
  const [agentRevenue, setAgentRevenue] = useState("0.00");
  const [loading, setLoading] = useState(true);

  const [newRate, setNewRate] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [isSaving, setIsSaving] = useState(false);

  const fetchNetworkUsers = (email: string) => {
    fetch("/api/get-agent-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentEmail: email })
    })
      .then(res => res.json())
      .then(data => {
        if (data.users) setMyUsers(data.users);
        if (data.maxLimit) setAgentMaxLimit(data.maxLimit); 
        if (data.agentRevenue) setAgentRevenue(Number(data.agentRevenue).toFixed(2));
        
        // 💥 ডাটাবেসের পারফেক্ট রেট এখানে সেট হচ্ছে 💥
        if (data.agentRate) setAgentRate(data.agentRate);
        
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setRole(parsedUser.role);

      if (parsedUser.role === "agent") {
        setAgentMail(parsedUser.email); 
        fetchNetworkUsers(parsedUser.email);
      }
    }
  }, []);

  const filteredUsers = myUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.uid && u.uid.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalUsers = myUsers.length;
  const activeUsers = myUsers.filter(u => u.status.toLowerCase() === 'active').length;
  const pendingUsers = myUsers.filter(u => u.status.toLowerCase() === 'pending').length;
  const isSeatFull = totalUsers >= agentMaxLimit;

  const openManageModal = (user: any) => {
    setSelectedUser(user);
    setNewRate(user.rate); 
    setNewStatus(user.status.toLowerCase()); 
    setNewPassword(""); 
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // 💥 ফ্রন্টএন্ড ভ্যালিডেশন (রিয়েল ডাটাবেস লিমিট দিয়ে) 💥
    if (Number(newRate) > agentRate) {
      alert(`🔴 ERROR: You cannot give a user more than your own limit! (Your Max Limit is ৳ ${agentRate.toFixed(2)})`);
      setIsSaving(false);
      return; 
    }

    try {
      const res = await fetch("/api/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword: newPassword,
          newRate: newRate,
          newStatus: newStatus,
          requesterEmail: agentMail, 
          requesterRole: role        
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert("✅ Successfully Updated User!");
        setIsModalOpen(false);
        fetchNetworkUsers(agentMail); 
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
    const confirmDelete = window.confirm(`⚠️ DANGER ZONE!\nAre you absolutely sure you want to permanently delete "${selectedUser.name}"?\nAll their data and balance will be lost. This CANNOT be undone!`);
    
    if (confirmDelete) {
      try {
        const res = await fetch("/api/delete-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: selectedUser.email, requesterRole: role })
        });
        const data = await res.json();
        
        if (data.success) {
          alert(`✅ ${selectedUser.name} has been permanently removed!`);
          setIsModalOpen(false);
          fetchNetworkUsers(agentMail); 
        } else {
          alert(`❌ Failed: ${data.message}`);
        }
      } catch (err) {
        alert("Server Error! Could not delete.");
      }
    }
  };

  if (role !== "agent") return <div className="min-h-screen bg-[#0B0F1A] text-white flex items-center justify-center">Access Denied. Agents Only.</div>;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full min-h-screen bg-[#0B0F1A] text-slate-200">
        
        <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-[#A855F7] to-[#EC4899] bg-clip-text text-transparent uppercase tracking-wider">
              My Network Users
            </h2>
            <p className="text-sm text-[#94A3B8] mt-1">Manage your team, set custom OTP rates, and update passwords.</p>
          </div>
          <div className="relative w-full lg:w-auto">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by ID or Name..." 
              className="w-full lg:min-w-[300px] bg-[#0F172A] border border-[#334155] text-white pl-10 pr-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:border-[#A855F7] transition-colors" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#334155] p-5 rounded-2xl shadow-lg relative overflow-hidden border-t-2 border-t-[#A855F7]">
            <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider mb-1">Total Users</p>
            <h3 className="text-3xl font-black text-white">
              {totalUsers} <span className="text-sm text-[#64748B] font-medium">/ {agentMaxLimit}</span>
            </h3>
            {isSeatFull && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-[#F43F5E]/20 text-[#F43F5E] border border-[#F43F5E]/30 text-[10px] font-black uppercase tracking-widest rounded animate-pulse">
                Seat Full
              </span>
            )}
          </div>
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#10B981]/30 p-5 rounded-2xl shadow-lg border-t-2 border-t-[#10B981]">
            <p className="text-[#10B981] text-xs font-bold uppercase tracking-wider mb-1">Active Users</p>
            <h3 className="text-3xl font-black text-[#10B981]">{activeUsers}</h3>
          </div>
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#EAB308]/30 p-5 rounded-2xl shadow-lg border-t-2 border-t-[#EAB308]">
            <p className="text-[#EAB308] text-xs font-bold uppercase tracking-wider mb-1">Pending</p>
            <h3 className="text-3xl font-black text-[#EAB308]">{pendingUsers}</h3>
          </div>
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#00C6FF]/30 p-5 rounded-2xl shadow-lg border-t-2 border-t-[#00C6FF]">
            <p className="text-[#00C6FF] text-xs font-bold uppercase tracking-wider mb-1">My Profit Margin</p>
            <h3 className="text-3xl font-black text-[#00C6FF]">৳ {agentRevenue}</h3>
          </div>
        </div>

        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-[#334155] rounded-2xl shadow-lg overflow-x-auto">
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
                <tr><td colSpan={6} className="text-center p-8 text-[#A855F7] font-bold">Loading Your Network...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-8 text-[#64748B] font-bold">No users found in your network.</td></tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#334155]/20 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-[#E2E8F0]">{u.name}</p>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30">{u.uid}</span>
                      </div>
                      <p className="text-[10px] text-[#64748B]">{u.email}</p>
                    </td>
                    <td className="p-4 text-center">
                       <p className="font-black text-white text-base">{u.todayOTP}</p>
                    </td>
                    <td className="p-4 font-black text-[#EAB308]">৳ {u.rate}</td>
                    <td className="p-4 font-black text-[#10B981]">৳ {u.balance}</td>
                    <td className="p-4">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${u.status === 'Active' ? 'bg-[#10B981]/10 text-[#10B981]' : u.status === 'Banned' ? 'bg-[#F43F5E]/10 text-[#F43F5E]' : 'bg-[#EAB308]/10 text-[#EAB308]'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button onClick={() => openManageModal(u)} className="bg-[#A855F7]/10 hover:bg-[#A855F7] text-[#A855F7] hover:text-white px-4 py-2 rounded-lg text-xs font-black transition-colors border border-[#A855F7]/30">
                        Manage User
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* User Manage Modal */}
        {isModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1E293B] border border-[#334155] rounded-3xl w-full max-w-md p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 text-[#94A3B8] hover:text-[#F43F5E] transition-colors font-black text-xl">✕</button>

              <div className="flex items-center gap-3 mb-5 border-b border-[#334155] pb-4">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#A855F7] to-[#EC4899] flex items-center justify-center text-white font-black">
                   {selectedUser.name.charAt(0)}
                 </div>
                 <div>
                   <h3 className="text-lg font-black text-white leading-tight">{selectedUser.name}</h3>
                   <p className="text-[10px] font-mono text-[#A855F7] font-bold">{selectedUser.uid}</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                 <div className="bg-[#0F172A] border border-[#334155] p-3 rounded-xl">
                   <span className="text-[9px] text-[#64748B] uppercase font-bold block mb-1">Today's OTP</span>
                   <span className="text-lg text-white font-black">{selectedUser.todayOTP}</span>
                 </div>
                 <div className="bg-[#0F172A] border border-[#334155] p-3 rounded-xl">
                   <span className="text-[9px] text-[#64748B] uppercase font-bold block mb-1">User Balance</span>
                   <span className="text-lg text-[#10B981] font-black">৳ {selectedUser.balance}</span>
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
                    Set User Pay Rate (Your Limit: ৳ {agentRate.toFixed(2)})
                  </label>
                  <input type="number" step="0.01" value={newRate} onChange={(e) => setNewRate(e.target.value)} required
                    className="w-full bg-[#0F172A] border border-[#334155] text-white font-black px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[#EAB308]" />
                </div>
                <div>
                  <label className="block text-[10px] text-[#F43F5E] uppercase font-bold mb-1">Reset Password</label>
                  <input type="text" placeholder="Type new password (Optional)..." value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#0F172A] border border-[#334155] focus:border-[#F43F5E] text-white px-4 py-3 rounded-xl text-sm focus:outline-none placeholder-[#334155]" />
                </div>
                
                <button type="submit" disabled={isSaving} className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white font-black text-sm shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-transform hover:-translate-y-1 disabled:opacity-50">
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