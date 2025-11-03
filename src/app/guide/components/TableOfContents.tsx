'use client'

import { useEffect, useState } from 'react'

interface TocItem {
  id: string
  text: string
  level: number
}

export default function TableOfContents() {
  const [toc, setToc] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    // 提取页面中的所有标题
    const headings = Array.from(document.querySelectorAll('h2, h3'))
      .map((heading) => ({
        id: heading.id,
        text: heading.textContent || '',
        level: parseInt(heading.tagName[1]),
      }))
    setToc(headings)

    // 监听滚动，高亮当前章节
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '-80px 0px -80% 0px' }
    )

    headings.forEach(({ id }) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [])

  if (toc.length === 0) return null

  return (
    <nav className="hidden xl:block xl:w-56 flex-shrink-0">
      <div className="sticky top-24 space-y-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">本页目录</p>
        <ul className="space-y-2 text-sm">
          {toc.map((item) => (
            <li
              key={item.id}
              style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
            >
              <a
                href={`#${item.id}`}
                className={`
                  block py-1 transition-colors
                  ${
                    activeId === item.id
                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }
                `}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
