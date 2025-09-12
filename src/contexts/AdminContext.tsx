'use client'

import React, { createContext, useContext } from 'react'
import { useRealAdminStatus } from '@/hooks/useRealAdminStatus'

interface AdminContextType {
  isAdminMode: boolean
  loading: boolean
}

const AdminContext = createContext<AdminContextType>({
  isAdminMode: false,
  loading: true
})

export function useAdmin() {
  return useContext(AdminContext)
}

interface AdminProviderProps {
  children: React.ReactNode
}

export function AdminProvider({ children }: AdminProviderProps) {
  const { isAdmin, loading } = useRealAdminStatus()
  
  return (
    <AdminContext.Provider value={{ isAdminMode: isAdmin, loading }}>
      {children}
    </AdminContext.Provider>
  )
}