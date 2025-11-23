/**
 * Annotations仓储类
 */
import { BaseRepository } from '../base';
import type { SharedAnnotation } from '../types';

export class AnnotationsRepository extends BaseRepository<SharedAnnotation> {
  constructor() {
    super('shared_annotations');
  }

  /**
   * 根据论文ID查找标注列表
   */
  async findByPaperId(paperId: number, limit = 100): Promise<SharedAnnotation[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error finding annotations by paper_id:', error);
      return [];
    }

    return data as SharedAnnotation[];
  }

  /**
   * 根据用户ID查找标注列表
   */
  async findByUserId(userId: string, limit = 100): Promise<SharedAnnotation[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error finding annotations by user_id:', error);
      return [];
    }

    return data as SharedAnnotation[];
  }

  /**
   * 分页获取论文的标注
   */
  async findByPaperIdPaginated(
    paperId: number,
    page = 1,
    pageSize = 20
  ): Promise<{ data: SharedAnnotation[]; total: number }> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const [dataResult, countResult] = await Promise.all([
      this.client
        .from(this.tableName)
        .select('*')
        .eq('paper_id', paperId)
        .order('created_at', { ascending: false })
        .range(from, to),
      this.client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('paper_id', paperId),
    ]);

    if (dataResult.error) {
      console.error('Error fetching paginated annotations:', dataResult.error);
      return { data: [], total: 0 };
    }

    return {
      data: dataResult.data as SharedAnnotation[],
      total: countResult.count || 0,
    };
  }

  /**
   * 批量删除标注
   */
  async deleteBatch(ids: string[]): Promise<boolean> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error deleting annotations in batch:', error);
      return false;
    }

    return true;
  }
}

// 导出单例实例
export const annotationsRepo = new AnnotationsRepository();
