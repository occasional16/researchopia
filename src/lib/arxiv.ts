// arXiv API integration for fetching preprint metadata

export interface ArxivEntry {
  id: string
  updated: string
  published: string
  title: string
  summary: string
  author: Array<{ name: string }>
  'arxiv:doi'?: { _: string }
  'arxiv:journal_ref'?: { _: string }
  category?: Array<{ $: { term: string } }> | { $: { term: string } }
}

export interface ArxivResponse {
  feed: {
    entry?: ArxivEntry | ArxivEntry[]
  }
}

export interface PaperMetadata {
  title: string
  authors: string[]
  doi: string
  abstract?: string
  keywords: string[]
  publication_date?: string
  journal?: string
  url?: string
}

/**
 * Fetch paper metadata from arXiv API using arXiv ID or DOI
 */
export async function fetchPaperFromArxiv(identifier: string): Promise<PaperMetadata | null> {
  try {
    // Extract arXiv ID from DOI or direct ID
    let arxivId = identifier
    
    // If it's a DOI like 10.48550/arXiv.2102.12194, extract the arXiv ID
    const arxivDOIMatch = identifier.match(/arXiv\.(\d+\.\d+)/i)
    if (arxivDOIMatch) {
      arxivId = arxivDOIMatch[1]
    }
    
    // Clean up arXiv ID (remove version if present)
    arxivId = arxivId.replace(/v\d+$/, '')
    
    console.log('📡 Fetching paper from arXiv:', arxivId)

    // arXiv API endpoint
    const response = await fetch(`http://export.arxiv.org/api/query?id_list=${arxivId}`, {
      headers: {
        'Accept': 'application/xml'
      }
    })

    if (!response.ok) {
      console.error('❌ arXiv API error:', response.status)
      return null
    }

    const xmlText = await response.text()
    
    // Check if paper was found
    if (xmlText.includes('<opensearch:totalResults>0</opensearch:totalResults>')) {
      console.error('❌ Paper not found in arXiv:', arxivId)
      return null
    }

    // Parse XML (simple parsing for the fields we need)
    const entry = parseArxivXML(xmlText)
    
    if (!entry) {
      console.error('❌ Failed to parse arXiv response')
      return null
    }

    console.log('✅ Paper found in arXiv:', entry.title)

    // Extract metadata
    const metadata: PaperMetadata = {
      title: entry.title.trim().replace(/\s+/g, ' '),
      authors: entry.authors || [],
      doi: identifier.includes('arXiv') ? identifier : `10.48550/arXiv.${arxivId}`,
      abstract: entry.abstract?.trim().replace(/\s+/g, ' '),
      keywords: entry.categories || [],
      publication_date: entry.published,
      journal: entry.journal || 'arXiv preprint',
      url: `https://arxiv.org/abs/${arxivId}`
    }

    return metadata
  } catch (error) {
    console.error('❌ Error fetching paper from arXiv:', error)
    return null
  }
}

/**
 * Simple XML parser for arXiv API response
 */
function parseArxivXML(xml: string): {
  title: string
  authors: string[]
  abstract?: string
  published: string
  categories: string[]
  journal?: string
} | null {
  try {
    // Extract title (use [\s\S] instead of . with s flag)
    const titleMatch = xml.match(/<title>([\s\S]+?)<\/title>/)
    const title = titleMatch ? titleMatch[1].replace(/^\s*arXiv:.+?\s*/, '').trim() : ''

    // Extract authors
    const authorMatches = xml.matchAll(/<author>[\s\S]*?<name>(.+?)<\/name>[\s\S]*?<\/author>/g)
    const authors = Array.from(authorMatches, m => m[1].trim())

    // Extract abstract (use [\s\S] instead of . with s flag)
    const summaryMatch = xml.match(/<summary>([\s\S]+?)<\/summary>/)
    const abstract = summaryMatch ? summaryMatch[1].trim() : undefined

    // Extract published date
    const publishedMatch = xml.match(/<published>(.+?)<\/published>/)
    const published = publishedMatch ? publishedMatch[1].split('T')[0] : new Date().toISOString().split('T')[0]

    // Extract categories
    const categoryMatches = xml.matchAll(/<category\s+term="([^"]+)"/g)
    const categories = Array.from(categoryMatches, m => m[1])

    // Extract journal reference if available
    const journalMatch = xml.match(/<arxiv:journal_ref>(.+?)<\/arxiv:journal_ref>/)
    const journal = journalMatch ? journalMatch[1].trim() : undefined

    if (!title) {
      return null
    }

    return {
      title,
      authors,
      abstract,
      published,
      categories,
      journal
    }
  } catch (error) {
    console.error('Error parsing arXiv XML:', error)
    return null
  }
}

/**
 * Check if identifier is likely an arXiv paper
 */
export function isArxivIdentifier(identifier: string): boolean {
  return /arXiv|arxiv/i.test(identifier) || /^\d{4}\.\d{4,5}$/.test(identifier)
}
