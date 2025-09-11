'use client'

interface BrandLogoProps {
  size?: number
  variant?: 'full' | 'icon-only' | 'text-only'
  theme?: 'light' | 'dark' | 'gradient'
  animated?: boolean
  className?: string
  onClick?: () => void
}

export default function BrandLogo({ 
  size = 120, 
  variant = 'full',
  theme = 'gradient',
  animated = false,
  className = "",
  onClick
}: BrandLogoProps) {
  const getThemeColors = () => {
    switch (theme) {
      case 'light':
        return {
          primary: '#7c3aed',
          secondary: '#a855f7',
          accent: '#fbbf24',
          text: '#1f2937'
        }
      case 'dark':
        return {
          primary: '#a855f7',
          secondary: '#c084fc',
          accent: '#fbbf24',
          text: '#f9fafb'
        }
      default: // gradient
        return {
          primary: 'rgba(124,58,237,0.9)',
          secondary: 'rgba(168,85,247,0.8)',
          accent: '#fbbf24',
          text: 'rgba(255,255,255,0.95)'
        }
    }
  }

  const colors = getThemeColors()
  
  if (variant === 'text-only') {
    return (
      <div 
        className={`cursor-pointer ${className}`}
        onClick={onClick}
      >
        <div className={`text-${Math.round(size/6)}xl font-bold ${theme === 'light' ? 'text-gray-900' : theme === 'dark' ? 'text-white' : 'text-white'} ${animated ? 'gradient-text' : ''}`}>
          研学港
        </div>
        <div className={`text-${Math.round(size/12)}xl ${theme === 'light' ? 'text-gray-600' : theme === 'dark' ? 'text-gray-300' : 'text-white opacity-80'} -mt-1`}>
          ResearchHub
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`${onClick ? 'cursor-pointer' : ''} ${className} ${animated ? 'animate-float' : ''}`}
      {...(onClick && { onClick })}
    >
      <div className="relative inline-block">
        <svg 
          width={size} 
          height={size} 
          viewBox="0 0 120 120" 
          xmlns="http://www.w3.org/2000/svg"
          className={animated ? 'animate-pulse-slow' : ''}
        >
          {/* 港口波浪 */}
          <path 
            d="M 10 80 Q 30 70, 50 80 T 90 80 T 130 80" 
            fill="none" 
            stroke={colors.secondary} 
            strokeWidth="3"
          >
            {animated && (
              <animate 
                attributeName="d" 
                values="M 10 80 Q 30 70, 50 80 T 90 80 T 130 80;M 10 82 Q 30 72, 50 82 T 90 82 T 130 82;M 10 80 Q 30 70, 50 80 T 90 80 T 130 80" 
                dur="3s" 
                repeatCount="indefinite"
              />
            )}
          </path>
          <path 
            d="M 10 85 Q 30 75, 50 85 T 90 85 T 130 85" 
            fill="none" 
            stroke={colors.primary} 
            strokeWidth="2"
          >
            {animated && (
              <animate 
                attributeName="d" 
                values="M 10 85 Q 30 75, 50 85 T 90 85 T 130 85;M 10 87 Q 30 77, 50 87 T 90 87 T 130 87;M 10 85 Q 30 75, 50 85 T 90 85 T 130 85" 
                dur="3s" 
                repeatCount="indefinite"
              />
            )}
          </path>
          
          {/* 书本形状 */}
          <g transform="translate(60,60)">
            <rect x="-25" y="-20" width="50" height="30" fill="rgba(255,255,255,0.95)" rx="3"/>
            <rect x="-23" y="-18" width="46" height="26" fill={colors.primary} rx="2"/>
            
            {/* 书页线条 */}
            <line x1="-15" y1="-10" x2="15" y2="-10" stroke="white" strokeWidth="1.5" opacity="0.9"/>
            <line x1="-15" y1="-5" x2="15" y2="-5" stroke="white" strokeWidth="1.5" opacity="0.8"/>
            <line x1="-15" y1="0" x2="15" y2="0" stroke="white" strokeWidth="1.5" opacity="0.9"/>
            <line x1="-15" y1="5" x2="15" y2="5" stroke="white" strokeWidth="1.5" opacity="0.8"/>
            
            {/* 中心分割线 */}
            <line x1="0" y1="-18" x2="0" y2="8" stroke="#6d28d9" strokeWidth="1.5"/>
          </g>
          
          {/* 灯塔/指引 */}
          <g transform="translate(85,35)">
            <rect x="-2" y="-10" width="4" height="20" fill={colors.accent} rx="1"/>
            <circle cx="0" cy="-12" r="4" fill={colors.accent}/>
            {/* 光芒 */}
            <g stroke={colors.accent} strokeWidth="2" opacity="0.9">
              <g>
                {animated && (
                  <animateTransform 
                    attributeName="transform" 
                    type="rotate" 
                    values="0 0 -12;360 0 -12" 
                    dur="4s" 
                    repeatCount="indefinite"
                  />
                )}
                <line x1="-10" y1="-12" x2="-14" y2="-12"/>
                <line x1="10" y1="-12" x2="14" y2="-12"/>
                <line x1="0" y1="-20" x2="0" y2="-24"/>
                <line x1="-7" y1="-19" x2="-10" y2="-22"/>
                <line x1="7" y1="-19" x2="10" y2="-22"/>
                <line x1="-7" y1="-5" x2="-10" y2="-2"/>
                <line x1="7" y1="-5" x2="10" y2="-2"/>
              </g>
            </g>
          </g>
          
          {variant === 'full' && (
            <text 
              x="60" 
              y="100" 
              fontFamily="Arial, sans-serif" 
              fontSize="14" 
              fontWeight="bold" 
              fill={colors.text} 
              textAnchor="middle"
            >
              ResearchHub
            </text>
          )}
        </svg>
        
        {animated && (
          <div className="absolute inset-0 rounded-full border-2 border-white opacity-30 animate-ping"></div>
        )}
      </div>
      
      {variant === 'full' && (
        <div className="text-center mt-2">
          <div className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : theme === 'dark' ? 'text-white' : 'text-white'}`}>
            研学港
          </div>
          <div className={`text-sm ${theme === 'light' ? 'text-gray-600' : theme === 'dark' ? 'text-gray-300' : 'text-white opacity-80'} -mt-1`}>
            研学并进，智慧共享
          </div>
        </div>
      )}
    </div>
  )
}
