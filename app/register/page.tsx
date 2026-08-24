"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GlobalFooter from "../components/GlobalFooter";

export default function RegisterPage() {
  const router = useRouter();
  const [lang, setLang] = useState("EN");
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: "", mobile: "", telegram: "", email: "", 
    country: "BD", agentEmail: "", password: "", withdrawPin: "", captcha: ""
  });
  const [progress, setProgress] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const userStr = localStorage.getItem("user");
    if (userStr) {
      fetch("/api/check-session", { method: "GET" })
        .then(res => {
          if (res.ok) router.push("/");
          else localStorage.removeItem("user");
        })
        .catch(() => localStorage.removeItem("user"));
    }
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
  }, [router]);

  useEffect(() => {
    let filled = 0;
    if (formData.fullName.trim().length >= 3) filled++;
    if (formData.mobile.trim().length >= 10) filled++;
    if (formData.telegram.trim().length >= 3) filled++;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) filled++;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.agentEmail.trim())) filled++;
    if (formData.password.length >= 6) filled++;
    if (formData.withdrawPin.trim().length === 4) filled++;
    if (parseInt(formData.captcha) === (num1 + num2)) filled++;
    setProgress(Math.round((filled / 8) * 100));
  }, [formData, num1, num2]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "withdrawPin") setFormData({ ...formData, [name]: value.replace(/\D/g, '').slice(0, 4) });
    else if (["email", "agentEmail", "telegram", "mobile"].includes(name)) setFormData({ ...formData, [name]: value.replace(/\s/g, "") });
    else setFormData({ ...formData, [name]: value });
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (progress < 100) return showToast(lang === "EN" ? "Please fill all fields!" : "সব তথ্য পূরণ করুন!", "error");
    
    setLoading(true);
    try {
      const cleanData = {
        ...formData,
        fullName: formData.fullName.trim(),
        mobile: formData.mobile.replace(/[^0-9+]/g, ''),
        telegram: formData.telegram.replace(/\s/g, '').replace('@', ''),
        email: formData.email.toLowerCase(),
        agentEmail: formData.agentEmail.toLowerCase(),
      };

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(lang === "EN" ? "Account Created!" : "একাউন্ট তৈরি হয়েছে!", "success");
        setTimeout(() => window.location.href = "/login", 1500);
      } else {
        showToast(data.message || "Failed!", "error");
      }
    } catch {
      showToast(lang === "EN" ? "Network Error!" : "নেটওয়ার্ক এরর!", "error");
    } finally {
      setLoading(false);
    }
  };

  const t = {
    title: lang === "EN" ? "Create an Account" : "নতুন একাউন্ট তৈরি করুন",
    subtitle: lang === "EN" ? "Secure Network Access" : "গ্লোবাল নেটওয়ার্ক অ্যাক্সেস",
    section1: lang === "EN" ? "Personal Details" : "ব্যক্তিগত তথ্যাবলী",
    section2: lang === "EN" ? "Security Settings" : "নিরাপত্তা ও সেটিংস",
    fullName: lang === "EN" ? "Full Name" : "পুরো নাম",
    mobile: lang === "EN" ? "Mobile Number" : "মোবাইল নাম্বার",
    email: lang === "EN" ? "Email Address" : "ইমেইল এড্রেস",
    telegram: lang === "EN" ? "Telegram ID" : "টেলিগ্রাম আইডি",
    country: lang === "EN" ? "Country" : "দেশ",
    agentEmail: lang === "EN" ? "Agent Email" : "এজেন্ট ইমেইল",
    password: lang === "EN" ? "Password" : "পাসওয়ার্ড",
    pin: lang === "EN" ? "Withdraw PIN (4-Digit)" : "উইথড্র পিন (৪-ডিজিট)",
    robot: lang === "EN" ? "Verify Human" : "রোবট চেক",
    btn: lang === "EN" ? "Register Account" : "একাউন্ট তৈরি করুন",
    loadingBtn: lang === "EN" ? "Processing..." : "তৈরি হচ্ছে...",
    already: lang === "EN" ? "Already a member?" : "আগে থেকেই একাউন্ট আছে?",
    login: lang === "EN" ? "Sign In" : "লগিন করুন",
    prof: lang === "EN" ? "Setup Progress" : "প্রোফাইল প্রোগ্রেস",
    termsText1: lang === "EN" ? "I agree to the " : "আমি একমত পোষণ করছি ",
    termsLink: lang === "EN" ? "Terms & Conditions" : "শর্তাবলীর সাথে",
    
    heroTitle1: lang === "EN" ? "Experience the Power of" : "ভবিষ্যতের টেকনোলজির",
    heroTitle2: lang === "EN" ? "Global Networking" : "অভিজ্ঞতা নিন",
    heroDesc: lang === "EN" ? "Join our highly secure and optimized platform. Leverage advanced routing infrastructure and automated systems designed for scale." : "আমাদের অত্যন্ত সুরক্ষিত এবং অপ্টিমাইজড প্ল্যাটফর্মে যোগ দিন। অ্যাডভান্সড রাউটিং এবং অটোমেটেড সিস্টেমের সুবিধা নিন।",
    feat1Title: lang === "EN" ? "Advanced Architecture" : "অ্যাডভান্সড আর্কিটেকচার",
    feat1Desc: lang === "EN" ? "Ultra-fast processing powered by highly optimized microservices." : "মাইক্রোসার্ভিস দ্বারা পরিচালিত সুপার-ফাস্ট ডেটা প্রসেসিং।",
    feat2Title: lang === "EN" ? "Secure Connectivity" : "সিকিউর কানেক্টিভিটি",
    feat2Desc: lang === "EN" ? "Direct and encrypted tunneling ensuring maximum reliability." : "সর্বোচ্চ নিরাপত্তা নিশ্চিত করতে সরাসরি এবং এনক্রিপ্টেড টানেলিং।",
    feat3Title: lang === "EN" ? "Automated Payouts" : "অটোমেটেড পেআউট",
    feat3Desc: lang === "EN" ? "Instant cryptocurrency settlements directly to your wallet." : "সরাসরি আপনার ওয়ালেটে ইনস্ট্যান্ট ক্রিপ্টো সেটেলমেন্ট।"
  };

  if (!isMounted) return null;

  return (
    <div suppressHydrationWarning className="bg-[#0B0F1A] text-slate-200 font-sans relative overflow-x-hidden min-h-screen flex flex-col">
      
      {/* Toast */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-sm transition-all duration-300 ${toast.show ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0 pointer-events-none"}`}>
        <div className={`px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md flex items-center space-x-3 ${toast.type === 'success' ? 'bg-[#064e3b]/90 border-emerald-500/50 text-emerald-400' : 'bg-[#7f1d1d]/90 border-red-500/50 text-red-400'}`}>
          <p className="text-sm font-bold tracking-wide">{toast.message}</p>
        </div>
      </div>

      {/* Ambient Backgrounds */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-teal-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="flex-grow w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-center p-4 lg:p-8 gap-8 lg:gap-16 relative z-10 py-8 md:py-12">
        
        {/* 🔥 PC PREMIUM LEFT SECTION 🔥 */}
        <div className="hidden lg:flex flex-col w-full max-w-[500px]">
          
          <div className="mb-10">
            {/* Glowing V2 Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
              <span className="text-cyan-400 text-[10px] font-black uppercase tracking-widest">ZENEX NETWORK V2.0</span>
            </div>
            
            {/* Stunning Typography */}
            <h1 className="text-[2.75rem] leading-[1.15] font-black text-white mb-6 tracking-tight">
              {t.heroTitle1} <br/>
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400 bg-clip-text text-transparent drop-shadow-sm">
                {t.heroTitle2}
              </span>
            </h1>
            <p className="text-slate-400 text-[15px] leading-relaxed mb-10 font-medium max-w-md">
              {t.heroDesc}
            </p>
          </div>
          
          {/* Professional SVGs and Features */}
          <div className="space-y-7">
            <div className="flex items-start gap-5">
              <div className="mt-0.5 w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-inner">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              <div>
                <h3 className="text-slate-200 font-bold text-[13px] uppercase tracking-wider mb-1.5">{t.feat1Title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">{t.feat1Desc}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-5">
              <div className="mt-0.5 w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 shadow-inner">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <h3 className="text-slate-200 font-bold text-[13px] uppercase tracking-wider mb-1.5">{t.feat2Title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">{t.feat2Desc}</p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="mt-0.5 w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0 shadow-inner">
                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
              </div>
              <div>
                <h3 className="text-slate-200 font-bold text-[13px] uppercase tracking-wider mb-1.5">{t.feat3Title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">{t.feat3Desc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 🔥 MOBILE OPTIMIZED FORM SECTION 🔥 */}
        <div className="w-full max-w-[500px] bg-[#111827]/70 backdrop-blur-2xl border border-slate-700/60 p-5 md:p-8 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.4)] relative">
          
          {/* Mobile Only Header with Stunning Branding */}
          <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-5 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_15px_rgba(8,145,178,0.4)]">
                <span className="text-white font-black text-sm">ZX</span>
              </div>
              <div>
                <h1 className="text-lg font-black text-white tracking-widest uppercase">
                  ZENEX <span className="text-cyan-400">V2.0</span>
                </h1>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{t.subtitle}</p>
              </div>
            </div>
            <button type="button" onClick={() => setLang(lang === "EN" ? "BN" : "EN")} className="bg-slate-800/80 hover:bg-slate-700 px-2 py-1.5 rounded border border-slate-600/50 transition text-[9px] uppercase font-bold text-slate-300">
              {lang === "EN" ? "বাংলা" : "ENG"}
            </button>
          </div>
          
          {/* PC Only Language Switch */}
          <div className="hidden lg:flex justify-end mb-5 relative z-20">
            <button type="button" onClick={() => setLang(lang === "EN" ? "BN" : "EN")} className="bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-600/50 transition text-[11px] uppercase font-bold text-slate-300 tracking-wider">
              {lang === "EN" ? "Switch to বাংলা" : "Switch to ENG"}
            </button>
          </div>

          <div className="mb-6 relative z-10">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
              <span className="text-slate-400">{t.prof}</span>
              <span className={progress === 100 ? "text-emerald-400 drop-shadow-[0_0_5px_#34d399]" : "text-cyan-400"}>{progress}%</span>
            </div>
            <div className="w-full bg-[#0F172A] h-2 rounded-full overflow-hidden border border-slate-800 shadow-inner">
              <div className={`h-full transition-all duration-700 ease-out ${progress === 100 ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" : "bg-gradient-to-r from-blue-500 to-cyan-400"}`} style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            
            <div className="bg-[#0F172A]/50 border border-slate-700/50 rounded-xl p-4 md:p-5 relative overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-blue-500/60 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.fullName}</label>
                  <input type="text" name="fullName" onChange={handleChange} placeholder="John Doe" className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-all text-white" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.email}</label>
                  <input type="email" name="email" onChange={handleChange} placeholder="name@example.com" className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-all text-white" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.mobile}</label>
                  <input type="tel" name="mobile" onChange={handleChange} placeholder="+8801..." className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-all text-white" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.telegram}</label>
                  <input type="text" name="telegram" onChange={handleChange} placeholder="@username" className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-all text-white" required />
                </div>
              </div>
            </div>

            <div className="bg-[#0F172A]/50 border border-slate-700/50 rounded-xl p-4 md:p-5 relative overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.country}</label>
                  <select name="country" onChange={handleChange} className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-all text-slate-300">
                    <option value="BD">Bangladesh</option>
                    <option value="IN">India</option>
                    <option value="PK">Pakistan</option>
                    <option value="US">USA</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest ml-1">{t.agentEmail}</label>
                  <input type="email" name="agentEmail" onChange={handleChange} placeholder="agent@zenexnetwork.com" className="w-full bg-[#111827] border border-cyan-500/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition-all text-white shadow-[0_0_10px_rgba(34,211,238,0.1)]" required />
                </div>
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.password}</label>
                  <input type={showPassword ? "text" : "password"} name="password" onChange={handleChange} placeholder="••••••••" className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-all text-white" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2 right-3 text-slate-500 hover:text-cyan-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
                </div>
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest ml-1">{t.pin}</label>
                  <input type={showPin ? "text" : "password"} name="withdrawPin" value={formData.withdrawPin} onChange={handleChange} placeholder="••••" maxLength={4} className="w-full bg-[#111827] border border-purple-500/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 transition-all text-white text-center tracking-[0.3em] font-black" required />
                  <button type="button" onClick={() => setShowPin(!showPin)} className="absolute bottom-2 right-3 text-slate-500 hover:text-purple-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#111827] border border-slate-700 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">Human: <span className="text-cyan-400 ml-1">{num1} + {num2} = </span></span>
              <input type="number" name="captcha" onChange={handleChange} className="w-14 bg-[#0F172A] border border-slate-600 rounded-lg px-2 py-1.5 text-center text-sm font-bold focus:outline-none focus:border-cyan-500 text-white" required />
            </div>

            <button type="submit" disabled={loading} className={`w-full text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(8,145,178,0.2)] ${loading ? 'bg-slate-700' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500'}`}>
              <span className="uppercase tracking-widest text-[13px]">{loading ? t.loadingBtn : t.btn}</span>
            </button>
          </form>

          <div className="mt-6 text-center space-y-2 relative z-10">
            <p className="text-[11px] font-medium text-slate-400">
              {t.already} <Link href="/login" className="text-cyan-400 font-bold hover:underline ml-1">{t.login}</Link>
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
              {t.termsText1} <Link href="/terms" target="_blank" className="text-slate-300 font-bold hover:text-white underline ml-1">{t.termsLink}</Link>
            </p>
          </div>

        </div>
      </div>

      <div className="w-full relative z-10 bg-[#0B0F1A]">
        <GlobalFooter />
      </div>
    </div>
  );
}