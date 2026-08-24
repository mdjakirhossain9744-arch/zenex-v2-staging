"use client";

import { useState, useEffect } from "react";

export default function Notifications() {
  const [role, setRole] = useState("user");
  const [userEmail, setUserEmail] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState("GLOBAL"); 

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

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("tab") === "personal") {
         setActiveTab("PERSONAL");
      }
    }
  }, []);

  // 💥 ম্যাজিক: লাইভ ডেটা ফেচ এবং ইভেন্ট লিসেনার 💥
  useEffect(() => {
    if (userEmail || activeTab === "GLOBAL") {
      fetchNotifications(activeTab);
    }

    const handleLiveUpdate = () => {
      console.log("⚡ Live Signal Received! Refreshing Notifications...");
      fetchNotifications(activeTab); 
    };

    window.addEventListener("NEW_LIVE_NOTIFICATION", handleLiveUpdate);

    return () => {
      window.removeEventListener("NEW_LIVE_NOTIFICATION", handleLiveUpdate);
    };
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
           if (tabType === "GLOBAL" && !viewedNotifs.includes(n._id)) {
              viewedNotifs.push(n._id);
              localStorage.setItem("zenex_viewed", JSON.stringify(viewedNotifs));
              fetch("/api/notifications", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "REACTION", id: n._id, reactionType: "view" })
              });
              n.views = (n.views || 0) + 1;
           }
           return { ...n, userReaction: savedReactions[n._id] || null };
        });
        setNotifications(formatted);
      }
    } catch (err: any) {
      console.error("Failed to load notifications", err);
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
          let newLikes = notif.likes || 0;
          let newDislikes = notif.dislikes || 0;

          if (currentReaction === "like") { newLikes--; fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "REACTION", id, reactionType: "unlike" }) }); }
          if (currentReaction === "dislike") { newDislikes--; fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "REACTION", id, reactionType: "undislike" }) }); }

          if (reaction === "like") newLikes++;
          if (reaction === "dislike") newDislikes++;

          savedReactions[id] = reaction;
          return { ...notif, userReaction: reaction, likes: newLikes, dislikes: newDislikes };
        }
      }
      return notif;
    })); 

    localStorage.setItem("zenex_reactions", JSON.stringify(savedReactions));

    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REACTION", id, reactionType: actionType })
    });
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    // 💥 V2 Strict Colors: INFO(Cyan), UPDATE(Blue), WARNING(Red) 💥
    const colorMap: Record<string, string> = { INFO: "cyan", UPDATE: "blue", WARNING: "red" };
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
    <div className="p-4 md:p-8 w-full relative z-10 pb-20" style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', sans-serif" }}>
      <div className="max-w-4xl mx-auto flex flex-col gap-6">

         {/* 💥 V2 CYBER TABS 💥 */}
         <div className="flex items-center gap-2 bg-[#0B152A] p-1.5 rounded-xl border border-[#162749] w-full md:w-max shadow-sm">
           <button 
              onClick={() => setActiveTab("GLOBAL")} 
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === "GLOBAL" ? "bg-[#101726] text-[#00D2FF] border border-[#162749] shadow-sm" : "text-[#6C84A3] hover:text-[#F8FAFC]"}`}
           >
              🌍 Global Notices
           </button>
           <button 
              onClick={() => setActiveTab("PERSONAL")} 
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === "PERSONAL" ? "bg-[#101726] text-[#60A5FA] border border-[#162749] shadow-sm" : "text-[#6C84A3] hover:text-[#F8FAFC]"}`}
           >
              🔔 My Alerts
           </button>
         </div>

         {role === "admin" && activeTab === "GLOBAL" && (
           <div className="mb-2">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-[#F8FAFC] uppercase tracking-widest">Admin Controls</h2>
                <button 
                  onClick={() => setIsPosting(!isPosting)} 
                  className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${isPosting ? 'bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/20' : 'bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20 hover:bg-[#00D2FF] hover:text-[#030816]'}`}
                >
                  {isPosting ? "Cancel Posting" : "+ Create New Post"}
                </button>
              </div>

              {isPosting && (
                <form onSubmit={handleCreatePost} className="bg-[#0B152A] border border-[#162749] p-5 md:p-6 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00D2FF] to-[#60A5FA]"></div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[9px] text-[#6C84A3] font-bold uppercase tracking-widest mb-1.5">Post Title</label>
                        <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Server Maintenance Notice" className="w-full bg-[#030816] border border-[#162749] rounded-lg px-4 py-2.5 text-[#F8FAFC] text-sm focus:outline-none focus:border-[#00D2FF] transition-colors placeholder:text-[#6C84A3]/50" />
                      </div>
                      <div>
                        <label className="block text-[9px] text-[#6C84A3] font-bold uppercase tracking-widest mb-1.5">Tag Type</label>
                        <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full bg-[#030816] border border-[#162749] rounded-lg px-4 py-2.5 text-[#F8FAFC] text-sm focus:outline-none focus:border-[#00D2FF] transition-colors appearance-none">
                          <option value="INFO">ℹ️ INFO (Cyan)</option>
                          <option value="UPDATE">🚀 UPDATE (Blue)</option>
                          <option value="WARNING">⚠️ WARNING (Red)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] text-[#6C84A3] font-bold uppercase tracking-widest mb-1.5">Detailed Description</label>
                      <textarea required value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="Type your full announcement here..." className="w-full bg-[#030816] border border-[#162749] rounded-lg px-4 py-2.5 text-[#F8FAFC] text-sm focus:outline-none focus:border-[#00D2FF] resize-none transition-colors placeholder:text-[#6C84A3]/50"></textarea>
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-[#00D2FF] to-[#60A5FA] text-[#030816] font-bold py-2.5 rounded-lg shadow-[0_0_15px_rgba(0,210,255,0.4)] hover:shadow-[0_0_25px_rgba(0,210,255,0.6)] transition-all uppercase tracking-widest text-[11px]">
                      Publish Announcement
                    </button>
                  </div>
                </form>
              )}
           </div>
         )}

         {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-[#162749] border-t-[#00D2FF] rounded-full animate-spin mb-4"></div>
              <div className="text-[10px] text-[#6C84A3] font-bold tracking-widest uppercase">Loading Network...</div>
            </div>
         ) : notifications.length === 0 ? (
            <div className="text-center text-[#6C84A3] font-medium py-10 border border-dashed border-[#162749] rounded-2xl bg-[#0B152A]">
               No {activeTab === "PERSONAL" ? "personal alerts" : "announcements"} found in the system.
            </div>
         ) : (
           notifications.map((notif) => {
             // 💥 V2 COLOR MAPPING 💥
             let accentColor = "bg-[#00D2FF]";
             let tagClass = "bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/20";
             let titleColor = "text-[#F8FAFC]";
             let descColor = "text-[#6C84A3]";

             if (notif.color === "cyan" || notif.type === "INFO") {
                accentColor = "bg-[#00D2FF]"; tagClass = "bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/20";
             } else if (notif.color === "blue" || notif.type === "UPDATE") {
                accentColor = "bg-[#60A5FA]"; tagClass = "bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20";
             } else if (notif.color === "red" || notif.type === "WARNING") {
                accentColor = "bg-[#F43F5E]"; tagClass = "bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20";
                titleColor = "text-[#F43F5E]"; descColor = "text-[#F43F5E]/80";
             }

             return (
              <div key={notif._id} className="bg-[#0B152A] border border-[#162749] hover:border-[#1F335B] rounded-2xl p-5 md:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-colors relative overflow-hidden group">
                 
                 <div className={`absolute top-0 left-0 w-1 h-full ${accentColor}`}></div>

                 <div className="flex justify-between items-start mb-3.5">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest border ${tagClass}`}>
                         {notif.type}
                      </span>
                      <span className="text-[10px] font-semibold text-[#6C84A3] tracking-wide flex items-center gap-1.5">
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         {timeAgo(notif.createdAt)}
                      </span>
                    </div>

                    {role === "admin" && activeTab === "GLOBAL" && (
                      <button onClick={() => handleDeletePost(notif._id)} className="text-[#6C84A3] hover:text-[#F43F5E] transition-colors p-1" title="Delete Post">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                 </div>

                 <h3 className={`text-base md:text-lg font-bold tracking-tight mb-2 pr-6 ${titleColor}`}>{notif.title}</h3>
                 <p className={`text-xs md:text-sm leading-relaxed mb-5 whitespace-pre-wrap font-medium tracking-wide ${descColor}`}>
                    {notif.description}
                 </p>

                 {activeTab === "GLOBAL" && (
                   <div className="flex items-center justify-between pt-3.5 border-t border-[#162749]">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#6C84A3] uppercase">
                         <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                         {notif.views?.toLocaleString() || 0} Views
                      </div>

                      <div className="flex items-center gap-3">
                         <button 
                           onClick={() => handleReaction(notif._id, "like")}
                           className={`flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-2.5 py-1.5 rounded-lg transition-all ${
                             notif.userReaction === "like" ? "bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/30" : "bg-[#030816] text-[#6C84A3] hover:text-[#00D2FF] border border-[#162749]"
                           }`}
                         >
                           <svg className="w-3.5 h-3.5" fill={notif.userReaction === "like" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                           {notif.likes || 0}
                         </button>

                         <button 
                           onClick={() => handleReaction(notif._id, "dislike")}
                           className={`flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-2.5 py-1.5 rounded-lg transition-all ${
                             notif.userReaction === "dislike" ? "bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/30" : "bg-[#030816] text-[#6C84A3] hover:text-[#F43F5E] border border-[#162749]"
                           }`}
                         >
                           <svg className="w-3.5 h-3.5" fill={notif.userReaction === "dislike" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.904-.904 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                           {notif.dislikes || 0}
                         </button>
                      </div>
                   </div>
                 )}
              </div>
             );
           })
         )}
      </div>
    </div>
  );
}