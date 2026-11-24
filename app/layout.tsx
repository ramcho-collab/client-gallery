import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const isAdminEnv = process.env.NEXT_PUBLIC_APP_MODE === 'admin';

export const metadata: Metadata = {
  title: isAdminEnv ? '254Oslo Admin — Madness Lunar' : '254Oslo — Madness Lunar',
  description: isAdminEnv
    ? '254Oslo — Madness Lunar Admin Studio'
    : '254Oslo — Madness Lunar Client Gallery',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: isAdminEnv ? '254Oslo Admin' : '254Oslo',
  },
};

export const viewport: Viewport = {
  themeColor: isAdminEnv ? '#0a0a0a' : '#006600',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brandHref = isAdminEnv ? '/admin' : '/';

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {isAdminEnv ? (
          <div
            aria-hidden="true"
            className="fixed inset-0 -z-10 bg-neutral-950 pointer-events-none"
          />
        ) : (
          <div
            aria-hidden="true"
            className="fixed inset-0 -z-10 kenya-flag-bg pointer-events-none"
          />
        )}
        <header className="w-full text-center pt-8 pb-4 px-4">
          <Link href={brandHref} className="inline-block">
            <div className="text-3xl md:text-5xl font-bold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              254Oslo
            </div>
            <div className="text-sm md:text-base font-medium tracking-widest uppercase text-white mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              Madness Lunar
            </div>
          </Link>
        </header>
        <div className="flex-1">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
