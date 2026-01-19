/**
 * Utility Functions Index
 * Re-exports all utility modules
 */

// Re-export from specialized modules
export * from './doi';
export * from './storage';
export * from './toast';

// ============================================================================
// URL Utilities
// ============================================================================

/**
 * Generate SHA-256 hash of a URL for use as identifier
 * Note: Must match backend hashUrl() - returns first 16 chars of hex digest
 */
export async function hashUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fullHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  // Return first 16 chars to match backend hashUrl()
  return fullHash.slice(0, 16);
}

/**
 * Normalize a URL for consistent hashing
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    // Remove hash and trailing slash
    return urlObj.origin + urlObj.pathname.replace(/\/$/, '') + urlObj.search;
  } catch {
    return url;
  }
}

/**
 * Simple sync hash for URL (for immediate use)
 */
export function simpleHashUrl(url: string): string {
  const normalized = normalizeUrl(url);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get the hostname from a URL
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Format timestamp to relative time string (Chinese)
 */
export function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return date.toLocaleDateString('zh-CN');
}

/**
 * Format timestamp to absolute date string
 */
export function formatAbsoluteTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// HTML Utilities
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// DOM Helpers
// ============================================================================

/**
 * Safely get element by ID with type cast
 */
export function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Toggle element visibility
 */
export function toggleHidden(element: HTMLElement | null, hidden: boolean): void {
  if (element) {
    element.classList.toggle('hidden', hidden);
  }
}

/**
 * Show/hide element
 */
export function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (element) {
    if (hidden) {
      element.classList.add('hidden');
    } else {
      element.classList.remove('hidden');
    }
  }
}

// ============================================================================
// Academic Site Detection
// ============================================================================

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
  'biorxiv.org',
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
 * Check if a URL is from an academic site
 */
export function isAcademicSite(url: string): boolean {
  if (!url) return false;
  return ACADEMIC_DOMAINS.some(domain => url.includes(domain));
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a string is empty or whitespace only
 */
export function isEmpty(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Check if a value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}
