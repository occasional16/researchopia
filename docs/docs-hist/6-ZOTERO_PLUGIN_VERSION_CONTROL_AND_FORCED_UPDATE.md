# Zotero插件版本控制与强制升级方案

## 一、方案概述

**方案1+2组合**：本地版本检测 + 远程配置控制

- **方案1（本地版本检测）**：插件启动时检测当前版本号，与最低支持版本比较
- **方案2（远程配置控制）**：从服务器API获取最低支持版本号，实现动态控制
- **优势**：无需Zotero审核流程，可立即生效；支持灰度控制和回滚

---

## 二、技术架构

### 2.1 版本号格式
采用语义化版本号（Semantic Versioning）：`major.minor.patch`
- `major`：不兼容的API修改
- `minor`：向下兼容的功能性新增
- `patch`：向下兼容的问题修正

示例：`1.2.3` → `v1.2.3`

### 2.2 系统组件

```
┌─────────────────────────────────────────────────────────────┐
│                    Zotero Plugin Client                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. 启动时版本检测                                      │  │
│  │     - 读取本地manifest.json的version                   │  │
│  │     - 调用远程API获取最低支持版本                       │  │
│  │     - 比较版本号                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  2. 版本不符处理                                        │  │
│  │     - 显示升级提示弹窗                                  │  │
│  │     - 禁用核心功能                                      │  │
│  │     - 提供下载链接                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    API请求：GET /api/config/version
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Backend API                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/config/version                                   │  │
│  │  {                                                     │  │
│  │    "min_version": "1.2.0",                            │  │
│  │    "latest_version": "1.3.5",                         │  │
│  │    "download_url": "https://...",                     │  │
│  │    "force_update": true,                              │  │
│  │    "message": "新版本包含重要安全更新"                   │  │
│  │  }                                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    存储在Supabase数据库或环境变量
```

---

## 三、实施步骤

### 步骤1：创建版本配置数据表（Supabase）

**表名**: `plugin_version_config`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | uuid | 主键 |
| plugin_name | text | 插件名称（如"researchopia-zotero"） |
| min_version | text | 最低支持版本号 |
| latest_version | text | 最新版本号 |
| download_url | text | 下载地址 |
| force_update | boolean | 是否强制升级 |
| update_message | text | 升级提示信息 |
| enabled | boolean | 是否启用版本控制 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

**SQL创建语句**:
```sql
CREATE TABLE plugin_version_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plugin_name TEXT NOT NULL UNIQUE,
  min_version TEXT NOT NULL,
  latest_version TEXT NOT NULL,
  download_url TEXT,
  force_update BOOLEAN DEFAULT false,
  update_message TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入初始数据
INSERT INTO plugin_version_config (
  plugin_name, 
  min_version, 
  latest_version, 
  download_url, 
  force_update, 
  update_message
) VALUES (
  'researchopia-zotero',
  '1.0.0',
  '1.0.0',
  'https://github.com/your-repo/releases/latest',
  false,
  '发现新版本，建议升级以获得最佳体验'
);
```

---

### 步骤2：创建版本检测API

**文件路径**: `src/app/api/config/version/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // 获取插件名称参数（支持多个插件）
    const pluginName = request.nextUrl.searchParams.get('plugin') || 'researchopia-zotero';
    
    // 查询版本配置
    const { data, error } = await supabase
      .from('plugin_version_config')
      .select('*')
      .eq('plugin_name', pluginName)
      .eq('enabled', true)
      .single();
    
    if (error || !data) {
      return NextResponse.json(
        { 
          error: 'Version config not found',
          // 默认配置
          min_version: '0.0.0',
          latest_version: '999.999.999',
          force_update: false
        },
        { status: 200 } // 返回200避免插件报错
      );
    }
    
    return NextResponse.json({
      min_version: data.min_version,
      latest_version: data.latest_version,
      download_url: data.download_url,
      force_update: data.force_update,
      message: data.update_message
    });
    
  } catch (error) {
    console.error('[Version API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        min_version: '0.0.0',
        latest_version: '999.999.999',
        force_update: false
      },
      { status: 200 }
    );
  }
}
```

---

### 步骤3：插件端版本检测模块

