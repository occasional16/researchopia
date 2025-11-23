import { describe, it, expect } from 'vitest';
import { validateDOI, normalizeDOI, extractDOI } from '@researchopia/shared/utils';

describe('DOI Utils from Shared Library', () => {
  it('should validate DOI', () => {
    expect(validateDOI('10.1234/test')).toBe(true);
    expect(validateDOI('10.1234/journal.2024.001')).toBe(true);
    expect(validateDOI('invalid')).toBe(false);
  });

  it('should normalize DOI', () => {
    expect(normalizeDOI('doi:10.1234/test')).toBe('10.1234/test');
    expect(normalizeDOI('https://doi.org/10.1234/test')).toBe('10.1234/test');
    expect(normalizeDOI('https://dx.doi.org/10.1234/test')).toBe('10.1234/test');
  });

  it('should extract DOI from text', () => {
    expect(extractDOI('10.1234/test')).toBe('10.1234/test');
    expect(extractDOI('doi:10.1234/test')).toBe('10.1234/test');
    expect(extractDOI('no doi here')).toBeNull();
  });
});
