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

  useEffect(() => {
    const verifySession = async () => {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const res = await fetch("/api/check-session", { method: "GET" });
          if (res.ok) router.push("/");
          else localStorage.removeItem("user");
        } catch (e) {
          localStorage.removeItem("user");
        }
      }
    };
    verifySession();
  }, [router]);

  useEffect(() => {
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
  }, []);

  useEffect(() => {
    let filled = 0;
    const totalFields = 8; 
    if (formData.fullName.trim().length >= 3) filled++;
    if (formData.mobile.trim().length >= 10) filled++;
    if (formData.telegram.trim().length >= 3) filled++;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) filled++;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.agentEmail.trim())) filled++;
    if (formData.password.length >= 6) filled++;
    if (formData.withdrawPin.trim().length === 4) filled++;
    if (parseInt(formData.captcha) === (num1 + num2)) filled++;
    setProgress(Math.round((filled / totalFields) * 100));
  }, [formData, num1, num2]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "withdrawPin") {
      setFormData({ ...formData, [name]: value.replace(/\D/g, '').slice(0, 4) });
    } else if (name === "email" || name === "agentEmail" || name === "telegram" || name === "mobile") {
      setFormData({ ...formData, [name]: value.replace(/\s/g, "") });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (progress < 100) {
      showToast(lang === "EN" ? "Please fill all fields correctly!" : "সব তথ্য সঠিকভাবে পূরণ করুন!", "error");
      return;
    }
    
    const cleanData = {
      ...formData,
      fullName: formData.fullName.trim(),
      mobile: formData.mobile.replace(/[^0-9+]/g, ''),
      telegram: formData.telegram.replace(/\s/g, '').replace('@', ''),
      email: formData.email.replace(/\s/g, '').toLowerCase(),
      agentEmail: formData.agentEmail.replace(/\s/g, '').toLowerCase(),
      withdrawPin: formData.withdrawPin.trim()
    };

    if (cleanData.withdrawPin.length !== 4) {
      showToast(lang === "EN" ? "PIN must be exactly 4 digits!" : "পিন অবশ্যই ৪ ডিজিটের হতে হবে!", "error");
      return;
    }

    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error("Invalid Server Response");
      }

      if (res.ok) {
        showToast(lang === "EN" ? "Account Created Successfully!" : "সফলভাবে একাউন্ট তৈরি হয়েছে!", "success");
        setTimeout(() => window.location.href = "/login", 2000);
      } else {
        showToast(data.message || (lang === "EN" ? "Registration Failed!" : "একাউন্ট তৈরি ব্যর্থ হয়েছে!"), "error");
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        showToast(lang === "EN" ? "Server Timeout! Network is slow or database is busy." : "সার্ভার টাইমআউট! আপনার নেটওয়ার্ক স্লো অথবা সার্ভার বিজি।", "error");
      } else {
        showToast(lang === "EN" ? "Network/Server Error! Please try again." : "নেটওয়ার্ক/সার্ভার এরর! আবার চেষ্টা করুন।", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const t = {
    title: lang === "EN" ? "Create your account" : "নতুন একাউন্ট তৈরি করুন",
    fullName: lang === "EN" ? "Full Name" : "পুরো নাম",
    mobile: lang === "EN" ? "Mobile Number" : "মোবাইল নাম্বার",
    email: lang === "EN" ? "Email Address" : "ইমেইল এড্রেস",
    telegram: lang === "EN" ? "Telegram Username" : "টেলিগ্রাম ইউজারনেম",
    country: lang === "EN" ? "Country" : "দেশ নির্বাচন করুন",
    agentEmail: lang === "EN" ? "Agent Referral Email" : "এজেন্ট রেফারেল ইমেইল",
    password: lang === "EN" ? "Create Password" : "পাসওয়ার্ড তৈরি করুন",
    pin: lang === "EN" ? "Withdraw PIN (4-Digit)" : "উইথড্র পিন (৪-ডিজিট)",
    robot: lang === "EN" ? "Robot Check" : "রোবট চেক",
    result: lang === "EN" ? "Result" : "ফলাফল",
    btn: lang === "EN" ? "Create Account" : "একাউন্ট তৈরি করুন",
    loadingBtn: lang === "EN" ? "Creating Account..." : "একাউন্ট তৈরি হচ্ছে...",
    already: lang === "EN" ? "Already have an account?" : "আগে থেকেই একাউন্ট আছে?",
    login: lang === "EN" ? "Login here" : "লগিন করুন",
    prof: lang === "EN" ? "Profile Completion" : "প্রোফাইল কমপ্লিশন",
    termsText1: lang === "EN" ? "I have read and agree to the " : "আমি পড়েছি এবং একমত পোষণ করছি ",
    termsLink: lang === "EN" ? "Terms & Conditions" : "শর্তাবলীর সাথে"
  };

  return (
    <div className="bg-[#0B0F1A] text-slate-200 font-sans relative overflow-x-hidden">
      
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-sm transform transition-all duration-500 ease-out ${toast.show ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0 pointer-events-none"}`}>
        <div className={`px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md flex items-center space-x-3 ${toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${toast.type === 'success' ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <p className="text-sm font-medium leading-snug">{toast.message}</p>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 my-4 md:my-0">
        <div className="w-full max-w-lg bg-[#111827]/80 backdrop-blur-xl border border-slate-700/50 p-6 md:p-8 rounded-2xl shadow-2xl">
          
          <div className="text-center mb-6">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-4">
              <button type="button" onClick={() => setLang(lang === "EN" ? "BN" : "EN")} className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-md border border-slate-600 transition">
                {lang === "EN" ? "Switch to বাংলা" : "Switch to English"}
              </button>
              <span>v4.0.1 (Secured)</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent uppercase tracking-wider">
              Zenex Network
            </h1>
            <p className="text-sm text-slate-400 mt-1">{t.title}</p>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{t.prof}</span>
              <span className={progress === 100 ? "text-green-400 font-bold" : "text-cyan-400 font-semibold"}>{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ease-out ${progress === 100 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-gradient-to-r from-cyan-400 to-blue-500"}`} style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.fullName}</label>
                <input type="text" name="fullName" onChange={handleChange} placeholder="John Doe" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition text-white" required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.mobile}</label>
                <input type="tel" name="mobile" onChange={handleChange} placeholder="017xxxxxxxx" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition text-white" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.email}</label>
                <input type="email" name="email" onChange={handleChange} placeholder="name@example.com" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition text-white" required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.telegram}</label>
                <input type="text" name="telegram" onChange={handleChange} placeholder="@username" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition text-white" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.country}</label>
                <select name="country" onChange={handleChange} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition text-slate-300">
                  <option value="BD">Bangladesh</option>
                  <option value="IN">India</option>
                  <option value="PK">Pakistan</option>
                  <option value="ID">Indonesia</option>
                  <option value="US">USA</option>
                  <option value="UK">UK</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-cyan-400 mb-1">{t.agentEmail}</label>
                <input type="email" name="agentEmail" onChange={handleChange} placeholder="agent@email.com" className="w-full bg-[#0F172A] border border-cyan-500/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.1)] transition text-white" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.password}</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password" 
                    onChange={handleChange} 
                    placeholder="********" 
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition text-white" 
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    )}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-[#A855F7] font-bold mb-1">{t.pin}</label>
                <div className="relative">
                  <input 
                    type={showPin ? "text" : "password"} 
                    name="withdrawPin" 
                    value={formData.withdrawPin} 
                    onChange={handleChange} 
                    placeholder="****" 
                    maxLength={4}
                    className="w-full bg-[#0F172A] border border-[#A855F7]/50 rounded-lg pl-4 pr-10 py-2.5 text-sm text-center tracking-[0.5em] font-black focus:outline-none focus:border-[#A855F7] shadow-[0_0_8px_rgba(168,85,247,0.15)] transition text-white" 
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPin(!showPin)} 
                    className="absolute inset-y-0 right-3 flex items-center text-[#A855F7] hover:text-[#D8B4FE] transition-colors"
                  >
                    {showPin ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#0F172A] border border-slate-700 rounded-lg p-3 flex items-center justify-between mt-2">
              <span className="text-sm text-slate-300">{t.robot}: <strong className="text-cyan-400">{num1} + {num2} = ?</strong></span>
              <input type="number" name="captcha" onChange={handleChange} placeholder={t.result} className="w-20 bg-[#0B0F1A] border border-slate-600 rounded px-2 py-1.5 text-center text-sm focus:outline-none focus:border-cyan-400 text-white" required />
            </div>

            {/* 💥 Clean Legal Checkbox 💥 */}
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" required className="w-4 h-4 accent-cyan-500 bg-[#0F172A] border-slate-600 rounded cursor-pointer shrink-0" />
              <p className="text-xs text-slate-400">
                {t.termsText1} 
                <Link href="/terms" target="_blank" className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors ml-1">
                  {t.termsLink}
                </Link>.
              </p>
            </div>

            <button type="submit" disabled={loading} className={`w-full text-white font-medium py-3 rounded-lg shadow-lg transition-all mt-4 ${loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]'}`}>
              {loading ? t.loadingBtn : t.btn}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6 pt-6 border-t border-slate-700/50">
            {t.already} <Link href="/login" className="text-cyan-400 hover:underline">{t.login}</Link>
          </p>
        </div>
      </div>

      <div className="w-full relative z-10 bg-[#0B0F1A]">
        <GlobalFooter />
      </div>
    </div>
  );
}