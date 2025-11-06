# Zotero 7/8 兼容性开发指南

## 目标
实现单一XPI插件包,能够自适应运行在Zotero 7和Zotero 8上,且:
1. 开发过程中不影响现有Zotero 8功能
2. 测试/使用时只需一个XPI文件
3. 代码设计层次分离,版本逻辑互不干扰

---

## 架构设计

### 核心原则: **适配层隔离** (Adapter Pattern)

```
┌─────────────────────────────────────────┐
│         业务逻辑层 (Business Logic)      │
│    ReadingSessionManager, UIManager...  │
└──────────────────┬──────────────────────┘
                   │ 统一API
┌──────────────────▼──────────────────────┐
│          适配层 (ZoteroAdapter)          │
│    版本检测 + API封装 + UI抽象          │
└──────────────────┬──────────────────────┘
                   │ 版本分支
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐      ┌───────────────┐
│  Zotero 8     │      │  Zotero 7     │
│  实现层       │      │  实现层       │
│  (Modern)     │      │  (Legacy)     │
└───────────────┘      └───────────────┘
```

---

## 实施步骤

### 阶段1: 版本检测与适配层基础 (工期: 0.5天)

#### 1.1 创建版本检测模块

**文件**: `src/utils/version-detector.ts`

```typescript
/**
 * Zotero版本检测工具
 * 用于判断当前运行环境并提供版本信息
 */

export class ZoteroVersionDetector {
  private static cachedVersion: number | null = null;

  /**
   * 获取Zotero主版本号 (7 or 8)
   */
  static getMajorVersion(): number {
    if (this.cachedVersion !== null) {
      return this.cachedVersion;
    }

    try {
      const fullVersion = Zotero.version; // e.g., "8.0-beta.13+d1f478fc4" or "7.0.5"
      const majorVersion = parseInt(fullVersion.split('.')[0]);
      this.cachedVersion = majorVersion;
      return majorVersion;
    } catch (error) {
      // 降级到Zotero 7
      console.warn('[Version Detector] Failed to detect version, assuming Zotero 7:', error);
      this.cachedVersion = 7;
      return 7;
    }
  }

  /**
   * 检查是否为Zotero 8
   */
  static isZotero8(): boolean {
    return this.getMajorVersion() >= 8;
  }

  /**
   * 检查是否为Zotero 7
   */
  static isZotero7(): boolean {
    return this.getMajorVersion() === 7;
  }

  /**
   * 获取完整版本字符串
   */
  static getFullVersion(): string {
    return Zotero.version;
  }

  /**
   * 日志输出当前版本信息
   */
  static logVersionInfo(): void {
    console.log(`[Researchopia] Running on Zotero ${this.getFullVersion()} (Major: ${this.getMajorVersion()})`);
  }
}
```

**使用示例**:
```typescript
import { ZoteroVersionDetector } from './utils/version-detector';

if (ZoteroVersionDetector.isZotero8()) {
  // Zotero 8 专有逻辑
} else {
  // Zotero 7 降级逻辑
}
```

---

#### 1.2 创建模块导入适配器

**文件**: `src/adapters/module-adapter.ts`

```typescript
/**
 * 模块导入适配器
 * 统一处理Zotero 7/8的模块导入差异
 */

import { ZoteroVersionDetector } from '../utils/version-detector';

export class ModuleAdapter {
  /**
   * 导入Services模块
   * Zotero 8: Services.sys.mjs
   * Zotero 7: Services.jsm
   */
  static importServices(): any {
    if (ZoteroVersionDetector.isZotero8()) {
      // Zotero 8 使用ESM
      return ChromeUtils.importESModule('resource://gre/modules/Services.sys.mjs').Services;
    } else {
      // Zotero 7 使用CommonJS
      const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
      return Services;
    }
  }

  /**
   * 导入Console模块
   */
  static importConsole(): any {
    if (ZoteroVersionDetector.isZotero8()) {
      return ChromeUtils.importESModule('resource://gre/modules/Console.sys.mjs').console;
    } else {
      const { console } = ChromeUtils.import('resource://gre/modules/Console.jsm');
      return console;
    }
  }

  /**
   * 导入AddonManager模块
   */
  static importAddonManager(): any {
    if (ZoteroVersionDetector.isZotero8()) {
      return ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs').AddonManager;
    } else {
      const { AddonManager } = ChromeUtils.import('resource://gre/modules/AddonManager.jsm');
      return AddonManager;
    }
  }
}
```

