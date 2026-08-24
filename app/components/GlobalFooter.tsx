"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function GlobalFooter() {
  const [supportLink, setSupportLink] = useState("https://t.me/Zenexacademy1");
  const [contactLink, setContactLink] = useState("https://t.me/abdullah_124");

  useEffect(() => {
    const fetchGlobalLinks = async () => {
      try {
        const res = await fetch("/api/admin/update-support-link");
        if(res.ok){
          const data = await res.json();
          if (data.supportLink) setSupportLink(data.supportLink);
          if (data.contactLink) setContactLink(data.contactLink);
        }
      } catch (e) {}
    };
    fetchGlobalLinks();
  }, []);

  return (
    <footer className="w-full bg-[#0B152A] border-t border-[#162749] py-5 px-6 mt-auto shrink-0 z-20">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full max-w-[1600px] mx-auto">
         <p className="text-[11px] text-[#6C84A3] font-bold tracking-widest uppercase text-center md:text-left">
           © 2026 ZENEX NETWORK. ALL RIGHTS RESERVED.
         </p>
         <div className="flex items-center justify-center gap-3 md:gap-4 text-[10px] md:text-[11px] font-bold tracking-widest uppercase">
            <a href={supportLink} target="_blank" rel="noopener noreferrer" className="text-[#6C84A3] hover:text-[#00D2FF] transition-colors">
              Support
            </a>
            <span className="text-[#162749]">|</span>
            <a href={contactLink} target="_blank" rel="noopener noreferrer" className="text-[#6C84A3] hover:text-[#60A5FA] transition-colors">
              Contact
            </a>
            <span className="text-[#162749]">|</span>
            <Link href="/faq" className="text-[#6C84A3] hover:text-[#00D2FF] transition-colors">
              FAQ
            </Link>
            <span className="text-[#162749]">|</span>
            {/* 💥 Simple Legal Link 💥 */}
            <Link href="/terms" className="text-[#F43F5E] hover:text-[#F8FAFC] transition-colors">
              Legal & Terms
            </Link>
         </div>
      </div>
    </footer>
  );
}