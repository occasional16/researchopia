// 研学港浏览器扩展 - 调试版内容脚本
console.log('🚀 研学港扩展内容脚本开始加载...');

class ResearchopiaContentScript {
  constructor() {
    this.floatingIcon = null;
    this.isDragging = false;
    this.wasDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.globalMouseMove = null;
    this.globalMouseUp = null;
    this.detectedDOI = null;
    this.settings = {
      floatingEnabled: true,
      sidebarEnabled: true,
      autoDetectDOI: true
    };
    
    console.log('✅ ResearchopiaContentScript 构造函数完成');
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(this.settings);
      this.settings = { ...this.settings, ...result };
      console.log('📋 设置加载完成:', this.settings);
      return this.settings;
    } catch (error) {
      console.error('❌ 设置加载失败:', error);
      return this.settings;
    }
  }

  async setup() {
    console.log('🚀 研学港扩展开始初始化...');
    
    try {
      console.log('📋 加载设置...');
      await this.loadSettings();
      console.log('✅ 设置加载完成:', this.settings);
      
      console.log('🔍 开始DOI检测...');
      await this.detectDOI();
      console.log('✅ DOI检测完成:', this.detectedDOI);
      
      console.log('📡 设置消息监听...');
      this.setupMessageListener();
      
      // 强制显示浮动图标（用于调试）
      console.log('📌 创建浮动图标...');
      console.log('floatingEnabled设置:', this.settings.floatingEnabled);
      
      // 总是创建浮动图标用于调试
      console.log('🔧 调试模式：强制创建浮动图标');
      this.createFloatingIcon();
      console.log('✅ 浮动图标已创建');
      
      console.log('🎉 研学港扩展已完全加载');
    } catch (error) {
      console.error('❌ 研学港扩展初始化失败:', error);
    }
  }

  createFloatingIcon() {
    console.log('🔨 开始创建浮动图标...');
    
    // 检查是否已经存在
    if (this.floatingIcon) {
      console.log('⚠️ 浮动图标已存在，移除旧图标');
      this.floatingIcon.remove();
    }

    this.floatingIcon = document.createElement('div');
    this.floatingIcon.className = 'researchopia-floating-icon';
    this.floatingIcon.innerHTML = `
      <div class="icon-text">研</div>
    `;

    // 设置样式
    Object.assign(this.floatingIcon.style, {
      position: 'fixed',
      top: '100px',
      right: '20px',
      width: '60px',
      height: '60px',
      backgroundColor: '#667eea',
      borderRadius: '50%',
      cursor: 'move',
      zIndex: '2147483647', // 最高z-index值
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'all 0.3s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: 'white',
      fontSize: '24px',
      fontWeight: 'bold',
      userSelect: 'none',
      pointerEvents: 'auto',
      visibility: 'visible',
      opacity: '1',
      transform: 'translateZ(0)', // 启用硬件加速
      border: '2px solid rgba(255,255,255,0.3)'
    });
    
    console.log('📐 浮动图标样式设置完成');
    
    // 注入强制样式确保显示
    const forceStyle = document.createElement('style');
    forceStyle.id = 'researchopia-floating-style';
    forceStyle.textContent = `
      .researchopia-floating-icon {
        position: fixed !important;
        top: 100px !important;
        right: 20px !important;
        width: 60px !important;
        height: 60px !important;
        background-color: #667eea !important;
        border-radius: 50% !important;
        cursor: move !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        color: white !important;
        font-size: 24px !important;
        font-weight: bold !important;
        user-select: none !important;
        pointer-events: auto !important;
        visibility: visible !important;
        opacity: 1 !important;
        transform: translateZ(0) !important;
        border: 2px solid rgba(255,255,255,0.3) !important;
        transition: all 0.3s ease !important;
      }
      
      .researchopia-floating-icon:hover {
        transform: scale(1.1) translateZ(0) !important;
        box-shadow: 0 6px 16px rgba(0,0,0,0.4) !important;
      }
    `;
    
    // 移除旧样式（如果存在）
    const oldStyle = document.getElementById('researchopia-floating-style');
    if (oldStyle) {
      oldStyle.remove();
    }
    
    // 添加新样式
    document.head.appendChild(forceStyle);
    console.log('🎨 强制CSS样式已注入');
    
    // 设置事件
    this.setupFloatingIconEvents(this.floatingIcon);
    console.log('🎛️ 浮动图标事件设置完成');

    // 添加到页面
    try {
      // 确保document.body存在
      if (!document.body) {
        console.error('❌ document.body不存在，延迟添加浮动图标');
        setTimeout(() => this.createFloatingIcon(), 100);
        return;
      }
      
      document.body.appendChild(this.floatingIcon);
      console.log('✅ 浮动图标已添加到页面DOM');
      
      // 强制重绘和验证
      this.floatingIcon.offsetHeight; // 触发重绘
      
      // 验证是否真的添加成功
      setTimeout(() => {
        const addedIcon = document.querySelector('.researchopia-floating-icon');
        if (addedIcon) {
          const rect = addedIcon.getBoundingClientRect();
          console.log('✅ 浮动图标在DOM中确认存在');
          console.log('📏 图标位置信息:', {
            top: addedIcon.style.top,
            right: addedIcon.style.right,
            zIndex: addedIcon.style.zIndex,
            display: addedIcon.style.display,
            visibility: getComputedStyle(addedIcon).visibility,
            opacity: getComputedStyle(addedIcon).opacity,
            position: getComputedStyle(addedIcon).position,
            boundingRect: rect
          });
          
          // 检查是否在可视区域内
          if (rect.width === 0 || rect.height === 0) {
            console.warn('⚠️ 浮动图标尺寸为0，可能被CSS隐藏');
          }
          if (rect.top < 0 || rect.left < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
            console.warn('⚠️ 浮动图标可能在可视区域外');
          }
        } else {
          console.error('❌ 浮动图标未在DOM中找到');
          // 尝试重新创建
          console.log('🔄 尝试重新创建浮动图标...');
          setTimeout(() => this.createFloatingIcon(), 500);
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ 添加浮动图标到DOM失败:', error);
    }
  }

  setupFloatingIconEvents(icon) {
    console.log('🎛️ 设置浮动图标事件...');
    
    // 点击事件
    icon.addEventListener('click', (e) => {
      // 如果在拖拽，不触发点击
      if (this.wasDragging) {
        this.wasDragging = false;
        return;
      }
      console.log('🖱️ 浮动图标被点击');
      e.preventDefault();
      e.stopPropagation();
      this.handleFloatingIconClick();
    });

    // 鼠标按下事件
    icon.addEventListener('mousedown', (e) => {
      console.log('🖱️ 浮动图标鼠标按下，开始拖拽');
      this.isDragging = true;
      this.wasDragging = false;
      
      const rect = icon.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      icon.style.cursor = 'grabbing';
      icon.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    });

    // 移除旧的全局事件监听器（如果存在）
    if (this.globalMouseMove) {
      document.removeEventListener('mousemove', this.globalMouseMove);
    }
    if (this.globalMouseUp) {
      document.removeEventListener('mouseup', this.globalMouseUp);
    }

    // 鼠标移动事件（全局）
    this.globalMouseMove = (e) => {
      if (this.isDragging && icon) {
        this.wasDragging = true;
        const newX = e.clientX - this.dragOffset.x;
        const newY = e.clientY - this.dragOffset.y;
        
        // 限制在视窗内
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;
        
        const finalX = Math.max(0, Math.min(maxX, newX));
        const finalY = Math.max(0, Math.min(maxY, newY));
        
        icon.style.left = `${finalX}px`;
        icon.style.top = `${finalY}px`;
        icon.style.right = 'auto';
        icon.style.bottom = 'auto';
        
        console.log('🖱️ 拖拽移动到:', finalX, finalY);
        e.preventDefault();
      }
    };

    // 鼠标抬起事件（全局）
    this.globalMouseUp = (e) => {
      if (this.isDragging) {
        console.log('🖱️ 拖拽结束');
        this.isDragging = false;
        if (icon) {
          icon.style.cursor = 'move';
        }
        e.preventDefault();
      }
    };

    // 添加全局事件监听器
    document.addEventListener('mousemove', this.globalMouseMove);
    document.addEventListener('mouseup', this.globalMouseUp);
    
    console.log('✅ 浮动图标拖拽事件设置完成');
  }

  handleFloatingIconClick() {
    console.log('🎯 处理浮动图标点击事件');
    
    // 尝试打开侧边栏
    this.openSidebar();
  }

  openSidebar() {
    console.log('📋 尝试打开研学港侧边栏...');
    
    try {
      // 向background script发送打开侧边栏的消息
      chrome.runtime.sendMessage({
        type: 'OPEN_SIDEBAR',
        url: window.location.href,
        doi: this.detectedDOI
      }, (response) => {
        if (response && response.success) {
          console.log('✅ 侧边栏打开成功');
        } else {
          console.error('❌ 侧边栏打开失败:', response?.error);
        }
      });
    } catch (error) {
      console.error('❌ 打开侧边栏时发生错误:', error);
    }
  }

  async detectDOI() {
    console.log('🔍 开始检测DOI...');
    
    if (!this.settings.autoDetectDOI) {
      console.log('⚠️ 自动DOI检测已禁用');
      return null;
    }

    // 检测方法1: meta标签
    const metaDOI = document.querySelector('meta[name="citation_doi"], meta[name="dc.identifier"], meta[property="og:doi"]');
    if (metaDOI) {
      const rawDoi = metaDOI.getAttribute('content');
      const cleanedDoi = this.cleanDOI(rawDoi);
      console.log('🔍 原始DOI:', rawDoi, '清理后DOI:', cleanedDoi);
      if (this.isValidDOI(cleanedDoi)) {
        console.log('✅ 从meta标签检测到DOI:', cleanedDoi);
        this.detectedDOI = cleanedDoi;
        return cleanedDoi;
      }
    }

    // 检测方法2: 当前URL
    const urlDOI = this.extractDOIFromURL(window.location.href);
    if (urlDOI) {
      const cleanedUrlDoi = this.cleanDOI(urlDOI);
      console.log('✅ 从URL检测到DOI:', cleanedUrlDoi);
      this.detectedDOI = cleanedUrlDoi;
      return cleanedUrlDoi;
    }

    console.log('❌ 未检测到有效DOI');
    return null;
  }

  extractDOIFromURL(url) {
    const doiPatterns = [
      /doi\.org\/(.+)/i,
      /doi:\s*(10\.\d{4,}\/[^\s]+)/i,
      /\/doi\/(10\.\d{4,}\/[^\/\s]+)/i,
      /(10\.\d{4,}\/[^\s]+)/i
    ];

    for (const pattern of doiPatterns) {
      const match = url.match(pattern);
      if (match) {
        let doi = match[1] || match[0];
        doi = this.cleanDOI(doi);
        if (this.isValidDOI(doi)) {
          return doi;
        }
      }
    }
    return null;
  }

  cleanDOI(doi) {
    if (!doi) return '';
    
    doi = doi.replace(/^doi:/i, '');
    doi = doi.replace(/[.,;:)\]}"'>]*$/, '');
    doi = doi.replace(/<[^>]*>/g, '');
    
    return doi.trim();
  }

  isValidDOI(doi) {
    if (!doi || typeof doi !== 'string') return false;
    const doiPattern = /^10\.\d{4,}\/\S+$/;
    return doiPattern.test(this.cleanDOI(doi));
  }

  setupMessageListener() {
    console.log('📡 设置消息监听器...');
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 收到消息:', message);
      
      // 兼容两种消息格式
      const messageType = message.type || message.action;
      
      switch (messageType) {
        case 'TOGGLE_FLOATING_ICON':
        case 'toggleFloating':
          this.toggleFloatingIcon(message.enabled);
          sendResponse({ success: true });
          break;
          
        case 'OPEN_SIDEBAR':
        case 'openSidebar':
          this.openSidebar();
          sendResponse({ success: true });
          break;
          
        case 'GET_DOI':
        case 'detectDOI':
          sendResponse({ 
            success: true, 
            doi: this.detectedDOI,
            url: window.location.href 
          });
          break;
          
        default:
          console.log('❓ 未知消息类型:', messageType);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
      
      return true; // 保持消息通道开放
    });
  }

  toggleFloatingIcon(enabled) {
    console.log('🔄 切换浮动图标显示状态:', enabled);
    console.log('当前浮动图标对象:', this.floatingIcon ? '存在' : '不存在');
    
    if (enabled) {
      if (!this.floatingIcon) {
        console.log('📌 浮动图标不存在，创建新的');
        this.createFloatingIcon();
      } else {
        console.log('📌 显示现有浮动图标');
        this.floatingIcon.style.display = 'flex';
        this.floatingIcon.style.visibility = 'visible';
        this.floatingIcon.style.opacity = '1';
      }
    } else {
      if (this.floatingIcon) {
        console.log('🫥 隐藏浮动图标');
        this.floatingIcon.style.display = 'none';
      } else {
        console.log('⚠️ 浮动图标不存在，无法隐藏');
      }
    }
    
    // 保存设置
    this.settings.floatingEnabled = enabled;
    try {
      chrome.storage.sync.set({ floatingEnabled: enabled });
      console.log('💾 浮动图标设置已保存:', enabled);
    } catch (error) {
      console.error('❌ 保存浮动图标设置失败:', error);
    }
  }

  removeFloatingIcon() {
    console.log('🗑️ 移除浮动图标');
    if (this.floatingIcon) {
      this.floatingIcon.remove();
      this.floatingIcon = null;
    }
  }
}

// 初始化脚本
console.log('🎬 开始初始化研学港扩展...');

// 等待DOM加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM加载完成，初始化扩展');
    const script = new ResearchopiaContentScript();
    script.setup();
  });
} else {
  console.log('📄 DOM已就绪，立即初始化扩展');
  const script = new ResearchopiaContentScript();
  script.setup();
}