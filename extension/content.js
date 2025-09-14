// 研学港 Researchopia - 内容脚本 (改进版，基于backup实现)
console.log('🔬 研学港 Researchopia 内容脚本启动');

class ResearchopiaContentScript {
  constructor() {
    this.detectedDOI = null;
    this.floatingIcon = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.researchopiaUrl = 'https://www.researchopia.com';
    
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
        <img class="icon-logo" src="${chrome.runtime.getURL('icons/logo-main.svg')}" alt="研学港" />
        <div class="icon-texts">
          <span class="icon-cn">研学港</span>
          <span class="icon-en">Researchopia</span>
        </div>
      </div>
      ${this.detectedDOI ? '<div class="doi-indicator">●</div>' : ''}
    `;

    // 应用样式
    this.applyIconStyles();
    
  // 设置初始位置：右上角（按需可持久化位置）
  this.setIconPosition('right', 20, 20);
    
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
      width: 85px !important;
      height: 36px !important;
      background: ${this.detectedDOI ? 
        'linear-gradient(135deg, #4f80ff, #6a8cff)' : 
        'linear-gradient(135deg, #9ca3af, #6b7280)'
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
        gap: 6px !important;
        transform: translateY(-1px);
      `;
    }

    const logoEl = this.floatingIcon.querySelector('.icon-logo');
    if (logoEl) {
      logoEl.style.cssText = `
        display: inline-block !important;
        width: 16px !important;
        height: 16px !important;
        object-fit: contain !important;
        border-radius: 3px !important;
        background: rgba(255,255,255,0.9) !important;
        padding: 1px !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important;
      `;
    }

    const texts = this.floatingIcon.querySelector('.icon-texts');
    if (texts) {
      texts.style.cssText = `
        display: flex !important;
        flex-direction: column !important;
        line-height: 1 !important;
      `;
    }

    const cn = this.floatingIcon.querySelector('.icon-cn');
    if (cn) {
      cn.style.cssText = `
        font-size: 11px !important;
        font-weight: 600 !important;
        letter-spacing: .5px !important;
      `;
    }

    const en = this.floatingIcon.querySelector('.icon-en');
    if (en) {
      en.style.cssText = `
        font-size: 8px !important;
        opacity: .9 !important;
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
    let startPosition = { x: 0, y: 0 };
    const DRAG_THRESHOLD = 5; // 拖拽阈值：5像素

    // 鼠标按下
    this.floatingIcon.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // 只响应左键
      
      clickStartTime = Date.now();
      hasMoved = false;
      
      // 记录起始位置，但不立即进入拖拽模式
      startPosition = { x: e.clientX, y: e.clientY };
      
      this.floatingIcon.style.cursor = 'grabbing';
      this.floatingIcon.style.transform = 'scale(1.1)';
      
      const rect = this.floatingIcon.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      console.log('🖱️ 鼠标按下，起始位置:', startPosition.x, startPosition.y);
      e.preventDefault();
      e.stopPropagation();
    });

    // 鼠标移动（全局）
    document.addEventListener('mousemove', (e) => {
      // 如果还没进入拖拽模式，检查是否需要进入
      if (!this.isDragging && startPosition.x !== 0) {
        const deltaX = Math.abs(e.clientX - startPosition.x);
        const deltaY = Math.abs(e.clientY - startPosition.y);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > DRAG_THRESHOLD) {
          this.isDragging = true;
          // 禁用过渡效果，使拖拽更流畅
          this.floatingIcon.style.transition = 'transform 0.1s';
          console.log('🖱️ 开始拖拽，移动距离:', distance);
        }
      }
      
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
      
      // 降噪：移除拖拽过程中的详细日志
      e.preventDefault();
    });

    // 鼠标释放（全局）
    document.addEventListener('mouseup', (e) => {
      // 重置起始位置
      const wasMouseDown = startPosition.x !== 0;
      startPosition = { x: 0, y: 0 };
      
      if (!wasMouseDown) return;
      
      this.floatingIcon.style.cursor = 'grab';
      this.floatingIcon.style.transform = 'scale(1)';
      
      if (this.isDragging) {
        // 边缘吸附逻辑
        this.snapToEdge();
        
        // 恢复过渡效果
        this.floatingIcon.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
  // 降噪：移除拖拽结束日志
        this.isDragging = false;
      } else {
        // 如果没有进入拖拽模式且时间短，认为是点击
        const clickDuration = Date.now() - clickStartTime;
        if (clickDuration < 300) {
          console.log('👆 检测到点击事件');
          this.handleIconClick();
        }
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
        // 降噪：移除悬停日志
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
    
    // 降噪：移除吸附日志
  }

  // 处理图标点击
  handleIconClick() {
    console.log('👆 浮动图标被点击');
    // 关键点：无论是否检测到 DOI，都尝试打开侧边栏
    try {
      const payload = {
        action: 'toggleSidePanel',
        doi: this.detectedDOI || null,
        url: window.location.href
      };
      console.log('📨 发送toggleSidePanel消息到background');

      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('⚠️ 消息发送失败:', chrome.runtime.lastError.message);
          return;
        }

        const success = !!(response && response.success);
        console.log('📬 Background响应（toggleSidePanel）:', response);
        if (success && !this.detectedDOI) {
          // 无 DOI 的轻量提示，不阻断
          this.showNoDOISoftHint();
        }
      });
    } catch (err) {
      console.error('❌ 发送打开侧边栏请求失败:', err);
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

  // 无 DOI 的轻量提示（不遮挡屏幕，不阻断操作）
  showNoDOISoftHint() {
    const hint = document.createElement('div');
    hint.textContent = '未检测到DOI，已为您打开侧边栏主页';
    hint.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      background: rgba(17,24,39,.92);
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,.25);
      pointer-events: none;
      opacity: 0;
      transition: opacity .2s ease;
    `;
    document.body.appendChild(hint);
    requestAnimationFrame(() => { hint.style.opacity = '1'; });
    setTimeout(() => {
      hint.style.opacity = '0';
      setTimeout(() => hint.remove(), 200);
    }, 2000);
  }

