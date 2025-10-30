/**
 * 论文注册模块
 * 负责自动检查和注册论文到Researchopia数据库
 */

import { logger } from "../utils/logger";
import { AuthManager } from "./auth";
import { apiGet, apiPost } from "../utils/apiClient";

export class PaperRegistry {
  private static registeredPapers = new Map<string, boolean>(); // DOI -> 是否已注册

  /**
   * 确保论文已在数据库中注册
   * 如果论文不存在,会自动从Zotero元数据创建基本记录
   */
  public static async ensurePaperRegistered(zoteroItem: any): Promise<{ success: boolean; paperId?: string; error?: string }> {
    try {
      // 获取DOI
      const doi = zoteroItem.getField('DOI');
      if (!doi) {
        return { success: false, error: '该文献没有DOI，无法自动注册' };
      }

      logger.log("[PaperRegistry] 📋 Checking paper registration for DOI:", doi);

      // 检查缓存
      if (this.registeredPapers.has(doi)) {
        logger.log("[PaperRegistry] ✅ Paper already registered (cached)");
        return { success: true };
      }

      // 检查论文是否已在数据库中
      const existingPaper = await this.checkPaperExists(doi);
      if (existingPaper) {
        logger.log("[PaperRegistry] ✅ Paper already exists in database:", existingPaper.id);
        this.registeredPapers.set(doi, true);
        return { success: true, paperId: existingPaper.id };
      }

      // 论文不存在,创建新记录
      logger.log("[PaperRegistry] 📝 Paper not found, creating new record...");
      const newPaper = await this.createPaperFromZotero(zoteroItem);
      
      if (newPaper) {
        logger.log("[PaperRegistry] ✅ Paper registered successfully:", newPaper.id);
        this.registeredPapers.set(doi, true);
        return { success: true, paperId: newPaper.id };
      } else {
        return { success: false, error: '创建论文记录失败' };
      }
    } catch (error) {
      logger.error("[PaperRegistry] ❌ Error ensuring paper registered:", error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 检查论文是否已存在于数据库
   */
  private static async checkPaperExists(doi: string): Promise<any | null> {
    try {
      const result = await apiGet(`/api/proxy/papers/check?doi=${encodeURIComponent(doi)}`);
      return result.data?.exists ? result.data.paper : null;
    } catch (error) {
      logger.error("[PaperRegistry] ❌ Error checking paper existence:", error);
      return null;
    }
  }

  /**
   * 从Zotero条目创建新的论文记录
   */
  private static async createPaperFromZotero(zoteroItem: any): Promise<any | null> {
    try {
      const currentUser = AuthManager.getCurrentUser();
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      // 从Zotero条目提取元数据
      const title = zoteroItem.getField('title');
      const doi = zoteroItem.getField('DOI');
      const abstract = zoteroItem.getField('abstractNote') || '';
      let publicationDate = zoteroItem.getField('date') || null;
      const journal = zoteroItem.getField('publicationTitle') || '';
      
      // 转换日期格式 - PostgreSQL的date类型需要YYYY-MM-DD格式
      if (publicationDate) {
        if (/^\d{4}$/.test(publicationDate)) {
          publicationDate = `${publicationDate}-01-01`;
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)) {
          const yearMatch = publicationDate.match(/\d{4}/);
          publicationDate = yearMatch ? `${yearMatch[0]}-01-01` : null;
        }
      }
      
      // 获取作者列表
      const creators = zoteroItem.getCreators();
      logger.log("[PaperRegistry] 📊 Raw creators:", creators);
      
      const authors = creators
        .map((c: any) => {
          if (c.firstName && c.lastName) {
            return `${c.firstName} ${c.lastName}`;
          } else if (c.lastName) {
            return c.lastName;
          }
          return c.name || '';
        })
        .filter((name: string) => name);

      logger.log("[PaperRegistry] 📊 Extracted authors:", { count: authors.length, authors });

      // 构建论文数据
      const paperData = {
        title,
        doi,
        abstract: abstract || null,
        authors: (authors && authors.length > 0) ? authors : null,
        journal: journal || null,
        publication_date: publicationDate || null,
      };

      logger.log("[PaperRegistry] 📤 Creating paper with data:", paperData);

      const result = await apiPost('/api/proxy/papers/register', paperData);
      
      if (result.success && result.data) {
        logger.log("[PaperRegistry] ✅ Paper created successfully:", result.data);
        return result.data.paper;
      } else {
        logger.error("[PaperRegistry] ❌ API Error:", result.message);
        return null;
      }
    } catch (error) {
      logger.error("[PaperRegistry] ❌ Error creating paper:", { 
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * 清除缓存
   */
  public static clearCache(): void {
    this.registeredPapers.clear();
    logger.log("[PaperRegistry] 🧹 Cache cleared");
  }
}
