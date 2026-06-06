"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../DashboardLayout"; 
import Link from "next/link";

export default function ApiDocumentation() {
  const router = useRouter();
  const [copiedSection, setCopiedSection] = useState("");
  
  // 💥 Security States 💥
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkApiAccess = async () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        try {
          const res = await fetch("/api/get-user-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: parsedUser.email })
          });
          const data = await res.json();
          
          if (data.success && data.user && data.user.isApiActive) {
            setIsAuthorized(true); 
          } else {
            setIsAuthorized(false); 
          }
        } catch (error) {
          console.error("Failed to check API access");
          setIsAuthorized(false);
        }
      } else {
        router.push("/login");
      }
      setLoading(false);
    };

    checkApiAccess();
  }, [router]);

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(""), 2000);
  };

  const getNumberRequest = `curl -X POST "https://www.zenexnetwork.com/api/v1/getnum" \\
  -H "mapikey: YOUR_API_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
      "range": "4473845XXX",
      "is_national": false,
      "remove_plus": false
  }'`;

  const getNumberResponse = `{
  "data": {
    "copy": "+447384561029",
    "country": "United Kingdom",
    "full_number": "447384561029",
    "iso": "gb",
    "number": "+447384561029",
    "operator": "Vodafone",
    "status": "pending"
  },
  "message": "Virtual number provisioned successfully",
  "meta": {
    "code": 200,
    "status": "success"
  }
}`;

  const checkOtpRequest = `curl -X GET "https://www.zenexnetwork.com/api/v1/numsuccess/info" \\
  -H "mapikey: YOUR_API_KEY_HERE"`;

  const checkOtpResponse = `{
  "data": {
    "otps": [
      {
        "nid": "ZX_9A8B7C6D5E",
        "number": "447384561029",
        "otp": "849302 is your Instagram code. Don't share it with anyone.",
        "country": "United Kingdom",
        "operator": "T-Mobile",
        "created_at": "2024-05-18 14:45:12"
      }
    ]
  },
  "message": "Live SMS records fetched successfully",
  "meta": {
    "code": 200,
    "status": "success"
  }
}`;

  const activeRangesRequest = `curl -X GET "https://www.zenexnetwork.com/api/v1/active-ranges" \\
  -H "mapikey: YOUR_API_KEY_HERE"`;

  const activeRangesResponse = `{
  "success": true,
  "cached": true,
  "message": "Global routing ranges fetched",
  "data": {
    "active_ranges": [
      { "range": "447384XXX", "service": "Telegram", "tag": "Premium", "hits": 312 },
      { "range": "628123XXX", "service": "WhatsApp", "tag": "Physical", "hits": 245 },
      { "range": "141598XXX", "service": "Netflix", "tag": "General", "hits": 89 }
    ]
  }
}`;

  const botScriptExample = `const axios = require('axios');

async function checkZenexLiveFeed(targetService, targetTag = "General") {
    try {
        const response = await axios.get("https://www.zenexnetwork.com/api/v1/active-ranges", {
            headers: { 'mapikey': 'YOUR_API_KEY_HERE' }
        });

        const activeRoutes = response.data.data.active_ranges;
        
        // Match user requested service with Zenex Engine
        const matchedRoutes = activeRoutes.filter(route => 
            route.service === targetService && 
            (targetTag === "General" ? true : route.tag === targetTag)
        );

        if (matchedRoutes.length > 0) {
            console.log(\`⚡ Live Zenex Routes for \${targetService}:\`);
            matchedRoutes.forEach(r => console.log(\`[Route: \${r.range}] -> \${r.hits} Success Hits\`));
        } else {
            console.log(\`⚠️ No active optimal routes found for \${targetService} at this moment.\`);
        }
    } catch (error) {
        console.error("Zenex API Connection Error:", error.message);
    }
}

// Bot Integration Example:
checkZenexLiveFeed("Telegram", "Premium"); 
checkZenexLiveFeed("WhatsApp");`;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center text-white p-10">
          <div className="w-10 h-10 border-4 border-[#334155] border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
          <p className="text-[#94A3B8] font-bold tracking-widest uppercase text-sm">Validating Zenex Core Access...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthorized) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center text-center p-10 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-96 h-96 bg-[#F43F5E] rounded-full blur-[120px]"></div>
          </div>
          <svg className="w-20 h-20 text-[#F43F5E] mb-6 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-widest relative z-10">Access Denied</h1>
          <p className="text-[#94A3B8] font-bold mt-4 text-sm md:text-base max-w-lg relative z-10 leading-relaxed">
            Your workspace is not authorized to interact with the Zenex Core API. Please upgrade your account or contact your network manager.
          </p>
          <Link href="/profile" className="mt-8 bg-[#1E293B] border border-[#334155] hover:border-[#3B82F6] text-white px-8 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors shadow-lg relative z-10">
            Return to Profile
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 w-full min-h-screen bg-[#0B0F1A] text-slate-200 font-sans selection:bg-[#3B82F6] selection:text-white">
        
        {/* Header Section */}
        <div className="mb-10 border-b border-[#334155] pb-8 relative overflow-hidden">
          <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-[#3B82F6] rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-widest flex items-center gap-4">
             <svg className="w-10 h-10 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
             ZENEX CORE API
          </h1>
          <p className="text-[#94A3B8] font-bold mt-3 text-sm md:text-base max-w-2xl leading-relaxed">
            Connect your systems directly to the Zenex Global Number Routing Engine. Provision premium numbers and capture real-time SMS payloads via our ultra-low latency REST architecture.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
             <span className="px-3 py-1.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded text-[10px] font-black uppercase tracking-widest">Version 4.0 (Stable)</span>
             <span className="px-3 py-1.5 bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 rounded text-[10px] font-black uppercase tracking-widest">Real-Time Tunnel</span>
             <span className="px-3 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 rounded text-[10px] font-black uppercase tracking-widest">JSON Output</span>
          </div>
        </div>

        {/* Authentication Section */}
        <div className="mb-12">
           <h2 className="text-xl md:text-2xl font-black text-white mb-4 flex items-center gap-2">
             <span className="text-[#3B82F6]">#</span> Authentication Engine
           </h2>
           <p className="text-[#94A3B8] text-sm font-medium mb-4">
             Every request to the Zenex Core requires a valid cryptographic API key. Locate your secure access key inside your <Link href="/profile" className="text-[#3B82F6] hover:underline">Profile Settings</Link>.
           </p>
           <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center justify-between">
              <div>
                 <span className="block text-[10px] text-[#64748B] font-black uppercase tracking-widest mb-1">Authorization Header</span>
                 <code className="text-[#10B981] font-bold text-lg">mapikey : YOUR_ZENEX_KEY_HERE</code>
              </div>
           </div>
           <div className="mt-4 p-4 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 flex items-start gap-3">
              <svg className="w-5 h-5 text-[#F43F5E] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-xs font-bold text-[#F43F5E] leading-relaxed">
                 Do not expose your API key in client-side code (e.g., frontend React/Vanilla JS). Always route API calls through your secure backend server to prevent balance draining.
              </p>
           </div>
        </div>

        {/* 1. Get Number Endpoint */}
        <div className="mb-12 bg-[#0F172A] border border-[#334155] rounded-2xl overflow-hidden shadow-lg">
           <div className="bg-[#1E293B] px-6 py-4 border-b border-[#334155] flex flex-wrap justify-between items-center gap-4">
              <h2 className="text-lg font-black text-white flex items-center gap-3">
                 <span className="bg-[#3B82F6] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">POST</span>
                 Provision Virtual Number
              </h2>
              <code className="text-xs text-[#94A3B8] font-bold bg-[#0F172A] px-3 py-1.5 rounded-lg border border-[#334155]">/api/v1/getnum</code>
           </div>
           
           <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div>
                 <p className="text-[#94A3B8] text-sm mb-6">Instantly provisions a temporary or permanent virtual number allocated directly to your Zenex workspace queue.</p>
                 
                 <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 border-b border-[#334155] pb-2">Payload Parameters</h4>
                 <ul className="space-y-3 mb-6">
                    <li className="flex gap-4 items-start">
                       <code className="text-[#3B82F6] font-bold text-xs bg-[#3B82F6]/10 px-2 py-1 rounded">range</code>
                       <span className="text-xs text-[#94A3B8]"><span className="text-white font-bold">Required.</span> Target routing prefix (e.g., 4473845XXX).</span>
                    </li>
                    <li className="flex gap-4 items-start">
                       <code className="text-[#EAB308] font-bold text-xs bg-[#EAB308]/10 px-2 py-1 rounded">is_national</code>
                       <span className="text-xs text-[#94A3B8]"><span className="text-white font-bold">Optional.</span> Set to true for local formatting.</span>
                    </li>
                    <li className="flex gap-4 items-start">
                       <code className="text-[#EAB308] font-bold text-xs bg-[#EAB308]/10 px-2 py-1 rounded">remove_plus</code>
                       <span className="text-xs text-[#94A3B8]"><span className="text-white font-bold">Optional.</span> Excludes the international '+' sign.</span>
                    </li>
                 </ul>
              </div>

              <div className="space-y-4">
                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Client Request (cURL)</span>
                       <button onClick={() => handleCopy(getNumberRequest, 'req1')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'req1' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#E2E8F0] font-mono overflow-x-auto custom-scrollbar">
                       <code>{getNumberRequest}</code>
                    </pre>
                 </div>

                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Server Response</span>
                       <button onClick={() => handleCopy(getNumberResponse, 'res1')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'res1' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#10B981] font-mono overflow-x-auto custom-scrollbar">
                       <code>{getNumberResponse}</code>
                    </pre>
                 </div>
              </div>
           </div>
        </div>

        {/* 2. Check OTP Endpoint */}
        <div className="mb-12 bg-[#0F172A] border border-[#334155] rounded-2xl overflow-hidden shadow-lg">
           <div className="bg-[#1E293B] px-6 py-4 border-b border-[#334155] flex flex-wrap justify-between items-center gap-4">
              <h2 className="text-lg font-black text-white flex items-center gap-3">
                 <span className="bg-[#10B981] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">GET</span>
                 Fetch SMS/OTP Payloads
              </h2>
              <code className="text-xs text-[#94A3B8] font-bold bg-[#0F172A] px-3 py-1.5 rounded-lg border border-[#334155]">/api/v1/numsuccess/info</code>
           </div>
           
           <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div>
                 <p className="text-[#94A3B8] text-sm mb-6">Polls the Zenex Core Engine to fetch incoming SMS payloads associated with your active number queue.</p>
                 
                 {/* 💥 NEW PRO TIP NOTICE FOR BOTS 💥 */}
                 <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-start gap-3 mb-6">
                    <svg className="w-6 h-6 text-[#10B981] mt-0.5 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <div>
                       <p className="text-xs font-bold text-[#10B981] mb-1">🚀 ZENEX V4 API: Direct Real-Time Tunnel</p>
                       <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                         Our OTP Engine is now completely cache-free! You will receive the OTP instantly the millisecond it arrives. 
                         <span className="text-white font-bold block mt-1">⚠️ DO NOT cancel numbers prematurely. Set your bot timeout to at least 15-20 minutes for a 100% success rate!</span>
                         Suggested polling rate: 3 to 5 seconds.
                       </p>
                    </div>
                 </div>

                 <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 border-b border-[#334155] pb-2">Response Object Architecture</h4>
                 <ul className="space-y-3">
                    <li className="flex gap-4 items-start">
                       <code className="text-[#3B82F6] font-bold text-[10px] bg-[#3B82F6]/10 px-2 py-1 rounded">nid</code>
                       <span className="text-xs text-[#94A3B8]">Cryptographic message identifier.</span>
                    </li>
                    <li className="flex gap-4 items-start">
                       <code className="text-[#3B82F6] font-bold text-[10px] bg-[#3B82F6]/10 px-2 py-1 rounded">number</code>
                       <span className="text-xs text-[#94A3B8]">The destination MSISDN.</span>
                    </li>
                    <li className="flex gap-4 items-start">
                       <code className="text-[#10B981] font-bold text-[10px] bg-[#10B981]/10 px-2 py-1 rounded">otp</code>
                       <span className="text-xs text-[#94A3B8]">Raw decoded SMS content.</span>
                    </li>
                 </ul>
              </div>

              <div className="space-y-4">
                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Client Request (cURL)</span>
                       <button onClick={() => handleCopy(checkOtpRequest, 'req2')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'req2' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#E2E8F0] font-mono overflow-x-auto custom-scrollbar">
                       <code>{checkOtpRequest}</code>
                    </pre>
                 </div>

                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Server Response</span>
                       <button onClick={() => handleCopy(checkOtpResponse, 'res2')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'res2' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#10B981] font-mono overflow-x-auto custom-scrollbar">
                       <code>{checkOtpResponse}</code>
                    </pre>
                 </div>
              </div>
           </div>
        </div>

        {/* 3. Active Ranges API (For Telegram Bots) */}
        <div className="mb-12 bg-[#0F172A] border border-[#334155] rounded-2xl overflow-hidden shadow-lg relative">
           <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <svg className="w-32 h-32 text-[#8B5CF6]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
           </div>
           
           <div className="bg-[#1E293B] px-6 py-4 border-b border-[#334155] flex flex-wrap justify-between items-center gap-4 relative z-10">
              <h2 className="text-lg font-black text-white flex items-center gap-3">
                 <span className="bg-[#10B981] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">GET</span>
                 Live Engine Routes <span className="text-[10px] text-[#8B5CF6] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-2 py-0.5 rounded ml-2 hidden md:inline-block">BOT FEED</span>
              </h2>
              <code className="text-xs text-[#94A3B8] font-bold bg-[#0F172A] px-3 py-1.5 rounded-lg border border-[#334155]">/api/v1/active-ranges</code>
           </div>
           
           <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
              <div>
                 <p className="text-[#94A3B8] text-sm mb-6 leading-relaxed">
                   Exports the global live routing matrix. Use this feed to dynamically populate your App/Bot buttons with highly successful prefixes (e.g., UK Telegram, USA WhatsApp).
                 </p>
                 
                 <div className="p-4 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 flex items-start gap-3 mb-6">
                    <svg className="w-5 h-5 text-[#F43F5E] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <div>
                       <p className="text-xs font-bold text-[#F43F5E] mb-1">DDoS Mitigation Array</p>
                       <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                         Protected by our 60-second micro-caching layer. Rapid requests will serve cached matrix data without penalizing your network score. Optimal polling: Every 2-5 minutes.
                       </p>
                    </div>
                 </div>

                 <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 border-b border-[#334155] pb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    Node.js Matrix Implementation
                 </h4>
                 <div className="bg-[#0B0F1A] border border-[#334155] rounded-xl overflow-hidden relative">
                    <div className="flex justify-between items-center px-4 py-2 border-b border-[#334155] bg-[#1E293B]">
                      <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest">Async Script Execution</span>
                      <button onClick={() => handleCopy(botScriptExample, 'script1')} className="text-[#64748B] hover:text-[#8B5CF6] transition-colors">
                          {copiedSection === 'script1' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                      </button>
                    </div>
                    <pre className="p-4 text-[10px] text-[#E2E8F0] font-mono overflow-x-auto custom-scrollbar">
                       <code>{botScriptExample}</code>
                    </pre>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Client Request (cURL)</span>
                       <button onClick={() => handleCopy(activeRangesRequest, 'req3')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'req3' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#E2E8F0] font-mono overflow-x-auto custom-scrollbar">
                       <code>{activeRangesRequest}</code>
                    </pre>
                 </div>

                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Server Response</span>
                       <button onClick={() => handleCopy(activeRangesResponse, 'res3')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'res3' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-[10px] text-[#10B981] font-mono overflow-x-auto custom-scrollbar">
                       <code>{activeRangesResponse}</code>
                    </pre>
                 </div>
              </div>
           </div>
        </div>

        {/* Status Codes */}
        <div className="mb-8">
           <h3 className="text-lg font-black text-white mb-4">HTTP Status Codes</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1E293B] border border-[#10B981]/30 p-4 rounded-xl flex items-center gap-3">
                 <span className="text-lg font-black text-[#10B981]">200</span>
                 <span className="text-xs font-bold text-[#94A3B8]">OK - Operation Successful</span>
              </div>
              <div className="bg-[#1E293B] border border-[#EAB308]/30 p-4 rounded-xl flex items-center gap-3">
                 <span className="text-lg font-black text-[#EAB308]">400</span>
                 <span className="text-xs font-bold text-[#94A3B8]">Malformed Syntax / Validation Fail</span>
              </div>
              <div className="bg-[#1E293B] border border-[#F43F5E]/30 p-4 rounded-xl flex items-center gap-3">
                 <span className="text-lg font-black text-[#F43F5E]">401</span>
                 <span className="text-xs font-bold text-[#94A3B8]">Invalid Key / Auth Rejected</span>
              </div>
              <div className="bg-[#1E293B] border border-[#F43F5E]/30 p-4 rounded-xl flex items-center gap-3">
                 <span className="text-lg font-black text-[#F43F5E]">429</span>
                 <span className="text-xs font-bold text-[#94A3B8]">IP Blacklisted (Zenex Firewall)</span>
              </div>
           </div>
        </div>

      </div>
    </DashboardLayout>
  );
}