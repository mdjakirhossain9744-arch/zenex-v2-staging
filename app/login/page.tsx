"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState("EN");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const [formData, setFormData] = useState({ emailOrPhone: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
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
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        // UI রেন্ডার করার জন্য শুধু বেসিক ডাটা লোকাল স্টোরেজে রাখা হলো
        localStorage.setItem("user", JSON.stringify(data.user));

        showToast(lang === "EN" ? "Login Successful!" : "লগিন সফল হয়েছে!", "success");
        setTimeout(() => {
          router.push("/"); 
        }, 2000);
      } else {
        showToast(data.message, "error");
      }
    } catch (error) {
      showToast("Network Error! Please try again.", "error");
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
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center p-4 text-slate-200 font-sans relative overflow-hidden">
      <div className={`fixed top-5 right-5 z-50 transform transition-all duration-500 ease-out ${toast.show ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0 pointer-events-none"}`}>
        <div className={`px-6 py-3 rounded-lg shadow-2xl border backdrop-blur-md flex items-center space-x-3 ${toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${toast.type === 'success' ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      </div>

      <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[10%] left-[10%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-md bg-[#111827]/80 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-2xl relative z-10">
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
            <span className="text-xs text-cyan-400 cursor-pointer hover:underline">{t.forgot}</span>
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
  );
}