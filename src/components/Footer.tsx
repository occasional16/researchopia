'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Github, User, Users, Newspaper } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import BrandLogo from '@/components/ui/BrandLogo'

// Supabase Storage URL for QR codes
const QR_BASE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/qr-codes`

// WeChat icon component (base icon, smaller for combined use)
function WechatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
    </svg>
  )
}

// QQ icon component (official penguin style)
function QQIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" fill="currentColor">
      <path d="M824.8 613.2c-16-51.4-34.4-94.6-62.7-165.3C766.5 262.2 689.3 112 511.5 112 331.7 112 256.2 265.2 261 447.9c-28.4 70.8-46.7 113.7-62.7 165.3-34 109.5-23 154.8-14.6 155.8 18 2.2 70.1-82.4 70.1-82.4 0 49 25.2 112.9 79.8 159-26.4 8.1-85.7 29.9-71.6 53.8 11.4 19.3 196.2 12.3 249.5 6.3 53.3 6 238.1 13 249.5-6.3 14.1-23.8-45.3-45.7-71.6-53.8 54.6-46.2 79.8-110.1 79.8-159 0 0 52.1 84.6 70.1 82.4 8.5-1.1 19.5-46.4-14.5-155.8z"/>
    </svg>
  )
}

// QR Code Popover Component
interface QRCodePopoverProps {
  imageName: string
  label: string
  children: React.ReactNode
}

function QRCodePopover({ imageName, label, children }: QRCodePopoverProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 min-w-[160px]">
            {!imageError ? (
              <img 
                src={`${QR_BASE_URL}/${imageName}`} 
                alt={label}
                className="w-40 h-40 rounded-lg object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-40 h-40 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-xs text-gray-400">暂无二维码</span>
              </div>
            )}
            <p className="text-sm text-center mt-3 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
              {label}
            </p>
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 bg-white dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 transform rotate-45" />
        </div>
      )}
    </div>
  )
}

// Tooltip Component for links
interface TooltipProps {
  text: string
  children: React.ReactNode
}

function Tooltip({ text, children }: TooltipProps) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
        {text}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45" />
      </div>
    </div>
  )
}

export default function Footer() {
  const { isAuthenticated } = useAuth()
  const { t } = useLanguage()

  return (
    <footer id="footer" className="mt-12 space-y-6 scroll-mt-4">
      {/* CTA Section - Compact design with logo */}
      {!isAuthenticated && (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800/50 dark:to-blue-900/30 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: Logo + Brand name */}
            <div className="flex items-center gap-4">
              <BrandLogo size={48} variant="icon-only" />
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    研学港
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Researchopia</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('footer.cta.slogan', '研学并进，智慧共享')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
                  {t('footer.cta.subtitle', '开放的学术交流与知识共享平台')}
                </p>
              </div>
            </div>
            {/* Right: CTA button */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('showAuthModal', { detail: { mode: 'signup' } }))}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-md text-sm"
            >
              {t('footer.cta.button', '立即加入')}
            </button>
          </div>
        </div>
      )}

      {/* Contact Section */}
      <div className="flex flex-wrap justify-center items-center gap-8 py-4">
        {/* Personal WeChat - User icon overlay */}
        <QRCodePopover imageName="wechat-personal.png" label="个人微信">
          <div className="flex flex-col items-center cursor-pointer group">
            <div className="relative">
              <WechatIcon className="w-8 h-8 text-green-500 group-hover:scale-110 transition-all duration-200" />
              <User className="absolute -bottom-1 -right-1 w-4 h-4 text-blue-500 bg-white dark:bg-gray-900 rounded-full p-0.5" />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">个人微信</span>
          </div>
        </QRCodePopover>

        {/* WeChat Official Account - Newspaper icon overlay */}
        <QRCodePopover imageName="wechat-official-account.png" label="观物AI微信公众号">
          <div className="flex flex-col items-center cursor-pointer group">
            <div className="relative">
              <WechatIcon className="w-8 h-8 text-green-500 group-hover:scale-110 transition-all duration-200" />
              <Newspaper className="absolute -bottom-1 -right-1 w-4 h-4 text-purple-500 bg-white dark:bg-gray-900 rounded-full p-0.5" />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">公众号</span>
          </div>
        </QRCodePopover>

        {/* WeChat Group - Users icon overlay */}
        <QRCodePopover imageName="wechat-group.png" label="官方微信用户群">
          <div className="flex flex-col items-center cursor-pointer group">
            <div className="relative">
              <WechatIcon className="w-8 h-8 text-green-500 group-hover:scale-110 transition-all duration-200" />
              <Users className="absolute -bottom-1 -right-1 w-4 h-4 text-orange-500 bg-white dark:bg-gray-900 rounded-full p-0.5" />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">微信群</span>
          </div>
        </QRCodePopover>

        {/* QQ Group */}
        <QRCodePopover imageName="qq-group.png" label="官方QQ用户群">
          <div className="flex flex-col items-center cursor-pointer group">
            <QQIcon className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-all duration-200" />
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">QQ群</span>
          </div>
        </QRCodePopover>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 hidden md:block" />

        {/* GitHub */}
        <Tooltip text="Github项目主页">
          <Link 
            href="https://github.com/occasional16/researchopia" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center group"
          >
            <Github className="w-8 h-8 text-gray-800 dark:text-gray-200 group-hover:scale-110 transition-all duration-200" />
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">GitHub</span>
          </Link>
        </Tooltip>

        {/* Reserved placeholders for future platforms */}
        {/* TODO: Add Zhihu, Bilibili, Douyin, Xiaohongshu when ready */}
      </div>

      {/* Copyright Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 pb-2">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <BrandLogo size={20} variant="icon-only" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} 研学港 Researchopia. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <Link href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              {t('footer.privacy', '隐私政策')}
            </Link>
            <span>|</span>
            <Link href="/terms" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              {t('footer.terms', '服务条款')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
