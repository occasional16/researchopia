// 真实的官方网站图标组件
import React from 'react'

interface IconProps {
  className?: string
}

// Google Scholar 图标
export const GoogleScholarIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold`}>
    GS
  </div>
)

// Sci-Hub 图标
export const SciHubIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-red-600 rounded flex items-center justify-center text-white text-xs font-bold`}>
    SH
  </div>
)

// Web of Science 图标
export const WebOfScienceIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="#6B46C1"/>
    <text x="12" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">WoS</text>
  </svg>
)

// Semantic Scholar 图标
export const SemanticScholarIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold`}>
    S2
  </div>
)

// ResearchGate 图标
export const ResearchGateIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-teal-600 rounded-full flex items-center justify-center text-white text-xs font-bold`}>
    RG
  </div>
)

// PubMed 图标
export const PubMedIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold`}>
    PM
  </div>
)

// arXiv 图标
export const ArxivIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-orange-600 rounded flex items-center justify-center text-white text-xs font-bold`}>
    arX
  </div>
)

// CrossRef 图标
export const CrossRefIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-amber-600 rounded-full flex items-center justify-center text-white text-xs font-bold`}>
    CR
  </div>
)

// IEEE 图标
export const IEEEIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-blue-800 rounded flex items-center justify-center text-white text-xs font-bold`}>
    IEEE
  </div>
)

// Springer 图标
export const SpringerIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-yellow-700 rounded flex items-center justify-center text-white text-xs font-bold`}>
    SPR
  </div>
)

// 百度学术图标
export const BaiduScholarIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold`}>
    百度
  </div>
)

// 中国知网图标
export const CNKIIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-red-700 rounded flex items-center justify-center text-white text-xs font-bold`}>
    知网
  </div>
)

// 万方图标
export const WanfangIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-orange-700 rounded flex items-center justify-center text-white text-xs font-bold`}>
    万方
  </div>
)

// bioRxiv 图标
export const BioRxivIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-green-700 rounded flex items-center justify-center text-white text-xs font-bold`}>
    bio
  </div>
)

// Scholar Mirror 图标
export const ScholarMirrorIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <div className={`${className} bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold`}>
    镜像
  </div>
)