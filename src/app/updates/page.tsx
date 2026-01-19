'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface VersionConfig {
  plugin_name: string;
  min_version: string;
  latest_version: string;
  stable_version?: string;
  download_url: string;
  force_update: boolean;
  message: string;
  disabled_features: string[];
  enabled: boolean;
  is_beta?: boolean;
  beta_message?: string;
}

type ProductType = 'researchopia-zotero' | 'researchopia-extension';

const PRODUCTS: { id: ProductType; name: string; icon: string; title: string; subtitle: string }[] = [
  { 
    id: 'researchopia-zotero', 
    name: 'Zotero 插件', 
    icon: '📚',
    title: 'Researchopia Zotero 插件更新',
    subtitle: '获取最新版本以享受更好的体验'
  },
  { 
    id: 'researchopia-extension', 
    name: '浏览器扩展', 
    icon: '🌐',
    title: 'Researchopia 浏览器扩展更新',
    subtitle: '获取最新版本以享受更好的体验'
  },
];

function UpdatesContent() {
  const searchParams = useSearchParams();
  const pluginParam = searchParams.get('plugin') as ProductType | null;
  
  const [activeProduct, setActiveProduct] = useState<ProductType>(
    pluginParam && PRODUCTS.some(p => p.id === pluginParam) ? pluginParam : 'researchopia-zotero'
  );
  const [config, setConfig] = useState<VersionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const currentProduct = PRODUCTS.find(p => p.id === activeProduct)!;

  // Feature name mapping for both products
  const featureNames: Record<string, string> = {
    'reading-session': '文献共读',
    'paper-evaluation': '论文评价',
    'quick-search': '快捷搜索',
    'sidebar': '侧边栏',
    'popup': '弹出窗口',
    'annotation-sync': '批注同步',
  };

  useEffect(() => {
    const supabase = createSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const fetchConfig = async (email: string, product: ProductType) => {
      let apiUrl = `/api/config/version?plugin=${product}`;
      if (email) {
        apiUrl += `&email=${encodeURIComponent(email)}`;
      }
      
      const configRes = await fetch(apiUrl);
      const configData = await configRes.json();
      setConfig(configData);
    };

    const fetchUserAndConfig = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        let email = '';
        let loggedIn = false;
        
        if (session?.user) {
          email = session.user.email || '';
          loggedIn = !!email;
          setIsLoggedIn(loggedIn);
          setUserEmail(email);
        }
        
        await fetchConfig(email, activeProduct);
      } catch (err) {
        console.error('Failed to fetch user or version config:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserAndConfig();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      let email = '';
      let loggedIn = false;
      
      if (session?.user) {
        email = session.user.email || '';
        loggedIn = !!email;
      }
      
      setIsLoggedIn(loggedIn);
      setUserEmail(email);
      
      await fetchConfig(email, activeProduct);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [activeProduct]);

  const handleProductChange = (productId: ProductType) => {
    setActiveProduct(productId);
    setLoading(true);
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set('plugin', productId);
    window.history.replaceState({}, '', url.toString());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-2xl bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">无法获取版本信息</h2>
          <p className="text-gray-600">请稍后再试或联系技术支持</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Product Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden">
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
        </div>

        {/* Title Area */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{currentProduct.icon === '📚' ? '🔔' : '🌐'}</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {currentProduct.title}
          </h1>
          <p className="text-lg text-gray-600">{currentProduct.subtitle}</p>
        </div>

        {/* Login prompt (shown when not logged in, Zotero only) */}
        {!isLoggedIn && activeProduct === 'researchopia-zotero' && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg shadow-lg mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-400 to-indigo-400 text-white p-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>🔐</span>
                登录查看完整信息
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-800 text-lg">
                如果您是内测用户，请登录Zotero插件后访问本页面，即可查看专属测试版邀请和详细信息。
              </p>
            </div>
          </div>
        )}
        
        {/* Beta invitation (Zotero only for now) */}
        {config.is_beta && config.beta_message && isLoggedIn && activeProduct === 'researchopia-zotero' && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow-lg mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white p-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>🧪</span>
                灰度测试邀请
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-lg">
                {config.beta_message}
              </p>
              <div className="mt-4 bg-white p-4 rounded border border-yellow-300">
                <p className="text-sm text-gray-600">
                  💡 <strong>您已被邀请参与测试版本 v{config.latest_version}</strong> 的体验。
                  测试版本可能包含未完全稳定的新功能，请谨慎使用并及时反馈问题。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Version Info Card */}
        <div className="bg-white rounded-lg shadow-lg mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>{config.is_beta ? '🧪' : '✅'}</span>
              版本信息
            </h2>
          </div>
          <div className="p-6">
            <div className={`grid ${config.is_beta ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
              {config.is_beta && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">测试版本</h3>
                  <p className="text-3xl font-bold text-yellow-600 flex items-center gap-2">
                    v{config.latest_version}
                    <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Beta
                    </span>
                  </p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  {config.is_beta ? '正式版本' : '最新版本'}
                </h3>
                <p className="text-3xl font-bold text-blue-600">
                  v{config.is_beta ? config.stable_version : config.latest_version}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">最低支持版本</h3>
                <p className="text-3xl font-bold text-gray-700">v{config.min_version}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Download Button */}
        {/* {config.download_url && (
          <div className="bg-white rounded-lg shadow-lg mb-6 p-6 text-center">
            <a
              href={config.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors text-lg"
            >
              <span>⬇️</span>
              {activeProduct === 'researchopia-extension' ? '前往商店下载' : '下载最新版本'}
            </a>
          </div>
        )} */}

        {/* Update Notes */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">更新说明</h2>
          </div>
          <div className="p-6 text-gray-700 markdown-content markdown-content-compact leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {config.message || '*暂无更新说明*'}
            </ReactMarkdown>
          </div>
        </div>

        {/* Disabled Features */}
        {config.disabled_features && config.disabled_features.length > 0 && (
          <div className="mt-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg shadow-lg">
            <div className="p-6 border-b border-yellow-200">
              <h2 className="text-2xl font-bold text-yellow-800 flex items-center gap-2">
                <span>⚠️</span>
                部分功能已在旧版本中禁用
              </h2>
            </div>
            <div className="p-6">
              <p className="text-yellow-800 mb-3">以下功能仅在最新版本中可用：</p>
              <ul className="list-disc list-inside space-y-1 text-yellow-700">
                {config.disabled_features.map((feature, index) => (
                  <li key={index}>{featureNames[feature] || feature}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UpdatesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    }>
      <UpdatesContent />
    </Suspense>
  );
}
