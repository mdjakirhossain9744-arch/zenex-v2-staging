import type { Metadata } from "next";
import "./globals.css";
import SessionWatcher from "./components/SessionWatcher"; // 💥 SessionWatcher
import FCMProvider from "./components/FCMProvider"; // 🚀 FCM Push Notification Provider

// 💥 Advanced SEO Metadata & PWA Manifest Added 💥
export const metadata: Metadata = {
  manifest: "/manifest.json", // 🚀 PWA Builder-এর জন্য Manifest লিঙ্ক 
  metadataBase: new URL("https://www.zenexnetwork.com"),
  title: "ZENEX NETWORK",
  description: "Join ZENEX NETWORK. Get free virtual numbers, complete successful OTP tasks, and get paid instantly. Enterprise micro-job platform.",
  keywords: ["ZENEX", "ZENEX NETWORK", "Free OTP", "Bangladesh OTP", "Micro Job", "Virtual Number", "Online Earning", "SMS Verification", "Instant Payout"],
  authors: [{ name: "Zenex Team" }],
  openGraph: {
    title: "ZENEX NETWORK",
    description: "Get free numbers, complete OTP tasks, and earn instant payouts.",
    url: "https://www.zenexnetwork.com",
    siteName: "ZENEX NETWORK",
    locale: "en_US",
    type: "website",
    // 💥 ছবি অফ করে দেওয়া হয়েছে 💥
  },
  twitter: {
    card: "summary", // 💥 large_image সরিয়ে শুধু text summary দেওয়া হয়েছে 💥
    title: "ZENEX NETWORK",
    description: "Get free numbers, complete OTP tasks, and earn instant payouts.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // 💥 Google Fonts সরিয়ে Next.js এর ডিফল্ট ফাস্ট font-sans ব্যবহার করা হলো
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full flex flex-col bg-[#0F172A] text-[#E2E8F0]">
        {/* 💥 ম্যাজিক: Cross-Tab Session Sync Component 💥 */}
        <SessionWatcher />
        
        {/* 🚀 ম্যাজিক: Real-Time FCM Push Notification Engine 🚀 */}
        <FCMProvider />
        
        {children}
      </body>
    </html>
  );
}