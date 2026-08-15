"use client";

import React, { useState } from "react";
import DashboardLayout from "../DashboardLayout"; 
import Link from "next/link";

export default function ApiDocumentation() {
  const [copiedSection, setCopiedSection] = useState("");

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(""), 2000);
  };

  // 💥 TEXT FILE DOWNLOAD LOGIC (WITH FULL EXAMPLES) 💥
  const handleDownloadDocs = () => {
    const docText = `=========================================
ZENEX CORE API DOCUMENTATION - V4.0
=========================================
Core API Base URL: https://api.zenexnetwork.com
Web API Base URL: https://www.zenexnetwork.com
Authentication Header: mapikey: YOUR_API_KEY_HERE

Note: Keep your API key secure. Route all requests through your backend server.

-----------------------------------------
1. PROVISION VIRTUAL NUMBER
-----------------------------------------
Method: POST
Endpoint: https://api.zenexnetwork.com/v1/getnum
Description: Instantly provisions a temporary or permanent virtual number.

Payload Example:
{
  "range": "4473845XXX",
  "is_national": false,
  "remove_plus": false
}

Response Example (Success):
{
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
  "meta": { "code": 200, "status": "success" }
}

-----------------------------------------
2. FETCH SMS/OTP PAYLOADS (MULTI-OTP UPGRADED)
-----------------------------------------
Method: GET
Endpoint: https://api.zenexnetwork.com/v1/numsuccess/info
Description: Polls the Zenex Core Engine to fetch incoming SMS payloads.
Important: Our OTP Engine is completely cache-free. Suggested polling rate is 3-5 seconds. Do not cancel numbers prematurely.

🔄 MULTI-OTP UPDATE: Multiple codes for the same number are now delivered as separate objects. To prevent duplicates and maintain backward compatibility, the 'nid' now includes a unique index (e.g., _0, _1). Your existing bots will automatically process Resend OTPs without any code changes!

Response Example (Success):
{
  "data": {
    "otps": [
      {
        "nid": "ZX_9A8B7C6D5E_0",
        "number": "447384561029",
        "otp": "849302 is your Instagram code. Don't share it.",
        "country": "United Kingdom",
        "operator": "T-Mobile",
        "created_at": "2024-05-18 14:45:12"
      },
      {
        "nid": "ZX_9A8B7C6D5E_1",
        "number": "447384561029",
        "otp": "123456 is your NEW Resend code.",
        "country": "United Kingdom",
        "operator": "T-Mobile",
        "created_at": "2024-05-18 14:46:05"
      }
    ]
  },
  "message": "Live SMS records fetched successfully",
  "meta": { "code": 200, "status": "success" }
}

-----------------------------------------
3. LIVE ENGINE ROUTES (BOT FEED)
-----------------------------------------
Method: GET
Endpoint: https://api.zenexnetwork.com/v1/active-ranges
Description: Exports the global live routing matrix. Use this feed to dynamically populate your App/Bot buttons with highly successful prefixes.
Important: Protected by 60s micro-caching. Optimal polling: Every 2-5 minutes.

Response Example (Success):
{
  "success": true,
  "cached": true,
  "data": {
    "active_ranges": [
      { "range": "447384XXX", "service": "Telegram", "tag": "Premium", "hits": 312 }
    ]
  }
}

-----------------------------------------
4. GLOBAL LIVE CONSOLE (PUBLIC FEED)
-----------------------------------------
Method: GET
Endpoint: https://www.zenexnetwork.com/api/v1/global-broadcast
Description: Fetches the global live feed of recent successful OTPs across the entire ZENEX network. Phone numbers are strictly masked (e.g., 447384XXX) for privacy. Ideal for powering your own Telegram bots.
Important: Protected by 10s Redis caching. Optimal polling: Every 5-8 seconds.

Response Example (Success):
{
  "success": true,
  "count": 2,
  "message": "Global Live Feed Fetched Successfully!",
  "data": [
    {
      "id": "64b5c7d...8e9f",
      "number": "447384XXX",
      "otp": "Your code is 12345. Do not share.",
      "service": "WHATSAPP",
      "country": "United Kingdom",
      "operator": "EE",
      "time": 1779460000000
    }
  ]
}

=========================================
Generated from Zenex Network Core (V4.0)
`;
    
    const blob = new Blob([docText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Zenex-API-Documentation.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getNumberRequest = `curl -X POST "https://api.zenexnetwork.com/v1/getnum" \\
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

  const checkOtpRequest = `curl -X GET "https://api.zenexnetwork.com/v1/numsuccess/info" \\
  -H "mapikey: YOUR_API_KEY_HERE"`;

  const checkOtpResponse = `{
  "data": {
    "otps": [
      {
        "nid": "ZX_9A8B7C6D5E_0",
        "number": "447384561029",
        "otp": "849302 is your Instagram code. Don't share it with anyone.",
        "country": "United Kingdom",
        "operator": "T-Mobile",
        "created_at": "2024-05-18 14:45:12"
      },
      {
        "nid": "ZX_9A8B7C6D5E_1",
        "number": "447384561029",
        "otp": "123456 is your NEW Resend code.",
        "country": "United Kingdom",
        "operator": "T-Mobile",
        "created_at": "2024-05-18 14:46:05"
      }
    ]
  },
  "message": "Live SMS records fetched successfully",
  "meta": {
    "code": 200,
    "status": "success"
  }
}`;

  const activeRangesRequest = `curl -X GET "https://api.zenexnetwork.com/v1/active-ranges" \\
  -H "mapikey: YOUR_API_KEY_HERE"`;

  const activeRangesResponse = `{
  "success": true,
  "cached": true,
  "message": "Global routing ranges fetched",
  "data": {
    "active_ranges": [
      { "range": "447384XXX", "service": "Telegram", "tag": "Premium", "hits": 312 },
      { "range": "628123XXX", "service": "WhatsApp", "tag": "Physical", "hits": 245 }
    ]
  }
}`;

  const globalBroadcastRequest = `curl -X GET "https://www.zenexnetwork.com/api/v1/global-broadcast" \\
  -H "mapikey: YOUR_API_KEY_HERE"`;

  const globalBroadcastResponse = `{
  "success": true,
  "count": 2,
  "message": "Global Live Feed Fetched Successfully!",
  "data": [
    {
      "id": "64b5c7d...8e9f",
      "number": "447384XXX",
      "otp": "Your code is 12345. Do not share.",
      "service": "WHATSAPP",
      "country": "United Kingdom",
      "operator": "EE",
      "time": 1779460000000
    }
  ]
}`;

  const botScriptExample = `const axios = require('axios');

async function checkZenexLiveFeed(targetService, targetTag = "General") {
    try {
        const response = await axios.get("https://api.zenexnetwork.com/v1/active-ranges", {
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
             <span className="px-3 py-1.5 bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 rounded text-[10px] font-black uppercase tracking-widest">Real-Time Microservice</span>
             <span className="px-3 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 rounded text-[10px] font-black uppercase tracking-widest">JSON Output</span>
             
             {/* 💥 DOWNLOAD BUTTON 💥 */}
             <button onClick={handleDownloadDocs} className="px-4 py-1.5 bg-[#EAB308]/10 hover:bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/30 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(234,179,8,0.2)] ml-auto md:ml-4">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download Docs (.txt)
             </button>
          </div>
        </div>

        {/* Authentication Section */}
        <div className="mb-12">
           <h2 className="text-xl md:text-2xl font-black text-white mb-4 flex items-center gap-2">
             <span className="text-[#3B82F6]">#</span> Authentication Engine
           </h2>
           <p className="text-[#94A3B8] text-sm font-medium mb-4">
             Every request to the Zenex Core requires a valid cryptographic API key. 
           </p>

           <div className="mt-4 mb-6 p-4 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-start gap-3 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <svg className="w-6 h-6 text-[#3B82F6] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
              <p className="text-sm font-bold text-[#E2E8F0] leading-relaxed">
                 <span className="text-[#3B82F6]">🔑 Where is my API Key?</span> <br/>
                 To generate or copy your API Key, please navigate to your <Link href="/profile" className="text-white underline hover:text-[#3B82F6] transition-colors">Profile Page</Link> and enable it from the 'API Access' section.
              </p>
           </div>

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
              <code className="text-xs text-[#94A3B8] font-bold bg-[#0F172A] px-3 py-1.5 rounded-lg border border-[#334155]">https://api.zenexnetwork.com/v1/getnum</code>
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
                          {copiedSection === 'req1' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
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
              <code className="text-xs text-[#94A3B8] font-bold bg-[#0F172A] px-3 py-1.5 rounded-lg border border-[#334155]">https://api.zenexnetwork.com/v1/numsuccess/info</code>
           </div>
           
           <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div>
                 <p className="text-[#94A3B8] text-sm mb-6">Polls the Zenex Core Engine to fetch incoming SMS payloads associated with your active number queue.</p>
                 
                 <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-start gap-3 mb-4">
                    <svg className="w-6 h-6 text-[#10B981] mt-0.5 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <div>
                       <p className="text-xs font-bold text-[#10B981] mb-1">🚀 ZENEX V4 API: Direct Real-Time Microservice</p>
                       <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                         Our OTP Engine is now completely cache-free and running on a separate microservice! You will receive the OTP instantly the millisecond it arrives. 
                         <span className="text-white font-bold block mt-1">⚠️ DO NOT cancel numbers prematurely. Set your bot timeout to at least 15-20 minutes for a 100% success rate!</span>
                         Suggested polling rate: 3 to 5 seconds.
                       </p>
                    </div>
                 </div>

                 {/* 💥 MULTI-OTP UPDATE NOTICE 💥 */}
                 <div className="p-4 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-start gap-3 mb-6">
                    <svg className="w-6 h-6 text-[#3B82F6] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    <div>
                       <p className="text-xs font-bold text-[#3B82F6] mb-1">🔄 MULTI-OTP & RESEND UPGRADE</p>
                       <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                         We now fully support Multi-OTP! Multiple codes for the same number are delivered as separate objects. To prevent duplicates and maintain backward compatibility, the <code className="text-[#3B82F6]">nid</code> now includes a unique index (e.g., <code className="text-[#3B82F6]">_0</code>, <code className="text-[#3B82F6]">_1</code>). Your existing bots will automatically process Resend OTPs without any code changes!
                       </p>
                    </div>
                 </div>

                 <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 border-b border-[#334155] pb-2">Response Object Architecture</h4>
                 <ul className="space-y-3">
                    <li className="flex gap-4 items-start">
                       <code className="text-[#3B82F6] font-bold text-[10px] bg-[#3B82F6]/10 px-2 py-1 rounded">nid</code>
                       <span className="text-xs text-[#94A3B8]">Cryptographic message identifier (Now includes _0, _1 index for Multi-OTP).</span>
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
                          {copiedSection === 'req2' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#E2E8F0] font-mono overflow-x-auto custom-scrollbar">
                       <code>{checkOtpRequest}</code>
                    </pre>
                 </div>

                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Server Response (Shows Multi-OTP)</span>
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

        {/* 3. Active Ranges API */}
        <div className="mb-12 bg-[#0F172A] border border-[#334155] rounded-2xl overflow-hidden shadow-lg relative">
           <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <svg className="w-32 h-32 text-[#8B5CF6]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
           </div>
           
           <div className="bg-[#1E293B] px-6 py-4 border-b border-[#334155] flex flex-wrap justify-between items-center gap-4 relative z-10">
              <h2 className="text-lg font-black text-white flex items-center gap-3">
                 <span className="bg-[#10B981] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">GET</span>
                 Live Engine Routes <span className="text-[10px] text-[#8B5CF6] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-2 py-0.5 rounded ml-2 hidden md:inline-block">BOT FEED</span>
              </h2>
              <code className="text-xs text-[#94A3B8] font-bold bg-[#0F172A] px-3 py-1.5 rounded-lg border border-[#334155]">https://api.zenexnetwork.com/v1/active-ranges</code>
           </div>
           
           <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
              <div>
                 <p className="text-[#94A3B8] text-sm mb-6 leading-relaxed">
                   Exports the global live routing matrix. Use this feed to dynamically populate your App/Bot buttons with highly successful prefixes.
                 </p>
                 
                 <div className="p-4 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 flex items-start gap-3 mb-6">
                    <svg className="w-5 h-5 text-[#F43F5E] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <div>
                       <p className="text-xs font-bold text-[#F43F5E] mb-1">DDoS Mitigation Array</p>
                       <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                         Protected by our 60-second micro-caching layer. Optimal polling: Every 2-5 minutes.
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
                          {copiedSection === 'script1' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
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
                          {copiedSection === 'req3' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
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

        {/* 4. NEW: Global Live Console (Broadcast) */}
        <div className="mb-12 bg-[#0F172A] border border-[#334155] rounded-2xl overflow-hidden shadow-lg relative border-l-4 border-l-[#EAB308]">
           <div className="bg-[#1E293B] px-6 py-4 border-b border-[#334155] flex flex-wrap justify-between items-center gap-4 relative z-10">
              <h2 className="text-lg font-black text-white flex items-center gap-3">
                 <span className="bg-[#10B981] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">GET</span>
                 Global Live Console <span className="text-[10px] text-[#EAB308] border border-[#EAB308]/30 bg-[#EAB308]/10 px-2 py-0.5 rounded ml-2">PUBLIC FEED</span>
              </h2>
              {/* 💥 EXPLICITLY SHOWING THE FULL NEXT.JS PATH 💥 */}
              <code className="text-xs text-[#94A3B8] font-bold bg-[#0F172A] px-3 py-1.5 rounded-lg border border-[#334155]">https://www.zenexnetwork.com/api/v1/global-broadcast</code>
           </div>
           
           <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
              <div>
                 <p className="text-[#94A3B8] text-sm mb-6 leading-relaxed">
                   Fetches the global live feed of recent successful OTPs across the entire ZENEX network. Use this data to power your own Telegram Bots and attract users with live real-time proof.
                 </p>
                 
                 <div className="p-4 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-start gap-3 mb-6">
                    <svg className="w-5 h-5 text-[#3B82F6] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                    <div>
                       <p className="text-xs font-bold text-[#3B82F6] mb-1">Privacy & Shielded Output</p>
                       <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                         Phone numbers are strictly masked using the Range Format (e.g., <strong>447384XXX</strong>) for privacy compliance. Protected by our 10-second micro-caching layer. Optimal polling: Every 5-8 seconds.
                       </p>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Client Request (cURL)</span>
                       <button onClick={() => handleCopy(globalBroadcastRequest, 'req4')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'req4' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#E2E8F0] font-mono overflow-x-auto custom-scrollbar">
                       <code>{globalBroadcastRequest}</code>
                    </pre>
                 </div>

                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Server Response</span>
                       <button onClick={() => handleCopy(globalBroadcastResponse, 'res4')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'res4' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-[10px] text-[#10B981] font-mono overflow-x-auto custom-scrollbar">
                       <code>{globalBroadcastResponse}</code>
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