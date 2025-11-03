'use client'

import { useState } from 'react'
import { Globe, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'toggle' | 'compact'
  position?: 'navbar' | 'footer' | 'sidebar'
  className?: string
}

export default function LanguageSwitcher({ 
  variant = 'dropdown', 
  position = 'navbar',
  className = '' 
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  const languages = [
    { code: 'zh' as const, name: '中文', nativeName: '简体中文', flag: '🇨🇳' },
    { code: 'en' as const, name: 'English', nativeName: 'English', flag: '🇺🇸' }
  ]

  const currentLang = languages.find(lang => lang.code === language) || languages[0]

  const handleLanguageChange = (langCode: 'zh' | 'en') => {
    setLanguage(langCode)
    setIsOpen(false)
  }

  // 紧凑模式：只显示图标和当前语言代码
  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Switch Language"
        >
          <Globe className="w-4 h-4" />
          <span className="font-medium uppercase">{language}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-1 z-50">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 ${
                    language === lang.code ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.name}</span>
                  {language === lang.code && (
                    <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // 切换按钮模式：类似于原用户指南的样式
  if (variant === 'toggle') {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-full p-1 shadow-md border dark:border-gray-700 ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
              language === lang.code
                ? 'bg-blue-500 dark:bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {lang.name}
          </button>
        ))}
      </div>
    )
  }

  // 下拉菜单模式（默认）
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{currentLang.name}</span>
        <span className="sm:hidden font-medium uppercase">{language}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className={`absolute mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-1 z-50 ${
            position === 'navbar' ? 'right-0' : 'left-0'
          }`}>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 ${
                  language === lang.code ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <div className="flex-1">
                  <div className="font-medium">{lang.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{lang.nativeName}</div>
                </div>
                {language === lang.code && (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 导出一个简化的语言切换钩子，用于快速切换
export function useLanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  
  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh')
  }
  
  return { language, setLanguage, toggleLanguage }
}