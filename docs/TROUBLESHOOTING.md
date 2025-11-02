# 问题排查指南

本文档整合了 Researchopia 项目三大组件(Next.js 网站、Zotero 插件、浏览器扩展)的常见问题和解决方案。

> **💡 提示**: 
> - 技术实现细节请参考 [DEVELOPMENT.md](./DEVELOPMENT.md)
> - 系统架构说明请参考 [ARCHITECTURE.md](./ARCHITECTURE.md)
> - 贡献指南请参考 [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 目录

### Next.js 网站问题
1. [开发服务器无法启动](#网站-开发服务器无法启动)
2. [Supabase 连接失败](#网站-supabase-连接失败)
3. [API 路由返回 500 错误](#网站-api-路由-500-错误)
4. [认证失败 Unauthorized](#网站-认证失败)
5. [页面构建失败](#网站-页面构建失败)

### Zotero 插件问题
6. [热重载不工作](#插件-热重载不工作)
7. [插件未出现在 Zotero 中](#插件-未出现在-zotero)
8. [认证失败 Token Invalid](#插件-认证失败)
9. [标注不显示或重复](#插件-标注不显示或重复)
10. [构建失败 Cannot Find Module](#插件-构建失败)
11. [PDF 标注未同步](#插件-pdf-标注未同步)
12. [会话无法加入](#插件-会话无法加入)

### 浏览器扩展问题
13. [DOI 检测失败](#扩展-doi-检测失败)
14. [悬浮图标不显示](#扩展-悬浮图标不显示)
15. [侧边栏无法打开](#扩展-侧边栏无法打开)
16. [扩展加载失败](#扩展-加载失败)

### 数据库问题
17. [RLS 策略阻止访问](#数据库-rls-策略阻止访问)
18. [查询性能慢](#数据库-查询性能慢)
19. [数据不一致](#数据库-数据不一致)

### 调试技巧
20. [如何查看详细日志](#调试-查看详细日志)
21. [如何使用断点调试](#调试-使用断点)
22. [如何测试 API 请求](#调试-测试-api-请求)
23. [如何分析性能问题](#调试-分析性能)

---

# Next.js 网站问题

<a name="网站-开发服务器无法启动"></a>
## 1. 开发服务器无法启动

### 现象
```bash
npm run dev
# Error: Cannot find module 'next'
```

### 原因
- 依赖未安装或损坏
- Node.js 版本不兼容
- 端口 3000 被占用

### 解决方法

**Step 1: 检查 Node.js 版本**
```bash
node -v
# 确保 >= v18.0.0
```

**Step 2: 重新安装依赖**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Step 3: 更换端口**
```bash
# 如果端口被占用
npm run dev -- -p 3001
```

**Step 4: 检查环境变量**
```bash
# 确保 .env.local 文件存在
cat .env.local
```

---

<a name="网站-supabase-连接失败"></a>
## 2. Supabase 连接失败

### 现象
```
Error: Invalid Supabase URL
Error: supabase.auth.getSession is not a function
```

### 原因
- 环境变量未配置或错误
- Supabase 项目暂停(免费版闲置)
- 网络连接问题

### 解决方法

**Step 1: 验证环境变量**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Step 2: 检查 Supabase 项目状态**
- 访问 [Supabase Dashboard](https://app.supabase.com)
- 确认项目状态为 "Active"
- 如果暂停,点击 "Resume" 恢复

**Step 3: 测试连接**
```typescript
// 创建测试文件 test-supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const { data, error } = await supabase.from('papers').select('count');
console.log('Supabase connection:', data, error);
```

---

<a name="网站-api-路由-500-错误"></a>
## 3. API 路由返回 500 错误

### 现象
```
GET /api/proxy/annotations/list → 500 Internal Server Error
```

### 原因
- 未捕获的异常
- 数据库查询错误
- 环境变量缺失

### 解决方法

**Step 1: 查看服务器日志**
```bash
# 终端输出会显示详细错误
npm run dev
```

**Step 2: 检查 API 代码**
```typescript
// src/app/api/proxy/annotations/list/route.ts
export async function GET(request: NextRequest) {
  try {
    // 业务逻辑
  } catch (error) {
    console.error('[API Error]', error); // 添加详细日志
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}
```

**Step 3: 测试数据库查询**
- 访问 Supabase Dashboard → SQL Editor
- 手动运行查询语句
- 检查表名、列名是否正确

---

<a name="网站-认证失败"></a>
## 4. 认证失败 Unauthorized

### 现象
```
POST /api/proxy/auth/login → 401 Unauthorized
```

### 原因
- Token 过期或无效
- RLS 策略阻止访问
- 用户不存在或密码错误

### 解决方法

**Step 1: 检查认证流程**
```typescript
// 客户端
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

if (error) {
  console.error('Auth error:', error.message);
}
```

**Step 2: 验证 Token**
```typescript
// 服务端 API 路由
const token = request.headers.get('authorization');
if (!token || !token.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Step 3: 检查 RLS 策略**
- Supabase Dashboard → Authentication → Policies
- 确认策略允许当前用户访问

---

<a name="网站-页面构建失败"></a>
## 5. 页面构建失败

### 现象
```bash
npm run build
# Error: Page "/papers/[doi]" is missing "generateStaticParams()"
```

### 原因
- 动态路由缺少静态参数生成
- 组件语法错误
- TypeScript 类型错误

### 解决方法

**Step 1: 添加 generateStaticParams**
```typescript
// src/app/papers/[doi]/page.tsx
export async function generateStaticParams() {
  return []; // 运行时生成
}
```

**Step 2: 检查类型错误**
```bash
npm run type-check
# 或
npx tsc --noEmit
```

**Step 3: 逐步构建**
```bash
# 删除 .next 缓存
rm -rf .next

# 重新构建
npm run build
```

---

# Zotero 插件问题

<a name="插件-热重载不工作"></a>
## 6. 热重载不工作

### 现象
- 修改代码后 Zotero 未自动重启
- 插件显示旧版本代码

### 原因
- `.env` 中的 Zotero 路径错误
- Zotero 进程卡死未关闭
- 构建缓存损坏

### 解决方法

**Step 1: 验证 Zotero 路径**
```bash
# zotero-plugin/.env
ZOTERO_PLUGIN_ZOTERO_BIN_PATH=C:\Program Files\Zotero\zotero.exe

# Windows: 确认路径正确
# Mac: /Applications/Zotero.app/Contents/MacOS/zotero
# Linux: /usr/bin/zotero
```

**Step 2: 手动关闭 Zotero**
```bash
# Windows
taskkill /F /IM zotero.exe

# Mac/Linux
killall zotero
```

**Step 3: 清理构建缓存**
```bash
cd zotero-plugin
rm -rf build/ .scaffold/
npm run build
npm start
```

**Step 4: 检查热重载日志**
```bash
# 终端应显示:
[Hot Reload] Watching for changes...
[Hot Reload] File changed: src/addon.ts
[Hot Reload] Restarting Zotero...
```

---

<a name="插件-未出现在-zotero"></a>
## 7. 插件未出现在 Zotero 中

### 现象
- 工具 → 附加组件 → 插件列表为空
- 无法看到 Researchopia 插件

### 原因
- 插件未正确安装
- `manifest.json` 配置错误
- Zotero 版本不兼容

### 解决方法

**Step 1: 手动安装插件**
```bash
# 构建 XPI 包
cd zotero-plugin
npm run release

# 输出: build/researchopia.xpi
```

在 Zotero 中:
1. 工具 → 附加组件
2. 齿轮图标 → Install Add-on From File
3. 选择 `build/researchopia.xpi`

**Step 2: 检查 manifest.json**
```json
{
  "manifest_version": 2,
  "name": "Researchopia",
  "version": "0.1.0",
  "applications": {
    "zotero": {
      "id": "researchopia@example.com",
      "update_url": "https://example.com/updates.json",
      "strict_min_version": "7.0",
      "strict_max_version": "8.*"
    }
  }
}
```

**Step 3: 查看 Zotero 日志**
- 帮助 → Debug Output Logging → Start Logging
- 重启 Zotero
- 帮助 → Debug Output Logging → View Output
- 搜索 "researchopia" 或 "error"

---

<a name="插件-认证失败"></a>
## 8. 认证失败 Token Invalid

### 现象
```
API Error: 401 Unauthorized
Token is invalid or expired
```

### 原因
- Token 已过期
- Next.js API 服务器未运行
- 网络连接问题

### 解决方法

**Step 1: 确认 API 服务器运行**
```bash
# 访问健康检查端点
curl https://www.researchopia.com/api/health
# 或
curl http://localhost:3000/api/health
```

**Step 2: 重新登录**
- 工具 → Researchopia → Logout
- 工具 → Researchopia → Login
- 输入邮箱和密码

**Step 3: 检查 Token 存储**
```typescript
// 在插件代码中查看存储的 Token
const token = Zotero.Prefs.get('researchopia.token');
logger.log('Current token:', token);
```

**Step 4: 检查 API 代理**
```typescript
// zotero-plugin/src/utils/apiClient.ts
const API_BASE_URL = 'https://www.researchopia.com/api/proxy';

// 确认 URL 正确
logger.log('API Base URL:', API_BASE_URL);
```

---

<a name="插件-标注不显示或重复"></a>
## 9. 标注不显示或重复

### 现象
- 社区标注列表为空
- 相同标注显示多次
- 新增标注未显示

### 原因
- 论文缺少 DOI
- API 分页错误
- 事件监听器重复注册
- 标注去重逻辑失败

### 解决方法

**Step 1: 确认论文有 DOI**
- 选中文献 → 右侧 Info 面板 → DOI 字段
- 如果为空,手动添加 DOI

**Step 2: 检查 API 响应**
```typescript
// 在插件中添加日志
const annotations = await apiClient.get('/api/proxy/annotations/list', {
  params: { doi: paperDoi }
});

logger.log('Fetched annotations:', annotations.data.length);
```

**Step 3: 验证去重逻辑**
```typescript
// zotero-plugin/src/modules/ui/annotationUtils.ts
export function deduplicateAnnotations(annotations: Annotation[]): Annotation[] {
  const seen = new Set<string>();
  return annotations.filter((anno) => {
    const key = anno.annotation_data?.zotero_key || anno.id;
    if (seen.has(key)) {
      return false; // 重复标注,过滤掉
    }
    seen.add(key);
    return true;
  });
}
```

**Step 4: 防止事件监听器重复注册**
```typescript
// zotero-plugin/src/modules/ui/readingSessionView.ts
private listenersRegistered: boolean = false;

private registerEventListeners(): void {
  if (this.listenersRegistered) {
    return; // 已注册,直接返回
  }

  addon.managers.sessionManager.onAnnotation((annotations) => {
    this.renderAnnotationsList(annotations);
  });

  this.listenersRegistered = true;
}
```

---

<a name="插件-构建失败"></a>
## 10. 构建失败 Cannot Find Module

### 现象
```bash
npm run build
# Error: Cannot find module 'zotero-plugin-toolkit'
```

### 原因
- 依赖未安装
- `node_modules` 损坏
- TypeScript 配置错误

### 解决方法

**Step 1: 重新安装依赖**
```bash
cd zotero-plugin
rm -rf node_modules package-lock.json
npm install
```

**Step 2: 清理构建缓存**
```bash
npm run clean
# 或手动删除
rm -rf build/ .scaffold/
```

**Step 3: 检查 tsconfig.json**
```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

**Step 4: 重新构建**
```bash
npm run build
```

---

<a name="插件-pdf-标注未同步"></a>
## 11. PDF 标注未同步

### 现象
- 在 Zotero PDF 中添加标注
- 标注未出现在社区标注列表

### 原因
- PDF 阅读器监听器未启动
- 标注数据提取失败
- API 调用失败

### 解决方法

**Step 1: 确认监听器已启动**
```typescript
// 在插件启动时检查
addon.managers.pdfReaderManager.startListening();
logger.log('PDF reader manager started');
```

**Step 2: 查看标注事件日志**
```typescript
// zotero-plugin/src/modules/pdfReaderManager.ts
public async notify(event: string, type: string, ids: string[]): Promise<void> {
  logger.log('[PDF Event]', event, type, ids);
  
  // 处理标注
}
```

**Step 3: 检查标注数据**
```typescript
const annotation = await Zotero.Annotations.get(annotationId);
logger.log('Annotation data:', {
  text: annotation.annotationText,
  comment: annotation.annotationComment,
  page: annotation.annotationPageLabel
});
```

**Step 4: 验证 API 调用**
```typescript
await apiClient.post('/api/proxy/annotations/create', {
  annotation_data: {
    zotero_key: annotation.key,
    text: annotation.annotationText,
    // ...
  },
  paper_doi: paperDoi
});

logger.log('Annotation created successfully');
```

---

<a name="插件-会话无法加入"></a>
## 12. 会话无法加入

### 现象
- 输入邀请码后提示"Session not found"
- 无法加入公共会话

### 原因
- 邀请码错误或过期
- 会话已关闭
- 网络连接问题

### 解决方法

**Step 1: 验证邀请码**
```bash
# 确认邀请码格式正确(6位字母数字)
ABC123
```

**Step 2: 检查会话状态**
- 访问 Supabase Dashboard → Table Editor → reading_sessions
- 查找对应的 `invite_code`
- 确认 `is_active = true`

**Step 3: 测试 API 端点**
```bash
curl -X POST https://www.researchopia.com/api/proxy/reading-session/join \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "ABC123"}'
```

---

# 浏览器扩展问题

<a name="扩展-doi-检测失败"></a>
## 13. DOI 检测失败

### 现象
- 在学术网站上未检测到 DOI
- 悬浮图标未显示

### 原因
- 网站 HTML 结构变化
- DOI 元标签不存在
- Content Script 未注入

### 解决方法

**Step 1: 检查网站支持**

当前支持的网站:
- Nature
- Science
- IEEE
- Springer
- Wiley
- Elsevier
- PubMed
- arXiv
- bioRxiv
- PLOS

**Step 2: 手动测试 DOI 检测**
```javascript
// 在浏览器控制台运行
const doi = document.querySelector('meta[name="citation_doi"]')?.content;
console.log('Detected DOI:', doi);
```

**Step 3: 检查 Content Script 注入**
```javascript
// extension/content.js
console.log('[Content Script] Loaded on:', window.location.href);

// 在页面控制台查看是否有输出
```

**Step 4: 添加新网站支持**
```javascript
// extension/content.js
function detectDOI() {
  // 1. Meta 标签
  let doi = document.querySelector('meta[name="citation_doi"]')?.content;
  
  // 2. 新网站的特殊选择器
  if (!doi && window.location.hostname.includes('newsite.com')) {
    doi = document.querySelector('.doi-field')?.textContent;
  }
  
  return doi;
}
```

---

<a name="扩展-悬浮图标不显示"></a>
## 14. 悬浮图标不显示

### 现象
- DOI 已检测到,但悬浮图标未显示
- 图标显示但无法拖拽

### 原因
- CSS 样式冲突
- 图标被网站元素遮挡
- JavaScript 错误

### 解决方法

**Step 1: 检查 CSS 加载**
```css
/* extension/content.css */
#researchopia-float-icon {
  position: fixed !important;
  right: 20px !important;
  top: 50% !important;
  z-index: 999999 !important;
  cursor: pointer !important;
}
```

**Step 2: 检查元素是否创建**
```javascript
// 在页面控制台运行
document.getElementById('researchopia-float-icon');
// 应返回 <div> 元素
```

**Step 3: 调整 z-index**
```javascript
// extension/content.js
const icon = document.createElement('div');
icon.style.zIndex = '2147483647'; // 最大值
```

---

<a name="扩展-侧边栏无法打开"></a>
## 15. 侧边栏无法打开

### 现象
- 点击悬浮图标无反应
- 侧边栏显示空白页面

### 原因
- iframe 被 CSP 阻止
- URL 错误
- JavaScript 错误

### 解决方法

**Step 1: 检查控制台错误**
```
Refused to display 'https://www.researchopia.com' in a frame because it set 'X-Frame-Options' to 'deny'.
```

**Step 2: 使用新标签页打开**(临时方案)
```javascript
// extension/content.js
icon.addEventListener('click', () => {
  window.open(`https://www.researchopia.com/doi/${doi}`, '_blank');
});
```

**Step 3: 配置服务器允许 iframe**
```typescript
// Next.js middleware
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  return response;
}
```

---

<a name="扩展-加载失败"></a>
## 16. 扩展加载失败

### 现象
```
Manifest file is invalid or missing.
```

### 原因
- `manifest.json` 格式错误
- Chrome 版本过低
- 扩展文件损坏

### 解决方法

**Step 1: 验证 manifest.json**
```bash
# 使用 JSON 验证器
cat extension/manifest.json | python -m json.tool
```

**Step 2: 检查 Chrome 版本**
- 确保 Chrome >= 88 (Manifest V3 要求)
- chrome://version/

**Step 3: 重新加载扩展**
- chrome://extensions/
- 删除扩展
- 重新加载(Load unpacked)

---

# 数据库问题

<a name="数据库-rls-策略阻止访问"></a>
## 17. RLS 策略阻止访问

### 现象
```
Error: new row violates row-level security policy
```

### 原因
- RLS 策略配置错误
- 用户未认证
- 策略条件不满足

### 解决方法

**Step 1: 检查认证状态**
```typescript
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);
```

**Step 2: 查看 RLS 策略**
- Supabase Dashboard → Authentication → Policies
- 选择对应的表
- 检查策略条件

**Step 3: 测试策略**
```sql
-- 以特定用户身份测试
SET LOCAL "request.jwt.claims" TO '{"sub": "user-uuid"}';

SELECT * FROM shared_annotations WHERE user_id = 'user-uuid';
```

**Step 4: 临时禁用 RLS (仅开发环境)**
```sql
ALTER TABLE shared_annotations DISABLE ROW LEVEL SECURITY;
```

---

<a name="数据库-查询性能慢"></a>
## 18. 查询性能慢

### 现象
- API 请求耗时 > 2 秒
- 数据库查询超时

### 原因
- 缺少索引
- 查询未优化
- 数据量过大

### 解决方法

**Step 1: 分析查询计划**
```sql
EXPLAIN ANALYZE
SELECT * FROM shared_annotations WHERE doi = '10.xxxx/xxxxx';
```

**Step 2: 添加索引**
```sql
-- 为高频查询字段创建索引
CREATE INDEX idx_annotations_doi ON shared_annotations(doi);
CREATE INDEX idx_annotations_user ON shared_annotations(user_id);
CREATE INDEX idx_annotations_created ON shared_annotations(created_at DESC);
```

**Step 3: 优化查询**
```typescript
// ❌ 不推荐: 查询所有字段
const { data } = await supabase
  .from('shared_annotations')
  .select('*');

// ✅ 推荐: 只查询需要的字段
const { data } = await supabase
  .from('shared_annotations')
  .select('id, annotation_text, created_at')
  .limit(50);
```

**Step 4: 使用分页**
```typescript
const { data } = await supabase
  .from('shared_annotations')
  .select('*')
  .range(0, 49)  // 每次 50 条
  .order('created_at', { ascending: false });
```

---

<a name="数据库-数据不一致"></a>
## 19. 数据不一致

### 现象
- 标注计数不正确
- 关联数据缺失

### 原因
- 级联删除未配置
- 并发写入冲突
- 触发器失败

### 解决方法

**Step 1: 配置级联删除**
```sql
ALTER TABLE annotation_likes
DROP CONSTRAINT annotation_likes_annotation_id_fkey,
ADD CONSTRAINT annotation_likes_annotation_id_fkey
  FOREIGN KEY (annotation_id)
  REFERENCES shared_annotations(id)
  ON DELETE CASCADE;
```

**Step 2: 使用事务**
```typescript
const { data, error } = await supabase.rpc('delete_annotation_with_relations', {
  annotation_id: 'uuid'
});
```

**Step 3: 添加触发器**
```sql
-- 自动更新计数器
CREATE OR REPLACE FUNCTION update_annotation_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shared_annotations
  SET likes_count = (
    SELECT COUNT(*) FROM annotation_likes WHERE annotation_id = NEW.annotation_id
  )
  WHERE id = NEW.annotation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_annotation_count
AFTER INSERT OR DELETE ON annotation_likes
FOR EACH ROW EXECUTE FUNCTION update_annotation_count();
```

---

# 调试技巧

<a name="调试-查看详细日志"></a>
## 20. 如何查看详细日志

### Next.js 网站

**开发环境**:
```bash
npm run dev
# 终端会显示所有日志
```

**生产环境**(Vercel):
- Vercel Dashboard → 项目 → Logs
- 实时查看服务器日志

### Zotero 插件

**方法 1: Zotero Debug Output**
```
帮助 → Debug Output Logging → Start Logging
执行操作
帮助 → Debug Output Logging → View Output
```

**方法 2: 插件内置 Logger**
```typescript
import { logger } from '../utils/logger';

logger.log('Info message');
logger.warn('Warning message');
logger.error('Error message:', error);
```

**方法 3: 浏览器控制台**
- Tools → Developer → Browser Console
- 查看插件的 JavaScript 错误

### 浏览器扩展

**Content Script**:
- 右键页面 → 检查(Inspect)
- Console 标签页

**Background Script**:
- chrome://extensions/
- Inspect views: service worker
- Console 标签页

**Popup**:
- 右键扩展图标 → 检查弹出窗口
- Console 标签页

---

<a name="调试-使用断点"></a>
## 21. 如何使用断点调试

### Next.js 网站

**VS Code 调试配置**:
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

**使用**:
1. 在代码中设置断点(点击行号左侧)
2. F5 启动调试
3. 执行触发断点的操作

### Zotero 插件

**使用 logger 替代断点**:
```typescript
logger.log('Before API call');
const result = await apiClient.get('/api/endpoint');
logger.log('API result:', result);
```

### 浏览器扩展

**Chrome DevTools**:
1. 打开 DevTools(F12)
2. Sources 标签页
3. 找到扩展文件(chrome-extension://...)
4. 设置断点
5. 执行操作

---

<a name="调试-测试-api-请求"></a>
## 22. 如何测试 API 请求

### 使用 cURL

```bash
# GET 请求
curl https://www.researchopia.com/api/proxy/annotations/list?doi=10.xxxx/xxxxx \
  -H "Authorization: Bearer YOUR_TOKEN"

# POST 请求
curl -X POST https://www.researchopia.com/api/proxy/annotations/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "annotation_data": {
      "text": "Test annotation"
    },
    "paper_doi": "10.xxxx/xxxxx"
  }'
```

### 使用 Postman

1. 下载 [Postman](https://www.postman.com/downloads/)
2. 创建新请求
3. 设置 URL 和方法(GET/POST)
4. 添加 Headers: `Authorization: Bearer YOUR_TOKEN`
5. 添加 Body(JSON)
6. 发送请求

### 使用浏览器 DevTools

1. F12 打开 DevTools
2. Network 标签页
3. 执行操作
4. 查看 API 请求和响应

---

<a name="调试-分析性能"></a>
## 23. 如何分析性能问题

### Next.js 性能分析

```bash
# 构建并分析
npm run build
npm run analyze

# 查看生成的报告: .next/analyze/*.html
```

### React 组件性能

```typescript
import { Profiler } from 'react';

<Profiler id="PaperList" onRender={(id, phase, actualDuration) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}}>
  <PaperList />
</Profiler>
```

### 数据库查询性能

```sql
-- 分析查询计划
EXPLAIN ANALYZE
SELECT * FROM shared_annotations WHERE doi = '10.xxxx/xxxxx';

-- 查看慢查询
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 网络性能

- Chrome DevTools → Network → Slow 3G
- 查看资源加载时间
- 优化大文件和慢请求

---

## 仍然无法解决?

1. **搜索 GitHub Issues**: [github.com/occasional16/researchopia/issues](https://github.com/occasional16/researchopia/issues)
2. **创建新 Issue**: 详细描述问题、错误信息、复现步骤
3. **查看技术文档**: [DEVELOPMENT.md](./DEVELOPMENT.md)
4. **查看架构文档**: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

**最后更新**: 2025-01-02  
**维护者**: Researchopia Team
