// 研学港 Researchopia - 内容脚本 (改进版，基于backup实现)
console.log('🔬 研学港 Researchopia 内容脚本启动');

class ResearchopiaContentScript {
  constructor() {
    this.detectedDOI = null;
    this.floatingIcon = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.researchopiaUrl = 'http://localhost:3000';
    
    this.init();
  }

  async init() {
    console.log('🚀 初始化研学港内容脚本');
    
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.startup());
    } else {
      this.startup();
    }
  }

  startup() {
    console.log('📄 页面加载完成，开始检测DOI和创建界面');
    this.detectDOI();
    this.createFloatingIcon();
    this.setupMessageListener();
  }

  // DOI检测方法
  detectDOI() {
    console.log('🔍 开始检测DOI...');
    
    // 方法1: 从meta标签提取
    const doiMeta = document.querySelector('meta[name="citation_doi"]');
    if (doiMeta && doiMeta.content) {
      this.detectedDOI = this.cleanDOI(doiMeta.content);
      console.log('✅ 从meta标签检测到DOI:', this.detectedDOI);
      return this.detectedDOI;
    }

    // 方法2: 从URL提取 
    const urlPatterns = [
      /doi\.org\/(.+)$/i,
      /\/doi\/(.+?)(?:\?|$)/i,
      /doi[=:]([^&\s]+)/i
    ];
    
    for (const pattern of urlPatterns) {
      const match = window.location.href.match(pattern);
      if (match && match[1]) {
        this.detectedDOI = this.cleanDOI(decodeURIComponent(match[1]));
        console.log('✅ 从URL检测到DOI:', this.detectedDOI);
        return this.detectedDOI;
      }
    }

    // 方法3: 从页面内容提取
    const textPattern = /(?:doi[:=]\s*)?10\.\d{4,}\/[^\s,\);"'<>]+/i;
    const pageText = document.body.textContent || document.body.innerText;
    const textMatch = pageText.match(textPattern);
    
    if (textMatch) {
      this.detectedDOI = this.cleanDOI(textMatch[0].replace(/^doi[:=]\s*/i, ''));
      console.log('✅ 从页面内容检测到DOI:', this.detectedDOI);
      return this.detectedDOI;
    }

    // 方法4: 从JSON-LD结构化数据提取
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const doi = this.extractDOIFromJsonLd(data);
        if (doi) {
          this.detectedDOI = this.cleanDOI(doi);
          console.log('✅ 从JSON-LD检测到DOI:', this.detectedDOI);
          return this.detectedDOI;
        }
      } catch (error) {
        // 忽略JSON解析错误
      }
    }

    console.log('❌ 未检测到DOI');
    return null;
  }

  // 清理DOI格式
  cleanDOI(doi) {
    if (!doi) return null;
    return doi.replace(/^(doi:|https?:\/\/(dx\.)?doi\.org\/)/, '').trim();
  }

  // 从JSON-LD结构化数据中提取DOI
  extractDOIFromJsonLd(data) {
    if (!data) return null;
    
    // 处理数组
    if (Array.isArray(data)) {
      for (const item of data) {
        const doi = this.extractDOIFromJsonLd(item);
        if (doi) return doi;
      }
    }
    
    // 处理对象
    if (typeof data === 'object') {
      // 直接查找DOI字段
      if (data.doi) return data.doi;
      if (data.identifier) {
        if (typeof data.identifier === 'string' && data.identifier.includes('10.')) {
          return data.identifier;
        }
        if (Array.isArray(data.identifier)) {
          for (const id of data.identifier) {
            if (typeof id === 'string' && id.includes('10.')) return id;
            if (id.value && id.value.includes('10.')) return id.value;
          }
        }
      }
    }
    
    return null;
  }

  // 创建浮动图标
  createFloatingIcon() {
    console.log('🎨 开始创建浮动图标...');
    
    // 移除已存在的图标
    const existing = document.getElementById('researchopia-floating-icon');
    if (existing) {
      console.log('🗑️ 移除已存在的浮动图标');
      existing.remove();
    }

    this.floatingIcon = document.createElement('div');
    this.floatingIcon.id = 'researchopia-floating-icon';
    this.floatingIcon.innerHTML = `
      <div class="icon-main">
        <span class="icon-symbol">🔬</span>
        <span class="icon-text">研学港</span>
      </div>
      ${this.detectedDOI ? '<div class="doi-indicator">●</div>' : ''}
    `;

    // 应用样式
    this.applyIconStyles();
    
    // 设置初始位置（左侧）
    this.setIconPosition('left', 20, '50%');
    
    // 绑定事件
    this.bindIconEvents();

    // 添加到页面
    document.body.appendChild(this.floatingIcon);
    
    console.log('✅ 浮动图标创建完成', this.detectedDOI ? '(检测到DOI)' : '(未检测到DOI)');
    return this.floatingIcon;
  }

  // 应用图标样式
  applyIconStyles() {
    this.floatingIcon.style.cssText = `
      position: fixed !important;
      width: 80px !important;
      height: 36px !important;
      background: ${this.detectedDOI ? 
        'linear-gradient(135deg, #155DFC, #1e40af)' : 
        'linear-gradient(135deg, #6b7280, #4b5563)'
      } !important;
      color: white !important;
      border-radius: 18px !important;
      cursor: grab !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      user-select: none !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border: 2px solid rgba(255, 255, 255, 0.2) !important;
    `;

    // 主内容样式
    const iconMain = this.floatingIcon.querySelector('.icon-main');
    if (iconMain) {
      iconMain.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        font-size: 11px !important;
        font-weight: 500 !important;
      `;
    }

    // DOI指示器样式
    const doiIndicator = this.floatingIcon.querySelector('.doi-indicator');
    if (doiIndicator) {
      doiIndicator.style.cssText = `
        position: absolute !important;
        top: -2px !important;
        right: -2px !important;
        width: 8px !important;
        height: 8px !important;
        background: #22c55e !important;
        border-radius: 50% !important;
        font-size: 8px !important;
        line-height: 8px !important;
        color: #22c55e !important;
      `;
    }
  }

  // 设置图标位置
  setIconPosition(side, x, y) {
    if (side === 'right') {
      this.floatingIcon.style.right = x + 'px';
      this.floatingIcon.style.left = 'auto';
    } else {
      this.floatingIcon.style.left = x + 'px';  
      this.floatingIcon.style.right = 'auto';
    }
    
    if (y === '50%') {
      this.floatingIcon.style.top = '50%';
      this.floatingIcon.style.transform = 'translateY(-50%)';
    } else {
      this.floatingIcon.style.top = y + 'px';
      this.floatingIcon.style.transform = 'none';
    }
  }

  // 绑定图标事件
  bindIconEvents() {
    let clickStartTime = 0;
    let hasMoved = false;

    // 鼠标按下
    this.floatingIcon.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // 只响应左键
      
      clickStartTime = Date.now();
      hasMoved = false;
      this.isDragging = true;
      
      this.floatingIcon.style.cursor = 'grabbing';
      this.floatingIcon.style.transform = 'scale(1.1)';
      
      const rect = this.floatingIcon.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // 禁用过渡效果，使拖拽更流畅
      this.floatingIcon.style.transition = 'transform 0.1s';
      
      console.log('🖱️ 开始拖拽，初始位置:', rect.left, rect.top);
      e.preventDefault();
      e.stopPropagation();
    });

    // 鼠标移动（全局）
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      hasMoved = true;
      
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;
      
      // 限制在视口内
      const maxX = window.innerWidth - this.floatingIcon.offsetWidth;
      const maxY = window.innerHeight - this.floatingIcon.offsetHeight;
      
      const constrainedX = Math.max(0, Math.min(maxX, x));
      const constrainedY = Math.max(0, Math.min(maxY, y));
      
      this.floatingIcon.style.left = constrainedX + 'px';
      this.floatingIcon.style.right = 'auto';
      this.floatingIcon.style.top = constrainedY + 'px';
      this.floatingIcon.style.transform = 'scale(1.1)';
      
      console.log('🖱️ 拖拽移动到:', constrainedX, constrainedY);
      e.preventDefault();
    });

    // 鼠标释放（全局）
    document.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;
      
      this.isDragging = false;
      this.floatingIcon.style.cursor = 'grab';
      this.floatingIcon.style.transform = 'scale(1)';
      
      // 边缘吸附逻辑
      this.snapToEdge();
      
      // 恢复过渡效果
      this.floatingIcon.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      
      console.log('🖱️ 停止拖拽');
      
      // 如果没有移动且时间短，认为是点击
      const clickDuration = Date.now() - clickStartTime;
      if (!hasMoved && clickDuration < 300) {
        console.log('👆 检测到点击事件');
        this.handleIconClick();
      }
    });

    // 悬停效果
    this.floatingIcon.addEventListener('mouseenter', () => {
      if (!this.isDragging) {
        const currentTransform = this.floatingIcon.style.transform;
        if (currentTransform.includes('translateY(-50%)')) {
          this.floatingIcon.style.transform = 'translateY(-50%) scale(1.05)';
        } else {
          this.floatingIcon.style.transform = 'scale(1.05)';
        }
        console.log('🖱️ 鼠标悬停');
      }
    });

    this.floatingIcon.addEventListener('mouseleave', () => {
      if (!this.isDragging) {
        const currentTransform = this.floatingIcon.style.transform;
        if (currentTransform.includes('translateY(-50%)')) {
          this.floatingIcon.style.transform = 'translateY(-50%)';
        } else {
          this.floatingIcon.style.transform = 'none';
        }
      }
    });
  }

  // 边缘吸附
  snapToEdge() {
    const rect = this.floatingIcon.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const iconCenterX = rect.left + rect.width / 2;
    
    const margin = 20;
    
    // 判断靠近左边还是右边
    if (iconCenterX < windowWidth / 2) {
      // 吸附到左边
      this.setIconPosition('left', margin, rect.top);
    } else {
      // 吸附到右边  
      this.setIconPosition('right', margin, rect.top);
    }
    
    console.log('🧲 图标吸附到边缘');
  }

  // 处理图标点击
  handleIconClick() {
    console.log('👆 浮动图标被点击');
    if (this.detectedDOI) {
      this.openSidebar();
    } else {
      console.log('⚠️ 未检测到DOI，显示提示');
      this.showNoDOIMessage();
    }
  }

  // 显示无DOI提示
  showNoDOIMessage() {
    // 简单的提示实现
    const tooltip = document.createElement('div');
    tooltip.textContent = '未检测到DOI，请在学术论文页面使用';
    tooltip.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 2147483648;
      pointer-events: none;
    `;
    
    document.body.appendChild(tooltip);
    setTimeout(() => tooltip.remove(), 2000);
  }

  // 打开侧边栏
  async openSidebar() {
    console.log('📖 尝试打开侧边栏，DOI:', this.detectedDOI);
    
    try {
      // 发送消息给background script
      const response = await chrome.runtime.sendMessage({
        action: 'openSidePanel',
        doi: this.detectedDOI,
        url: window.location.href
      });
      
      console.log('📨 Background响应:', response);
      return response;
    } catch (error) {
      console.error('❌ 打开侧边栏失败:', error);
      return false;
    }
  }

  // 设置消息监听器
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 收到消息:', request);
      
      switch (request.action) {
        case 'toggleFloatingIcon':
          this.toggleFloatingIcon();
          sendResponse({ success: true });
          break;
          
        case 'detectDOI':
          const doi = this.detectDOI();
          sendResponse({ success: true, doi: doi });
          break;
          
        case 'openSidebar':
          this.openSidebar().then(result => {
            sendResponse({ success: result });
          });
          return true; // 保持消息通道开启
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
  }

  // 切换浮动图标显示/隐藏
  toggleFloatingIcon() {
    console.log('🔄 切换浮动图标显示状态');
    
    if (!this.floatingIcon) {
      console.log('📍 创建浮动图标');
      this.createFloatingIcon();
      return true;
    }
    
    const isVisible = this.floatingIcon.style.display !== 'none';
    this.floatingIcon.style.display = isVisible ? 'none' : 'flex';
    
    console.log(isVisible ? '🙈 隐藏浮动图标' : '👁️ 显示浮动图标');
    return !isVisible;
  }
}

// 初始化内容脚本
if (typeof window !== 'undefined' && !window.researchopiaContentScript) {
  window.researchopiaContentScript = new ResearchopiaContentScript();
  console.log('✅ 研学港内容脚本初始化完成');
}