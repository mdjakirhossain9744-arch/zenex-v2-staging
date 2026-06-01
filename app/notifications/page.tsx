"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout"; 

export default function Notifications() {
  const [role, setRole] = useState("user");
  const [userEmail, setUserEmail] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 💥 NEW: Tab State 💥
  const [activeTab, setActiveTab] = useState("GLOBAL"); // "GLOBAL" or "PERSONAL"

  const [isPosting, setIsPosting] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("INFO");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
       const parsed = JSON.parse(storedUser);
       setRole(parsed.role);
       setUserEmail(parsed.email);
    }

    // 💥 URL Checker: If user clicked Bell Icon, open Personal Tab automatically 💥
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("tab") === "personal") {
       setActiveTab("PERSONAL");
    }
  }, []);

  useEffect(() => {
    if (userEmail || activeTab === "GLOBAL") {
      fetchNotifications(activeTab);
    }
  }, [activeTab, userEmail]);

  const fetchNotifications = async (tabType: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FETCH", fetchType: tabType, email: userEmail }) 
      });
      const data = await res.json();
      
      if (data.success) {
        const savedReactions = JSON.parse(localStorage.getItem("zenex_reactions") || "{}");
        const viewedNotifs = JSON.parse(localStorage.getItem("zenex_viewed") || "[]");

        const formatted = data.data.map((n: any) => {
           // We only track views/likes for GLOBAL notices
           if (tabType === "GLOBAL" && !viewedNotifs.includes(n._id)) {
              viewedNotifs.push(n._id);
              localStorage.setItem("zenex_viewed", JSON.stringify(viewedNotifs));
              fetch("/api/notifications", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "REACTION", id: n._id, reactionType: "view" })
              });
              n.views += 1;
           }
           return { ...n, userReaction: savedReactions[n._id] || null };
        });
        setNotifications(formatted);
      }
    } catch (err) {
      console.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async (id: string, reaction: "like" | "dislike") => {
    const savedReactions = JSON.parse(localStorage.getItem("zenex_reactions") || "{}");
    const currentReaction = savedReactions[id];

    let actionType: string = reaction;
    
    setNotifications(prev => prev.map(notif => {
      if (notif._id === id) {
        if (currentReaction === reaction) {
          actionType = reaction === "like" ? "unlike" : "undislike";
          savedReactions[id] = null;
          return {
            ...notif, userReaction: null,
            likes: reaction === "like" ? notif.likes - 1 : notif.likes,
            dislikes: reaction === "dislike" ? notif.dislikes - 1 : notif.dislikes,
          };
        } else {
          let newLikes = notif.likes;
          let newDislikes = notif.dislikes;

          if (currentReaction === "like") { newLikes--; fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "REACTION", id, reactionType: "unlike" }) }); }
          if (currentReaction === "dislike") { newDislikes--; fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "REACTION", id, reactionType: "undislike" }) }); }

          if (reaction === "like") newLikes++;
          if (reaction === "dislike") newDislikes++;

          savedReactions[id] = reaction;
          return { ...notif, userReaction: reaction, likes: newLikes, dislikes: newDislikes };
        }
      }
      return notif;
    });

    localStorage.setItem("zenex_reactions", JSON.stringify(savedReactions));

    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REACTION", id, reactionType: actionType })
    });
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const colorMap: Record<string, string> = { INFO: "blue", UPDATE: "green", WARNING: "yellow" };
    const color = colorMap[newType];

    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CREATE", title: newTitle, description: newDesc, type: newType, color, noticeType: "GLOBAL" })
    });
    
    if (res.ok) {
      setNewTitle(""); setNewDesc(""); setIsPosting(false);
      fetchNotifications("GLOBAL"); 
    }
  };

  const handleDeletePost = async (id: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this notification?");
    if (confirmDelete) {
      setNotifications(notifications.filter(n => n._id !== id)); 
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE", id })
      });
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Just Now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full relative z-10 pb-20">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">

           {/* 💥 TOP TAB NAVIGATION 💥 */}
           <div className="flex items-center gap-2 bg-[#0F172A] p-2 rounded-2xl border border-[#334155] w-full md:w-max">
             <button 
                onClick={() => setActiveTab("GLOBAL")} 
                className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-black transition-all ${activeTab === "GLOBAL" ? "bg-[#3B82F6] text-white shadow-lg" : "text-[#94A3B8] hover:text-white"}`}
             >
                🌍 Global Notices
             </button>
             <button 
                onClick={() => setActiveTab("PERSONAL")} 
                className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-black transition-all ${activeTab === "PERSONAL" ? "bg-[#10B981] text-white shadow-lg" : "text-[#94A3B8] hover:text-white"}`}
             >
                🔔 My Alerts
             </button>
           </div>

           {role === "admin" && activeTab === "GLOBAL" && (
             <div className="mb-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-black text-[#64748B] uppercase tracking-wider">Admin Controls</h2>
                  <button 
                    onClick={() => setIsPosting(!isPosting)} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${isPosting ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'}`}
                  >
                    {isPosting ? "Cancel Posting" : "+ Create New Post"}
                  </button>
                </div>

                {isPosting && (
                  <form onSubmit={handleCreatePost} className="bg-[#1E293B]/90 border border-[#334155] p-6 rounded-2xl shadow-xl animate-bounce-in relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3B82F6] to-[#00C6FF]"></div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mb-1">Post Title</label>
                          <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Server Maintenance Notice" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#3B82F6]" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mb-1">Tag Type</label>
                          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#3B82F6]">
                            <option value="INFO">ℹ️ INFO (Blue)</option>
                            <option value="UPDATE">🚀 UPDATE (Green)</option>
                            <option value="WARNING">⚠️ WARNING (Yellow)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mb-1">Detailed Description</label>
                        <textarea required value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="Type your full announcement here..." className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#3B82F6] resize-none"></textarea>
                      </div>
                      <button type="submit" className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-black py-3 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-colors">
                        Publish Announcement
                      </button>
                    </div>
                  </form>
                )}
             </div>
           )}

           {loading ? (
              <div className="text-center text-[#3B82F6] font-bold py-10">Loading Messages...</div>
           ) : notifications.length === 0 ? (
              <div className="text-center text-[#64748B] font-bold py-10">No {activeTab === "PERSONAL" ? "personal alerts" : "announcements"} found.</div>
           ) : (
             notifications.map((notif) => (
                <div key={notif._id} className="bg-[#1E293B]/80 border border-[#334155] hover:border-[#3B82F6]/50 rounded-3xl p-6 md:p-8 shadow-lg transition-all relative overflow-hidden group">
                   
                   <div className={`absolute top-0 left-0 w-1.5 h-full ${
                     notif.color === 'blue' ? 'bg-[#3B82F6]' : 
                     notif.color === 'yellow' ? 'bg-[#EAB308]' : 
                     notif.color === 'red' ? 'bg-[#F43F5E]' :
                     'bg-[#10B981]'
                   }`}></div>

                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                           notif.color === 'blue' ? 'bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20' : 
                           notif.color === 'yellow' ? 'bg-[#EAB308]/10 text-[#EAB308] border border-[#EAB308]/20' : 
                           notif.color === 'red' ? 'bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/20' : 
                           'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'
                        }`}>
                           {notif.type}
                        </span>
                        <span className="text-xs font-bold text-[#64748B] flex items-center gap-1">
                           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           {timeAgo(notif.createdAt)}
                        </span>
                      </div>

                      {role === "admin" && activeTab === "GLOBAL" && (
                        <button onClick={() => handleDeletePost(notif._id)} className="text-[#64748B] hover:text-[#F43F5E] transition-colors p-1" title="Delete Post">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                   </div>

                   <h3 className="text-xl font-black text-white mb-2 pr-6">{notif.title}</h3>
                   <p className={`text-sm leading-relaxed mb-6 whitespace-pre-wrap ${notif.color === 'red' ? 'text-red-200' : 'text-[#94A3B8]'}`}>
                      {notif.description}
                   </p>

                   {/* Only show views and reactions for GLOBAL notices */}
                   {activeTab === "GLOBAL" && (
                     <div className="flex items-center justify-between pt-4 border-t border-[#334155]/50">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#64748B]">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                           {notif.views?.toLocaleString() || 0} Views
                        </div>

                        <div className="flex items-center gap-4">
                           <button 
                             onClick={() => handleReaction(notif._id, "like")}
                             className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                               notif.userReaction === "like" ? "bg-[#3B82F6]/20 text-[#3B82F6]" : "bg-[#0F172A] text-[#94A3B8] hover:text-white border border-[#334155]"
                             }`}
                           >
                             <svg className="w-4 h-4" fill={notif.userReaction === "like" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                             {notif.likes || 0}
                           </button>

                           <button 
                             onClick={() => handleReaction(notif._id, "dislike")}
                             className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                               notif.userReaction === "dislike" ? "bg-[#F43F5E]/20 text-[#F43F5E]" : "bg-[#0F172A] text-[#94A3B8] hover:text-white border border-[#334155]"
                             }`}
                           >
                             <svg className="w-4 h-4" fill={notif.userReaction === "dislike" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                             {notif.dislikes || 0}
                           </button>
                        </div>
                     </div>
                   )}
                </div>
             ))
           )}
        </div>
      </div>
    </DashboardLayout>
  );
}