import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import { DevPerformanceMonitor } from "@/components/ui/PerformanceMonitor";
import SafeWrapper from "@/components/SafeWrapper";
import ClientProviders from "@/components/providers/ClientProviders";

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
  description: "Researchopia - Open academic exchange and knowledge sharing platform. Where Research Meets Community | 研学港 - 开放的学术交流与知识共享平台。研学并进，智慧共享",
  keywords: ["研学港", "Researchopia", "学术评价", "研学社区", "论文评分", "学术交流", "知识共享", "智慧共享", "研究协作", "学者社区"],
  authors: [{ name: "Researchopia Team" }],
  creator: "Researchopia",
  publisher: "研学港 Researchopia",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // 明确声明站点图标，避免浏览器回退到 /favicon.ico
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/logo-main.svg" }],
  },
  metadataBase: new URL(process.env.NODE_ENV === 'production'
    ? 'https://researchopia.com'
    : 'http://localhost:3000'
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
        url: '/og?title=研学港 Researchopia&subtitle=研学并进，智慧共享',
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
    images: ['/og?title=研学港 Researchopia&subtitle=Where Research Meets Community'],
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
  verification: {
    google: "ms9QZDBICKEN16IGqRQ__QD1p2NSF7K_s-vRe6EBwuY",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 立即执行脚本，防止深色模式闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('rp-dark-mode') === '1') {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        <link rel="manifest" href="/manifest.json" />
        {/* 保险起见再加一条显式的 favicon 链接（Next 的 metadata 会自动注入，但部分环境缓存严格时更稳妥）*/}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Apple Touch 图标（当前使用 SVG，若需要可后续补充 PNG 版本提高兼容性）*/}
        <link rel="apple-touch-icon" href="/logo-main.svg" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="baidu-site-verification" content="codeva-rSICCiqIlo" />
        {/* DNS预解析和预连接，优化外部资源加载 */}
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL || ''} />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL || ''} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900`}
      >
        <ClientProviders>
          <SafeWrapper>
            <div className="min-h-screen">
              <Navbar />
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
                {children}
              </main>
              <DevPerformanceMonitor />
            </div>
          </SafeWrapper>
        </ClientProviders>
      </body>
    </html>
  );
}
