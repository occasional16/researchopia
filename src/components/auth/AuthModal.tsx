'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import LoginForm from './LoginForm'
import SignUpForm from './SignUpForm'
import ReCaptchaProvider from './ReCaptchaProvider'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'signup'
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)

  if (!isOpen) return null

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
  }

  return (
    <ReCaptchaProvider>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-xl font-semibold">
              {mode === 'login' ? '登录' : '注册'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6">
            {mode === 'login' ? (
              <LoginForm onToggleMode={toggleMode} onClose={onClose} />
            ) : (
              <SignUpForm onToggleMode={toggleMode} onClose={onClose} />
            )}
          </div>

          {/* reCAPTCHA 说明 */}
          <div className="px-6 pb-4 text-xs text-gray-500 text-center">
            本网站受 reCAPTCHA 保护，适用 Google{' '}
            <a 
              href="https://policies.google.com/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              隐私政策
            </a>
            {' '}和{' '}
            <a 
              href="https://policies.google.com/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              服务条款
            </a>
            。
          </div>
        </div>
      </div>
    </ReCaptchaProvider>
  )
}
