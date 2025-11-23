/**
 * 基础仓储类
 * 提供通用的CRUD操作
 */
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export abstract class BaseRepository<T> {
  protected client: SupabaseClient;
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  /**
   * 根据ID查找记录
   */
  async findById(id: string | number): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error finding ${this.tableName} by id:`, error);
      return null;
    }

    return data as T;
  }

  /**
   * 查找所有记录
   */
  async findAll(limit = 100, offset = 0): Promise<T[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(`Error finding all ${this.tableName}:`, error);
      return [];
    }

    return data as T[];
  }

  /**
   * 创建记录
   */
  async create(record: Partial<T>): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error(`Error creating ${this.tableName}:`, error);
      return null;
    }

    return data as T;
  }

  /**
   * 更新记录
   */
  async update(id: string | number, updates: Partial<T>): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${this.tableName}:`, error);
      return null;
    }

    return data as T;
  }

  /**
   * 删除记录
   */
  async delete(id: string | number): Promise<boolean> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting ${this.tableName}:`, error);
      return false;
    }

    return true;
  }

  /**
   * 统计记录数量
   */
  async count(): Promise<number> {
    const { count, error } = await this.client
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`Error counting ${this.tableName}:`, error);
      return 0;
    }

    return count || 0;
  }
}
