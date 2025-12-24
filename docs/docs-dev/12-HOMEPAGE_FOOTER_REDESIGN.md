# 12. 首页底部区域重设计方案

## 现状分析

当前底部（`src/app/page.tsx` 980行附近）仅有一个简单的"欢迎消息"区块：
- 蓝色背景卡片，列出4个功能点
- 对未登录用户显示注册按钮
- 缺乏视觉层次，信息展示单调

## 设计目标

1. **提升专业感** - 学术平台应具有可信度和权威性
2. **增强转化率** - 引导用户注册、探索功能
3. **完善信息架构** - 补充快捷链接、联系方式、版权信息

---

## 方案：三区域Footer设计

### 结构布局

```
┌──────────────────────────────────────────────────────────────┐
│  CTA区域 (Call-to-Action)                                    │
│  渐变背景 + 标语 + 注册按钮（仅未登录用户显示）                 │
├──────────────────────────────────────────────────────────────┤
│  联系方式区域 (水平图标排列)                                  │
│              GitHub  邮箱  微信  QQ群                        │
│                       (hover显示二维码)                      │
├──────────────────────────────────────────────────────────────┤
│  版权区域                                                    │
│  Logo + © 2025 Researchopia + 隐私 | 条款                    │
└──────────────────────────────────────────────────────────────┘
```

### 区域1: CTA区域

**位置**: 替换现有欢迎消息区块

**样式**:
- 渐变背景: `from-blue-600 to-purple-700`
- 圆角卡片，内部居中布局

**内容**:
```
标题: "研学并进，智慧共享"
副标题: "加入研学港，与全球研究者一起探索学术前沿"
按钮: "立即开始" → 触发注册弹窗
```

**逻辑**: 已登录用户不显示此区域，或显示探索提示

### 区域2: 联系方式区域

**布局**: `flex flex-wrap justify-center gap-6 md:gap-8`

**联系方式列表**（按顺序）:

| 序号 | 渠道 | 图标 | Hover效果 | 交互 | 资源 |
|-----|------|------|----------|------|------|
| 1 | 个人微信 | 微信图标 | 显示二维码浮层 + "个人微信" | - | `wechat-personal.png` |
| 2 | 微信群 | 微信图标 | 显示二维码浮层 + "官方微信用户群" | - | `wechat-group.png` |
| 3 | 微信公众号 | 微信图标 | 显示二维码浮层 + "观物AI微信公众号" | - | `wechat-official-account.png` |
| 4 | GitHub | GitHub图标 | Tooltip "Github项目主页" | 点击跳转 | [链接](https://github.com/occasional16/researchopia) |
| 5+ | 预留 | 各平台官方图标 | Tooltip "观物AI-平台名" | 点击跳转 | 知乎/B站/抖音/小红书等 |

**二维码浮层组件**:
```tsx
<div className="group relative">
  <WechatIcon className="w-6 h-6 cursor-pointer hover:scale-110 transition-transform" />
  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl">
      <img src={`${QR_BASE_URL}/wechat-personal.png`} className="w-32 h-32" />
      <p className="text-xs text-center mt-2 text-gray-600 dark:text-gray-300">个人微信</p>
    </div>
  </div>
</div>
```

**二维码存储**: Supabase Storage `qr-codes` bucket
- URL格式: `{SUPABASE_URL}/storage/v1/object/public/qr-codes/{filename}`

### 区域3: 版权区域

**布局**: `flex justify-between items-center`

**左侧**: BrandLogo组件（小尺寸）+ 版权文字  
**右侧**: 隐私政策 | 服务条款（可选链接）

---

## 实现要点

1. **组件化**: 创建 `src/components/Footer.tsx` 独立组件
2. **响应式**: `flex-wrap` 自动换行
3. **暗色模式**: 使用 `dark:` 前缀适配
4. **i18n**: 所有文本使用 `t()` 函数
5. **二维码存储**: Supabase Storage `qr-codes` bucket
6. **模块化**: 从 `page.tsx` 抽离 Footer，减小文件体积

## 文件结构

```
src/components/
├── Footer.tsx          # 新增: 完整Footer组件
├── ui/
│   └── QRCodePopover.tsx  # 新增: 二维码浮层组件（可选）
```

## 优先级

- P0: 创建 Footer 组件 + CTA + 版权
- P1: 联系方式图标（微信二维码、GitHub跳转）
- P2: 预留平台入口（知乎/B站等）

---

## 参考

- [Vercel Footer](https://vercel.com) - 简洁专业
- [Notion Footer](https://notion.so) - 清晰分类
