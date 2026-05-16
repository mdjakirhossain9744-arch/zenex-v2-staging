"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootRouterPage() {
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.replace("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    
    // 💥 DYNAMIC ROUTING 💥
    if (parsedUser.role === "admin") {
      router.replace("/admin/dashboard");
    } else if (parsedUser.role === "agent") {
      router.replace("/manager/dashboard");
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#334155] border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
      <p className="text-[#94A3B8] font-bold tracking-widest uppercase text-xs">Authenticating Workspace...</p>
    </div>
  );
}