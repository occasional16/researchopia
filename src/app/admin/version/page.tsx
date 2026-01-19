/**
 * Version Control Management Page
 * Path: /admin/version
 * Permission: Admin only
 * 
 * Supports both Zotero Plugin and Browser Extension version management
 */

'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import MarkdownEditor from '@/components/MarkdownEditor';

interface VersionConfig {
  id: string;
  plugin_name: string;
  min_version: string;
  latest_version: string;
  beta_version?: string;
  beta_testers?: string[];
  beta_message?: string;
  beta_confirm_message?: string;
  download_url: string;
  force_update: boolean;
  update_message: string;
  disabled_features: string[];
  enabled: boolean;
  updated_at: string;
}

type ProductType = 'researchopia-zotero' | 'researchopia-extension';

const PRODUCTS: { id: ProductType; name: string; icon: string; description: string }[] = [
  { 
    id: 'researchopia-zotero', 
    name: 'Zotero 插件', 
    icon: '📚',
    description: '管理 Zotero 插件的版本要求、功能开关和升级提示'
  },
  { 
    id: 'researchopia-extension', 
    name: '浏览器扩展', 
    icon: '🌐',
    description: '管理浏览器扩展的版本要求和升级提示'
  },
];

const ZOTERO_FEATURE_OPTIONS = [
  { value: 'reading-session', label: '文献共读' },
  { value: 'paper-evaluation', label: '论文评价' },
  { value: 'quick-search', label: '快捷搜索' },
];

const EXTENSION_FEATURE_OPTIONS = [
  { value: 'sidebar', label: '侧边栏' },
  { value: 'popup', label: '弹出窗口' },
  { value: 'annotation-sync', label: '批注同步' },
];

export default function VersionManagementPage() {
  const searchParams = useSearchParams();
  
  const [activeProduct, setActiveProduct] = useState<ProductType>(
    (searchParams.get('product') as ProductType) || 'researchopia-zotero'
  );
  const [config, setConfig] = useState<VersionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [activeProduct]);

  const loadConfig = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setMessage({ type: 'error', text: 'Supabase未初始化' });
        setLoading(false);
        return;
      }
      
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Trigger auth modal instead of redirecting to non-existent page
        window.dispatchEvent(new CustomEvent('showAuthModal', { detail: { mode: 'login' } }));
        setLoading(false);
        return;
      }

      // Simplified permission check: can access /admin = is admin
      setIsAdmin(true);

      // Load config for selected product
      const { data, error } = await supabase
        .from('plugin_version_config')
        .select('*')
        .eq('plugin_name', activeProduct)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No record found - need to create one
          setMessage({ type: 'error', text: `尚未配置 ${PRODUCTS.find(p => p.id === activeProduct)?.name} 的版本信息，请先在数据库中添加记录` });
          setConfig(null);
        } else {
          throw error;
        }
      } else {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setMessage({ type: 'error', text: '加载配置失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (productId: ProductType) => {
    setActiveProduct(productId);
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set('product', productId);
    window.history.replaceState({}, '', url.toString());
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

      setMessage({ type: 'success', text: '✅ 保存成功！新配置将在用户下次检查时生效' });
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

  const featureOptions = activeProduct === 'researchopia-zotero' 
    ? ZOTERO_FEATURE_OPTIONS 
    : EXTENSION_FEATURE_OPTIONS;

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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 版本控制管理
          </h1>
          <p className="text-gray-600">
            管理 Researchopia 各产品的版本要求、功能开关和升级提示
          </p>
        </div>

        {/* Product Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {PRODUCTS.map((product) => (
              <button
                key={product.id}
                onClick={() => handleProductChange(product.id)}
                className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                  activeProduct === product.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl mr-2">{product.icon}</span>
                {product.name}
              </button>
            ))}
          </div>
          <div className="p-4 bg-gray-50 text-sm text-gray-600">
            {PRODUCTS.find(p => p.id === activeProduct)?.description}
          </div>
        </div>

        {/* Message */}
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

        {/* Config not found */}
        {!config && !message && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-yellow-800 mb-2">配置未找到</h2>
            <p className="text-yellow-700">
              请先在数据库中为 {PRODUCTS.find(p => p.id === activeProduct)?.name} 添加版本配置记录
            </p>
          </div>
        )}

        {/* Config Form */}
        {config && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            {/* Version Numbers */}
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
                  低于此版本将收到升级提示
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
                  当前最新版本号
                </p>
              </div>
            </div>

            {/* Download URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                下载地址
              </label>
              <input
                type="text"
                value={config.download_url || ''}
                onChange={(e) => setConfig({ ...config, download_url: e.target.value })}
                placeholder={activeProduct === 'researchopia-extension' 
                  ? 'https://chromewebstore.google.com/detail/...' 
                  : 'https://github.com/...'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Update Message */}
            <div>
              <MarkdownEditor
                value={config.update_message || ''}
                onChange={(value) => setConfig({ ...config, update_message: value })}
                label="升级提示信息"
                placeholder="发现新版本！建议升级以获得最佳体验...\n\n支持 Markdown 格式:\n- **粗体**\n- [链接](url)"
                minHeight="200px"
                helperText="此信息将在升级弹窗和 /updates 页面中显示"
              />
            </div>

            {/* Feature Toggles */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                功能禁用（旧版本）
              </label>
              <div className="space-y-2">
                {featureOptions.map((feature) => (
                  <label
                    key={feature.value}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={config.disabled_features?.includes(feature.value) || false}
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

            {/* Beta Testing (Zotero only for now) */}
            {activeProduct === 'researchopia-zotero' && (
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
                
                <MarkdownEditor
                  value={config.beta_message || ''}
                  onChange={(value) => setConfig({ ...config, beta_message: value })}
                  label="灰度测试邀请信息（展示在/updates页面）"
                  placeholder="欢迎体验 Researchopia 测试版！\n\n您的反馈将帮助我们改进产品..."
                  minHeight="150px"
                  className="mb-4"
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
                  💡 支持 {'{version}'} 占位符显示版本号
                </p>
              </div>
            )}

            {/* Switches */}
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

            {/* Meta Info */}
            <div className="pt-4 border-t border-gray-200 text-xs text-gray-500">
              <p>产品标识: {config.plugin_name}</p>
              <p>最后更新: {new Date(config.updated_at).toLocaleString('zh-CN')}</p>
            </div>

            {/* Save Button */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '保存中...' : '💾 保存配置'}
              </button>
              <button
                onClick={() => loadConfig()}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                🔄 重置
              </button>
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">📖 使用说明</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>最低支持版本</strong>：低于此版本会收到升级提示</li>
            <li>• <strong>强制升级</strong>：启用后旧版本将无法使用，谨慎开启</li>
            <li>• <strong>功能禁用</strong>：可选择性禁用旧版本的部分功能</li>
            <li>• <strong>生效时间</strong>：配置保存后，用户下次检查时生效</li>
            <li>• <strong>紧急回滚</strong>：如需回滚，将最低版本改回旧版本号即可</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