**文件路径**: `zotero-plugin/src/modules/versionChecker.ts`

```typescript
import { logger } from "../utils/logger";
import { APIClient } from "../utils/apiClient";

interface VersionConfig {
  min_version: string;
  latest_version: string;
  download_url?: string;
  force_update?: boolean;
  message?: string;
}

export class VersionChecker {
  private static instance: VersionChecker;
  private currentVersion: string;
  private apiClient = APIClient.getInstance();

  private constructor() {
    // 从manifest.json读取当前版本
    this.currentVersion = this.getCurrentVersion();
  }

  public static getInstance(): VersionChecker {
    if (!VersionChecker.instance) {
      VersionChecker.instance = new VersionChecker();
    }
    return VersionChecker.instance;
  }

  /**
   * 获取当前插件版本号
   */
  private getCurrentVersion(): string {
    try {
      const manifest = Zotero.getAddonManager().getAddonByID('your-addon-id@example.com');
      return manifest?.version || '0.0.0';
    } catch (error) {
      logger.error('[VersionChecker] Failed to get current version:', error);
      return '0.0.0';
    }
  }

  /**
   * 比较版本号
   * @returns 1: v1 > v2, 0: v1 = v2, -1: v1 < v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  }

  /**
   * 检查版本并处理
   * @returns true: 版本符合要求, false: 需要升级
   */
  public async checkAndEnforce(): Promise<boolean> {
    try {
      logger.log('[VersionChecker] Checking version...');
      logger.log('[VersionChecker] Current version:', this.currentVersion);
      
      // 从服务器获取版本配置
      const config = await this.fetchVersionConfig();
      
      if (!config) {
        logger.warn('[VersionChecker] Failed to fetch version config, allowing plugin to run');
        return true; // 获取失败时不阻止插件运行
      }
      
      logger.log('[VersionChecker] Server config:', config);
      
      // 比较版本
      const comparison = this.compareVersions(this.currentVersion, config.min_version);
      
      if (comparison < 0) {
        // 当前版本低于最低支持版本
        logger.warn('[VersionChecker] Version too old, showing update dialog');
        this.showUpdateDialog(config);
        return false;
      }
      
      // 检查是否有新版本可用
      if (this.compareVersions(this.currentVersion, config.latest_version) < 0) {
        // 有新版本但不强制更新
        if (!config.force_update) {
          logger.log('[VersionChecker] New version available, showing notification');
          this.showUpdateNotification(config);
        }
      }
      
      return true;
      
    } catch (error) {
      logger.error('[VersionChecker] Error checking version:', error);
      return true; // 出错时不阻止插件运行
    }
  }

  /**
   * 从服务器获取版本配置
   */
  private async fetchVersionConfig(): Promise<VersionConfig | null> {
    try {
      const response = await this.apiClient.request('GET', '/api/config/version?plugin=researchopia-zotero');
      return response as VersionConfig;
    } catch (error) {
      logger.error('[VersionChecker] Failed to fetch version config:', error);
      return null;
    }
  }

  /**
   * 显示强制升级对话框
   */
  private showUpdateDialog(config: VersionConfig): void {
    const message = config.message || '您的插件版本过旧，请升级到最新版本';
    const downloadUrl = config.download_url || 'https://github.com/your-repo/releases';
    
    const ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
    
    const flags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING +
                  ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
    
    const result = ps.confirmEx(
      null,
      '需要升级',
      `${message}\n\n当前版本: ${this.currentVersion}\n最低版本: ${config.min_version}\n最新版本: ${config.latest_version}`,
      flags,
      '前往下载',
      null,
      null,
      null,
      {}
    );
    
    if (result === 0) {
      // 用户点击"前往下载"
      Zotero.launchURL(downloadUrl);
    }
  }

  /**
   * 显示升级通知（非强制）
   */
  private showUpdateNotification(config: VersionConfig): void {
    const message = config.message || '发现新版本，建议升级';
    
    const notifierID = Zotero.Notifier.registerObserver({
      notify: () => {}
    }, ['item']);
    
    new Zotero.ProgressWindow({ closeOnClick: true })
      .changeHeadline(`Researchopia 新版本可用`)
      .addDescription(`${message}\n最新版本: ${config.latest_version}`)
      .show();
    
    setTimeout(() => {
      Zotero.Notifier.unregisterObserver(notifierID);
    }, 5000);
  }

  /**
   * 禁用插件核心功能
   */
  public disablePlugin(): void {
    logger.warn('[VersionChecker] Disabling plugin due to version check failure');
    // 这里可以禁用UI面板、菜单项等
    // 具体实现取决于你的插件架构
  }
}
```

