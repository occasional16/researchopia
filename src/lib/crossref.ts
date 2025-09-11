// CrossRef API integration for fetching paper metadata by DOI

export interface CrossRefWork {
  DOI: string
  title: string[]
  author?: Array<{
    given?: string
    family?: string
    name?: string
  }>
  abstract?: string
  published?: {
    'date-parts': number[][]
  }
  'container-title'?: string[]
  subject?: string[]
  type?: string
  URL?: string
}

export interface CrossRefResponse {
  status: string
  'message-type': string
  'message-version': string
  message: CrossRefWork
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
 * Fetch paper metadata from CrossRef API using DOI
 */
export async function fetchPaperByDOI(doi: string): Promise<PaperMetadata | null> {
  try {
    // Clean and validate DOI
    const cleanDOI = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    
    if (!isValidDOI(cleanDOI)) {
      throw new Error('Invalid DOI format')
    }

    const response = await fetch(`https://api.crossref.org/works/${cleanDOI}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Academic Rating Platform (mailto:admin@example.com)'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('DOI not found')
      }
      throw new Error(`CrossRef API error: ${response.status}`)
    }

    const data: CrossRefResponse = await response.json()
    const work = data.message

    // Extract and format the data
    const metadata: PaperMetadata = {
      title: work.title?.[0] || 'Unknown Title',
      authors: extractAuthors(work.author || []),
      doi: work.DOI,
      abstract: work.abstract ? stripHtml(work.abstract) : undefined,
      keywords: work.subject || [],
      publication_date: extractPublicationDate(work.published),
      journal: work['container-title']?.[0],
      url: work.URL
    }

    return metadata
  } catch (error) {
    console.error('Error fetching paper from CrossRef:', error)
    throw error
  }
}

/**
 * Validate DOI format
 */
export function isValidDOI(doi: string): boolean {
  // Basic DOI format validation
  const doiRegex = /^10\.\d{4,}\/[^\s]+$/
  return doiRegex.test(doi)
}

/**
 * Extract authors from CrossRef author array
 */
function extractAuthors(authors: CrossRefWork['author'] = []): string[] {
  return authors.map(author => {
    if (author.name) {
      return author.name
    }
    if (author.given && author.family) {
      return `${author.given} ${author.family}`
    }
    if (author.family) {
      return author.family
    }
    return 'Unknown Author'
  }).filter(name => name !== 'Unknown Author')
}

/**
 * Extract publication date from CrossRef date format
 */
function extractPublicationDate(published?: CrossRefWork['published']): string | undefined {
  if (!published || !published['date-parts'] || !published['date-parts'][0]) {
    return undefined
  }

  const dateParts = published['date-parts'][0]
  if (dateParts.length >= 3) {
    // Full date: YYYY-MM-DD
    const [year, month, day] = dateParts
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  } else if (dateParts.length >= 2) {
    // Year and month: YYYY-MM-01
    const [year, month] = dateParts
    return `${year}-${month.toString().padStart(2, '0')}-01`
  } else if (dateParts.length >= 1) {
    // Year only: YYYY-01-01
    const [year] = dateParts
    return `${year}-01-01`
  }

  return undefined
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

/**
 * Search for papers by DOI and return existing or fetch new
 */
export async function searchOrFetchPaper(doi: string): Promise<PaperMetadata> {
  // First check if paper already exists in our database
  // This will be implemented in the database layer
  
  // If not found, fetch from CrossRef
  const metadata = await fetchPaperByDOI(doi)
  if (!metadata) {
    throw new Error('Paper not found')
  }

  return metadata
}
