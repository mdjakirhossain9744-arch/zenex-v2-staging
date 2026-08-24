"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GlobalFooter from "../components/GlobalFooter";

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState("EN");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ emailOrPhone: "", password: "" });
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
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === "emailOrPhone" ? value.replace(/\s/g, "") : value });
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.emailOrPhone || !formData.password) {
      showToast(lang === "EN" ? "Please fill all fields!" : "সব তথ্য পূরণ করুন!", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, emailOrPhone: formData.emailOrPhone.toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));
        showToast(lang === "EN" ? "Login Successful!" : "লগিন সফল হয়েছে!", "success");
        setTimeout(() => window.location.href = "/", 1500);
      } else {
        showToast(data.message || (lang === "EN" ? "Login Failed!" : "লগিন ব্যর্থ হয়েছে!"), "error");
      }
    } catch (error) {
      showToast(lang === "EN" ? "Network Error! Please try again." : "নেটওয়ার্ক এরর!", "error");
    } finally {
      setLoading(false);
    }
  };

  const t = {
    title: lang === "EN" ? "Secure Dashboard Access" : "নিরাপদ ড্যাশবোর্ড অ্যাক্সেস",
    email: lang === "EN" ? "Phone or Email" : "ফোন বা ইমেইল",
    pass: lang === "EN" ? "Password" : "পাসওয়ার্ড",
    forgot: lang === "EN" ? "Forgot Password?" : "পাসওয়ার্ড ভুলে গেছেন?",
    btn: lang === "EN" ? "Login to System" : "সিস্টেমে লগিন করুন",
    loadingBtn: lang === "EN" ? "Authenticating..." : "লগিন হচ্ছে...",
    noAccount: lang === "EN" ? "Don't have an account?" : "একাউন্ট নেই?",
    register: lang === "EN" ? "Register here" : "রেজিস্টার করুন",
    modalTitle: lang === "EN" ? "Account Recovery" : "একাউন্ট রিকভারি",
    modalDesc: lang === "EN" ? "To reset your withdrawal PIN or change your account password, please contact the agent (agent@zenexnetwork.com) whose referral email you used to register." : "আপনার পিন বা পাসওয়ার্ড পরিবর্তন করতে, অনুগ্রহ করে সেই এজেন্টের (agent@zenexnetwork.com) সাথে যোগাযোগ করুন যার রেফারেল আপনি ব্যবহার করেছেন।",
    termsText: lang === "EN" ? "By continuing, you agree to our" : "লগিন করার মাধ্যমে আপনি আমাদের",
    termsLink: lang === "EN" ? "Terms & Conditions" : "শর্তাবলী মেনে নিচ্ছেন"
  };

  if (!isMounted) return null;

  return (
    <div suppressHydrationWarning className="bg-[#0B0F1A] text-slate-200 font-sans relative overflow-x-hidden selection:bg-cyan-500/30">
      
      {/* Toast Notification */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-sm transition-all duration-300 ${toast.show ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0 pointer-events-none"}`}>
        <div className={`px-4 py-3 rounded-lg shadow-2xl border flex items-center space-x-3 ${toast.type === 'success' ? 'bg-[#064e3b] border-emerald-500/50 text-emerald-300' : 'bg-[#7f1d1d] border-red-500/50 text-red-300'}`}>
          <div className={`w-2 h-2 rounded-full shrink-0 ${toast.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
          <p className="text-sm font-medium tracking-wide">{toast.message}</p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F1A]/80 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-slate-700 p-6 md:p-8 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-w-sm w-full relative">
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
                <h3 className="text-lg font-bold text-white tracking-wide">{t.modalTitle}</h3>
              </div>
              <button type="button" onClick={() => setLang(lang === "EN" ? "BN" : "EN")} className="bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 transition text-[10px] uppercase font-bold text-slate-300">
                {lang === "EN" ? "বাংলা" : "ENG"}
              </button>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">{t.modalDesc}</p>
            <button onClick={() => setShowForgotModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg border border-slate-600 transition-colors uppercase tracking-wider text-xs shadow-md">
              {lang === "EN" ? "Close" : "বন্ধ করুন"}
            </button>
          </div>
        </div>
      )}

      {/* Main Login Area - Set to min-h-screen so footer is pushed down */}
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 py-10">
        {/* max-w-md brings back the wider/flatter look on PC */}
        <div className="w-full max-w-md bg-[#111827] border border-slate-700/60 p-6 md:p-9 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
          
          <div className="text-center mb-8 relative">
            <div className="absolute -top-2 right-0">
               <button type="button" onClick={() => setLang(lang === "EN" ? "BN" : "EN")} className="bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1 rounded border border-slate-700 transition text-[10px] uppercase font-bold text-slate-300">
                {lang === "EN" ? "বাংলা" : "ENG"}
              </button>
            </div>
            
            <div className="inline-flex items-center justify-center mb-4">
              <span className="bg-cyan-500/10 text-cyan-400 px-2.5 py-0.5 rounded border border-cyan-500/20 text-[10px] uppercase font-bold tracking-widest">
                V2.0
              </span>
            </div>
            
            <h1 className="text-2xl md:text-[28px] font-extrabold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent tracking-[0.1em] uppercase">
              ZENEX NETWORK
            </h1>
            <p className="text-[12px] text-slate-400 mt-2 font-medium">{t.title}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1 tracking-wide">{t.email}</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <input type="text" name="emailOrPhone" onChange={handleChange} placeholder="name@zenex.com" className="w-full bg-[#0F172A] border border-slate-700 rounded-xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all text-white placeholder-slate-600" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-semibold text-slate-400 tracking-wide">{t.pass}</label>
                <button type="button" onClick={() => setShowForgotModal(true)} className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
                  {t.forgot}
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input type={showPassword ? "text" : "password"} name="password" onChange={handleChange} placeholder="••••••••" className="w-full bg-[#0F172A] border border-slate-700 rounded-xl pl-10 pr-10 py-3.5 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all text-white tracking-widest placeholder-slate-600 placeholder:tracking-normal" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-cyan-400 transition-colors">
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className={`w-full text-white font-semibold py-3.5 rounded-xl transition-all duration-300 mt-6 shadow-lg ${loading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 hover:shadow-cyan-500/25'}`}>
              <span className="text-[13px] uppercase tracking-wider flex justify-center items-center">
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : null}
                {loading ? t.loadingBtn : t.btn}
              </span>
            </button>
          </form>

          <div className="mt-8 text-center pt-5 border-t border-slate-700/50">
            <p className="text-[12px] font-medium text-slate-400">
              {t.noAccount} <Link href="/register" className="text-cyan-400 hover:text-cyan-300 hover:underline ml-1 transition-colors">{t.register}</Link>
            </p>
            
            <div className="mt-3 flex flex-wrap justify-center items-center gap-1 text-[11px] text-slate-500 font-medium">
              <span>{t.termsText}</span>
              <Link href="/terms" target="_blank" className="text-cyan-500 hover:text-cyan-400 underline decoration-cyan-500/30 underline-offset-2 transition-colors">
                {t.termsLink}
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Footer is now below the fold and requires scroll */}
      <div className="w-full relative z-10 bg-[#0B0F1A] border-t border-slate-800">
        <GlobalFooter />
      </div>
    </div>
  );
}