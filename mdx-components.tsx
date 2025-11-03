import type { MDXComponents } from 'mdx/types'
import CodeBlock from './src/app/guide/components/CodeBlock'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // 自定义代码块
    pre: ({ children, ...props }: any) => {
      const code = children?.props?.children || ''
      const language = children?.props?.className?.replace('language-', '') || ''
      return <CodeBlock language={language}>{code}</CodeBlock>
    },
    // 自定义标题（添加锚点）
    h1: ({ children, ...props }: any) => (
      <h1 id={slugify(children)} className="scroll-mt-20" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 id={slugify(children)} className="scroll-mt-20" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 id={slugify(children)} className="scroll-mt-20" {...props}>
        {children}
      </h3>
    ),
    // 自定义链接（外部链接在新标签打开）
    a: ({ href, children, ...props }: any) => {
      const isExternal = href?.startsWith('http')
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          {...props}
        >
          {children}
        </a>
      )
    },
    ...components,
  }
}

// 将文本转换为 URL 友好的 slug
function slugify(text: any): string {
  if (typeof text !== 'string') {
    text = String(text)
  }
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '')
    .replace(/--+/g, '-')
}
