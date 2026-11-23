import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import InstallAppButton from "@/components/InstallAppButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "254Oslo — Madness Lunar",
  description: "254Oslo — Madness Lunar Client Galleries",
  appleWebApp: {
    capable: true,
    title: "254Oslo",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#006600",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-white relative">
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 kenya-flag-bg pointer-events-none"
        />
        <header className="w-full text-center pt-8 pb-4 px-4">
          <Link href="/" className="inline-block">
            <div className="text-3xl md:text-5xl font-bold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              254Oslo
            </div>
            <div className="text-sm md:text-base font-medium tracking-widest uppercase text-white mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              Madness Lunar
            </div>
          </Link>
          <InstallAppButton />
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
