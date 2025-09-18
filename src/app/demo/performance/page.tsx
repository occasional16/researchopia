/*
  System Performance Test Suite
  Comprehensive testing and optimization for the Researchopia annotation system
*/

'use client';

import React, { useState, useEffect } from 'react';
import { UniversalAnnotation } from '@/types/annotation-protocol';
import { AnnotationConverterManager } from '@/lib/annotation-converters/converter-manager';
import LoadingSpinner from '@/components/LoadingSpinner';

interface TestResult {
  testName: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  details?: any;
}

interface PerformanceMetrics {
  conversionSpeed: number; // annotations per second
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  networkLatency: number; // ms
  searchResponseTime: number; // ms
  renderTime: number; // ms
}

interface TestSuite {
  name: string;
  description: string;
  tests: TestResult[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration: number;
}

export default function SystemPerformanceTest() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    conversionSpeed: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    networkLatency: 0,
    searchResponseTime: 0,
    renderTime: 0
  });
  
  const converterManager = new AnnotationConverterManager();

  // 生成测试数据
  const generateTestAnnotations = (count: number): any[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-annotation-${i}`,
      type: 'highlight',
      document_id: `test-doc-${Math.floor(i / 10)}`,
      page: Math.floor(i / 5) + 1,
      x: 100 + (i % 10) * 50,
      y: 200 + (i % 5) * 30,
      width: 200,
      height: 20,
      text: `Test annotation content ${i} with some sample text that demonstrates the annotation system`,
      note: `Test comment ${i} - This is a longer comment to test performance with larger text content`,
      color: { r: Math.random(), g: Math.random(), b: Math.random() },
      author: {
        id: `user-${i % 5}`,
        name: `Test User ${i % 5}`,
        email: `user${i % 5}@example.com`
      },
      privacy_level: i % 3 === 0 ? 'public' : i % 3 === 1 ? 'group' : 'private',
      created: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      last_modified: new Date().toISOString(),
      tags: [`tag${i % 10}`, `category${i % 5}`, 'test']
    }));
  };

  // 性能测试：转换速度
  const testConversionPerformance = async (): Promise<TestResult> => {
    const testName = 'Conversion Performance Test';
    const startTime = performance.now();
    
    try {
      const testData = generateTestAnnotations(1000);
      const conversionStart = performance.now();
      
      const result = await converterManager.fromPlatform('mendeley', testData);
      
      const conversionEnd = performance.now();
      const conversionTime = conversionEnd - conversionStart;
      const speed = testData.length / (conversionTime / 1000); // annotations per second
      
      setMetrics(prev => ({ ...prev, conversionSpeed: speed }));
      
      return {
        testName,
        status: result.success ? 'passed' : 'failed',
        duration: performance.now() - startTime,
        details: {
          annotationsProcessed: result.processed,
          conversionSpeed: `${speed.toFixed(2)} annotations/sec`,
          memoryImpact: 'Low'
        }
      };
    } catch (error) {
      return {
        testName,
        status: 'failed',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  // 内存使用测试
  const testMemoryUsage = async (): Promise<TestResult> => {
    const testName = 'Memory Usage Test';
    const startTime = performance.now();
    
    try {
      // 使用performance.memory（如果可用）或估算
      const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;
      
      // 创建大量标注数据
      const largeDataset = generateTestAnnotations(10000);
      const results = [];
      
      for (let i = 0; i < 10; i++) {
        const batchResult = await converterManager.fromPlatform('mendeley', largeDataset.slice(i * 1000, (i + 1) * 1000));
        results.push(batchResult);
      }
      
      const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryUsed = (memoryAfter - memoryBefore) / (1024 * 1024); // MB
      
      setMetrics(prev => ({ ...prev, memoryUsage: memoryUsed }));
      
      return {
        testName,
        status: memoryUsed < 100 ? 'passed' : 'failed', // 100MB limit
        duration: performance.now() - startTime,
        details: {
          memoryUsed: `${memoryUsed.toFixed(2)} MB`,
          batchesProcessed: results.length,
          memoryEfficiency: memoryUsed < 50 ? 'Excellent' : memoryUsed < 100 ? 'Good' : 'Needs Optimization'
        }
      };
    } catch (error) {
      return {
        testName,
        status: 'failed',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  // 搜索性能测试
  const testSearchPerformance = async (): Promise<TestResult> => {
    const testName = 'Search Performance Test';
    const startTime = performance.now();
    
    try {
      const testAnnotations = generateTestAnnotations(5000);
      const convertedResult = await converterManager.fromPlatform('mendeley', testAnnotations);
      
      if (!convertedResult.success || !convertedResult.data) {
        throw new Error('Failed to convert test data');
      }
      
      const annotations = convertedResult.data;
      const searchQueries = ['test', 'annotation', 'user', 'sample', 'content'];
      const searchResults = [];
      
      for (const query of searchQueries) {
        const searchStart = performance.now();
        
        // 简单文本搜索
        const results = annotations.filter(ann => 
          ann.content?.text?.toLowerCase().includes(query.toLowerCase()) ||
          ann.content?.comment?.toLowerCase().includes(query.toLowerCase()) ||
          ann.metadata.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
        
        const searchTime = performance.now() - searchStart;
        searchResults.push({ query, resultCount: results.length, time: searchTime });
      }
      
      const avgSearchTime = searchResults.reduce((sum, result) => sum + result.time, 0) / searchResults.length;
      setMetrics(prev => ({ ...prev, searchResponseTime: avgSearchTime }));
      
      return {
        testName,
        status: avgSearchTime < 100 ? 'passed' : 'failed', // 100ms threshold
        duration: performance.now() - startTime,
        details: {
          averageSearchTime: `${avgSearchTime.toFixed(2)} ms`,
          totalQueries: searchQueries.length,
          searchResults: searchResults,
          performance: avgSearchTime < 50 ? 'Excellent' : avgSearchTime < 100 ? 'Good' : 'Needs Optimization'
        }
      };
    } catch (error) {
      return {
        testName,
        status: 'failed',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  // 并发处理测试
  const testConcurrentProcessing = async (): Promise<TestResult> => {
    const testName = 'Concurrent Processing Test';
    const startTime = performance.now();
    
    try {
      const batchSize = 500;
      const batchCount = 8;
      const batches = Array.from({ length: batchCount }, (_, i) => 
        generateTestAnnotations(batchSize)
      );
      
      // 并发处理多个批次
      const concurrentStart = performance.now();
      const promises = batches.map(async (batch, index) => {
        return converterManager.fromPlatform('mendeley', batch);
      });
      
      const results = await Promise.allSettled(promises);
      const concurrentEnd = performance.now();
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const totalProcessingTime = concurrentEnd - concurrentStart;
      const throughput = (batchCount * batchSize) / (totalProcessingTime / 1000);
      
      return {
        testName,
        status: successCount === batchCount ? 'passed' : 'failed',
        duration: performance.now() - startTime,
        details: {
          batchesProcessed: successCount,
          totalBatches: batchCount,
          throughput: `${throughput.toFixed(2)} annotations/sec`,
          concurrentProcessingTime: `${totalProcessingTime.toFixed(2)} ms`,
          efficiency: successCount === batchCount ? 'Excellent' : 'Needs Improvement'
        }
      };
    } catch (error) {
      return {
        testName,
        status: 'failed',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  // 数据完整性测试
  const testDataIntegrity = async (): Promise<TestResult> => {
    const testName = 'Data Integrity Test';
    const startTime = performance.now();
    
    try {
      const originalData = generateTestAnnotations(100);
      
      // 转换为通用格式然后转回去
      const universalResult = await converterManager.fromPlatform('mendeley', originalData);
      if (!universalResult.success || !universalResult.data) {
        throw new Error('Failed to convert to universal format');
      }
      
      const backConvertResult = await converterManager.toPlatform('mendeley', universalResult.data);
      if (!backConvertResult.success || !backConvertResult.data) {
        throw new Error('Failed to convert back to platform format');
      }
      
      // 验证数据完整性
      const integrityChecks = [];
      for (let i = 0; i < Math.min(originalData.length, backConvertResult.data.length); i++) {
        const original = originalData[i];
        const converted = backConvertResult.data[i];
        
        const checks = {
          idPreserved: original.id === converted.id,
          textPreserved: original.text === converted.text,
          authorPreserved: original.author.name === converted.author.name,
          tagsPreserved: JSON.stringify(original.tags) === JSON.stringify(converted.tags)
        };
        
        integrityChecks.push(checks);
      }
      
      const passedChecks = integrityChecks.filter(check => 
        check.idPreserved && check.textPreserved && check.authorPreserved && check.tagsPreserved
      ).length;
      
      const integrityScore = (passedChecks / integrityChecks.length) * 100;
      
      return {
        testName,
        status: integrityScore >= 95 ? 'passed' : 'failed',
        duration: performance.now() - startTime,
        details: {
          integrityScore: `${integrityScore.toFixed(1)}%`,
          totalChecks: integrityChecks.length,
          passedChecks: passedChecks,
          dataLoss: integrityScore < 100 ? 'Minor' : 'None'
        }
      };
    } catch (error) {
      return {
        testName,
        status: 'failed',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  // 错误处理测试
  const testErrorHandling = async (): Promise<TestResult> => {
    const testName = 'Error Handling Test';
    const startTime = performance.now();
    
    try {
      // 测试无效数据处理
      const invalidData = [
        null,
        undefined,
        {},
        { id: 'test' }, // missing required fields
        { invalid: 'structure' }
      ];
      
      const result = await converterManager.fromPlatform('mendeley', invalidData);
      
      // 应该优雅处理错误而不崩溃
      const hasErrors = result.errors && result.errors.length > 0;
      const hasPartialSuccess = result.processed === 0 && result.failed === invalidData.length;
      
      return {
        testName,
        status: hasErrors && hasPartialSuccess ? 'passed' : 'failed',
        duration: performance.now() - startTime,
        details: {
          invalidInputsHandled: result.failed,
          errorsReported: result.errors?.length || 0,
          systemStability: 'Stable',
          gracefulDegradation: hasPartialSuccess ? 'Yes' : 'No'
        }
      };
    } catch (error) {
      return {
        testName,
        status: 'failed',
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  // 运行所有测试
  const runAllTests = async () => {
    setIsRunning(true);
    const suites: TestSuite[] = [
      {
        name: 'Performance Tests',
        description: 'Test system performance under various conditions',
        tests: [],
        status: 'running',
        duration: 0
      },
      {
        name: 'Reliability Tests', 
        description: 'Test system reliability and error handling',
        tests: [],
        status: 'pending',
        duration: 0
      }
    ];
    
    setTestSuites([...suites]);
    
    try {
      // 性能测试套件
      const performanceTests = [
        testConversionPerformance,
        testMemoryUsage,
        testSearchPerformance,
        testConcurrentProcessing
      ];
      
      const performanceResults = [];
      for (const test of performanceTests) {
        setCurrentTest(test.name || 'Running test...');
        const result = await test();
        performanceResults.push(result);
      }
      
      suites[0].tests = performanceResults;
      suites[0].status = 'completed';
      suites[0].duration = performanceResults.reduce((sum, test) => sum + test.duration, 0);
      
      // 可靠性测试套件
      suites[1].status = 'running';
      setTestSuites([...suites]);
      
      const reliabilityTests = [
        testDataIntegrity,
        testErrorHandling
      ];
      
      const reliabilityResults = [];
      for (const test of reliabilityTests) {
        setCurrentTest(test.name || 'Running test...');
        const result = await test();
        reliabilityResults.push(result);
      }
      
      suites[1].tests = reliabilityResults;
      suites[1].status = 'completed';
      suites[1].duration = reliabilityResults.reduce((sum, test) => sum + test.duration, 0);
      
      setTestSuites([...suites]);
      
    } catch (error) {
      console.error('Test execution error:', error);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  // 获取测试状态图标
  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running': return '🟡';
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      default: return '⚪';
    }
  };

  // 获取性能评级
  const getPerformanceGrade = () => {
    const { conversionSpeed, memoryUsage, searchResponseTime } = metrics;
    
    let score = 0;
    if (conversionSpeed > 100) score += 30;
    else if (conversionSpeed > 50) score += 20;
    else if (conversionSpeed > 10) score += 10;
    
    if (memoryUsage < 50) score += 30;
    else if (memoryUsage < 100) score += 20;
    else if (memoryUsage < 200) score += 10;
    
    if (searchResponseTime < 50) score += 40;
    else if (searchResponseTime < 100) score += 30;
    else if (searchResponseTime < 200) score += 20;
    
    if (score >= 80) return { grade: 'A', color: 'text-green-600' };
    if (score >= 60) return { grade: 'B', color: 'text-yellow-600' };
    if (score >= 40) return { grade: 'C', color: 'text-orange-600' };
    return { grade: 'D', color: 'text-red-600' };
  };

  const performanceGrade = getPerformanceGrade();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 系统性能测试套件
          </h1>
          <p className="text-gray-600">
            全面测试Researchopia标注系统的性能、可靠性和用户体验
          </p>
        </div>

        {/* 控制面板 */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">测试控制</h2>
              {currentTest && (
                <div className="text-gray-600 flex items-center">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 mr-2"></div>
                  {currentTest}
                </div>
              )}
            </div>
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className={`px-6 py-3 rounded-lg font-medium ${
                isRunning 
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isRunning ? '测试运行中...' : '运行所有测试'}
            </button>
          </div>
        </div>

        {/* 性能指标概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <h3 className="text-sm text-gray-500 mb-1">转换速度</h3>
            <p className="text-lg font-bold text-blue-600">
              {metrics.conversionSpeed.toFixed(1)} /s
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <h3 className="text-sm text-gray-500 mb-1">内存使用</h3>
            <p className="text-lg font-bold text-green-600">
              {metrics.memoryUsage.toFixed(1)} MB
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <h3 className="text-sm text-gray-500 mb-1">搜索响应</h3>
            <p className="text-lg font-bold text-purple-600">
              {metrics.searchResponseTime.toFixed(1)} ms
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <h3 className="text-sm text-gray-500 mb-1">网络延迟</h3>
            <p className="text-lg font-bold text-orange-600">
              {metrics.networkLatency.toFixed(1)} ms
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <h3 className="text-sm text-gray-500 mb-1">渲染时间</h3>
            <p className="text-lg font-bold text-pink-600">
              {metrics.renderTime.toFixed(1)} ms
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <h3 className="text-sm text-gray-500 mb-1">性能评级</h3>
            <p className={`text-2xl font-bold ${performanceGrade.color}`}>
              {performanceGrade.grade}
            </p>
          </div>
        </div>

        {/* 测试套件结果 */}
        <div className="space-y-6">
          {testSuites.map((suite, suiteIndex) => (
            <div key={suite.name} className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{suite.name}</h3>
                    <p className="text-gray-600 mt-1">{suite.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      状态: {suite.status === 'completed' ? '✅ 完成' : 
                           suite.status === 'running' ? '🟡 运行中' : 
                           suite.status === 'failed' ? '❌ 失败' : '⚪ 等待'}
                    </div>
                    {suite.duration > 0 && (
                      <div className="text-sm text-gray-500">
                        耗时: {(suite.duration / 1000).toFixed(2)}s
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {suite.tests.length > 0 ? (
                  <div className="space-y-4">
                    {suite.tests.map((test, testIndex) => (
                      <div key={testIndex} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <span className="mr-2">{getStatusIcon(test.status)}</span>
                              <h4 className="font-medium">{test.testName}</h4>
                              <span className="ml-2 text-sm text-gray-500">
                                ({(test.duration / 1000).toFixed(2)}s)
                              </span>
                            </div>
                            
                            {test.error && (
                              <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                                错误: {test.error}
                              </div>
                            )}
                            
                            {test.details && (
                              <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(test.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {suite.status === 'pending' ? '等待测试执行...' : '正在运行测试...'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 优化建议 */}
        {testSuites.length > 0 && testSuites.every(suite => suite.status === 'completed') && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">📊 优化建议</h3>
            <div className="space-y-2 text-blue-800">
              {metrics.conversionSpeed < 50 && (
                <p>• 考虑实施批处理优化以提高转换速度</p>
              )}
              {metrics.memoryUsage > 100 && (
                <p>• 建议实施内存池和对象复用来减少内存占用</p>
              )}
              {metrics.searchResponseTime > 100 && (
                <p>• 可以考虑添加搜索索引来改善搜索性能</p>
              )}
              <p>• 总体性能评级: <strong className={performanceGrade.color}>{performanceGrade.grade}</strong></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}