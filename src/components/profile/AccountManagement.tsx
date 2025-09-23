'use client'

import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface AccountManagementProps {
  user: any
  profile: any
}

export default function AccountManagement({ user, profile }: AccountManagementProps) {
  const { signOut } = useAuth()
  
  // 修改密码状态
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [changePasswordLoading, setChangePasswordLoading] = useState(false)
  const [changePasswordMessage, setChangePasswordMessage] = useState('')
  const [changePasswordError, setChangePasswordError] = useState('')

  // 忘记密码状态
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('')

  // 修改用户名状态
  const [showChangeUsername, setShowChangeUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernamePassword, setUsernamePassword] = useState('')
  const [changeUsernameLoading, setChangeUsernameLoading] = useState(false)
  const [changeUsernameMessage, setChangeUsernameMessage] = useState('')
  const [changeUsernameError, setChangeUsernameError] = useState('')

  // 删除账户状态
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState('')

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangePasswordLoading(true)
    setChangePasswordError('')
    setChangePasswordMessage('')

    if (newPassword !== confirmNewPassword) {
      setChangePasswordError('新密码不一致')
      setChangePasswordLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setChangePasswordError('新密码长度至少6位')
      setChangePasswordLoading(false)
      return
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setChangePasswordError('新密码必须包含字母和数字')
      setChangePasswordLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token || ''}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const result = await response.json()

      if (result.success) {
        setChangePasswordMessage('密码修改成功')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
        setTimeout(() => {
          setShowChangePassword(false)
          setChangePasswordMessage('')
        }, 2000)
      } else {
        setChangePasswordError(result.message || '密码修改失败')
      }
    } catch (error) {
      setChangePasswordError('网络错误，请重试')
    } finally {
      setChangePasswordLoading(false)
    }
  }

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeUsernameLoading(true)
    setChangeUsernameError('')
    setChangeUsernameMessage('')

    if (!newUsername || newUsername.length < 3) {
      setChangeUsernameError('用户名至少3个字符')
      setChangeUsernameLoading(false)
      return
    }

    if (newUsername === profile?.username) {
      setChangeUsernameError('新用户名与当前用户名相同')
      setChangeUsernameLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/change-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token || ''}`
        },
        body: JSON.stringify({
          newUsername,
          password: usernamePassword
        })
      })

      const result = await response.json()

      if (result.success) {
        setChangeUsernameMessage('用户名修改成功，页面将自动刷新')
        setNewUsername('')
        setUsernamePassword('')
        setTimeout(() => {
          window.location.reload() // 刷新页面以更新用户信息
        }, 2000)
      } else {
        setChangeUsernameError(result.message || '用户名修改失败')
      }
    } catch (error) {
      setChangeUsernameError('网络错误，请重试')
    } finally {
      setChangeUsernameLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setForgotPasswordLoading(true)
    setForgotPasswordMessage('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      })

      const result = await response.json()
      setForgotPasswordMessage(result.message || '密码重置邮件已发送')
    } catch (error) {
      setForgotPasswordMessage('发送失败，请重试')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteAccountLoading(true)
    setDeleteAccountError('')

    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token || ''}`
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmText: deleteConfirmText
        })
      })

      const result = await response.json()

      if (result.success) {
        alert('账户已成功删除，即将退出登录')
        await signOut()
      } else {
        setDeleteAccountError(result.message || '删除失败')
      }
    } catch (error) {
      setDeleteAccountError('网络错误，请重试')
    } finally {
      setDeleteAccountLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">基本信息</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              邮箱地址
            </label>
            <div className="flex items-center">
              <Mail className="h-4 w-4 text-gray-400 mr-2" />
              <input
                type="email"
                value={user.email}
                disabled
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">邮箱地址不可修改</p>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                用户名
              </label>
              <button
                onClick={() => setShowChangeUsername(!showChangeUsername)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                修改用户名
              </button>
            </div>
            <input
              type="text"
              value={profile?.username || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              用户名每30天只能修改一次
            </p>

            {/* 修改用户名表单 */}
            {showChangeUsername && (
              <div className="mt-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <form onSubmit={handleChangeUsername} className="space-y-4">
                  {changeUsernameMessage && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-green-700 text-sm">{changeUsernameMessage}</span>
                    </div>
                  )}

                  {changeUsernameError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                      <XCircle className="h-4 w-4 text-red-500 mr-2" />
                      <span className="text-red-700 text-sm">{changeUsernameError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      新用户名
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入新用户名（3-20个字符）"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      请输入当前密码确认身份
                    </label>
                    <input
                      type="password"
                      value={usernamePassword}
                      onChange={(e) => setUsernamePassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入密码"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={changeUsernameLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {changeUsernameLoading ? '修改中...' : '确认修改'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowChangeUsername(false)
                        setNewUsername('')
                        setUsernamePassword('')
                        setChangeUsernameError('')
                        setChangeUsernameMessage('')
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {profile?.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                账户类型
              </label>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                管理员
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 密码管理 */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Lock className="h-5 w-5 mr-2" />
          密码管理
        </h3>
        
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              修改密码
            </button>
            
            <button
              onClick={handleForgotPassword}
              disabled={forgotPasswordLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {forgotPasswordLoading ? '发送中...' : '忘记密码'}
            </button>
          </div>

          {forgotPasswordMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-700 text-sm">{forgotPasswordMessage}</p>
            </div>
          )}

          {showChangePassword && (
            <div className="border-t pt-4">
              <form onSubmit={handleChangePassword} className="space-y-4">
                {changePasswordMessage && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-green-700 text-sm">{changePasswordMessage}</span>
                  </div>
                )}

                {changePasswordError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                    <XCircle className="h-4 w-4 text-red-500 mr-2" />
                    <span className="text-red-700 text-sm">{changePasswordError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    当前密码
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="请输入当前密码"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    新密码
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="请输入新密码"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    密码必须包含字母和数字，至少6位
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    确认新密码
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="请再次输入新密码"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={changePasswordLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {changePasswordLoading ? '修改中...' : '确认修改'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassword(false)
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmNewPassword('')
                      setChangePasswordError('')
                      setChangePasswordMessage('')
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* 危险操作 */}
      {profile?.role !== 'admin' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-900 mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            危险操作
          </h3>
          
          <div className="space-y-4">
            <div>
              <button
                onClick={() => setShowDeleteAccount(!showDeleteAccount)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                注销账户
              </button>
              <p className="text-sm text-red-600 mt-2">
                注销账户将永久删除您的所有数据，此操作不可恢复
              </p>
            </div>

            {showDeleteAccount && (
              <div className="border-t border-red-200 pt-4">
                <form onSubmit={handleDeleteAccount} className="space-y-4">
                  {deleteAccountError && (
                    <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                      <p className="text-red-700 text-sm">{deleteAccountError}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-red-700 mb-2">
                      请输入当前密码确认身份
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="请输入密码"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-red-700 mb-2">
                      请输入"删除我的账户"确认操作
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="删除我的账户"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={deleteAccountLoading || deleteConfirmText !== '删除我的账户'}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleteAccountLoading ? '删除中...' : '确认删除账户'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteAccount(false)
                        setDeletePassword('')
                        setDeleteConfirmText('')
                        setDeleteAccountError('')
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