**使用示例**:
```typescript
import { ModuleAdapter } from './adapters/module-adapter';

const Services = ModuleAdapter.importServices();
Services.prompt.alert(null, '标题', '内容'); // 同时兼容7/8
```

---

### 阶段2: UI适配层 (工期: 1天)

#### 2.1 创建UI工厂模式

**文件**: `src/adapters/ui-adapter.ts`

```typescript
/**
 * UI适配器
 * 为Zotero 7/8提供统一的UI创建接口
 */

import { ZoteroVersionDetector } from '../utils/version-detector';
import { ModernUIRenderer } from './ui-modern'; // Zotero 8
import { LegacyUIRenderer } from './ui-legacy'; // Zotero 7

export interface IUIRenderer {
  createPanel(options: PanelOptions): HTMLElement | XULElement;
  createButton(options: ButtonOptions): HTMLElement | XULElement;
  createTextbox(options: TextboxOptions): HTMLElement | XULElement;
  applyStyles(element: any, styles: Record<string, string>): void;
}

export class UIAdapter {
  private static renderer: IUIRenderer | null = null;

  /**
   * 获取UI渲染器
   */
  static getRenderer(): IUIRenderer {
    if (this.renderer) {
      return this.renderer;
    }

    if (ZoteroVersionDetector.isZotero8()) {
      this.renderer = new ModernUIRenderer();
    } else {
      this.renderer = new LegacyUIRenderer();
    }

    return this.renderer;
  }

  /**
   * 创建面板容器
   */
  static createPanel(options: PanelOptions): HTMLElement | XULElement {
    return this.getRenderer().createPanel(options);
  }

  /**
   * 创建按钮
   */
  static createButton(options: ButtonOptions): HTMLElement | XULElement {
    return this.getRenderer().createButton(options);
  }

  /**
   * 创建文本框
   */
  static createTextbox(options: TextboxOptions): HTMLElement | XULElement {
    return this.getRenderer().createTextbox(options);
  }

  /**
   * 应用样式 (统一接口)
   */
  static applyStyles(element: any, styles: Record<string, string>): void {
    this.getRenderer().applyStyles(element, styles);
  }
}

// 选项类型定义
export interface PanelOptions {
  id?: string;
  className?: string;
  styles?: Record<string, string>;
  children?: Array<HTMLElement | XULElement | string>;
}

export interface ButtonOptions {
  label: string;
  onClick: () => void;
  styles?: Record<string, string>;
  disabled?: boolean;
}

export interface TextboxOptions {
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  styles?: Record<string, string>;
}
```

---

#### 2.2 Zotero 8 UI实现 (保持现有代码)

**文件**: `src/adapters/ui-modern.ts`

```typescript
/**
 * Zotero 8 UI渲染器 (现代HTML组件)
 * 保持现有代码不变,只需封装为类
 */

import { IUIRenderer, PanelOptions, ButtonOptions, TextboxOptions } from './ui-adapter';

export class ModernUIRenderer implements IUIRenderer {
  createPanel(options: PanelOptions): HTMLElement {
    const panel = document.createElement('div');
    if (options.id) panel.id = options.id;
    if (options.className) panel.className = options.className;
    if (options.styles) this.applyStyles(panel, options.styles);
    if (options.children) {
      options.children.forEach(child => {
        if (typeof child === 'string') {
          panel.appendChild(document.createTextNode(child));
        } else {
          panel.appendChild(child);
        }
      });
    }
    return panel;
  }

  createButton(options: ButtonOptions): HTMLElement {
    const button = document.createElement('button');
    button.textContent = options.label;
    button.onclick = options.onClick;
    if (options.disabled) button.disabled = true;
    if (options.styles) this.applyStyles(button, options.styles);
    return button;
  }

  createTextbox(options: TextboxOptions): HTMLElement {
    const textbox = options.multiline 
      ? document.createElement('textarea') 
      : document.createElement('input');
    
    if (!options.multiline) {
      (textbox as HTMLInputElement).type = 'text';
    }
    if (options.value) (textbox as any).value = options.value;
    if (options.placeholder) (textbox as any).placeholder = options.placeholder;
    if (options.styles) this.applyStyles(textbox, options.styles);
    return textbox;
  }

  applyStyles(element: HTMLElement, styles: Record<string, string>): void {
    Object.assign(element.style, styles);
  }
}
```

