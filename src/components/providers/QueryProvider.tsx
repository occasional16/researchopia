'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 数据保持新鲜5分钟
            staleTime: 5 * 60 * 1000,
            // 缓存数据保留10分钟
            gcTime: 10 * 60 * 1000,
            // 失败时重试一次
            retry: 1,
            // 窗口重新获得焦点时不自动重新获取
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
