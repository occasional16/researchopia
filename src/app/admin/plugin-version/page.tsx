/**
 * 插件版本控制管理页面
 * 路径: /admin/plugin-version
 * 权限: 仅管理员可访问
 */

'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface VersionConfig {
  id: string;
  plugin_name: string;
  min_version: string;
  latest_version: string;
  beta_version?: string;
  beta_testers?: string[];
  beta_message?: string; // 灰度测试邀请信息（展示在/updates页面）
  beta_confirm_message?: string; // Zotero确认框信息
  download_url: string;
  force_update: boolean;
  update_message: string;
  disabled_features: string[];
  enabled: boolean;
  updated_at: string;
}

const FEATURE_OPTIONS = [
  { value: 'reading-session', label: '文献共读' },
  { value: 'paper-evaluation', label: '论文评价' },
  { value: 'quick-search', label: '快捷搜索' },
];

export default function PluginVersionManagementPage() {
  const router = useRouter();
  const [config, setConfig] = useState<VersionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndLoadConfig();
  }, []);

  const checkAdminAndLoadConfig = async () => {
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setMessage({ type: 'error', text: 'Supabase未初始化' });
        setLoading(false);
        return;
      }
      
      // 检查是否是管理员
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // 简化权限检查：能访问/admin就是管理员
      setIsAdmin(true);

      // 加载配置
      const { data, error } = await supabase
        .from('plugin_version_config')
        .select('*')
        .eq('plugin_name', 'researchopia-zotero')
        .single();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error('Error loading config:', error);
      setMessage({ type: 'error', text: '加载配置失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setMessage(null);

    try {
      const supabase = getSupabase();
      if (!supabase) {
        setMessage({ type: 'error', text: 'Supabase未初始化' });
        setSaving(false);
        return;
      }
      
      const { error } = await supabase
        .from('plugin_version_config')
        .update({
          min_version: config.min_version,
          latest_version: config.latest_version,
          beta_version: config.beta_version || null,
          beta_testers: config.beta_testers || [],
          beta_message: config.beta_message || null,
          beta_confirm_message: config.beta_confirm_message || null,
          download_url: config.download_url,
          force_update: config.force_update,
          update_message: config.update_message,
          disabled_features: config.disabled_features,
          enabled: config.enabled,
        })
        .eq('id', config.id);

      if (error) throw error;

      setMessage({ type: 'success', text: '✅ 保存成功！新配置将在用户下次启动插件时生效' });
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: '❌ 保存失败: ' + (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleFeatureToggle = (feature: string) => {
    if (!config) return;
    
    const newFeatures = config.disabled_features.includes(feature)
      ? config.disabled_features.filter(f => f !== feature)
      : [...config.disabled_features, feature];
    
    setConfig({ ...config, disabled_features: newFeatures });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">无权访问</h1>
          <p className="text-gray-600">您没有权限访问此页面</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">配置未找到</h1>
          <p className="text-gray-600">插件版本配置不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 插件版本控制管理
          </h1>
          <p className="text-gray-600">
            管理Zotero插件的版本要求、功能开关和升级提示
          </p>
        </div>

        {/* 消息提示 */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 配置表单 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          {/* 版本号配置 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                最低支持版本 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={config.min_version}
                onChange={(e) => setConfig({ ...config, min_version: e.target.value })}
                placeholder="1.0.0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                低于此版本的插件将收到升级提示
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                最新版本 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={config.latest_version}
                onChange={(e) => setConfig({ ...config, latest_version: e.target.value })}
                placeholder="1.0.0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                当前最新的插件版本号
              </p>
            </div>
          </div>

          {/* 升级提示信息 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              升级提示信息
            </label>
            <textarea
              value={config.update_message || ''}
              onChange={(e) => setConfig({ ...config, update_message: e.target.value })}
              rows={6}
              placeholder="发现新版本！建议升级以获得最佳体验..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              支持多行文本，会显示在升级弹窗中
            </p>
          </div>

          {/* 功能开关 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              功能禁用（旧版本）
            </label>
            <div className="space-y-2">
              {FEATURE_OPTIONS.map((feature) => (
                <label
                  key={feature.value}
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={config.disabled_features.includes(feature.value)}
                    onChange={() => handleFeatureToggle(feature.value)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    {feature.label}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    ({feature.value})
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              勾选的功能将在旧版本中被禁用，提示用户升级
            </p>
          </div>

          {/* 灰度测试配置 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🧪 灰度测试版本
            </label>
            <input
              type="text"
              value={config.beta_version || ''}
              onChange={(e) => setConfig({ ...config, beta_version: e.target.value })}
              placeholder="0.5.0-beta"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent mb-3"
            />
            
            <label className="block text-sm font-medium text-gray-700 mb-2">
              测试用户邮箱（每行一个）
            </label>
            <textarea
              value={(config.beta_testers || []).join('\n')}
              onChange={(e) => setConfig({ 
                ...config, 
                beta_testers: e.target.value.split('\n').filter(email => email.trim())
              })}
              rows={5}
              placeholder="user1@example.com&#10;user2@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-mono text-sm mb-3"
            />
            
            <label className="block text-sm font-medium text-gray-700 mb-2">
              灰度测试邀请信息（展示在/updates页面）
            </label>
            <textarea
              value={config.beta_message || ''}
              onChange={(e) => setConfig({ ...config, beta_message: e.target.value })}
              rows={4}
              placeholder="欢迎体验 Researchopia 测试版！我们邀请您参与新功能的测试，您的反馈将帮助我们改进产品..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent mb-4"
            />
            
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zotero确认框信息
            </label>
            <textarea
              value={config.beta_confirm_message || ''}
              onChange={(e) => setConfig({ ...config, beta_confirm_message: e.target.value })}
              rows={3}
              placeholder="发现测试版本 v{version}，是否查看详情？"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-600">
              💡 此信息将在Zotero启动时的确认框中显示。支持 {'{version}'} 占位符显示版本号
            </p>
          </div>

          {/* 其他开关 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={config.force_update}
                onChange={(e) => setConfig({ ...config, force_update: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900">强制升级</span>
                <p className="text-xs text-gray-500">禁止旧版本运行</p>
              </div>
            </label>

            <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900">启用版本控制</span>
                <p className="text-xs text-gray-500">关闭则不进行检查</p>
              </div>
            </label>
          </div>

          {/* 元信息 */}
          <div className="pt-4 border-t border-gray-200 text-xs text-gray-500">
            <p>插件名称: {config.plugin_name}</p>
            <p>最后更新: {new Date(config.updated_at).toLocaleString('zh-CN')}</p>
          </div>

          {/* 保存按钮 */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '保存中...' : '💾 保存配置'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              🔄 重置
            </button>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">📖 使用说明</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>最低支持版本</strong>：低于此版本会收到升级提示</li>
            <li>• <strong>强制升级</strong>：启用后旧版本将无法使用，谨慎开启</li>
            <li>• <strong>功能禁用</strong>：可选择性禁用旧版本的部分功能</li>
            <li>• <strong>生效时间</strong>：配置保存后，用户下次启动插件时生效</li>
            <li>• <strong>紧急回滚</strong>：如需回滚，将最低版本改回旧版本号即可</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
