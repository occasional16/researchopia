/**
 * 数据库仓储层统一导出
 */

// 基础仓储
export { BaseRepository } from './base';

// 类型定义
export type { Paper, SharedAnnotation, ReadingSession, User } from './types';

// 仓储实例
export { papersRepo, PapersRepository } from './repositories/papers';
export { annotationsRepo, AnnotationsRepository } from './repositories/annotations';
