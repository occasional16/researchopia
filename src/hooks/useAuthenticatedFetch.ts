import { useAuth } from '@/contexts/AuthContext'
import { getSafeSession } from '@/lib/auth-utils'

export function useAuthenticatedFetch() {
  const { user, isAuthenticated } = useAuth()

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers)

    // 如果用户已认证，尝试添加authorization头
    if (isAuthenticated && user) {
      const session = await getSafeSession()
      
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`)
      }
    }

    return fetch(url, {
      ...options,
      headers
    })
  }

  return authenticatedFetch
}