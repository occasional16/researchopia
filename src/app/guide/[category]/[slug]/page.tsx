import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import GuideLayout from '../../components/GuideLayout'
import GuideNavigation from '../../components/GuideNavigation'
import TableOfContents from '../../components/TableOfContents'
import { findGuideItem, getAllGuidePaths } from '../../guide-config'
import { getMDXContent, getMDXFrontmatter } from '../../content'

// Generate all guide page paths statically
export async function generateStaticParams() {
  return getAllGuidePaths()
}

// Generate metadata using static frontmatter map (no fs needed)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}): Promise<Metadata> {
  const { category, slug } = await params
  const guideInfo = findGuideItem(category, slug)
  const frontmatter = getMDXFrontmatter(category, slug)

  if (!guideInfo || !frontmatter) {
    return {
      title: '页面未找到',
    }
  }

  return {
    title: `${frontmatter.title || guideInfo.item.title} - Researchopia 用户指南`,
    description: frontmatter.description || guideInfo.item.description,
  }
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { category, slug } = await params
  const guideInfo = findGuideItem(category, slug)
  const frontmatter = getMDXFrontmatter(category, slug)

  if (!guideInfo || !frontmatter) {
    notFound()
  }

  // Use static import map for Cloudflare Workers compatibility
  const MDXContent = getMDXContent(category, slug)
  
  if (!MDXContent) {
    notFound()
  }

  return (
    <GuideLayout category={category} slug={slug}>
      <div className="flex gap-8">
        {/* Main content */}
        <article className="flex-1 min-w-0 prose prose-blue dark:prose-invert max-w-none">
          <MDXContent />
          <GuideNavigation category={category} slug={slug} />
        </article>

        {/* Right sidebar TOC */}
        <TableOfContents />
      </div>
    </GuideLayout>
  )
}
