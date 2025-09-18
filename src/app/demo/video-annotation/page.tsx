/*
  Video Annotation Demo - B站弹幕式视频标注演示
  展示多媒体标注的创新体验
*/

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VideoAnnotation {
  id: string;
  timestamp: number;
  duration?: number;
  content: string;
  author: string;
  type: 'danmaku' | 'point' | 'range' | 'discussion';
  position?: {
    x: number;
    y: number;
  };
  color: string;
  layer: 'content' | 'emotion' | 'knowledge' | 'collaboration';
  votes: number;
  replies: number;
}

interface VideoPlayer {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export default function VideoAnnotationDemo() {
  const [videoState, setVideoState] = useState<VideoPlayer>({
    currentTime: 0,
    duration: 300, // 5分钟演示视频
    isPlaying: false
  });
  
  const [annotations, setAnnotations] = useState<VideoAnnotation[]>([
    {
      id: '1',
      timestamp: 15,
      content: '这个概念很重要！建议反复观看',
      author: '学霸小王',
      type: 'danmaku',
      color: '#FF6B6B',
      layer: 'content',
      votes: 12,
      replies: 3
    },
    {
      id: '2', 
      timestamp: 32,
      content: '老师讲得太快了，需要暂停消化一下',
      author: '求知少年',
      type: 'danmaku',
      color: '#4ECDC4',
      layer: 'emotion',
      votes: 8,
      replies: 2
    },
    {
      id: '3',
      timestamp: 45,
      content: '参考论文：Smith et al. (2023) Nature',
      author: '研究生导师',
      type: 'point',
      color: '#45B7D1',
      layer: 'knowledge',
      votes: 25,
      replies: 7
    },
    {
      id: '4',
      timestamp: 78,
      content: '这里的公式推导有问题吧？',
      author: '数学大神',
      type: 'discussion',
      color: '#FFA07A',
      layer: 'collaboration',
      votes: 15,
      replies: 12
    },
    {
      id: '5',
      timestamp: 120,
      content: '终于理解了！感谢老师的耐心讲解',
      author: '恍然大悟',
      type: 'danmaku',
      color: '#98D8C8',
      layer: 'emotion',
      votes: 6,
      replies: 1
    }
  ]);

  const [showAnnotations, setShowAnnotations] = useState({
    content: true,
    emotion: true,
    knowledge: true,
    collaboration: true
  });

