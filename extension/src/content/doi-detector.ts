/**
 * DOI Detector Module for Content Script
 * Specialized DOI detection for injected content scripts
 */

export interface DOIDetectionResult {
  doi: string | null;
  source: 'meta' | 'url' | 'json-ld' | 'text' | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * URL patterns for DOI detection
 * Supports: doi.org, arxiv, bioRxiv, medRxiv, SSRN
 */
const URL_PATTERNS = [
  { pattern: /doi\.org\/(.+)$/i, transform: null },
  { pattern: /\/doi\/(.+?)(?:\?|$)/i, transform: null },
  { pattern: /doi[=:]([^&\s]+)/i, transform: null },
  // arXiv: arxiv.org/abs/2301.12345
  { pattern: /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i, transform: (id: string) => `10.48550/arXiv.${id}` },
  // bioRxiv/medRxiv: biorxiv.org/content/10.1101/2023.01.01.522000v1
  { pattern: /(?:bio|med)rxiv\.org\/content\/(10\.\d+\/[^?\s]+)/i, transform: null },
  // SSRN: ssrn.com/abstract=1234567
  { pattern: /ssrn\.com\/(?:abstract=|papers\.cfm\?abstract_id=)(\d+)/i, transform: (id: string) => `10.2139/ssrn.${id}` },
];

/**
 * Clean and normalize DOI format
 */
export function cleanDOI(doi: string | null): string | null {
  if (!doi) return null;
  
  return doi
    .replace(/^doi:/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/[.;,\s]+$/, '') // Remove trailing punctuation
    .trim();
}

/**
 * Validate DOI format
 */
export function isValidDOI(doi: string | null): boolean {
  if (!doi) return false;
  // DOI format: 10.xxxx/xxxxx (prefix 10, followed by registrant code and suffix)
  return /^10\.\d{4,}\/[^\s]+$/.test(doi);
}

/**
 * Detect DOI from meta tags
 */
export function detectFromMeta(): DOIDetectionResult {
  // Primary: citation_doi
  const citationDoi = document.querySelector('meta[name="citation_doi"]');
  if (citationDoi) {
    const content = citationDoi.getAttribute('content');
    const doi = cleanDOI(content);
    if (isValidDOI(doi)) {
      return { doi, source: 'meta', confidence: 'high' };
    }
  }

  // Secondary: DC.identifier (Dublin Core)
  const dcIdentifier = document.querySelector('meta[name="DC.identifier"]');
  if (dcIdentifier) {
    const content = dcIdentifier.getAttribute('content');
    if (content?.includes('10.')) {
      const doi = cleanDOI(content);
      if (isValidDOI(doi)) {
        return { doi, source: 'meta', confidence: 'high' };
      }
    }
  }

  // Tertiary: prism.doi
  const prismDoi = document.querySelector('meta[name="prism.doi"]');
  if (prismDoi) {
    const content = prismDoi.getAttribute('content');
    const doi = cleanDOI(content);
    if (isValidDOI(doi)) {
      return { doi, source: 'meta', confidence: 'high' };
    }
  }

  return { doi: null, source: null, confidence: 'low' };
}

/**
 * Detect DOI from URL
 */
export function detectFromURL(url: string = window.location.href): DOIDetectionResult {
  for (const { pattern, transform } of URL_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      let extracted = decodeURIComponent(match[1]);
      
      // Apply transform if needed (e.g., for arXiv, SSRN)
      if (transform) {
        extracted = transform(extracted);
      }
      
      const doi = cleanDOI(extracted);
      if (isValidDOI(doi)) {
        return { doi, source: 'url', confidence: 'high' };
      }
    }
  }

  return { doi: null, source: null, confidence: 'low' };
}

/**
 * Extract DOI from JSON-LD structured data
 */
