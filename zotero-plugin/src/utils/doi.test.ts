/**
 * DOI工具函数测试
 * 验证共享库中的DOI验证和格式化功能
 */

import { describe, it, expect } from 'vitest';
import { normalizeDOI, extractDOI } from '@researchopia/shared';

describe('DOI Utils', () => {
  describe('normalizeDOI', () => {
    it('应该移除URL前缀', () => {
      expect(normalizeDOI('https://doi.org/10.1234/test')).toBe('10.1234/test');
      expect(normalizeDOI('http://dx.doi.org/10.1234/test')).toBe('10.1234/test');
    });

    it('应该保留原始大小写（DOI区分大小写）', () => {
      expect(normalizeDOI('10.1234/TEST')).toBe('10.1234/TEST');
    });

    it('应该处理已规范化的DOI', () => {
      expect(normalizeDOI('10.1234/test')).toBe('10.1234/test');
    });
  });

  describe('extractDOI', () => {
    it('应该从URL中提取DOI', () => {
      expect(extractDOI('https://doi.org/10.1234/test')).toBe('10.1234/test');
    });

    it('应该从文本中提取DOI', () => {
      expect(extractDOI('The paper DOI is 10.1234/test in the text')).toBe('10.1234/test');
    });

    it('没有DOI时应返回null', () => {
      expect(extractDOI('No DOI here')).toBeNull();
    });
  });
});
