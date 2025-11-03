import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import GuideLayout from '../../components/GuideLayout'
import GuideNavigation from '../../components/GuideNavigation'
import TableOfContents from '../../components/TableOfContents'
import { findGuideItem, getAllGuidePaths } from '../../guide-config'

// 动态生成所有指南页面路径
export async function generateStaticParams() {
  return getAllGuidePaths()
}

// 读取 MDX 文件内容
async function getGuideContent(category: string, slug: string) {
  try {
    const filePath = path.join(
      process.cwd(),
      'src/app/guide/content',
      category,
      `${slug}.mdx`
    )
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContent)
    return { frontmatter: data, content }
  } catch (error) {
    return null
  }
}

// 生成元数据
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}): Promise<Metadata> {
  const { category, slug } = await params
  const guideInfo = findGuideItem(category, slug)
  const mdxContent = await getGuideContent(category, slug)

  if (!guideInfo || !mdxContent) {
    return {
      title: '页面未找到',
    }
  }

  return {
    title: `${mdxContent.frontmatter.title || guideInfo.item.title} - Researchopia 用户指南`,
    description: mdxContent.frontmatter.description || guideInfo.item.description,
  }
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { category, slug } = await params
  const guideInfo = findGuideItem(category, slug)
  const mdxContent = await getGuideContent(category, slug)

  if (!guideInfo || !mdxContent) {
    notFound()
  }

  // 动态导入 MDX 组件
  const MDXContent = await import(`../../content/${category}/${slug}.mdx`).then(
    (mod) => mod.default
  )

  return (
    <GuideLayout category={category} slug={slug}>
      <div className="flex gap-8">
        {/* 主内容 */}
        <article className="flex-1 min-w-0 prose prose-blue dark:prose-invert max-w-none">
          <MDXContent />
          <GuideNavigation category={category} slug={slug} />
        </article>

        {/* 右侧目录 */}
        <TableOfContents />
      </div>
    </GuideLayout>
  )
}
