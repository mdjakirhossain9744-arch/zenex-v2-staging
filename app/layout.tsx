import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionWatcher from "./components/SessionWatcher"; // 💥 SessionWatcher ইমপোর্ট করা হলো

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 💥 Advanced SEO Metadata & Telegram Cache Fix 💥
export const metadata: Metadata = {
  metadataBase: new URL("https://www.zenexnetwork.com"),
  title: "ZENEX NETWORK - Free Numbers & Instant Payouts",
  description: "Join ZENEX NETWORK. Get free virtual numbers, complete successful OTP tasks, and get paid instantly. Enterprise micro-job platform.",
  keywords: ["ZENEX", "ZENEX NETWORK", "Free OTP", "Bangladesh OTP", "Micro Job", "Virtual Number", "Online Earning", "SMS Verification", "Instant Payout"],
  authors: [{ name: "Zenex Team" }],
  openGraph: {
    title: "ZENEX NETWORK - Free Numbers & Instant Payouts",
    description: "Get free numbers, complete OTP tasks, and earn instant payouts.",
    url: "https://www.zenexnetwork.com",
    siteName: "ZENEX NETWORK",
    images: [
      {
        url: "/zenex-logo.png?v=4.0.1", // 💥 CACHE FIX: forces telegram/socials to fetch new logo 💥
        width: 800,
        height: 600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZENEX NETWORK - Free Numbers & Instant Payouts",
    images: ["/zenex-logo.png?v=4.0.1"], // 💥 TWITTER CACHE FIX 💥
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 💥 ম্যাজিক: Cross-Tab Session Sync Component 💥 */}
        {/* এটি ব্যাকগ্রাউন্ডে কাজ করবে এবং অন্য ট্যাবে লগইন হলে এই পেজ রিলোড করে দেবে */}
        <SessionWatcher />
        
        {children}
      </body>
    </html>
  );
}