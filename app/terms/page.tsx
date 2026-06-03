import Link from "next/link";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 font-sans selection:bg-[#3B82F6] selection:text-white pb-20 relative overflow-hidden">
      
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#3B82F6] rounded-full blur-[150px] opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#F43F5E] rounded-full blur-[150px] opacity-[0.05] pointer-events-none"></div>

      {/* Header */}
      <header className="bg-[#1E293B]/80 backdrop-blur-xl border-b border-[#334155] sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center border border-[#3B82F6]/30 group-hover:scale-105 transition-transform">
              <span className="text-[#3B82F6] font-black text-sm">ZX</span>
            </div>
            <h1 className="text-xl font-black tracking-widest bg-gradient-to-r from-[#FFFFFF] to-[#3B82F6] text-transparent bg-clip-text">ZENEX</h1>
          </Link>
          <Link href="/login" className="text-xs font-bold text-[#94A3B8] hover:text-white uppercase tracking-widest border border-[#334155] px-4 py-2 rounded-md hover:bg-[#334155]/50 transition-colors">
            Back to Login
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 mt-12 relative z-10">
        
        <div className="mb-12 border-b border-[#334155] pb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-widest mb-4">Terms & Conditions</h1>
          <p className="text-[#94A3B8] text-sm md:text-base font-bold max-w-2xl mx-auto leading-relaxed">
            Please read these terms carefully before using ZENEX NETWORK. By accessing our services, you agree to be bound by these strict usage policies.
          </p>
        </div>

        <div className="space-y-10 text-sm md:text-base text-[#94A3B8] leading-relaxed">
          
          {/* Section 1 */}
          <section className="bg-[#1E293B] border border-[#334155] p-6 md:p-8 rounded-2xl shadow-lg">
            <h2 className="text-xl font-black text-white mb-4 flex items-center gap-3">
              <span className="text-[#3B82F6]">01.</span> General Provision & Service Usage
            </h2>
            <p className="mb-4">
              ZENEX NETWORK provides temporary and permanent virtual numbers exclusively for legitimate marketing, automation, API integration, and standard account verification purposes. We act solely as a technology provider bridging the gap between global telecom aggregators and end-users.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-[#F43F5E]/5 border border-[#F43F5E]/30 p-6 md:p-8 rounded-2xl shadow-lg relative overflow-hidden">
            <h2 className="text-xl font-black text-[#F43F5E] mb-4 flex items-center gap-3 relative z-10">
              <span className="text-[#F43F5E]">02.</span> Zero-Tolerance Policy (Anti-Fraud)
            </h2>
            <p className="mb-4 relative z-10 text-[#E2E8F0] font-medium">
              We maintain a strictly enforced <span className="font-black text-white">Zero-Tolerance Policy</span> against all forms of illegal activities. 
            </p>
            <ul className="list-disc pl-5 space-y-2 relative z-10 font-bold text-[#F43F5E]/80">
              <li>Using our numbers for phishing, scamming, blackmailing, or financial fraud is absolutely prohibited.</li>
              <li>Impersonating individuals or government entities will result in an immediate permanent network ban.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-[#1E293B] border border-[#334155] p-6 md:p-8 rounded-2xl shadow-lg">
            <h2 className="text-xl font-black text-white mb-4 flex items-center gap-3">
              <span className="text-[#EAB308]">03.</span> Limitation of Liability (Disclaimer)
            </h2>
            <p className="mb-4">
              By using our service, you acknowledge that ZENEX NETWORK operates merely as an API/Routing infrastructure. 
            </p>
            <p className="font-bold text-[#E2E8F0]">
              We do not track, endorse, or take responsibility for how users utilize the generated numbers. Under no circumstances shall ZENEX NETWORK be held liable for any damages, losses, or legal disputes arising from the misuse of our platform by independent users.
            </p>
          </section>

          {/* 💥 Section 4 (UPDATED based on your Earning Model) 💥 */}
          <section className="bg-[#1E293B] border border-[#334155] p-6 md:p-8 rounded-2xl shadow-lg">
            <h2 className="text-xl font-black text-white mb-4 flex items-center gap-3">
              <span className="text-[#3B82F6]">04.</span> Account & Earnings Policy
            </h2>
            <ul className="list-disc pl-5 space-y-3">
              <li><strong className="text-white">Free Platform:</strong> ZENEX is a 100% free-to-use platform. Users earn money exclusively by successfully processing valid OTPs. We never ask for deposits.</li>
              <li><strong className="text-white">Security:</strong> API Keys and Passwords must be kept confidential. We are not responsible for unauthorized usage of your account due to leaked credentials.</li>
              <li><strong className="text-white">Fund Confiscation:</strong> Management reserves the absolute right to suspend or terminate any account and confiscate all earned balances without prior explanation if fraudulent activities or network rules violations are detected.</li>
            </ul>
          </section>

        </div>

        <div className="mt-16 border-t border-[#334155] pt-8 text-center pb-10">
          <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest">
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

      </main>
    </div>
  );
}