---

### 步骤4：在插件启动时集成版本检测

**文件路径**: `zotero-plugin/src/addon.ts` 或主入口文件

```typescript
import { VersionChecker } from './modules/versionChecker';

export async function onStartup() {
  try {
    // 版本检测
    const versionChecker = VersionChecker.getInstance();
    const versionOk = await versionChecker.checkAndEnforce();
    
    if (!versionOk) {
      // 版本不符合要求，禁用插件
      versionChecker.disablePlugin();
      return; // 不继续启动
    }
    
    // 版本检测通过，正常启动插件
    // ... 其他启动逻辑
    
  } catch (error) {
    logger.error('[Addon] Startup error:', error);
  }
}
```

---

## 四、使用流程

### 4.1 正常升级流程
1. 开发新版本并发布到GitHub Releases
2. 在Supabase数据库中更新`latest_version`字段
3. 用户启动插件时会收到升级提示（非强制）

### 4.2 强制升级流程
1. 发现严重bug或安全漏洞
2. 发布修复版本到GitHub Releases
3. 在Supabase中更新：
   - `min_version`: 设为修复后的版本
   - `force_update`: 设为`true`
   - `update_message`: 写明升级原因
4. 旧版本用户启动插件时会被强制要求升级

### 4.3 紧急回滚
如果新版本出现问题：
```sql
UPDATE plugin_version_config 
SET min_version = '1.0.0',  -- 回退到稳定版本
    force_update = false
WHERE plugin_name = 'researchopia-zotero';
```

---

## 五、测试方案

### 5.1 本地测试
1. 修改manifest.json版本号为`0.0.1`
2. 在Supabase设置`min_version`为`1.0.0`
3. 启动插件，验证弹窗是否显示

### 5.2 灰度发布
1. 先设置`min_version`为当前版本（不影响用户）
2. 仅设置`latest_version`为新版本，观察用户反馈
3. 确认无问题后，逐步提升`min_version`

---

## 六、注意事项

### 6.1 网络失败处理
- API请求失败时，默认允许插件运行（避免网络问题导致无法使用）
- 设置合理的超时时间（建议5秒）

### 6.2 版本号规范
- 严格遵循`x.y.z`格式
- 不要使用`v`前缀（在代码中统一处理）

### 6.3 用户体验
- 非强制升级时，每24小时最多提示一次
- 提供"不再提示"选项（存储到本地preferences）

### 6.4 后向兼容
- 尽量保持API向后兼容
- 数据结构变化时，提供迁移脚本

---

## 七、扩展功能

### 7.1 多环境支持
```typescript
const env = process.env.NODE_ENV; // 'development' | 'production'
const apiUrl = env === 'production' 
  ? '/api/config/version' 
  : '/api/config/version?env=dev';
```

### 7.2 版本特性标志（Feature Flags）
在版本配置中添加功能开关：
```json
{
  "min_version": "1.2.0",
  "features": {
    "reading_session": true,
    "annotation_sharing": false
  }
}
```

### 7.3 A/B测试
根据用户ID或随机数决定是否启用新功能：
```typescript
const userId = await getCurrentUserId();
const group = hashCode(userId) % 2; // 0 or 1
if (group === 0 && config.features.new_ui_enabled) {
  // 启用新UI
}
```

---

## 八、实施时间线

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 第1天 | 创建数据表和API | 2小时 |
| 第2天 | 编写VersionChecker模块 | 3小时 |
| 第3天 | 集成到插件启动流程 | 1小时 |
| 第4天 | 编写单元测试 | 2小时 |
| 第5天 | 本地和线上测试 | 2小时 |

**总计**：约10小时

---

## 九、参考资料

- [Semantic Versioning规范](https://semver.org/)
- [Zotero插件开发文档](https://www.zotero.org/support/dev/client_coding)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
