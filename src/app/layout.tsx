// src/app/layout.tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import Footer from './components/Footer';
import { ThemeProvider } from './components/ThemeProvider';
import HeaderButtons from './components/HeaderButtons';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import "./globals.css";
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata, Viewport } from 'next';


// 1. Separate Viewport export
export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// 2. Metadata for PWA assets
export const metadata: Metadata = {
  metadataBase: new URL('https://sunoverthe.cloud'),
  title: {
    template: 'Sun Over The Cloud',
    default: 'Sun Over The Cloud',
  },
  description: 'Have fun watching weather graphs',
  alternates: {
      canonical: '/',
    },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SuperApp',
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              <header className="flex flex-col md:flex-row md:justify-between md:items-center px-4 pb-4 bg-white dark:bg-gray-800 shadow-md pt-[calc(1rem+var(--safe-top))]">
                <Link href="/" className="flex items-center space-x-2 mb-4 md:mb-0">
                  <Image src="/icon.png" alt="Sun Over The Cloud" width={40} height={40} />
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">Sun Over The Cloud</h1>
                </Link>
                <div className="self-end md:self-auto">
                  <HeaderButtons />
                </div>
              </header>
              <main className="flex-grow bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
                {children}
              </main>
              <Footer />
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}