---

#### 2.3 Zotero 7 UI实现 (降级版本)

**文件**: `src/adapters/ui-legacy.ts`

```typescript
/**
 * Zotero 7 UI渲染器 (XUL组件降级)
 * 使用XUL元素或简化的HTML
 */

import { IUIRenderer, PanelOptions, ButtonOptions, TextboxOptions } from './ui-adapter';

export class LegacyUIRenderer implements IUIRenderer {
  createPanel(options: PanelOptions): XULElement {
    // Zotero 7 使用vbox或hbox
    const panel = document.createXULElement('vbox');
    if (options.id) panel.id = options.id;
    if (options.className) panel.className = options.className;
    
    // XUL样式通过属性设置
    if (options.styles) {
      this.applyStyles(panel, options.styles);
    }
    
    if (options.children) {
      options.children.forEach(child => {
        if (typeof child === 'string') {
          const label = document.createXULElement('label');
          label.setAttribute('value', child);
          panel.appendChild(label);
        } else {
          panel.appendChild(child);
        }
      });
    }
    return panel;
  }

  createButton(options: ButtonOptions): XULElement {
    const button = document.createXULElement('button');
    button.setAttribute('label', options.label);
    button.addEventListener('command', options.onClick);
    if (options.disabled) button.setAttribute('disabled', 'true');
    if (options.styles) this.applyStyles(button, options.styles);
    return button;
  }

  createTextbox(options: TextboxOptions): XULElement {
    const textbox = document.createXULElement('textbox');
    if (options.multiline) {
      textbox.setAttribute('multiline', 'true');
      textbox.setAttribute('rows', '5');
    }
    if (options.value) textbox.setAttribute('value', options.value);
    if (options.placeholder) textbox.setAttribute('placeholder', options.placeholder);
    if (options.styles) this.applyStyles(textbox, options.styles);
    return textbox;
  }

  applyStyles(element: any, styles: Record<string, string>): void {
    // XUL元素样式设置
    const styleStr = Object.entries(styles)
      .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
      .join('; ');
    element.setAttribute('style', styleStr);
  }

  private camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  }
}
```

---

### 阶段3: Services API适配 (工期: 0.5天)

#### 3.1 创建Services适配器

**文件**: `src/adapters/services-adapter.ts`

```typescript
/**
 * Services API适配器
 * 统一Zotero 7/8的Services调用接口
 */

import { ModuleAdapter } from './module-adapter';

export class ServicesAdapter {
  private static services: any = null;

  /**
   * 获取Services对象
   */
  private static getServices(): any {
    if (!this.services) {
      this.services = ModuleAdapter.importServices();
    }
    return this.services;
  }

  /**
   * 显示提示对话框
   */
  static alert(title: string, message: string): void {
    const Services = this.getServices();
    Services.prompt.alert(null, title, message);
  }

  /**
   * 显示确认对话框
   */
  static confirm(title: string, message: string): boolean {
    const Services = this.getServices();
    return Services.prompt.confirm(null, title, message);
  }

  /**
   * 显示输入对话框
   */
  static prompt(title: string, message: string, defaultValue: string = ''): string | null {
    const Services = this.getServices();
    const input = { value: defaultValue };
    const result = Services.prompt.prompt(null, title, message, input, null, {});
    return result ? input.value : null;
  }

  /**
   * 打开URL
   */
  static openURL(url: string): void {
    const Services = this.getServices();
    const ioService = Services.io;
    const uri = ioService.newURI(url, null, null);
    Services.ww.openWindow(
      null,
      uri.spec,
      '_blank',
      'chrome,dialog=no,all',
      null
    );
  }
}
```

**使用示例**:
```typescript
import { ServicesAdapter } from './adapters/services-adapter';

// 替换所有Services.prompt调用
ServicesAdapter.alert('提示', '操作成功');
const confirmed = ServicesAdapter.confirm('确认', '是否继续?');
```

---

### 阶段4: 修改现有代码 (工期: 1天)

#### 4.1 更新入口文件

**文件**: `src/index.ts`

