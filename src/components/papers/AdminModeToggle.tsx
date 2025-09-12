'use client'

import { Crown, Shield } from 'lucide-react'

interface AdminModeToggleProps {
  isAdminMode: boolean
  onToggle: () => void
  className?: string
}

export default function AdminModeToggle({ isAdminMode, onToggle, className = "" }: AdminModeToggleProps) {
  return (
    <div className={`flex items-center space-x-2 p-3 bg-gradient-to-r ${
      isAdminMode 
        ? 'from-yellow-50 to-orange-50 border-yellow-200' 
        : 'from-gray-50 to-slate-50 border-gray-200'
    } border rounded-lg ${className}`}>
      <input
        type="checkbox"
        id="adminModeToggle"
        checked={isAdminMode}
        onChange={onToggle}
        className="rounded transition-colors"
      />
      <label htmlFor="adminModeToggle" className="flex items-center space-x-2 cursor-pointer select-none">
        {isAdminMode ? (
          <Crown className="w-4 h-4 text-yellow-600" />
        ) : (
          <Shield className="w-4 h-4 text-gray-600" />
        )}
        <span className={`text-sm font-medium ${
          isAdminMode ? 'text-yellow-800' : 'text-gray-700'
        }`}>
          管理员模式
        </span>
      </label>
      
      {isAdminMode && (
        <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded-full font-medium">
          可管理所有报道
        </span>
      )}
    </div>
  )
}