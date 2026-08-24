"use client";

import Link from "next/link";

export default function AccessList() {
  return (
    <div className="relative w-full h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-transparent font-sans">
      
      {/* 💥 CYBER GLOW BACKGROUND 💥 */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#00D2FF] rounded-full blur-[250px] opacity-[0.05] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-[#60A5FA] rounded-full blur-[200px] opacity-[0.03] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-lg p-4 md:p-10">
        
        {/* 💥 MAIN MODULE CARD 💥 */}
        <div className="bg-[#0B152A]/90 border border-[#162749] backdrop-blur-2xl p-10 md:p-14 rounded-3xl shadow-[0_0_50px_rgba(0,210,255,0.05),inset_0_1px_4px_rgba(0,210,255,0.05)] text-center w-full relative overflow-hidden group">
           
           {/* 💥 SCANNER LINE ANIMATION 💥 */}
           <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00D2FF] to-transparent animate-[scan_2.5s_ease-in-out_infinite] shadow-[0_0_15px_#00D2FF]"></div>

           <div className="flex justify-center mb-8 relative">
              <div className="absolute inset-0 bg-[#00D2FF] blur-[50px] opacity-20 rounded-full animate-pulse"></div>
              
              <div className="w-24 h-24 bg-[#101726] border border-[#162749] rounded-full flex items-center justify-center relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                 
                 {/* 💥 SPINNING HUD RINGS 💥 */}
                 <div className="absolute inset-0 border-[2px] border-transparent border-t-[#00D2FF] border-r-[#00D2FF]/30 rounded-full animate-[spin_3s_linear_infinite]"></div>
                 <div className="absolute inset-2 border-[2px] border-transparent border-b-[#60A5FA] border-l-[#60A5FA]/30 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                 
                 <svg className="w-10 h-10 text-[#00D2FF] drop-shadow-[0_0_8px_rgba(0,210,255,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
              </div>
           </div>

           <h2 className="text-xl md:text-2xl font-bold text-[#F8FAFC] tracking-widest uppercase mb-3">
             Module <span className="text-[#00D2FF]">Offline</span>
           </h2>
           <p className="text-[#6C84A3] text-xs md:text-sm font-medium leading-relaxed mb-8 px-2">
             We are upgrading the <span className="text-[#F8FAFC] font-semibold">Access List</span> security nodes for faster and more secured routing. Deployment is scheduled shortly.
           </p>

           {/* 💥 PROGRESS BAR 💥 */}
           <div className="w-full bg-[#101726] border border-[#162749] rounded-full h-2.5 mb-2.5 relative overflow-hidden shadow-inner">
              <div className="bg-gradient-to-r from-[#60A5FA] to-[#00D2FF] h-full rounded-full animate-[progress_3s_ease-in-out_infinite] shadow-[0_0_10px_#00D2FF]"></div>
           </div>
           <div className="flex justify-between text-[9px] md:text-[10px] font-semibold text-[#6C84A3] uppercase tracking-widest px-1">
             <span>Deploying Nodes</span>
             <span className="text-[#00D2FF] animate-pulse">Processing...</span>
           </div>

           {/* 💥 RETURN BUTTON 💥 */}
           <Link href="/" className="mt-10 inline-flex items-center gap-2 bg-[#101726] border border-[#162749] hover:border-[#00D2FF]/50 text-[#6C84A3] hover:text-[#00D2FF] px-8 py-3.5 rounded-xl font-bold transition-all text-xs tracking-widest uppercase shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_20px_rgba(0,210,255,0.1)] group/btn">
              <svg className="w-4 h-4 text-[#6C84A3] group-hover/btn:text-[#00D2FF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Return to Terminal
           </Link>
        </div>

      </div>

      {/* 💥 CSS ANIMATIONS 💥 */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes progress {
          0% { width: 5%; }
          50% { width: 95%; }
          100% { width: 5%; }
        }
      `}} />
    </div>
  );
}