function extractDOIFromJsonLd(data: unknown): string | null {
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

    // Direct doi field
    if (typeof obj.doi === 'string' && obj.doi.includes('10.')) {
      return obj.doi;
    }

    // identifier field (can be string, array, or object)
    if (obj.identifier) {
      if (typeof obj.identifier === 'string' && obj.identifier.includes('10.')) {
        return obj.identifier;
      }
      if (Array.isArray(obj.identifier)) {
        for (const id of obj.identifier) {
          if (typeof id === 'string' && id.includes('10.')) return id;
          if (typeof id === 'object' && id !== null) {
            const idObj = id as Record<string, unknown>;
            if (typeof idObj.value === 'string' && idObj.value.includes('10.')) {
              return idObj.value;
            }
          }
        }
      }
    }

    // sameAs field (often contains DOI URL)
    if (typeof obj.sameAs === 'string' && obj.sameAs.includes('doi.org')) {
      const match = obj.sameAs.match(/doi\.org\/(10\.[^\s]+)/);
      if (match) return match[1];
    }
  }

  return null;
}

/**
 * Detect DOI from JSON-LD scripts in page
 */
export function detectFromJsonLd(): DOIDetectionResult {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      const extracted = extractDOIFromJsonLd(data);
      if (extracted) {
        const doi = cleanDOI(extracted);
        if (isValidDOI(doi)) {
          return { doi, source: 'json-ld', confidence: 'medium' };
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return { doi: null, source: null, confidence: 'low' };
}

/**
 * Detect DOI from page text content (fallback method)
 */
export function detectFromText(): DOIDetectionResult {
  const pageText = document.body?.textContent || document.body?.innerText || '';
  
  // Pattern to match DOI in text
  const pattern = /(?:doi[:=]\s*)?10\.\d{4,}\/[^\s,\);"'<>]+/gi;
  const matches = pageText.match(pattern);
  
  if (matches && matches.length > 0) {
    // Take the first match and clean it
    const raw = matches[0].replace(/^doi[:=]\s*/i, '');
    const doi = cleanDOI(raw);
    
    if (isValidDOI(doi)) {
      return { doi, source: 'text', confidence: 'low' };
    }
  }

  return { doi: null, source: null, confidence: 'low' };
}

/**
 * Main DOI detection function
 * Tries multiple methods in order of reliability
 */
export function detectDOI(): DOIDetectionResult {
  // 1. Try meta tags (most reliable)
  const metaResult = detectFromMeta();
  if (metaResult.doi) {
    console.log('✅ DOI detected from meta:', metaResult.doi);
    return metaResult;
  }

  // 2. Try URL (also reliable)
  const urlResult = detectFromURL();
  if (urlResult.doi) {
    console.log('✅ DOI detected from URL:', urlResult.doi);
    return urlResult;
  }

  // 3. Try JSON-LD (medium reliability)
  const jsonLdResult = detectFromJsonLd();
  if (jsonLdResult.doi) {
    console.log('✅ DOI detected from JSON-LD:', jsonLdResult.doi);
    return jsonLdResult;
  }

  // 4. Try page text (fallback)
  const textResult = detectFromText();
  if (textResult.doi) {
    console.log('✅ DOI detected from page text:', textResult.doi);
    return textResult;
  }

  console.log('❌ No DOI detected');
  return { doi: null, source: null, confidence: 'low' };
}

/**
 * Check if current page is an academic site
 */
export function isAcademicSite(hostname: string = window.location.hostname): boolean {
  const academicDomains = [
    'nature.com',
    'science.org',
    'sciencemag.org',
    'ieee.org',
    'ieeexplore.ieee.org',
    'springer.com',
    'link.springer.com',
    'sciencedirect.com',
    'wiley.com',
    'onlinelibrary.wiley.com',
    'tandfonline.com',
    'acm.org',
    'dl.acm.org',
    'arxiv.org',
    'pubmed.ncbi.nlm.nih.gov',
    'ncbi.nlm.nih.gov',
    'doi.org',
    'researchgate.net',
    'semanticscholar.org',
    'scholar.google.com',
    'jstor.org',
    'biorxiv.org',
    'medrxiv.org',
    'ssrn.com',
    'pnas.org',
    'cell.com',
    'acs.org',
    'pubs.acs.org',
    'rsc.org',
    'pubs.rsc.org',
    'mdpi.com',
    'frontiersin.org',
    'plos.org',
    'journals.plos.org',
    'hindawi.com',
    'cambridge.org',
    'oxford.com',
    'academic.oup.com',
    'elsevier.com',
    'sciencedirect.com',
  ];

  return academicDomains.some(domain => hostname.includes(domain));
}
