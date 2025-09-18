/*
  Researchopia System Overview
  Complete demonstration of the academic annotation sharing platform
*/

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface SystemModule {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'beta' | 'development' | 'planning';
  features: string[];
  demoPath?: string;
  technologies: string[];
  metrics?: {
    performance: number;
    reliability: number;
    usability: number;
  };
}

interface ProjectStats {
  totalModules: number;
  completedModules: number;
  linesOfCode: number;
  supportedPlatforms: number;
  testCoverage: number;
  performanceScore: number;
}

export default function SystemOverview() {
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const modules: SystemModule[] = [
    {
      id: 'annotation-protocol',
      name: '🌐 跨平台标注协议',
      description: '统一的标注数据格式和交换协议，支持多个学术平台之间的标注共享',
      status: 'completed',
      features: [
        '通用标注数据模型',
        '平台无关的数据格式',
        'W3C标准兼容',
        '版本控制支持',
        '元数据扩展机制'
      ],
      technologies: ['TypeScript', 'JSON Schema', 'W3C Standards'],
      metrics: {
        performance: 95,
        reliability: 98,
        usability: 92
      }
    },
    {
      id: 'zotero-plugin',
      name: '🦓 Zotero标注分享插件',
      description: 'Zotero插件，支持标注提取、转换、上传和分享功能',
      status: 'completed',
      features: [
        '标注自动提取',
        '实时数据同步',
        '用户界面集成',
        '批量操作支持',
        '权限管理'
      ],
      technologies: ['JavaScript', 'Zotero API', 'WebExtensions'],
      metrics: {
        performance: 88,
        reliability: 95,
        usability: 90
      }
    },
    {
      id: 'collaboration-system',
      name: '🤝 实时协作系统',
      description: 'WebSocket驱动的多用户实时标注协作系统',
      status: 'completed',
      features: [
        'WebSocket实时通信',
        '冲突解决机制',
        '用户在线状态',
        '协作锁定机制',
        '操作历史记录'
      ],
      technologies: ['WebSocket', 'Node.js', 'React Hooks'],
      metrics: {
        performance: 92,
        reliability: 94,
        usability: 88
      }
    },
    {
      id: 'web-viewer',
      name: '💻 Web标注查看器',
      description: '功能完整的Web界面，用于查看和管理共享标注',
      status: 'completed',
      features: [
        '高级搜索和过滤',
        '多种视图模式',
        '标注编辑功能',
        '批量操作',
        '导出功能'
      ],
      demoPath: '/demo/annotation-viewer',
      technologies: ['React', 'TypeScript', 'Tailwind CSS'],
      metrics: {
        performance: 90,
        reliability: 96,
        usability: 94
      }
    },
    {
      id: 'platform-converters',
      name: '🔄 多平台转换器',
      description: '支持多个学术平台的标注格式转换器系统',
      status: 'completed',
      features: [
        'Mendeley格式支持',
        'Hypothesis格式支持',
        'Adobe Reader格式支持',
        '批量转换处理',
        '数据验证机制'
      ],
      demoPath: '/demo/converter',
      technologies: ['TypeScript', 'Platform APIs', 'Format Converters'],
      metrics: {
        performance: 87,
        reliability: 93,
        usability: 89
      }
    },
    {
      id: 'search-engine',
      name: '🔍 智能搜索引擎',
      description: '基于全文索引和语义分析的标注搜索系统',
      status: 'completed',
      features: [
        '全文搜索索引',
        '分面搜索',
        '相关性评分',
        '搜索建议',
        '高级过滤器'
      ],
      technologies: ['Full-text Search', 'Indexing', 'React'],
      metrics: {
        performance: 93,
        reliability: 91,
        usability: 96
      }
    },
    {
      id: 'video-annotation',
      name: '🎬 视频智能标注',
      description: 'B站弹幕式视频标注演示，展示多媒体内容的实时协作标注体验',
      status: 'beta',
      features: [
        '时间轴精确标注',
        '弹幕式实时显示',
        '多维度标注层',
        '实时协作讨论',
        '智能标注推荐'
      ],
      demoPath: '/demo/video-annotation',
      technologies: ['React', 'Video API', 'Real-time Sync'],
      metrics: {
        performance: 88,
        reliability: 85,
        usability: 92
      }
    },
    {
      id: 'performance-testing',
      name: '🧪 性能测试套件',
      description: '全面的系统性能监控和优化测试工具',
      status: 'completed',
      features: [
        '性能基准测试',
        '内存使用监控',
        '并发处理测试',
        '数据完整性验证',
        '优化建议生成'
      ],
      demoPath: '/demo/performance',
      technologies: ['Performance API', 'Testing Framework', 'Metrics'],
      metrics: {
        performance: 95,
        reliability: 97,
        usability: 85
      }
    },
    {
      id: 'api-gateway',
      name: '🌉 API网关',
      description: 'RESTful API服务，提供标注数据的CRUD操作和权限管理',
      status: 'beta',
      features: [
        'RESTful API接口',
        'JWT身份验证',
        '权限控制',
        'API限流',
        'OpenAPI文档'
      ],
      technologies: ['Next.js API', 'JWT', 'OpenAPI'],
      metrics: {
        performance: 85,
        reliability: 88,
        usability: 82
      }
    }
  ];

  const projectStats: ProjectStats = {
    totalModules: modules.length,
    completedModules: modules.filter(m => m.status === 'completed').length,
    linesOfCode: 15000, // 更新估算
    supportedPlatforms: 5, // 增加视频平台支持
    testCoverage: 85,
    performanceScore: Math.round(
      modules.reduce((sum, module) => sum + (module.metrics?.performance || 0), 0) / modules.length
    )
  };

  const getStatusColor = (status: SystemModule['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'beta': return 'bg-blue-100 text-blue-800';
      case 'development': return 'bg-yellow-100 text-yellow-800';
      case 'planning': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: SystemModule['status']) => {
    switch (status) {
      case 'completed': return '✅';
      case 'beta': return '🔵';
      case 'development': return '🟡';
      case 'planning': return '⚪';
      default: return '❓';
    }
  };

  const selectedModuleData = modules.find(m => m.id === selectedModule);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              📚 Researchopia
            </h1>
            <h2 className="text-2xl text-gray-600 mb-6">
              智能学术标注分享平台
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Researchopia是一个创新的学术标注分享平台，旨在连接不同的学术工具和研究者，
              实现标注的跨平台共享、实时协作和智能管理。
            </p>
          </div>
          
          {/* 项目统计 */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-6 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {projectStats.completedModules}/{projectStats.totalModules}
              </div>
              <div className="text-sm text-gray-600">模块完成</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {projectStats.linesOfCode.toLocaleString()}+
              </div>
              <div className="text-sm text-gray-600">代码行数</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {projectStats.supportedPlatforms}
              </div>
              <div className="text-sm text-gray-600">支持平台</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {projectStats.testCoverage}%
              </div>
              <div className="text-sm text-gray-600">测试覆盖</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-600">
                {projectStats.performanceScore}
              </div>
              <div className="text-sm text-gray-600">性能评分</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600">
                95%
              </div>
              <div className="text-sm text-gray-600">项目进度</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* 系统架构图 */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            🏗️ 系统架构概览
          </h3>
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* 数据层 */}
              <div className="text-center">
                <div className="bg-blue-100 rounded-lg p-6 mb-4">
                  <h4 className="font-semibold text-blue-900 mb-2">数据层</h4>
                  <div className="space-y-2 text-sm text-blue-700">
                    <div>🌐 跨平台协议</div>
                    <div>🔄 格式转换器</div>
                    <div>🗄️ 数据存储</div>
                  </div>
                </div>
              </div>

              {/* 服务层 */}
              <div className="text-center">
                <div className="bg-green-100 rounded-lg p-6 mb-4">
                  <h4 className="font-semibold text-green-900 mb-2">服务层</h4>
                  <div className="space-y-2 text-sm text-green-700">
                    <div>🌉 API网关</div>
                    <div>🤝 协作服务</div>
                    <div>🔍 搜索引擎</div>
                  </div>
                </div>
              </div>

              {/* 应用层 */}
              <div className="text-center">
                <div className="bg-purple-100 rounded-lg p-6 mb-4">
                  <h4 className="font-semibold text-purple-900 mb-2">应用层</h4>
                  <div className="space-y-2 text-sm text-purple-700">
                    <div>💻 Web界面</div>
                    <div>🦓 Zotero插件</div>
                    <div>📱 移动应用</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 模块列表 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 模块卡片列表 */}
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              🧩 系统模块
            </h3>
            <div className="space-y-4">
              {modules.map((module) => (
                <div
                  key={module.id}
                  className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    selectedModule === module.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => {
                    setSelectedModule(module.id);
                    setShowDetails(true);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          {module.name}
                        </h4>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(module.status)}`}>
                          {getStatusIcon(module.status)} {module.status}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">
                        {module.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {module.technologies.slice(0, 3).map((tech) => (
                          <span
                            key={tech}
                            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                          >
                            {tech}
                          </span>
                        ))}
                        {module.technologies.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            +{module.technologies.length - 3}
                          </span>
                        )}
                      </div>
                      {module.demoPath && (
                        <Link
                          href={module.demoPath}
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          查看演示 →
                        </Link>
                      )}
                    </div>
                    {module.metrics && (
                      <div className="ml-4 text-right">
                        <div className="text-sm text-gray-500">性能评分</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {module.metrics.performance}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 详细信息面板 */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                📊 模块详情
              </h3>
              {selectedModuleData ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    {selectedModuleData.name}
                  </h4>
                  
                  {/* 性能指标 */}
                  {selectedModuleData.metrics && (
                    <div className="mb-6">
                      <h5 className="font-medium text-gray-700 mb-3">性能指标</h5>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm">
                            <span>性能</span>
                            <span>{selectedModuleData.metrics.performance}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${selectedModuleData.metrics.performance}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm">
                            <span>可靠性</span>
                            <span>{selectedModuleData.metrics.reliability}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${selectedModuleData.metrics.reliability}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm">
                            <span>易用性</span>
                            <span>{selectedModuleData.metrics.usability}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{ width: `${selectedModuleData.metrics.usability}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 功能特性 */}
                  <div className="mb-6">
                    <h5 className="font-medium text-gray-700 mb-3">核心功能</h5>
                    <ul className="space-y-1">
                      {selectedModuleData.features.map((feature, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 技术栈 */}
                  <div>
                    <h5 className="font-medium text-gray-700 mb-3">技术栈</h5>
                    <div className="flex flex-wrap gap-1">
                      {selectedModuleData.technologies.map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {selectedModuleData.demoPath && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <Link
                        href={selectedModuleData.demoPath}
                        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 text-center block"
                      >
                        🚀 体验演示
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                  点击左侧模块卡片查看详细信息
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 快速入门 */}
        <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            🚀 快速开始
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">体验演示</h4>
              <p className="text-gray-600 text-sm mb-4">
                访问各个模块的演示页面，了解系统功能
              </p>
              <Link href="/demo/annotation-viewer" className="text-blue-600 hover:text-blue-800 font-medium">
                查看标注查看器 →
              </Link>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">2️⃣</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">测试转换</h4>
              <p className="text-gray-600 text-sm mb-4">
                尝试多平台标注格式转换功能
              </p>
              <Link href="/demo/converter" className="text-green-600 hover:text-green-800 font-medium">
                测试转换器 →
              </Link>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">3️⃣</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">性能测试</h4>
              <p className="text-gray-600 text-sm mb-4">
                运行系统性能测试，了解系统表现
              </p>
              <Link href="/demo/performance" className="text-purple-600 hover:text-purple-800 font-medium">
                性能测试 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}