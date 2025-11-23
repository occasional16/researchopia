/**
 * Papers仓储类
 */
import { BaseRepository } from '../base';
import type { Paper } from '../types';

export class PapersRepository extends BaseRepository<Paper> {
  constructor() {
    super('papers');
  }

  /**
   * 根据DOI查找论文
   */
  async findByDOI(doi: string): Promise<Paper | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('doi', doi)
      .single();

    if (error) {
      console.error('Error finding paper by DOI:', error);
      return null;
    }

    return data as Paper;
  }

  /**
   * 搜索论文（按标题或关键词）
   */
  async search(query: string, limit = 20): Promise<Paper[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .or(`title.ilike.%${query}%,keywords.cs.{${query}}`)
      .limit(limit);

    if (error) {
      console.error('Error searching papers:', error);
      return [];
    }

    return data as Paper[];
  }

  /**
   * 获取最新论文列表
   */
  async getRecent(limit = 10): Promise<Paper[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent papers:', error);
      return [];
    }

    return data as Paper[];
  }

  /**
   * 检查DOI是否已存在
   */
  async existsByDOI(doi: string): Promise<boolean> {
    const paper = await this.findByDOI(doi);
    return paper !== null;
  }

  /**
   * 批量创建论文
   */
  async createBatch(papers: Partial<Paper>[]): Promise<Paper[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(papers)
      .select();

    if (error) {
      console.error('Error creating papers in batch:', error);
      return [];
    }

    return data as Paper[];
  }
}

// 导出单例实例
export const papersRepo = new PapersRepository();