  const [newAnnotation, setNewAnnotation] = useState({
    content: '',
    type: 'danmaku' as VideoAnnotation['type'],
    layer: 'content' as VideoAnnotation['layer']
  });

  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // 模拟视频播放
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (videoState.isPlaying) {
      interval = setInterval(() => {
        setVideoState(prev => ({
          ...prev,
          currentTime: Math.min(prev.currentTime + 1, prev.duration)
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [videoState.isPlaying]);

  // 获取当前时间的标注
  const getCurrentAnnotations = useCallback(() => {
    return annotations.filter(ann => {
      const timeRange = 3; // 3秒窗口
      return Math.abs(ann.timestamp - videoState.currentTime) <= timeRange &&
             showAnnotations[ann.layer];
    });
  }, [annotations, videoState.currentTime, showAnnotations]);

  const addAnnotation = () => {
    if (!newAnnotation.content.trim()) return;

    const annotation: VideoAnnotation = {
      id: Date.now().toString(),
      timestamp: videoState.currentTime,
      content: newAnnotation.content,
      author: '当前用户',
      type: newAnnotation.type,
      color: getRandomColor(),
      layer: newAnnotation.layer,
      votes: 0,
      replies: 0
    };

    setAnnotations(prev => [...prev, annotation]);
    setNewAnnotation({ content: '', type: 'danmaku', layer: 'content' });
    setIsAddingAnnotation(false);
  };

  const getRandomColor = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLayerIcon = (layer: VideoAnnotation['layer']) => {
    switch (layer) {
      case 'content': return '📝';
      case 'emotion': return '😊';
      case 'knowledge': return '🧠';
      case 'collaboration': return '💬';
      default: return '📌';
    }
  };

  const getLayerColor = (layer: VideoAnnotation['layer']) => {
    switch (layer) {
      case 'content': return 'bg-blue-100 border-blue-300';
      case 'emotion': return 'bg-pink-100 border-pink-300';
      case 'knowledge': return 'bg-purple-100 border-purple-300';
      case 'collaboration': return 'bg-green-100 border-green-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  const currentAnnotations = getCurrentAnnotations();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">
            🎬 视频智能标注演示
          </h1>
          <p className="text-blue-100">
            体验B站弹幕式的学术视频标注 - 多维度实时协作学习
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* 视频播放区域 */}
          <div className="lg:col-span-3">
            <div className="bg-black rounded-lg overflow-hidden shadow-2xl">
              {/* 模拟视频画面 */}
              <div 
                ref={videoRef}
                className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center"
              >
                {/* 模拟视频内容 */}
                <div className="text-center">
                  <div className="text-6xl mb-4">🎓</div>
                  <h3 className="text-2xl font-semibold mb-2">
                    深度学习基础理论讲座
                  </h3>
                  <p className="text-gray-300">
                    当前播放时间: {formatTime(videoState.currentTime)}
                  </p>
                </div>

                {/* 弹幕层显示 */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {currentAnnotations.map((ann, index) => (
                    ann.type === 'danmaku' && (
                      <div
                        key={ann.id}
                        className="absolute animate-pulse"
                        style={{
                          top: `${20 + (index * 15) % 60}%`,
                          left: `${100 - ((videoState.currentTime - ann.timestamp + 3) * 10)}%`,
                          color: ann.color,
                          fontSize: '14px',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                        }}
                      >
                        {getLayerIcon(ann.layer)} {ann.content}
                      </div>
                    )
                  ))}
                </div>

                {/* 点标注显示 */}
                {currentAnnotations.map(ann => (
                  ann.type === 'point' && (
                    <div
                      key={ann.id}
                      className="absolute bg-yellow-400 text-black px-2 py-1 rounded-full text-sm animate-bounce"
                      style={{
                        top: '30%',
                        right: '20%',
                        fontSize: '12px'
                      }}
                    >
                      💡 {ann.content.slice(0, 20)}...
                    </div>
                  )
                ))}
              </div>

              {/* 视频控制栏 */}
              <div className="bg-gray-800 p-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    {videoState.isPlaying ? '⏸️ 暂停' : '▶️ 播放'}
                  </button>
                  
                  <div className="flex-1">
                    <div className="relative">
                      {/* 进度条 */}
                      <div 
                        ref={timelineRef}
                        className="h-3 bg-gray-700 rounded-full cursor-pointer"
                        onClick={(e) => {
                          const rect = timelineRef.current!.getBoundingClientRect();
                          const percent = (e.clientX - rect.left) / rect.width;
                          const newTime = Math.floor(percent * videoState.duration);
                          setVideoState(prev => ({ ...prev, currentTime: newTime }));
                        }}
                      >
                        <div 
                          className="h-3 bg-blue-600 rounded-full"
                          style={{ width: `${(videoState.currentTime / videoState.duration) * 100}%` }}
                        />
                        
                        {/* 标注时间点标记 */}
                        {annotations.map(ann => (
                          <div
                            key={ann.id}
                            className="absolute top-0 w-1 h-3 rounded-full"
                            style={{
                              left: `${(ann.timestamp / videoState.duration) * 100}%`,
                              backgroundColor: ann.color
                            }}
                            title={`${formatTime(ann.timestamp)}: ${ann.content}`}
                          />
                        ))}
                      </div>
                      
                      <div className="flex justify-between text-sm text-gray-400 mt-1">
                        <span>{formatTime(videoState.currentTime)}</span>
                        <span>{formatTime(videoState.duration)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsAddingAnnotation(true)}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    ➕ 添加标注
                  </button>
                </div>
              </div>
            </div>

            {/* 添加标注面板 */}
            {isAddingAnnotation && (
              <div className="mt-4 bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">
                  在时间点 {formatTime(videoState.currentTime)} 添加标注
                </h3>
                
                <div className="space-y-3">
                  <div className="flex space-x-4">
                    <select
                      value={newAnnotation.type}
                      onChange={(e) => setNewAnnotation(prev => ({ 
                        ...prev, 
                        type: e.target.value as VideoAnnotation['type'] 
                      }))}
                      className="bg-gray-700 rounded px-3 py-2"
                    >
                      <option value="danmaku">弹幕标注</option>
                      <option value="point">重点标记</option>
                      <option value="discussion">讨论话题</option>
                    </select>

                    <select
                      value={newAnnotation.layer}
                      onChange={(e) => setNewAnnotation(prev => ({ 
                        ...prev, 
                        layer: e.target.value as VideoAnnotation['layer'] 
                      }))}
                      className="bg-gray-700 rounded px-3 py-2"
                    >
                      <option value="content">📝 内容层</option>
                      <option value="emotion">😊 情感层</option>
                      <option value="knowledge">🧠 知识层</option>
                      <option value="collaboration">💬 协作层</option>
                    </select>
                  </div>

                  <textarea
                    value={newAnnotation.content}
                    onChange={(e) => setNewAnnotation(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="输入你的标注内容..."
                    className="w-full bg-gray-700 rounded px-3 py-2 h-20 resize-none"
                  />

                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setIsAddingAnnotation(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={addAnnotation}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      发布标注
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右侧控制面板 */}
          <div className="space-y-6">
            {/* 标注图层控制 */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">📊 标注图层</h3>
              <div className="space-y-2">
                {Object.entries(showAnnotations).map(([layer, visible]) => (
                  <label key={layer} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) => setShowAnnotations(prev => ({
                        ...prev,
                        [layer]: e.target.checked
                      }))}
                      className="rounded"
                    />
                    <span>
                      {getLayerIcon(layer as VideoAnnotation['layer'])} {
                        layer === 'content' ? '内容层' :
                        layer === 'emotion' ? '情感层' :
                        layer === 'knowledge' ? '知识层' : '协作层'
                      }
                    </span>
                    <span className="text-sm text-gray-400">
                      ({annotations.filter(a => a.layer === layer).length})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 实时标注列表 */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">💬 实时标注</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {currentAnnotations.length === 0 ? (
                  <p className="text-gray-400 text-sm">当前时间段暂无标注</p>
                ) : (
                  currentAnnotations.map(ann => (
                    <div 
                      key={ann.id}
                      className={`p-2 rounded border-l-4 ${getLayerColor(ann.layer)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center text-xs text-gray-300 mb-1">
                            <span>{getLayerIcon(ann.layer)}</span>
                            <span className="ml-1">{ann.author}</span>
                            <span className="ml-2">{formatTime(ann.timestamp)}</span>
                          </div>
                          <p className="text-sm">{ann.content}</p>
                          <div className="flex items-center text-xs text-gray-400 mt-1 space-x-2">
                            <span>👍 {ann.votes}</span>
                            <span>💬 {ann.replies}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 统计信息 */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">📈 统计信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>总标注数:</span>
                  <span className="font-semibold">{annotations.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>活跃用户:</span>
                  <span className="font-semibold">{new Set(annotations.map(a => a.author)).size}</span>
                </div>
                <div className="flex justify-between">
                  <span>总点赞数:</span>
                  <span className="font-semibold">{annotations.reduce((sum, a) => sum + a.votes, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>讨论回复:</span>
                  <span className="font-semibold">{annotations.reduce((sum, a) => sum + a.replies, 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 功能特性展示 */}
        <div className="mt-8 bg-gradient-to-r from-blue-800 to-purple-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-center">
            🌟 多媒体标注平台特性
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl mb-2">⏱️</div>
              <h3 className="font-semibold mb-1">时间同步</h3>
              <p className="text-sm text-blue-100">精确到秒的时间轴标注</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🎭</div>
              <h3 className="font-semibold mb-1">多维标注</h3>
              <p className="text-sm text-blue-100">内容、情感、知识多层次</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">👥</div>
              <h3 className="font-semibold mb-1">实时协作</h3>
              <p className="text-sm text-blue-100">多用户同步标注讨论</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🧠</div>
              <h3 className="font-semibold mb-1">智能推荐</h3>
              <p className="text-sm text-blue-100">AI辅助内容理解</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}