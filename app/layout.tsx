import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 💥 Advanced SEO Metadata for Google Ranking 💥
export const metadata: Metadata = {
  title: "ZENEX NETWORK - Premium OTP Service & Micro-Job Platform",
  description: "Join ZENEX NETWORK, the most secure and automated OTP service and micro-job platform. Fast, reliable, and user-friendly dashboard for seamless experiences.",
  keywords: ["ZENEX", "ZENEX NETWORK", "OTP Service", "Bangladesh OTP", "Micro Job", "Virtual Number", "Online Earning", "SMS Verification", "Auto Auto"],
  authors: [{ name: "Zenex Team" }],
  openGraph: {
    title: "ZENEX NETWORK - Premium OTP Service",
    description: "The most secure and automated OTP service platform.",
    url: "https://www.zenexnetwork.com",
    siteName: "ZENEX NETWORK",
    images: [
      {
        url: "/zenex-logo.png", // আপনার পাবলিক ফোল্ডারে থাকা লোগো
        width: 800,
        height: 600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}