/*
  Annotation Converter Demo Page
  Demonstrates the multi-platform annotation conversion system
*/

'use client';

import React, { useState, useEffect } from 'react';
import { PlatformType, UniversalAnnotation } from '@/types/annotation-protocol';
import { 
  AnnotationConverterManager, 
  type ConversionResult 
} from '@/lib/annotation-converters/converter-manager';

// 示例数据生成器
const generateSampleData = (platform: PlatformType) => {
  switch (platform) {
    case 'mendeley':
      return [{
        id: 'mendeley-123',
        type: 'highlight' as const,
        document_id: 'doc-456',
        page: 1,
        x: 100,
        y: 200,
        width: 200,
        height: 20,
        text: 'This is a sample highlighted text from Mendeley',
        note: 'This is my comment on the highlighted text',
        color: { r: 1, g: 1, b: 0 },
        author: {
          id: 'user-789',
          name: 'John Doe',
          email: 'john@example.com'
        },
        privacy_level: 'private' as const,
        created: new Date().toISOString(),
        last_modified: new Date().toISOString(),
        tags: ['important', 'research']
      }];

    case 'hypothesis':
      return [{
        id: 'hypothesis-456',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        user: 'acct:user@hypothes.is',
        uri: 'https://example.com/article',
        text: 'This is my annotation comment',
        tags: ['annotation', 'web'],
        target: [{
          source: 'https://example.com/article',
          selector: [{
            type: 'TextQuoteSelector',
            exact: 'This is the selected text from the webpage'
          }]
        }],
        permissions: {
          read: ['group:__world__'],
          admin: ['acct:user@hypothes.is'],
          update: ['acct:user@hypothes.is'],
          delete: ['acct:user@hypothes.is']
        },
        user_info: {
          display_name: 'Jane Smith'
        },
        hidden: false,
        flagged: false,
        group: '__world__'
      }];

    case 'adobe-reader':
      return [{
        id: 'adobe-789',
        type: 'Highlight' as const,
        page: 2,
        rect: [100, 200, 300, 220],
        contents: 'This is a PDF annotation',
        quadPoints: [100, 220, 300, 220, 100, 200, 300, 200],
        color: [1, 1, 0],
        opacity: 1.0,
        author: 'PDF User',
        subject: 'Highlight',
        creationDate: 'D:20241201120000+00\'00',
        modDate: 'D:20241201120000+00\'00',
        markup: {
          text: 'Selected text from PDF document',
          quadPoints: [100, 220, 300, 220, 100, 200, 300, 200]
        }
      }];

    default:
      return [];
  }
};

