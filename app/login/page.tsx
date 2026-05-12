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

  const [formData, setFormData] = useState({ emailOrPhone: "", password: "" });

  // 💥 Loop Protection 💥
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // লগিন করার সময়ও ইমেইল/ফোনে কোনো স্পেস থাকলে তা কেটে দেবে
    if (name === "emailOrPhone") {
      setFormData({ ...formData, [name]: value.replace(/\s/g, "") });
    } else {
      setFormData({ ...formData, [name]: value });
    }
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
        body: JSON.stringify({
          ...formData,
          emailOrPhone: formData.emailOrPhone.toLowerCase()
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));
        showToast(lang === "EN" ? "Login Successful!" : "লগিন সফল হয়েছে!", "success");
        setTimeout(() => {
          window.location.href = "/"; 
        }, 1500);
      } else {
        // ডাটাবেস থেকে আসা মেসেজ যদি থাকে, না হলে ডিফল্ট ট্রান্সলেশন মেসেজ
        showToast(data.message || (lang === "EN" ? "Login Failed!" : "লগিন ব্যর্থ হয়েছে!"), "error");
      }
    } catch (error) {
      showToast(lang === "EN" ? "Network Error! Please try again." : "নেটওয়ার্ক এরর! আবার চেষ্টা করুন।", "error");
    } finally {
      setLoading(false);
    }
  };

  const t = {
    title: lang === "EN" ? "Welcome back, Agent/User" : "স্বাগতম, এজেন্ট/ইউজার",
    email: lang === "EN" ? "Phone or Email" : "ফোন বা ইমেইল",
    pass: lang === "EN" ? "Password" : "পাসওয়ার্ড",
    forgot: lang === "EN" ? "Forgot Password?" : "পাসওয়ার্ড ভুলে গেছেন?",
    btn: lang === "EN" ? "Login to Dashboard" : "ড্যাশবোর্ডে লগিন করুন",
    loadingBtn: lang === "EN" ? "Logging in..." : "লগিন হচ্ছে...",
    noAccount: lang === "EN" ? "Don't have an account?" : "একাউন্ট নেই?",
    register: lang === "EN" ? "Register here" : "রেজিস্টার করুন",
    modalTitle: lang === "EN" ? "Reset Password or PIN" : "পাসওয়ার্ড বা পিন রিসেট করুন",
    modalDesc: lang === "EN" ? "To reset your withdrawal PIN or change your account password, please contact the agent or manager whose referral email you used to register. Their contact info is available on your profile." : "আপনার উইথড্র পিন বা পাসওয়ার্ড পরিবর্তন করতে, অনুগ্রহ করে সেই এজেন্টের সাথে যোগাযোগ করুন যার রেফারেল ইমেইল ব্যবহার করে আপনি অ্যাকাউন্ট খুলেছেন। তাদের যোগাযোগের তথ্য আপনার প্রোফাইলে দেওয়া আছে।",
    closeBtn: lang === "EN" ? "Close" : "বন্ধ করুন"
  };

  return (
    <div className="bg-[#0B0F1A] text-slate-200 font-sans relative overflow-x-hidden">
      
      {/* 💥 Mobile Friendly Toast for Login Page 💥 */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-sm transform transition-all duration-500 ease-out ${toast.show ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0 pointer-events-none"}`}>
        <div className={`px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md flex items-center space-x-3 ${toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${toast.type === 'success' ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <p className="text-sm font-medium leading-snug">{toast.message}</p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-slate-700/50 p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full relative transform scale-100 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-cyan-400">{t.modalTitle}</h3>
              <button onClick={() => setLang(lang === "EN" ? "BN" : "EN")} className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 transition">
                {lang === "EN" ? "বাংলা" : "English"}
              </button>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              {t.modalDesc}
            </p>
            <button onClick={() => setShowForgotModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg border border-slate-600 transition-colors">
              {t.closeBtn}
            </button>
          </div>
        </div>
      )}

      <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] left-[10%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md bg-[#111827]/80 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-4">
              <button type="button" onClick={() => setLang(lang === "EN" ? "BN" : "EN")} className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-md border border-slate-600 transition">
                {lang === "EN" ? "Switch to বাংলা" : "Switch to English"}
              </button>
              <span>V3.0.1 (Secured)</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent uppercase tracking-wider">
              Zenex Network
            </h1>
            <p className="text-sm text-slate-400 mt-1">{t.title}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t.email}</label>
              <input type="text" name="emailOrPhone" onChange={handleChange} placeholder="Enter phone or email" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400 transition" required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t.pass}</label>
              <input type="password" name="password" onChange={handleChange} placeholder="Enter password" className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400 transition" required />
            </div>
            <div className="flex justify-end">
              <span onClick={() => setShowForgotModal(true)} className="text-xs text-cyan-400 cursor-pointer hover:underline">{t.forgot}</span>
            </div>
            <button type="submit" disabled={loading} className={`w-full text-white font-medium py-3 rounded-lg shadow-lg transition-all mt-2 ${loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500'}`}>
              {loading ? t.loadingBtn : t.btn}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            {t.noAccount} <Link href="/register" className="text-cyan-400 hover:underline">{t.register}</Link>
          </p>
        </div>
      </div>

      <div className="w-full relative z-10 bg-[#0B0F1A]">
        <GlobalFooter />
      </div>
    </div>
  );
}