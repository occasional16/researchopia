/**
 * DOI Utility Functions
 * Pure functions for DOI detection, validation, and normalization
 */

// ============================================================================
// DOI Patterns
// ============================================================================

const DOI_PATTERNS = {
  // Standard DOI pattern: 10.xxxx/xxxx
  standard: /10\.\d{4,}\/[^\s,)\]"'<>]+/i,
  
  // DOI with prefix
  withPrefix: /doi[:=]\s*(10\.\d{4,}\/[^\s,)\]"'<>]+)/i,
  
  // DOI in URL
  inUrl: /doi\.org\/(10\.\d{4,}\/[^\s?#]+)/i,
};

const URL_PATTERNS = [
  // doi.org
  { pattern: /doi\.org\/(.+)$/i, transform: (m: string) => decodeURIComponent(m) },
  
  // Generic /doi/ path
  { pattern: /\/doi\/(.+?)(?:\?|$)/i, transform: (m: string) => decodeURIComponent(m) },
  
  // Query parameter
  { pattern: /doi[=:]([^&\s]+)/i, transform: (m: string) => decodeURIComponent(m) },
  
  // arXiv: arxiv.org/abs/2301.12345
  { pattern: /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i, transform: (m: string) => `10.48550/arXiv.${m}` },
  
  // bioRxiv/medRxiv
  { pattern: /(?:bio|med)rxiv\.org\/content\/(10\.\d+\/[^?\s]+)/i, transform: (m: string) => decodeURIComponent(m) },
  
  // SSRN
  { pattern: /ssrn\.com\/(?:abstract=|papers\.cfm\?abstract_id=)(\d+)/i, transform: (m: string) => `10.2139/ssrn.${m}` },
];

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Clean a DOI string by removing prefixes and unwanted characters
 */
export function cleanDOI(doi: string | null | undefined): string | null {
  if (!doi) return null;
  
  let cleaned = doi
    .replace(/^(doi:|DOI:|\s*)/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim();
  
  // Remove quotes
  cleaned = cleaned.replace(/["\"\"''']/g, '');
  
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[.,;:)\]}>]+$/, '');
  
  return cleaned || null;
}

/**
 * Validate if a string is a valid DOI
 */
export function isValidDOI(doi: string | null | undefined): boolean {
  if (!doi) return false;
  const cleaned = cleanDOI(doi);
  if (!cleaned) return false;
  return /^10\.\d{4,}\/[\-._;()\/:A-Z0-9]+$/i.test(cleaned);
}

/**
 * Extract DOI from a URL
 */
export function extractDOIFromURL(url: string): string | null {
  if (!url) return null;
  
  for (const { pattern, transform } of URL_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      const doi = transform(match[1]);
      const cleaned = cleanDOI(doi);
      if (isValidDOI(cleaned)) {
        return cleaned;
      }
    }
  }
  
  return null;
}

/**
 * Extract DOI from meta tags
 */
export function extractDOIFromMeta(): string | null {
  const selectors = [
    'meta[name="citation_doi"]',
    'meta[name="DC.identifier"][scheme="doi"]',
    'meta[name="dc.identifier"][scheme="doi"]',
    'meta[property="og:doi"]',
  ];
  
  for (const selector of selectors) {
    const meta = document.querySelector(selector);
    if (meta) {
      const content = meta.getAttribute('content');
      if (content) {
        const cleaned = cleanDOI(content);
        if (isValidDOI(cleaned)) {
          return cleaned;
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract DOI from JSON-LD structured data
 */
export function extractDOIFromJsonLd(data: unknown): string | null {
  if (!data) return null;
  
  // Handle arrays
  if (Array.isArray(data)) {
    for (const item of data) {
      const doi = extractDOIFromJsonLd(item);
      if (doi) return doi;
    }
    return null;
  }
  
  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    
    // Direct DOI field
    if (typeof obj.doi === 'string' && obj.doi.includes('10.')) {
      const cleaned = cleanDOI(obj.doi);
      if (isValidDOI(cleaned)) return cleaned;
    }
    
    // Identifier field
    if (obj.identifier) {
      if (typeof obj.identifier === 'string' && obj.identifier.includes('10.')) {
        const cleaned = cleanDOI(obj.identifier);
        if (isValidDOI(cleaned)) return cleaned;
      }
      
      if (Array.isArray(obj.identifier)) {
        for (const id of obj.identifier) {
          if (typeof id === 'string' && id.includes('10.')) {
            const cleaned = cleanDOI(id);
            if (isValidDOI(cleaned)) return cleaned;
          }
          if (typeof id === 'object' && id !== null) {
            const idObj = id as Record<string, unknown>;
            if (typeof idObj.value === 'string' && idObj.value.includes('10.')) {
              const cleaned = cleanDOI(idObj.value);
              if (isValidDOI(cleaned)) return cleaned;
            }
          }
        }
      }
    }
    
    // @id field (common in JSON-LD)
    if (typeof obj['@id'] === 'string' && obj['@id'].includes('doi.org')) {
      const doi = extractDOIFromURL(obj['@id']);
      if (doi) return doi;
    }
  }
  
  return null;
}

/**
 * Extract DOI from page text content
 */
export function extractDOIFromText(text?: string): string | null {
  const content = text || document.body?.textContent || document.body?.innerText || '';
  
  const match = content.match(DOI_PATTERNS.withPrefix) || content.match(DOI_PATTERNS.standard);
  
  if (match) {
    const doi = match[1] || match[0];
    const cleaned = cleanDOI(doi.replace(/^doi[:=]\s*/i, ''));
    if (isValidDOI(cleaned)) {
      return cleaned;
    }
  }
  
  return null;
}

/**
 * Detect DOI using all available methods
 * Priority: Meta > JSON-LD > URL > Text
 */
export function detectDOI(): string | null {
  // 1. Meta tags (most reliable)
  const metaDOI = extractDOIFromMeta();
  if (metaDOI) return metaDOI;
  
  // 2. JSON-LD
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      const doi = extractDOIFromJsonLd(data);
      if (doi) return doi;
    } catch {
      // Ignore parse errors
    }
  }
  
  // 3. URL
  const urlDOI = extractDOIFromURL(window.location.href);
  if (urlDOI) return urlDOI;
  
  // 4. Page text (least reliable)
  const textDOI = extractDOIFromText();
  if (textDOI) return textDOI;
  
  return null;
}

/**
 * Build a DOI URL for opening
 */
export function buildDOIUrl(doi: string): string {
  const cleaned = cleanDOI(doi);
  if (!cleaned) return '';
  return `https://doi.org/${cleaned}`;
}