  // 打开侧边栏 - 使用 background 代理实现
  async openSidebar() {
    console.log('📖 尝试打开侧边栏，DOI:', this.detectedDOI);

    // 可选：预先保存 DOI 信息，供侧边栏读取（不依赖用户手势）
    if (this.detectedDOI) {
      try {
        await chrome.storage.sync.set({
          doiFromContentScript: this.detectedDOI,
          currentPageUrl: window.location.href,
          lastClickTime: Date.now()
        });
        console.log('💾 DOI信息已保存:', this.detectedDOI);
      } catch (storageError) {
        console.error('存储失败:', storageError);
      }
    }

    let success = false;

    // 方法1: 发送 openSidePanel 消息（后台会尝试打开侧边栏）
    try {
      console.log('🛰️ 尝试方法1: 发送 openSidePanel 消息');
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'openSidePanel', doi: this.detectedDOI, url: window.location.href },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(resp);
            }
          }
        );
      });
      console.log('✅ 方法1成功，响应:', response);
      success = !!(response && response.success);
    } catch (error1) {
      console.log('⚠️ 方法1失败:', error1.message);
    }

    // content script 无法直接使用 chrome.sidePanel，跳过方法2
    if (!success) {
      console.log('ℹ️ content script 无法直接使用 chrome.sidePanel，跳过方法2');
    }

    // 保持静默：不再显示“点击工具栏图标”的提示

    return success;
  }

  // （已移除）手动提示函数

  // 设置消息监听器
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 收到消息:', request);
      
      switch (request.action) {
        case 'toggleFloating':  // 修复：匹配popup发送的消息
        case 'toggleFloatingIcon':  // 保持兼容性
          this.toggleFloatingIcon();
          sendResponse({ success: true });
          break;
        
        case 'getCurrentDOI':
          // 提供当前检测到的 DOI 给侧边栏或其他页面
          sendResponse({ success: true, doi: this.detectedDOI || null });
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
        
        case 'panelClosed':
          this.showClosedToast();
          sendResponse?.({ success: true });
          break;
          
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

  showClosedToast() {
    const hint = document.createElement('div');
    hint.textContent = '侧边栏已关闭';
    hint.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      background: rgba(17,24,39,.92);
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,.25);
      pointer-events: none;
      opacity: 0;
      transition: opacity .2s ease;
    `;
    document.body.appendChild(hint);
    requestAnimationFrame(() => { hint.style.opacity = '1'; });
    setTimeout(() => {
      hint.style.opacity = '0';
      setTimeout(() => hint.remove(), 200);
    }, 1000);
  }
}

// 初始化内容脚本
if (typeof window !== 'undefined' && !window.researchopiaContentScript) {
  window.researchopiaContentScript = new ResearchopiaContentScript();
  console.log('✅ 研学港内容脚本初始化完成');
}