'use client'

import { useState } from 'react'
import { Info, Users, Shield, Eye, Edit3, Trash2, X, Crown } from 'lucide-react'

interface ReportsVisibilityInfoProps {
  isAdminMode?: boolean
}

export default function ReportsVisibilityInfo({ isAdminMode = false }: ReportsVisibilityInfoProps) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowInfo(true)}
        className="inline-flex items-center text-xs text-gray-500 hover:text-blue-600 transition-colors"
        title="了解报道可见性规则"
      >
        <Info className="w-3 h-3 mr-1" />
        可见性说明
        {isAdminMode && (
          <Crown className="w-3 h-3 ml-1 text-yellow-600" />
        )}
      </button>

      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                报道可见性与权限说明
                {isAdminMode && (
                  <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium flex items-center">
                    <Crown className="w-3 h-3 mr-1" />
                    管理员模式
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              {/* 可见性规则 */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                  <Eye className="w-4 h-4 mr-2 text-green-600" />
                  报道可见性规则
                </h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong className="text-green-800">全局可见</strong>
                        <p className="text-green-700">智能爬取和手动添加的报道对<strong>所有用户</strong>都可见</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong className="text-green-800">知识共享</strong>
                        <p className="text-green-700">体现"研学并进，智慧共享"理念，避免重复工作</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong className="text-green-800">贡献认证</strong>
                        <p className="text-green-700">每条报道都会显示贡献者信息和添加方式</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 权限控制 */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                  <Shield className="w-4 h-4 mr-2 text-blue-600" />
                  操作权限控制
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <Edit3 className="w-4 h-4 mr-2 text-blue-600" />
                      <strong className="text-blue-800">编辑权限</strong>
                    </div>
                    <p className="text-sm text-blue-700">
                      {isAdminMode 
                        ? '管理员可编辑任何用户添加的报道条目'
                        : '只能编辑自己添加的报道条目（管理员可编辑所有条目）'
                      }
                    </p>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                      <strong className="text-red-800">删除权限</strong>
                    </div>
                    <p className="text-sm text-red-700">
                      {isAdminMode 
                        ? '管理员可删除任何不当或重复的报道条目'
                        : '只能删除自己添加的报道条目（管理员可删除所有条目）'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* 管理员权限详细说明 */}
              {isAdminMode && (
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                    <Crown className="w-4 h-4 mr-2 text-yellow-600" />
                    管理员特殊权限
                  </h4>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <Eye className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="text-yellow-800">全局查看权限</strong>
                          <p className="text-sm text-yellow-700 mt-1">
                            可查看所有用户提交的报道详细信息，包括贡献者统计
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Edit3 className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="text-yellow-800">全局编辑权限</strong>
                          <p className="text-sm text-yellow-700 mt-1">
                            可编辑任何报道的标题、描述等信息，完善内容质量
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Trash2 className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="text-yellow-800">全局删除权限</strong>
                          <p className="text-sm text-yellow-700 mt-1">
                            可删除不当、重复或低质量的报道，维护平台内容质量
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Shield className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="text-yellow-800">内容管理职责</strong>
                          <p className="text-sm text-yellow-700 mt-1">
                            确保学术报道的准确性和相关性，维护学术社区的专业水准
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 协作优势 */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">
                  🤝 协作优势
                </h4>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-purple-700">
                    <li className="flex items-start space-x-2">
                      <span className="text-purple-500">•</span>
                      <span><strong>避免重复工作</strong>: 其他用户已收集的报道立即可见</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-purple-500">•</span>
                      <span><strong>信息更完整</strong>: 多人贡献让每篇论文的影响力数据更丰富</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-purple-500">•</span>
                      <span><strong>提升价值</strong>: 集体智慧创造更大的学术价值</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-purple-500">•</span>
                      <span><strong>成就感</strong>: 贡献者信息让每个人的努力都被认可</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* 安全保障 */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">
                  🔒 安全保障
                </h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• 严格的权限控制确保数据安全</li>
                    <li>• 防重复机制避免同一报道被多次添加</li>
                    <li>• 完整的操作日志便于问题追溯</li>
                    <li>• 管理员监督确保内容质量</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-500">
                  💡 这种设计让研学港成为真正的学术协作平台
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  我知道了
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}