```typescript
import { ZoteroVersionDetector } from './utils/version-detector';
import { ResearchopiaPlugin } from './plugin';

// 插件启动时检测版本
ZoteroVersionDetector.logVersionInfo();

// 确保兼容性
if (ZoteroVersionDetector.getMajorVersion() < 7) {
  console.error('[Researchopia] Unsupported Zotero version. Requires Zotero 7 or later.');
  throw new Error('Zotero version 7 or later is required.');
}

// 启动插件
const plugin = new ResearchopiaPlugin();
plugin.startup();
```

---

#### 4.2 更新UIManager

**文件**: `src/views/ui-manager.ts`

```typescript
// 旧代码 (仅Zotero 8):
const panel = document.createElement('div');
panel.style.padding = '16px';

// 新代码 (兼容7/8):
import { UIAdapter } from '../adapters/ui-adapter';

const panel = UIAdapter.createPanel({
  styles: {
    padding: '16px',
    backgroundColor: '#ffffff'
  }
});
```

---

#### 4.3 更新SessionListView

**文件**: `src/views/sessionListView.ts`

```typescript
// 旧代码:
Services.prompt.confirm(null, '删除失败', errorMsg);

// 新代码:
import { ServicesAdapter } from '../adapters/services-adapter';

ServicesAdapter.confirm('删除失败', errorMsg);
```

---

### 阶段5: Manifest配置 (工期: 0.5天)

#### 5.1 更新manifest.json

**文件**: `addon/manifest.json`

```json
{
  "manifest_version": 2,
  "name": "Researchopia",
  "version": "0.2.0",
  "description": "Academic reading and annotation platform",
  "homepage_url": "https://github.com/yourusername/researchopia",
  
  "applications": {
    "zotero": {
      "id": "researchopia@yourdomain.com",
      "update_url": "https://yourdomain.com/updates.json",
      "strict_min_version": "7.0",
      "strict_max_version": "8.*"
    }
  },

  "icons": {
    "48": "icons/icon48.png",
    "96": "icons/icon96.png"
  },

  "background": {
    "scripts": ["background.js"]
  },

  "content_scripts": [],
  
  "permissions": [
    "storage",
    "tabs",
    "webRequest",
    "webRequestBlocking",
    "<all_urls>"
  ]
}
```

**关键配置**:
- `manifest_version: 2` - Zotero 7/8都支持v2
- `strict_min_version: "7.0"` - 最低支持Zotero 7
- `strict_max_version: "8.*"` - 最高支持Zotero 8所有版本

---

### 阶段6: 构建配置 (工期: 0.5天)

#### 6.1 更新构建脚本

**文件**: `zotero-plugin.config.ts`

```typescript
import { defineConfig } from 'zotero-plugin-scaffold';

export default defineConfig({
  name: 'Researchopia',
  id: 'researchopia@yourdomain.com',
  namespace: 'researchopia',
  updateURL: 'https://yourdomain.com/updates.json',
  xpiName: 'researchopia-{version}.xpi',
  
  build: {
    assets: 'addon/**/*',
    define: {
      // 注入构建时常量
      __ZOTERO_MIN_VERSION__: JSON.stringify('7.0'),
      __ZOTERO_MAX_VERSION__: JSON.stringify('8.*')
    }
  },

  release: {
    bumpp: {
      release: 'patch'
    }
  }
});
```

---

### 阶段7: 测试策略 (工期: 1天)

#### 7.1 创建测试环境

1. **Zotero 7 测试环境**:
   - 下载Zotero 7.0.x最新stable版
   - 创建独立配置文件 (`zotero.exe -p`)
   - 安装插件XPI

2. **Zotero 8 测试环境**:
   - 保持现有Zotero 8 beta环境
   - 使用相同XPI文件安装

---

#### 7.2 测试清单

**核心功能测试**:

| 功能 | Zotero 7 | Zotero 8 | 测试方法 |
|------|----------|----------|----------|
| 插件加载 | ✅ | ✅ | 启动Zotero,检查插件是否显示 |
| UI渲染 | ✅ | ✅ | 打开会话广场,检查布局 |
| 创建会话 | ✅ | ✅ | 创建公开/私密会话 |
| 会话列表 | ✅ | ✅ | 检查会话管理页面 |
| 删除会话 | ✅ | ✅ | 删除会话并确认 |
| 标注功能 | ✅ | ✅ | 创建和查看标注 |
| 用户认证 | ✅ | ✅ | 登录/登出流程 |
| Services API | ✅ | ✅ | 触发alert/confirm弹窗 |

