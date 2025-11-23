/**
 * 插件版本检测API
 * GET /api/config/version?plugin=researchopia-zotero
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface VersionConfig {
  min_version: string;
  latest_version: string;
  download_url?: string;
  force_update?: boolean;
  message?: string;
  disabled_features?: string[];
  is_beta?: boolean; // 标记是否为测试版本
  beta_message?: string; // 灰度测试邀请信息（展示在/updates页面）
  beta_confirm_message?: string; // Zotero确认框信息
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 获取插件名称和用户邮箱参数
    const pluginName = request.nextUrl.searchParams.get('plugin') || 'researchopia-zotero';
    const userEmail = request.nextUrl.searchParams.get('email');
    
    // 查询版本配置
    const { data, error } = await supabase
      .from('plugin_version_config')
      .select('*')
      .eq('plugin_name', pluginName)
      .eq('enabled', true)
      .single();
    
    if (error || !data) {
      console.warn('[Version API] Config not found for plugin:', pluginName, error);
      // 返回默认配置，不阻止插件运行
      const response = NextResponse.json({
        min_version: '0.0.0',
        latest_version: '999.999.999',
        download_url: 'https://github.com/your-repo/releases',
        force_update: false,
        message: '版本检测服务暂时不可用',
        disabled_features: []
      } as VersionConfig);
      
      // 禁用缓存
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return response;
    }
    
    // 检查是否为灰度测试用户
    let latestVersion = data.latest_version;
    let isBetaTester = false;
    
    if (userEmail && data.beta_version && data.beta_testers) {
      // 检查用户是否在测试用户列表中
      isBetaTester = data.beta_testers.includes(userEmail);
      if (isBetaTester) {
        latestVersion = data.beta_version;
        console.log('[Version API] Beta tester detected:', userEmail, '-> version:', latestVersion);
      }
    }
    
    console.log('[Version API] Config fetched:', {
      plugin: pluginName,
      email: userEmail,
      is_beta: isBetaTester,
      min_version: data.min_version,
      latest_version: latestVersion,
      stable_version: data.latest_version
    });
    
    // 返回版本配置（测试用户看到 beta 版本）
    const response = NextResponse.json({
      min_version: data.min_version,
      latest_version: latestVersion,
      stable_version: data.latest_version, // 始终返回正式版本号
      download_url: data.download_url,
      force_update: data.force_update,
      message: data.update_message,
      disabled_features: data.disabled_features || [],
      is_beta: isBetaTester, // 标记是否为测试版本
      beta_message: isBetaTester ? data.beta_message : undefined, // 仅测试用户收到邀请信息（展示在/updates页面）
      beta_confirm_message: isBetaTester ? data.beta_confirm_message : undefined // 仅测试用户收到确认框信息
    } as VersionConfig);
    
    // 禁用缓存，确保生产环境实时更新
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
    
  } catch (error) {
    console.error('[Version API] Error:', error);
    // 出错时返回宽松配置
    const response = NextResponse.json({
      min_version: '0.0.0',
      latest_version: '999.999.999',
      download_url: 'https://github.com/your-repo/releases',
      force_update: false,
      message: '版本检测服务出错',
      disabled_features: []
    } as VersionConfig, { status: 200 });
    
    // 禁用缓存
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  }
}
