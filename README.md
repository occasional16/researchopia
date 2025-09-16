# 研学港 Researchopia - 学术论文评分平台

> **研学并进，智慧共享** | Where Research Meets Community

## 📋 项目概述

**研学港 Researchopia** 是一个现代化的学术论文评分平台，旨在为研究者提供优质的学术资源评价和交流环境。我们致力于构建一个研究者的理想国，让学术智慧在这里汇聚和传播。

## 🌐 在线访问

- **官方网站**: [https://www.researchopia.com](https://www.researchopia.com)

## 🚀 主要功能

- **学术论文搜索与评分**: 智能搜索学术文献，提供多维度评价体系
- **研究者社区**: 构建学术交流与讨论的专业平台
- **浏览器扩展**: 提供 Chrome/Edge 浏览器插件，便捷访问论文评价
- **Zotero 集成**: 无缝集成 Zotero 文献管理器
- **多平台支持**: 响应式设计，支持桌面和移动端访问

## � 项目结构

```
📁 academic-rating/
├── 📁 src/                    # 源代码目录
│   ├── 📁 app/               # Next.js 13+ App Router页面
│   ├── 📁 components/        # React组件
│   ├── 📁 contexts/          # React上下文
│   ├── 📁 hooks/             # 自定义Hook
│   ├── 📁 lib/               # 工具库
│   ├── 📁 middleware/        # 中间件
│   └── 📁 utils/             # 工具函数
├── 📁 public/                # 静态资源文件
├── 📁 database/              # 数据库配置与脚本
├── 📁 extension/             # 浏览器扩展
├── 📁 zotero-plugin/         # Zotero插件
├── 📁 supabase/              # Supabase配置与迁移
├── 📁 scripts/               # 项目脚本 【整理后新增】
│   ├── 📁 deploy/            # 部署脚本 (18个)
│   ├── 📁 test/              # 测试与诊断脚本 (31个)
│   ├── 📁 setup/             # 项目设置脚本 (12个)
│   ├── 📁 maintenance/       # 维护脚本 (17个)
│   └── 📁 database/          # 数据库脚本 (9个)
├── 📁 archive/               # 归档文件 【整理后新增】
│   ├── 📁 old-docs/          # 过时文档 (39个)
│   └── 📁 old-scripts/       # 过时脚本 (8个)
└── 📁 docs/                  # 项目文档
```

## �🔧 开发环境

### 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 本地访问: http://localhost:300x
```

### 环境配置

复制 `.env.example` 到 `.env.local` 并配置必要的环境变量：

```bash
# Supabase 数据库配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# Altmetric API 配置（可选）
ALTMETRIC_API_KEY=your_altmetric_key
```

## 📱 浏览器扩展

研学港提供 Chrome/Edge 浏览器扩展，支持：

- 自动检测学术论文 DOI
- 一键搜索论文评价
- 侧边栏快速预览
- 浮动图标便捷访问

### 安装扩展

1. 打开浏览器扩展管理页面
2. 启用"开发者模式"
3. 选择"加载已解压的扩展程序"
4. 选择项目中的 `extension` 文件夹

## 📚 Zotero 插件

集成 Zotero 文献管理器，在 Zotero 中直接查看论文评价。

### 安装 Zotero 插件

1. 将 `zotero-plugin` 文件夹复制到 Zotero 插件目录
2. 重启 Zotero
3. 在论文条目中查看评价信息

## 🛠 技术栈

- **前端框架**: Next.js 15 + React 19
- **样式设计**: Tailwind CSS + Shadcn/ui
- **数据库**: Supabase (PostgreSQL)
- **部署平台**: Vercel
- **开发语言**: TypeScript

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目！

---

**研学港 Researchopia** - 让学术研究更高效，让知识分享更便捷。
