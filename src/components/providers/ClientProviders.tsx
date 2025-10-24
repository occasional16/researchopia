'use client'

import { ReactNode } from 'react'
import { AuthProvider } from "@/contexts/AuthContext"
import { AdminProvider } from "@/contexts/AdminContext"
import { LanguageProvider } from "@/contexts/LanguageContext"
import { QueryProvider } from "@/components/providers/QueryProvider"
import ReCaptchaProvider from "@/components/auth/ReCaptchaProvider"

interface ClientProvidersProps {
  children: ReactNode
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <QueryProvider>
      <ReCaptchaProvider>
        <LanguageProvider>
          <AuthProvider>
            <AdminProvider>
              {children}
            </AdminProvider>
          </AuthProvider>
        </LanguageProvider>
      </ReCaptchaProvider>
    </QueryProvider>
  )
}
