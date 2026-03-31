"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [lang, setLang] = useState("EN");
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  const [formData, setFormData] = useState({
    fullName: "", mobile: "", telegram: "", email: "", 
    country: "BD", agentEmail: "", password: "", captcha: ""
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
  }, []);

  useEffect(() => {
    let filled = 0;
    const totalFields = 7; 
    if (formData.fullName.trim().length >= 3) filled++;
    if (formData.mobile.trim().length >= 10) filled++;
    if (formData.telegram.trim().length >= 3 && !/\s/.test(formData.telegram)) filled++;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) filled++;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.agentEmail)) filled++;
    if (formData.password.length >= 6) filled++;
    if (parseInt(formData.captcha) === (num1 + num2)) filled++;
    setProgress(Math.round((filled / totalFields) * 100));
  }, [formData, num1, num2]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (progress < 100) {
      showToast(lang === "EN" ? "Please fill all fields correctly!" : "সব তথ্য সঠিকভাবে পূরণ করুন!", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(lang === "EN" ? "Account Created Successfully!" : "সফলভাবে একাউন্ট তৈরি হয়েছে!", "success");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        showToast(data.message, "error");
      }
    } catch (error) {
      showToast(lang === "EN" ? "Network Error! Please try again." : "সার্ভার এরর! আবার চেষ্টা করুন।", "error");
    } finally {
      setLoading(false);
    }
  };

  // ১০০% বাংলা এবং ইংরেজির ডিকশনারি
  const t = {
    title: lang === "EN" ? "Create your account" : "নতুন একাউন্ট তৈরি করুন",
    fullName: lang === "EN" ? "Full Name" : "পুরো নাম",
    mobile: lang === "EN" ? "Mobile Number" : "মোবাইল নাম্বার",
    email: lang === "EN" ? "Email Address" : "ইমেইল এড্রেস",
    telegram: lang === "EN" ? "Telegram Username" : "টেলিগ্রাম ইউজারনেম",
    country: lang === "EN" ? "Country" : "দেশ নির্বাচন করুন",
    agentEmail: lang === "EN" ? "Agent Referral Email" : "এজেন্ট রেফারেল ইমেইল",
    password: lang === "EN" ? "Create Password" : "পাসওয়ার্ড তৈরি করুন",
    robot: lang === "EN" ? "Robot Check" : "রোবট চেক",
    result: lang === "EN" ? "Result" : "ফলাফল",
    btn: lang === "EN" ? "Create Account" : "একাউন্ট তৈরি করুন",
    loadingBtn: lang === "EN" ? "Creating Account..." : "একাউন্ট তৈরি হচ্ছে...",
    already: lang === "EN" ? "Already have an account?" : "আগে থেকেই একাউন্ট আছে?",
    login: lang === "EN" ? "Login here" : "লগিন করুন",
    prof: lang === "EN" ? "Profile Completion" : "প্রোফাইল কমপ্লিশন"
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center p-4 text-slate-200 font-sans relative overflow-hidden">
      
      {/* Toast Notification */}
      <div className={`fixed top-5 right-5 z-50 transform transition-all duration-500 ease-out ${toast.show ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0 pointer-events-none"}`}>
        <div className={`px-6 py-3 rounded-lg shadow-2xl border backdrop-blur-md flex items-center space-x-3 ${toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${toast.type === 'success' ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-lg bg-[#111827]/80 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-2xl relative z-10">
        
        <div className="text-center mb-6">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-4">
            <button type="button" onClick={() => setLang(lang === "EN" ? "BN" : "EN")} className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-md border border-slate-600 transition">
              {lang === "EN" ? "Switch to বাংলা" : "Switch to English"}
            </button>
            <span>V3.0.1</span>
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
              <input type="text" name="fullName" onChange={handleChange} placeholder="John Doe" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition" required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.mobile}</label>
              <input type="tel" name="mobile" onChange={handleChange} placeholder="017xxxxxxxx" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.email}</label>
              <input type="email" name="email" onChange={handleChange} placeholder="name@example.com" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition" required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.telegram}</label>
              <input type="text" name="telegram" onChange={handleChange} placeholder="@username" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition" required />
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
                <option value="VN">Vietnam</option>
                <option value="RU">Russia</option>
                <option value="BR">Brazil</option>
                <option value="PH">Philippines</option>
                <option value="NG">Nigeria</option>
                <option value="US">USA</option>
                <option value="UK">UK</option>
                <option value="MY">Malaysia</option>
                <option value="TH">Thailand</option>
                <option value="EG">Egypt</option>
                <option value="ZA">South Africa</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-cyan-400 mb-1">{t.agentEmail}</label>
              <input type="email" name="agentEmail" onChange={handleChange} placeholder="agent@zenexnetwork.com" className="w-full bg-[#0F172A] border border-cyan-500/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.1)] transition" required />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">{t.password}</label>
            <input type="password" name="password" onChange={handleChange} placeholder="********" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition" required />
          </div>

          <div className="bg-[#0F172A] border border-slate-700 rounded-lg p-3 flex items-center justify-between mt-2">
            <span className="text-sm text-slate-300">{t.robot}: <strong className="text-cyan-400">{num1} + {num2} = ?</strong></span>
            <input type="number" name="captcha" onChange={handleChange} placeholder={t.result} className="w-20 bg-[#0B0F1A] border border-slate-600 rounded px-2 py-1.5 text-center text-sm focus:outline-none focus:border-cyan-400" required />
          </div>

          <button type="submit" disabled={loading} className={`w-full text-white font-medium py-3 rounded-lg shadow-lg transition-all mt-4 ${loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]'}`}>
            {loading ? t.loadingBtn : t.btn}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          {t.already} <Link href="/login" className="text-cyan-400 hover:underline">{t.login}</Link>
        </p>
      </div>
    </div>
  );
}