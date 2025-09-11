'use client'

interface LoadingLogoProps {
  size?: number
  showText?: boolean
  className?: string
}

export default function LoadingLogo({ 
  size = 60, 
  showText = false, 
  className = "" 
}: LoadingLogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        <svg 
          width={size} 
          height={size} 
          viewBox="0 0 120 120" 
          xmlns="http://www.w3.org/2000/svg" 
          className="animate-pulse-slow"
        >
          {/* 港口波浪 - 加载动画 */}
          <path 
            d="M 10 80 Q 30 70, 50 80 T 90 80 T 130 80" 
            fill="none" 
            stroke="rgba(124,58,237,0.8)" 
            strokeWidth="3"
          >
            <animate 
              attributeName="d" 
              values="M 10 80 Q 30 70, 50 80 T 90 80 T 130 80;M 10 82 Q 30 72, 50 82 T 90 82 T 130 82;M 10 80 Q 30 70, 50 80 T 90 80 T 130 80" 
              dur="2s" 
              repeatCount="indefinite"
            />
          </path>
          <path 
            d="M 10 85 Q 30 75, 50 85 T 90 85 T 130 85" 
            fill="none" 
            stroke="rgba(124,58,237,0.6)" 
            strokeWidth="2"
          >
            <animate 
              attributeName="d" 
              values="M 10 85 Q 30 75, 50 85 T 90 85 T 130 85;M 10 87 Q 30 77, 50 87 T 90 87 T 130 87;M 10 85 Q 30 75, 50 85 T 90 85 T 130 85" 
              dur="2s" 
              repeatCount="indefinite"
            />
          </path>
          
          {/* 书本形状 */}
          <g transform="translate(60,60)">
            <rect x="-20" y="-15" width="40" height="25" fill="rgba(255,255,255,0.95)" rx="3"/>
            <rect x="-18" y="-13" width="36" height="21" fill="rgba(139,92,246,0.9)" rx="2"/>
            
            {/* 书页线条 */}
            <line x1="-12" y1="-8" x2="12" y2="-8" stroke="white" strokeWidth="1.5" opacity="0.9"/>
            <line x1="-12" y1="-3" x2="12" y2="-3" stroke="white" strokeWidth="1.5" opacity="0.8"/>
            <line x1="-12" y1="2" x2="12" y2="2" stroke="white" strokeWidth="1.5" opacity="0.9"/>
            
            {/* 中心分割线 */}
            <line x1="0" y1="-13" x2="0" y2="8" stroke="#6d28d9" strokeWidth="1.5"/>
          </g>
          
          {/* 灯塔/指引 - 旋转动画 */}
          <g transform="translate(85,35)">
            <rect x="-1.5" y="-8" width="3" height="16" fill="#fbbf24" rx="1"/>
            <circle cx="0" cy="-10" r="3" fill="#fbbf24"/>
            {/* 光芒 - 旋转动画 */}
            <g stroke="#fbbf24" strokeWidth="1.5" opacity="0.9">
              <g>
                <animateTransform 
                  attributeName="transform" 
                  type="rotate" 
                  values="0 0 -10;360 0 -10" 
                  dur="3s" 
                  repeatCount="indefinite"
                />
                <line x1="-8" y1="-10" x2="-12" y2="-10"/>
                <line x1="8" y1="-10" x2="12" y2="-10"/>
                <line x1="0" y1="-18" x2="0" y2="-22"/>
                <line x1="-6" y1="-16" x2="-8" y2="-18"/>
                <line x1="6" y1="-16" x2="8" y2="-18"/>
              </g>
            </g>
          </g>
        </svg>
        
        {/* 外圈光环效果 */}
        <div 
          className="absolute inset-0 rounded-full border-2 border-purple-300 opacity-30 animate-ping"
          style={{ 
            width: size, 
            height: size,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
      
      {showText && (
        <div className="mt-3 text-center">
          <div className="text-sm font-semibold text-purple-600 gradient-text">
            研学港 ResearchHub
          </div>
          <div className="text-xs text-gray-500 mt-1">
            加载中...
          </div>
        </div>
      )}
    </div>
  )
}
