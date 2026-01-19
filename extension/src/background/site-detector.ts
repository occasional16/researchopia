/**
 * Site Detector Module
 * Utilities for detecting academic sites and DOI validation
 */

/**
 * Academic domain patterns
 */
const ACADEMIC_DOMAINS = [
  'arxiv.org',
  'scholar.google',
  'pubmed.ncbi.nlm.nih.gov',
  'ieee.org',
  'acm.org',
  'springer.com',
  'nature.com',
  'science.org',
  'cell.com',
  'elsevier.com',
  'wiley.com',
  'taylor',
  'sage',
  'jstor.org',
  'researchgate.net',
  'academia.edu',
  'semanticscholar.org',
  'dblp.org',
  'crossref.org',
  'doi.org',
  'ncbi.nlm.nih.gov',
  'bioarxiv.org',
  'medrxiv.org',
  'ssrn.com',
  'preprints.org',
  'f1000research.com',
  'peerj.com',
  'hindawi.com',
  'mdpi.com',
  'frontiersin.org',
];

/**
 * Check if URL is an academic site
 */
export function isAcademicSite(url: string | undefined): boolean {
  if (!url) return false;
  return ACADEMIC_DOMAINS.some((domain) => url.includes(domain));
}

/**
 * Validate DOI format
 */
export function isValidDOI(doi: string | undefined): boolean {
  if (!doi) return false;
  return /^10\.\d{4,}\/[\-._;()\/:A-Z0-9]+$/i.test(doi);
}

/**
 * Clean and normalize DOI string
 */
export function cleanDOI(rawDOI: string | undefined): string | null {
  if (!rawDOI) return null;

  let cleaned = rawDOI.replace(/^(doi:|DOI:|\s*)/i, '').trim();
  cleaned = cleaned.replace(/[\"\"\"''']/g, '');
  cleaned = cleaned.replace(/[.,;:)\]}>]+$/, '');

  return cleaned;
}

/**
 * Update badge based on site type
 */
export async function updateBadgeForSite(
  tabId: number,
  url: string | undefined
): Promise<void> {
  try {
    if (isAcademicSite(url)) {
      await chrome.action.setBadgeText({ text: 'DOI', tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#4ade80', tabId });
    } else {
      await chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch {
    // Ignore badge errors
  }
}
