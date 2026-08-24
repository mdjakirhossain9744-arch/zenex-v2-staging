import Link from "next/link";
import GlobalFooter from "../components/GlobalFooter";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-200 font-sans selection:bg-cyan-500/30 selection:text-white flex flex-col">
      
      {/* Header - V2 Solid Premium Look */}
      <header className="bg-[#0B0F1A]/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[#111827] flex items-center justify-center border border-slate-700/50 shadow-sm group-hover:border-cyan-500/30 transition-colors">
              <span className="text-cyan-400 font-bold text-xs tracking-wider">ZX</span>
            </div>
            <h1 className="text-xl font-extrabold tracking-[0.15em] bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent uppercase">
              ZENEX NETWORK
            </h1>
          </Link>
          <Link href="/login" className="text-[11px] font-bold text-slate-400 hover:text-white uppercase tracking-widest border border-slate-700/60 px-4 py-2 rounded-md bg-[#111827] hover:bg-slate-800 hover:border-slate-600 transition-all shadow-sm">
            Back to Login
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl mx-auto px-6 mt-12 mb-16 relative z-10 w-full">
        
        <div className="mb-14 border-b border-slate-800 pb-10 text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <span className="bg-cyan-900/20 text-cyan-400 px-3 py-1 rounded-sm border border-cyan-800/30 text-[10px] uppercase font-bold tracking-widest">
              Legal Document
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white uppercase tracking-widest mb-4">
            Terms & Conditions
          </h1>
          <p className="text-slate-400 text-sm md:text-base font-medium max-w-2xl mx-auto leading-relaxed">
            Please read these terms carefully before using ZENEX NETWORK. By accessing our services, you agree to be bound by these strict usage policies.
          </p>
        </div>

        <div className="space-y-6 text-sm md:text-base text-slate-300 leading-relaxed">
          
          {/* Section 1 */}
          <section className="bg-[#111827] border border-slate-800/80 p-6 md:p-8 rounded-xl shadow-lg hover:border-slate-700 transition-colors duration-300">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3 tracking-wide">
              <span className="text-cyan-400 font-black text-xl">01.</span> General Provision & Service Usage
            </h2>
            <p className="text-slate-400 font-medium">
              ZENEX NETWORK provides temporary and permanent virtual numbers exclusively for legitimate marketing, automation, API integration, and standard account verification purposes. We act solely as a technology provider bridging the gap between global telecom aggregators and end-users.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-[#111827] border border-slate-800/80 p-6 md:p-8 rounded-xl shadow-lg hover:border-slate-700 transition-colors duration-300">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3 tracking-wide">
              <span className="text-cyan-400 font-black text-xl">02.</span> Zero-Tolerance Policy (Anti-Fraud)
            </h2>
            <p className="mb-4 text-slate-300 font-medium">
              We maintain a strictly enforced <span className="font-bold text-white">Zero-Tolerance Policy</span> against all forms of illegal activities. 
            </p>
            <ul className="list-disc pl-5 space-y-2 font-medium text-slate-400">
              <li>Using our numbers for phishing, scamming, blackmailing, or financial fraud is absolutely prohibited.</li>
              <li>Impersonating individuals or government entities will result in an immediate permanent network ban.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-[#111827] border border-slate-800/80 p-6 md:p-8 rounded-xl shadow-lg hover:border-slate-700 transition-colors duration-300">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3 tracking-wide">
              <span className="text-cyan-400 font-black text-xl">03.</span> Limitation of Liability (Disclaimer)
            </h2>
            <p className="mb-4 text-slate-400 font-medium">
              By using our service, you acknowledge that ZENEX NETWORK operates merely as an API/Routing infrastructure. 
            </p>
            <p className="font-semibold text-slate-300">
              We do not track, endorse, or take responsibility for how users utilize the generated numbers. Under no circumstances shall ZENEX NETWORK be held liable for any damages, losses, or legal disputes arising from the misuse of our platform by independent users.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-[#111827] border border-slate-800/80 p-6 md:p-8 rounded-xl shadow-lg hover:border-slate-700 transition-colors duration-300">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3 tracking-wide">
              <span className="text-cyan-400 font-black text-xl">04.</span> Account & Earnings Policy
            </h2>
            <ul className="list-disc pl-5 space-y-3 text-slate-400 font-medium">
              <li><strong className="text-slate-200">Free Platform:</strong> ZENEX is a 100% free-to-use platform. Users earn money exclusively by successfully processing valid OTPs. We never ask for deposits.</li>
              <li><strong className="text-slate-200">Security:</strong> API Keys and Passwords must be kept confidential. We are not responsible for unauthorized usage of your account due to leaked credentials.</li>
              <li><strong className="text-slate-200">Fund Confiscation:</strong> Management reserves the absolute right to suspend or terminate any account and confiscate all earned balances without prior explanation if fraudulent activities or network rules violations are detected.</li>
            </ul>
          </section>

        </div>
      </main>

      <div className="w-full mt-auto relative z-10 bg-[#0B0F1A]">
        <div className="text-center pt-8 pb-6 border-t border-slate-800/50">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <GlobalFooter />
      </div>
    </div>
  );
}