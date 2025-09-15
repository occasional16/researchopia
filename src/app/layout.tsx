import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Navbar from "@/components/layout/Navbar";
import { DevPerformanceMonitor } from "@/components/ui/PerformanceMonitor";
import SafeWrapper from "@/components/SafeWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "研学港 | Researchopia - 研学并进，智慧共享",
  description: "研学港(Researchopia)是新一代学术评价与研学社区平台。研学并进，智慧共享，连接全球学者，促进学术交流与协作创新。Where Research Meets Community.",
  keywords: ["研学港", "Researchopia", "学术评价", "研学社区", "论文评分", "学术交流", "智慧共享", "研究协作", "学者社区"],
  authors: [{ name: "Researchopia Team" }],
  creator: "Researchopia",
  publisher: "研学港 Researchopia",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NODE_ENV === 'production'
    ? 'https://academic-rating.vercel.app'
    : 'http://localhost:3009'
  ),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "研学港 | Researchopia - 研学并进，智慧共享",
    description: "研学港(Researchopia) - 新一代学术评价与研学社区平台。Where Research Meets Community. 连接全球学者，构建智慧共享的研学生态。",
    url: '/',
    siteName: "研学港 Researchopia",
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '研学港 Researchopia - 研学并进，智慧共享',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "研学港 | Researchopia - Where Research Meets Community",
    description: "研学并进，智慧共享 | 新一代学术评价与研学社区平台",
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <LanguageProvider>
          <AuthProvider>
            <AdminProvider>
              <SafeWrapper>
                <div className="min-h-screen">
                  <Navbar />
                  <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {children}
                  </main>
                  <DevPerformanceMonitor />
                </div>
              </SafeWrapper>
            </AdminProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
