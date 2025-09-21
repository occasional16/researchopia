'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { isValidSession } from '@/lib/auth-utils'

export function useRealAdminStatus() {
  const { user, isAuthenticated } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!isAuthenticated || !user || !supabase) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      try {
        // 检查会话是否有效
        const hasValidSession = await isValidSession()
        
        if (!hasValidSession) {
          console.log('No valid session for admin check')
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // 从数据库查询用户角色
        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Failed to fetch user role:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin((userData as any)?.role === 'admin')
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdminStatus()
  }, [user, isAuthenticated])

  return { isAdmin, loading }
}