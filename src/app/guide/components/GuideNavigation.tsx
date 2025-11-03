import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getAdjacentGuides, findGuideItem } from '../guide-config'

interface GuideNavigationProps {
  category: string
  slug: string
}

export default function GuideNavigation({ category, slug }: GuideNavigationProps) {
  const adjacent = getAdjacentGuides(category, slug)

  return (
    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        {/* 上一页 */}
        <div className="flex-1">
          {adjacent.prev && (
            <Link
              href={`/guide/${adjacent.prev.category}/${adjacent.prev.slug}`}
              className="group flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <div className="text-left">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">上一页</div>
                <div className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {findGuideItem(adjacent.prev.category, adjacent.prev.slug)?.item.title}
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* 下一页 */}
        <div className="flex-1">
          {adjacent.next && (
            <Link
              href={`/guide/${adjacent.next.category}/${adjacent.next.slug}`}
              className="group flex items-center justify-end space-x-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">下一页</div>
                <div className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {findGuideItem(adjacent.next.category, adjacent.next.slug)?.item.title}
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
