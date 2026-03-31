"use client";

import Link from "next/link";
import DashboardLayout from "../DashboardLayout"; 

export default function AccessList() {
  return (
    <DashboardLayout>
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-[#EAB308] rounded-full blur-[200px] opacity-[0.05] pointer-events-none"></div>

      <div className="flex-1 overflow-auto p-4 md:p-10 flex items-center justify-center relative z-10 w-full h-full pb-20">
        
        <div className="bg-[#1E293B]/80 border border-[#334155] backdrop-blur-xl p-10 md:p-16 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.3)] text-center max-w-lg w-full relative overflow-hidden group">
           
           {/* Scanner Line Animation */}
           <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#EAB308] to-transparent animate-[scan_2s_ease-in-out_infinite]"></div>

           <div className="flex justify-center mb-6 relative">
              <div className="absolute inset-0 bg-[#EAB308] blur-[40px] opacity-20 rounded-full animate-pulse"></div>
              <div className="w-24 h-24 bg-[#0F172A] border-2 border-[#EAB308]/50 rounded-full flex items-center justify-center relative">
                 {/* Spinning Gears */}
                 <div className="absolute inset-0 border-[3px] border-transparent border-t-[#EAB308] rounded-full animate-[spin_3s_linear_infinite]"></div>
                 <div className="absolute inset-2 border-[3px] border-transparent border-b-[#3B82F6] rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                 <svg className="w-10 h-10 text-[#EAB308]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
              </div>
           </div>

           <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-3">
             Coming <span className="text-[#EAB308]">Soon...</span>
           </h2>
           <p className="text-[#94A3B8] text-sm md:text-base leading-relaxed mb-8">
             We are currently upgrading the Access List feature to provide you with better security and faster routing. Please check back soon!
           </p>

           <div className="w-full bg-[#0F172A] border border-[#334155] rounded-full h-3 mb-2 relative overflow-hidden">
              <div className="bg-gradient-to-r from-[#EAB308] to-[#F59E0B] h-full rounded-full animate-[progress_3s_ease-in-out_infinite]"></div>
           </div>
           <div className="flex justify-between text-[10px] font-bold text-[#64748B] uppercase tracking-widest">
             <span>Optimizing Nodes</span>
             <span className="text-[#EAB308] animate-pulse">Working</span>
           </div>

           <Link href="/" className="mt-10 inline-block bg-[#0F172A] border border-[#334155] hover:border-[#3B82F6] text-[#94A3B8] hover:text-white px-8 py-3 rounded-xl font-bold transition-all text-sm tracking-wider">
              RETURN TO DASHBOARD
           </Link>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        @keyframes progress {
          0% { width: 10%; }
          50% { width: 80%; }
          100% { width: 10%; }
        }
      `}} />
    </DashboardLayout>
  );
}