**降级功能测试** (仅Zotero 7):
- XUL组件渲染正常
- 样式降级可接受
- 无JavaScript错误

---

#### 7.3 自动化测试脚本

**文件**: `tests/version-test.ts`

```typescript
/**
 * 版本兼容性测试
 */

import { ZoteroVersionDetector } from '../src/utils/version-detector';
import { UIAdapter } from '../src/adapters/ui-adapter';

export function runCompatibilityTests() {
  console.log('=== Researchopia Compatibility Test ===');
  
  // 测试1: 版本检测
  const version = ZoteroVersionDetector.getMajorVersion();
  console.log(`✓ Detected Zotero version: ${version}`);
  
  // 测试2: UI创建
  try {
    const testPanel = UIAdapter.createPanel({ id: 'test-panel' });
    console.log('✓ UI adapter working');
    testPanel.remove();
  } catch (error) {
    console.error('✗ UI adapter failed:', error);
  }
  
  // 测试3: Services API
  try {
    const Services = ModuleAdapter.importServices();
    console.log('✓ Services module imported');
  } catch (error) {
    console.error('✗ Services import failed:', error);
  }
  
  console.log('=== Test Complete ===');
}
```

---

## 开发规范

### 规范1: 不直接使用版本特定API

❌ **错误示例**:
```typescript
// 直接使用Zotero 8 API
const panel = document.createElement('div');
Services.prompt.alert(null, '标题', '内容');
```

✅ **正确示例**:
```typescript
// 使用适配器
import { UIAdapter } from './adapters/ui-adapter';
import { ServicesAdapter } from './adapters/services-adapter';

const panel = UIAdapter.createPanel({ ... });
ServicesAdapter.alert('标题', '内容');
```

---

### 规范2: 新功能必须考虑兼容性

**开发检查清单**:
- [ ] 是否使用了适配器API?
- [ ] UI组件是否通过UIAdapter创建?
- [ ] Services调用是否通过ServicesAdapter?
- [ ] 模块导入是否通过ModuleAdapter?
- [ ] 是否在两个版本上测试过?

---

### 规范3: 优雅降级原则

如果某功能在Zotero 7无法实现:
1. 检测版本并禁用该功能
2. 提供替代方案或降级体验
3. 记录日志说明原因

```typescript
if (ZoteroVersionDetector.isZotero8()) {
  // Zotero 8 完整功能
  this.enableAdvancedFeature();
} else {
  // Zotero 7 降级功能
  console.warn('[Researchopia] Advanced feature not available on Zotero 7');
  this.enableBasicFeature();
}
```

---

## 开发时间线

### 第1天: 基础框架 (阶段1-3) - **进行中** 🔄

**已完成**:
- ✅ 版本检测模块 (`src/utils/version-detector.ts`)
  - 支持Zotero 7/8版本检测
  - 提供`isZotero8()`, `isZotero7()`辅助方法
  - 缓存版本号避免重复检测
- ✅ 模块导入适配器 (`src/adapters/module-adapter.ts`)
  - 统一Services, Console, AddonManager导入
  - 自动处理ESM (Zotero 8) vs CommonJS (Zotero 7)
- ✅ Services API适配器 (`src/adapters/services-adapter.ts`)
  - 统一alert, confirm, prompt, openURL调用
  - 隐藏版本差异,提供一致API

- ✅ UI适配器框架 (`src/adapters/ui-adapter.ts`)
  - IUIRenderer接口统一HTML/XUL差异
  - ModernUIRenderer for Zotero 8 (HTML元素)
  - LegacyUIRenderer for Zotero 7 (HTML优先,XUL降级)
  - 统一`createPanel`, `createButton`, `createTextbox`方法
  - 智能样式应用 (支持HTML style对象和XUL style属性)

**阶段1总结**: 
- ✅ 适配层基础框架完成
- ✅ 版本检测/模块导入/Services/UI四大适配器就绪
- ✅ 统一导出文件 `src/adapters/index.ts` 方便使用
- ⏭️ 下一步: 开始迁移现有代码使用适配器

---

### 第2天: 代码迁移 (阶段4) - **进行中** 🔄

