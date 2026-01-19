/**
 * Content Script Module Exports
 * Re-exports all content script modules for convenient importing
 */

export { FloatingIcon } from './floating-icon';
export { 
  detectDOI,
  detectFromMeta,
  detectFromURL,
  detectFromJsonLd,
  detectFromText,
  cleanDOI,
  isValidDOI,
  isAcademicSite,
} from './doi-detector';

export type { FloatingIconConfig, DragState } from './floating-icon';
export type { DOIDetectionResult } from './doi-detector';