export default function ConverterDemo() {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>('mendeley');
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [convertedData, setConvertedData] = useState<UniversalAnnotation[]>([]);
  const [conversionResult, setConversionResult] = useState<ConversionResult<UniversalAnnotation[]> | null>(null);
  const [targetPlatform, setTargetPlatform] = useState<PlatformType>('hypothesis');
  const [exportFormat, setExportFormat] = useState('json');
  const [exportedData, setExportedData] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 创建转换器管理器实例
  const converterManager = new AnnotationConverterManager();
  const supportedPlatforms = converterManager.getSupportedPlatforms();
  const stats = converterManager.getConversionStats();

  // 生成示例数据
  useEffect(() => {
    const data = generateSampleData(selectedPlatform);
    setSourceData(data);
  }, [selectedPlatform]);

  // 执行转换
  const handleConvert = async () => {
    setLoading(true);
    try {
      const result = await converterManager.fromPlatform(
        selectedPlatform,
        sourceData
      );
      
      setConversionResult(result);
      setConvertedData(result.data || []);
    } catch (error) {
      console.error('Conversion error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 平台间转换
  const handleCrossPlatformConvert = async () => {
    setLoading(true);
    try {
      const result = await converterManager.convertBetweenPlatforms(
        selectedPlatform,
        targetPlatform,
        sourceData
      );
      
      console.log('Cross-platform conversion result:', result);
    } catch (error) {
      console.error('Cross-platform conversion error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 导出数据
  const handleExport = async () => {
    try {
      const exported = await converterManager.exportToFormat(
        selectedPlatform,
        sourceData,
        exportFormat
      );
      setExportedData(exported);
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  // 获取平台支持的格式
  const getSupportedFormats = (platform: PlatformType) => {
    return converterManager.getSupportedFormats(platform);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔄 多平台标注转换器演示
          </h1>
          <p className="text-gray-600">
            演示Researchopia如何在不同学术标注平台之间进行数据转换和同步
          </p>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">支持平台</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.supportedPlatforms}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">转换器数量</h3>
            <p className="text-2xl font-bold text-green-600">{stats.totalConverters}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">支持验证</h3>
            <p className="text-2xl font-bold text-purple-600">
              {stats.platforms.filter(p => p.hasValidation).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">支持导出</h3>
            <p className="text-2xl font-bold text-orange-600">
              {stats.platforms.filter(p => p.hasExport).length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：源数据和转换 */}
          <div className="space-y-6">
            {/* 平台选择 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">1. 选择源平台</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    源平台
                  </label>
                  <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value as PlatformType)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {supportedPlatforms.map(platform => (
                      <option key={platform} value={platform}>
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-gray-50 p-3 rounded text-sm">
                  <strong>支持的格式:</strong>{' '}
                  {getSupportedFormats(selectedPlatform).join(', ')}
                </div>
              </div>
            </div>

            {/* 源数据预览 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">2. 源数据预览</h2>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-64 text-sm">
                <pre>{JSON.stringify(sourceData, null, 2)}</pre>
              </div>
            </div>

            {/* 转换操作 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">3. 执行转换</h2>
              <div className="space-y-4">
                <button
                  onClick={handleConvert}
                  disabled={loading}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? '转换中...' : '转换为通用格式'}
                </button>

                <div className="flex space-x-2">
                  <select
                    value={targetPlatform}
                    onChange={(e) => setTargetPlatform(e.target.value as PlatformType)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  >
                    {supportedPlatforms.map(platform => (
                      <option key={platform} value={platform}>
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCrossPlatformConvert}
                    disabled={loading}
                    className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:opacity-50"
                  >
                    跨平台转换
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：转换结果 */}
          <div className="space-y-6">
            {/* 转换结果 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">4. 转换结果</h2>
              
              {conversionResult && (
                <div className="space-y-4">
                  {/* 统计信息 */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-sm text-gray-600">成功</p>
                      <p className="text-lg font-bold text-green-600">
                        {conversionResult.processed}
                      </p>
                    </div>
                    <div className="bg-red-50 p-3 rounded">
                      <p className="text-sm text-gray-600">失败</p>
                      <p className="text-lg font-bold text-red-600">
                        {conversionResult.failed}
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded">
                      <p className="text-sm text-gray-600">警告</p>
                      <p className="text-lg font-bold text-yellow-600">
                        {conversionResult.warnings?.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* 错误信息 */}
                  {conversionResult.errors && conversionResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded">
                      <h4 className="font-medium text-red-800 mb-2">错误:</h4>
                      <ul className="text-sm text-red-700 list-disc list-inside">
                        {conversionResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 警告信息 */}
                  {conversionResult.warnings && conversionResult.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                      <h4 className="font-medium text-yellow-800 mb-2">警告:</h4>
                      <ul className="text-sm text-yellow-700 list-disc list-inside">
                        {conversionResult.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 转换后数据 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">5. 通用格式数据</h2>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-64 text-sm">
                <pre>{JSON.stringify(convertedData, null, 2)}</pre>
              </div>
            </div>

            {/* 导出功能 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">6. 数据导出</h2>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  >
                    {getSupportedFormats(selectedPlatform).map(format => (
                      <option key={format} value={format}>
                        {format.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleExport}
                    className="bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-600"
                  >
                    导出
                  </button>
                </div>

                {exportedData && (
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-32 text-sm">
                    <pre>{exportedData}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 平台详细信息 */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">平台支持详情</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    平台
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    支持格式
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    验证
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    导出
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.platforms.map(platform => (
                  <tr key={platform.platform}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {platform.platform.charAt(0).toUpperCase() + platform.platform.slice(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {platform.supportedFormats.join(', ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {platform.hasValidation ? '✅' : '❌'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {platform.hasExport ? '✅' : '❌'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}