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
            setIsAuthorized(true); // 💥 API অন থাকলে পেজ দেখাবে
          } else {
            setIsAuthorized(false); // 💥 API অফ থাকলে পেজ দেখাবে না
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

  const getNumberRequest = `curl -X POST "https://yourdomain.com/api/v1/getnum" \\
  -H "mapikey: YOUR_API_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
      "range": "23276345XXX",
      "is_national": false,
      "remove_plus": false
  }'`;

  const getNumberResponse = `{
  "data": {
    "copy": "+23276345652",
    "country": "Sierra Leone",
    "full_number": "23276345652",
    "iso": "sl",
    "number": "+23276345652",
    "operator": "Other",
    "status": "pending"
  },
  "message": "Number allocated successfully",
  "meta": {
    "code": 200,
    "status": "success"
  }
}`;

  const checkOtpRequest = `curl -X GET "https://yourdomain.com/api/v1/numsuccess/info" \\
  -H "mapikey: YOUR_API_KEY_HERE"`;

  const checkOtpResponse = `{
  "data": {
    "cached_time": "13:31:08",
    "count": 20,
    "otps": [
      {
        "nid": "M_22ETYO7LL",
        "number": "23275561614",
        "otp": "<#> 031397 is your verification code.",
        "country": "Sierra Leone",
        "operator": "Other",
        "created_at": "2026-02-02 13:29:33"
      }
    ],
    "source": "database"
  },
  "message": "Recent OTPs retrieved successfully",
  "meta": {
    "code": 200,
    "status": "success"
  }
}`;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center text-white p-10">
          <div className="w-10 h-10 border-4 border-[#334155] border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
          <p className="text-[#94A3B8] font-bold tracking-widest uppercase text-sm">Verifying Developer Access...</p>
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
            You do not have permission to view the Developer API Documentation. This area is strictly reserved for users with active API Access. 
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
             ZENEX API Docs
          </h1>
          <p className="text-[#94A3B8] font-bold mt-3 text-sm md:text-base max-w-2xl leading-relaxed">
            Integrate our powerful OTP and Number Generation engine directly into your Telegram bots, web apps, or custom softwares. 
            Automate your workflow with lightning-fast JSON responses.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
             <span className="px-3 py-1.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded text-[10px] font-black uppercase tracking-widest">Version 1.0</span>
             <span className="px-3 py-1.5 bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 rounded text-[10px] font-black uppercase tracking-widest">REST API</span>
             <span className="px-3 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 rounded text-[10px] font-black uppercase tracking-widest">JSON Responses</span>
          </div>
        </div>

        {/* Authentication Section */}
        <div className="mb-12">
           <h2 className="text-xl md:text-2xl font-black text-white mb-4 flex items-center gap-2">
             <span className="text-[#3B82F6]">#</span> Authentication
           </h2>
           <p className="text-[#94A3B8] text-sm font-medium mb-4">
             All API requests must include your unique secret key in the request headers. You can find your API key in your <Link href="/profile" className="text-[#3B82F6] hover:underline">Profile Settings</Link>.
           </p>
           <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center justify-between">
              <div>
                 <span className="block text-[10px] text-[#64748B] font-black uppercase tracking-widest mb-1">Header Key</span>
                 <code className="text-[#10B981] font-bold text-lg">mapikey : ZNX_YOUR_SECRET_KEY</code>
              </div>
           </div>
           <div className="mt-4 p-4 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 flex items-start gap-3">
              <svg className="w-5 h-5 text-[#F43F5E] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-xs font-bold text-[#F43F5E] leading-relaxed">
                 Keep your API key strictly confidential. If leaked, unauthorized users can generate numbers using your account, and your balance will be affected.
              </p>
           </div>
        </div>

        {/* 1. Get Number Endpoint */}
        <div className="mb-12 bg-[#0F172A] border border-[#334155] rounded-2xl overflow-hidden shadow-lg">
           <div className="bg-[#1E293B] px-6 py-4 border-b border-[#334155] flex flex-wrap justify-between items-center gap-4">
              <h2 className="text-lg font-black text-white flex items-center gap-3">
                 <span className="bg-[#3B82F6] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">POST</span>
                 Allocate a Phone Number
              </h2>
              <code className="text-xs text-[#94A3B8] font-bold bg-[#0F172A] px-3 py-1.5 rounded-lg border border-[#334155]">/api/v1/getnum</code>
           </div>
           
           <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div>
                 <p className="text-[#94A3B8] text-sm mb-6">Generates a new live phone number based on your specified range or country code.</p>
                 
                 <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 border-b border-[#334155] pb-2">Request Body Parameters</h4>
                 <ul className="space-y-3 mb-6">
                    <li className="flex gap-4 items-start">
                       <code className="text-[#3B82F6] font-bold text-xs bg-[#3B82F6]/10 px-2 py-1 rounded">range</code>
                       <span className="text-xs text-[#94A3B8]"><span className="text-white font-bold">Required.</span> The country code or prefix (e.g., 23276345XXX).</span>
                    </li>
                    <li className="flex gap-4 items-start">
                       <code className="text-[#EAB308] font-bold text-xs bg-[#EAB308]/10 px-2 py-1 rounded">is_national</code>
                       <span className="text-xs text-[#94A3B8]"><span className="text-white font-bold">Optional.</span> Boolean (true/false). Default is false.</span>
                    </li>
                    <li className="flex gap-4 items-start">
                       <code className="text-[#EAB308] font-bold text-xs bg-[#EAB308]/10 px-2 py-1 rounded">remove_plus</code>
                       <span className="text-xs text-[#94A3B8]"><span className="text-white font-bold">Optional.</span> Boolean (true/false). Excludes '+' from the number.</span>
                    </li>
                 </ul>
              </div>

              <div className="space-y-4">
                 {/* Example Request */}
                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Example Request (cURL)</span>
                       <button onClick={() => handleCopy(getNumberRequest, 'req1')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'req1' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#E2E8F0] font-mono overflow-x-auto custom-scrollbar">
                       <code>{getNumberRequest}</code>
                    </pre>
                 </div>

                 {/* Example Response */}
                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Example Response</span>
                       <button onClick={() => handleCopy(getNumberResponse, 'res1')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'res1' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
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
                 Retrieve Recent OTPs
              </h2>
              <code className="text-xs text-[#94A3B8] font-bold bg-[#0F172A] px-3 py-1.5 rounded-lg border border-[#334155]">/api/v1/numsuccess/info</code>
           </div>
           
           <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div>
                 <p className="text-[#94A3B8] text-sm mb-6">Fetches all the recent OTPs and messages received by the numbers allocated to your account.</p>
                 
                 <div className="p-4 rounded-xl bg-[#EAB308]/10 border border-[#EAB308]/20 flex items-start gap-3 mb-6">
                    <svg className="w-5 h-5 text-[#EAB308] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                       <p className="text-xs font-bold text-[#EAB308] mb-1">Polling Recommendation</p>
                       <p className="text-[10px] text-[#94A3B8] leading-relaxed">It is strictly recommended to poll this endpoint every 3 to 5 seconds. Polling faster than 2 seconds may trigger our automated Firewall and temporarily block your IP.</p>
                    </div>
                 </div>

                 <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 border-b border-[#334155] pb-2">Response Array Fields</h4>
                 <ul className="space-y-3">
                    <li className="flex gap-4 items-start">
                       <code className="text-[#3B82F6] font-bold text-[10px] bg-[#3B82F6]/10 px-2 py-1 rounded">number</code>
                       <span className="text-xs text-[#94A3B8]">The phone number that received the message.</span>
                    </li>
                    <li className="flex gap-4 items-start">
                       <code className="text-[#10B981] font-bold text-[10px] bg-[#10B981]/10 px-2 py-1 rounded">otp</code>
                       <span className="text-xs text-[#94A3B8]">The full SMS text containing the verification code.</span>
                    </li>
                 </ul>
              </div>

              <div className="space-y-4">
                 {/* Example Request */}
                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Example Request (cURL)</span>
                       <button onClick={() => handleCopy(checkOtpRequest, 'req2')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'req2' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#E2E8F0] font-mono overflow-x-auto custom-scrollbar">
                       <code>{checkOtpRequest}</code>
                    </pre>
                 </div>

                 {/* Example Response */}
                 <div className="relative bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
                    <div className="bg-[#0B0F1A] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                       <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Example Response</span>
                       <button onClick={() => handleCopy(checkOtpResponse, 'res2')} className="text-[#64748B] hover:text-white transition-colors">
                          {copiedSection === 'res2' ? <span className="text-[#10B981] text-[10px] font-black">COPIED!</span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                       </button>
                    </div>
                    <pre className="p-4 text-xs text-[#10B981] font-mono overflow-x-auto custom-scrollbar">
                       <code>{checkOtpResponse}</code>
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
                 <span className="text-xs font-bold text-[#94A3B8]">OK - Request Successful</span>
              </div>
              <div className="bg-[#1E293B] border border-[#EAB308]/30 p-4 rounded-xl flex items-center gap-3">
                 <span className="text-lg font-black text-[#EAB308]">400</span>
                 <span className="text-xs font-bold text-[#94A3B8]">Bad Request / Invalid Range</span>
              </div>
              <div className="bg-[#1E293B] border border-[#F43F5E]/30 p-4 rounded-xl flex items-center gap-3">
                 <span className="text-lg font-black text-[#F43F5E]">401</span>
                 <span className="text-xs font-bold text-[#94A3B8]">Unauthorized / Invalid Key</span>
              </div>
              <div className="bg-[#1E293B] border border-[#F43F5E]/30 p-4 rounded-xl flex items-center gap-3">
                 <span className="text-lg font-black text-[#F43F5E]">429</span>
                 <span className="text-xs font-bold text-[#94A3B8]">Too Many Requests (Firewall)</span>
              </div>
           </div>
        </div>

      </div>
    </DashboardLayout>
  );
}