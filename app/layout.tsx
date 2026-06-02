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

// 💥 Advanced SEO Metadata & Preview Image Removed 💥
export const metadata: Metadata = {
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