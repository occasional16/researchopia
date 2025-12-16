/**
 * 标注共享模块 - 常量配置
 * 
 * 此文件包含标注共享功能的所有共享常量，
 * 避免在多个文件中重复定义相同的配置。
 */

import type { ShareModeButton } from './types';

/**
 * 4种共享模式按钮配置
 * 
 * 注意: 顺序决定了按钮显示顺序
 */
export const SHARE_MODES: ShareModeButton[] = [
  {
    id: 'public',
    label: '公开',
    icon: '🌐',
    color: '#2196F3',
    title: '公开共享 - 显示真实用户名'
  },
  {
    id: 'anonymous',
    label: '匿名',
    icon: '🎭',
    color: '#FF9800',
    title: '匿名共享 - 显示"匿名用户"'
  },
  {
    id: 'private',
    label: '私密',
    icon: '🔒',
    color: '#9E9E9E',
    title: '私密共享 - 仅自己可见'
  },
  {
    id: null,
    label: '取消',
    icon: '🗑️',
    color: '#F44336',
    title: '取消共享 - 仅本地保存'
  }
];

/**
 * 缓存过期时间 (毫秒)
 */
export const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5分钟

/**
 * 共享按钮尺寸配置
 */
export const SHARE_BUTTON_SIZE = {
  width: '32px',
  height: '32px',
  fontSize: '16px',
  padding: '4px'
};

/**
 * 共享状态徽章颜色
 */
export const SHARE_STATUS_COLORS = {
  public: '#2196F3',    // 蓝色 - 公开
  anonymous: '#FF9800', // 橙色 - 匿名
  private: '#9E9E9E',   // 灰色 - 私密
  unshared: '#E0E0E0'   // 浅灰 - 未共享
};

/**
 * 共享状态图标
 */
export const SHARE_STATUS_ICONS = {
  public: '🌐',
  anonymous: '🎭',
  private: '🔒',
  unshared: '📌'
};

/**
 * API 端点
 */
export const API_ENDPOINTS = {
  annotations: '/api/proxy/annotations',
  likes: '/api/proxy/likes',
  comments: '/api/proxy/comments',
  documents: '/api/proxy/documents'
};