**已完成**:
- ✅ Services适配器迁移 (阶段4.3)
  - sessionListView.ts: 1处Services.prompt.confirm
  - sessionCard.ts: 1处Services.prompt.confirm
  - sharedAnnotationsView.ts: 1处Services.prompt.confirm
  - paperEvaluationView.ts: 1处Services.prompt.confirm  
  - myAnnotationsView.ts: 2处Services.prompt.confirm
  - nested-comments.ts: 1处Services.prompt.confirm
  - **共7处调用已全部迁移到ServicesAdapter**
  - ✅ 构建成功,无编译错误

**设计决策**:
- ✅ UI层保持HTML元素 (不迁移到UIAdapter)
  - 理由: Zotero 7也支持document.createElement
  - 好处: 避免大规模重构,降低风险
  - 备选: UIAdapter框架已就绪,如遇问题可随时迁移
- ✅ 重点完成Services API兼容 (已100%完成)
  - 这是最关键的兼容性问题

**阶段4总结**:
- ✅ Services API全部迁移完成
- ✅ 构建成功,Zotero 8测试通过
- ⏭️ 下一步: Manifest配置 + Zotero 7测试

---

### 第3天: 测试与修复 (阶段5-7) - **进行中** 🔄

**已完成**:
- ✅ Manifest配置检查 (阶段5)
  - 确认 `strict_min_version: "7.0.0"`
  - 确认 `strict_max_version: "8.*"`
  - ✅ **单一XPI已支持Zotero 7/8双版本!**
- ✅ 首次Zotero 7测试与修复 (Test1)
  - 发现问题: ChromeUtils.import shim在Zotero 7冲突
  - 解决方案: 添加版本检测,仅Zotero 8应用shim
  - 修改位置: `src/index.ts`
  - 测试结果: ✅ Zotero 7测试通过 (Test2)
- ✅ **v0.3.0 发布准备**
  - 更新版本号: package.json `0.2.0` → `0.3.0`
  - 更新偏好设置: 兼容版本改为 "Zotero 8 beta, Zotero 7"
  - 添加推荐提示: "💡 推荐使用 Zotero 8 beta 以获得最佳体验"
  - 构建成功: `研学港-researchopia.xpi` (v0.3.0)
  - ✅ **可以发布!**
- 📋 Manifest配置
- 🔨 构建XPI
- 🧪 Zotero 7环境测试
- 🐛 Bug修复和优化

---

## 成功标准

✅ **必须达成**:
1. 单个XPI文件可在Zotero 7/8上安装
2. 核心功能在两个版本上正常工作
3. 无JavaScript错误或警告
4. UI在两个版本上可用(Zotero 7可降级)

🎯 **期望达成**:
1. Zotero 8保持现有完整体验
2. Zotero 7 UI降级但功能完整
3. 自动化测试覆盖两个版本
4. 开发流程不受影响(一次开发,双版本支持)

---

## 风险评估

| 风险 | 可能性 | 影响 | 缓解策略 |
|------|--------|------|----------|
| XUL组件过时 | 中 | 高 | 降级到基础HTML元素 |
| API差异未覆盖 | 中 | 中 | 增量测试,逐步补充适配器 |
| 性能下降 | 低 | 低 | 适配器层轻量级设计 |
| 维护成本增加 | 高 | 中 | 规范开发流程,自动化测试 |

---

## 下一步行动

### 立即执行:
1. **审核本文档** - 确认开发方向
2. **创建版本检测模块** - 实施阶段1.1
3. **测试版本检测** - 在Zotero 8上验证

### 后续规划:
- 完成适配器开发 (阶段1-3)
- 迁移现有代码 (阶段4)
- 搭建Zotero 7测试环境 (阶段7)
- 发布兼容版本 (v0.3.0)

---

## 附录: 常见问题

### Q1: 为什么不分别打包两个版本?
**A**: 用户体验差,需要手动选择版本。单一XPI自适应更方便。

### Q2: Zotero 7的UI会很丑吗?
**A**: 会有降级,但核心功能不受影响。可以逐步优化XUL样式。

### Q3: 适配器会影响性能吗?
**A**: 影响极小。版本检测只在启动时执行一次,API调用开销可忽略。

### Q4: 如果Zotero 9发布怎么办?
**A**: 适配器架构天然支持扩展,只需添加Zotero9实现层即可。

---

**文档版本**: v1.0  
**创建日期**: 2025-10-31  
**作者**: Researchopia开发团队  
**适用版本**: Researchopia v0.2.0+
