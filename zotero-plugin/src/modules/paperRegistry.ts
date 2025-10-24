/**
 * 论文注册模块
 * 负责自动检查和注册论文到Researchopia数据库
 */

import { logger } from "../utils/logger";
import { AuthManager } from "./auth";

// Supabase配置
const SUPABASE_URL = 'https://obcblvdtqhwrihoddlez.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4';

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
      const session = AuthManager.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/papers?doi=eq.${encodeURIComponent(doi)}&select=id,title,doi`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data && data.length > 0 ? data[0] : null;
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
      const session = AuthManager.getSession();
      const currentUser = AuthManager.getCurrentUser();
      if (!session || !currentUser) {
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
        // 如果只有年份(如"2023"),转换为YYYY-01-01
        if (/^\d{4}$/.test(publicationDate)) {
          publicationDate = `${publicationDate}-01-01`;
        }
        // 如果是其他格式,尝试解析(这里简化处理,只保留YYYY-MM-DD部分)
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)) {
          // 尝试提取年份
          const yearMatch = publicationDate.match(/\d{4}/);
          publicationDate = yearMatch ? `${yearMatch[0]}-01-01` : null;
        }
      }
      
      // 获取作者列表
      const creators = zoteroItem.getCreators();
      logger.log("[PaperRegistry] 📊 Raw creators:", creators);
      
      const authors = creators
        .filter((c: any) => {
          // creatorTypeID 1 = author (大多数情况)
          // 也可能是其他类型,所以保留所有创建者
          return true;
        })
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

      // 构建论文数据 - 注意authors如果为空数组会被数据库拒绝,需要转为null
      const paperData = {
        title,
        doi,
        abstract: abstract || null,
        authors: (authors && authors.length > 0) ? authors : null,
        journal: journal || null,
        publication_date: publicationDate || null,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      logger.log("[PaperRegistry] 📤 Creating paper with data:", paperData);

      const response = await fetch(`${SUPABASE_URL}/rest/v1/papers`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(paperData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // 如果是重复键错误(409冲突),说明论文已存在,直接查询返回
        if (response.status === 409) {
          logger.log("[PaperRegistry] ℹ️ Paper already exists (409 conflict), fetching existing record");
          const existingPaper = await this.checkPaperExists(doi);
          if (existingPaper) {
            this.registeredPapers.set(doi, true);
            return existingPaper;
          }
        }
        
        logger.error("[PaperRegistry] ❌ API Error:", { 
          status: response.status, 
          statusText: response.statusText,
          body: errorText 
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      logger.log("[PaperRegistry] ✅ Paper created successfully:", data);
      return data && data.length > 0 ? data[0] : null;
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
