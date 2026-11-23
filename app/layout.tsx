import type { Metadata } from "next";
import Link from "next/link";
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

export const metadata: Metadata = {
  title: "254Oslo — Madness Lunar",
  description: "254Oslo — Madness Lunar Client Galleries",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col kenya-flag-bg text-white">
        <header className="w-full bg-black/55 backdrop-blur-xs text-center pt-8 pb-4 px-4 border-b border-white/15">
          <Link href="/" className="inline-block">
            <div className="text-3xl md:text-5xl font-bold tracking-tight text-white drop-shadow">
              254Oslo
            </div>
            <div className="text-sm md:text-base font-medium tracking-widest uppercase text-white/90 mt-1 drop-shadow">
              Madness Lunar
            </div>
          </Link>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
