# 研学港 Researchopia - 开放的学术交流平台

[![zotero target version](https://img.shields.io/badge/Zotero-8/7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org) 
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)
![Downloads](https://gh-down-badges.linkof.link/occasional16/researchopia)
[![Latest release](https://img.shields.io/github/v/release/occasional16/researchopia)](https://github.com/occasional16/researchopia/releases)
![License](https://img.shields.io/badge/License-AGPLv3-green.svg)

> **研学并进，智慧共享** | Where Research Meets Community

## 🚀 最新动态

**2025.10.31** Zotero插件0.3.1版已上线，请前往zotero插件商店或github下载安装。

## 💡 项目声明

欢迎来到 **研学港 Researchopia** ！ **本项目完全由AI工具生成**（除了这段话），没敲过一行代码（因为根本不会😂）。我是一名刚博士毕业的科研狗（化学领域），没有编程基础，也没有报过AI课程，抱着试一试的态度，才发现AI太好用了！

本项目为 **研学港 Researchopia** 的开源项目（项目名称、logo和slogan也是AI给设计的），旨在为学术研究者提供优质的学术资源和交流环境。

本项目主要呈现方式是一个 **[网站](https://www.researchopia.com)** ，以及于此网站关联的 **[浏览器扩展](https://microsoftedge.microsoft.com/addons/detail/%E7%A0%94%E5%AD%A6%E6%B8%AF-researchopia/hjijphegihgkddcmdmfjpflpcdaadbio)** 和 **Zotero插件** （官网或 [Releases](https://github.com/occasional16/researchopia/releases) 下载）。具体功能参考下方描述，以及网站上的 [用户指南](https://www.researchopia.com/guide) 。

本项目总共历时1周。其实只要描述清楚，直接给一段话AI就可以搞定！一点也不夸张，一周前我还不懂什么叫网站前后端也不懂VS code（现在也只是大致了解一点），但第一天时间就完成了网站基本的界面设计和数据库搭建。浏览器扩展和zotero插件的第一版真的是各用一句话直接生成。当然，进一步的细节打磨和bug处理是花了更多的时间。这段时间也渐渐学到了一些编程知识，也积累了一些与AI对话的经验和小窍门。目前项目处于初期阶段，后续会持续优化和完善。

想要近距离了解本项目开发意图和计划，有任何开发和使用上的建议和反馈，或者想了解AI开发的细节的小伙伴，欢迎加我的个人微信，也欢迎加入官方群用户群。

<div align="center">
<img src="./doc/img/wechat.png" alt="微信二维码" width="35%">
<img src="./doc/img/wechat group-users.png" alt="微信二维码" width="33.5%">
</div> 

## 📋 项目概述

**研学港 Researchopia** 是一个现代化的学术论文交流平台，旨在为研究者提供优质的学术资源评价和交流环境。我们致力于构建一个研究者的理想国，让学术智慧在这里汇聚和传播。

## 🌐 在线访问

- **官方网站**: [https://www.researchopia.com](https://www.researchopia.com)

主页：

![主页](/doc/img/zhuye.png)

论文详情页：

![alt text](/doc/img/xiangqingye.png)

个人中心页：

![alt text](/doc/img/gerenzhongxin.png)

## ✨ 主要功能

- **学术论文搜索与评分**: 智能搜索学术文献，提供多维度评价体系
- **研究者社区**: 构建学术交流与讨论的专业平台
- **浏览器扩展**: 提供 Chrome/Edge 浏览器插件，便捷访问论文评价
- **Zotero 集成**: 无缝集成 Zotero 文献管理器
- **多平台支持**: 响应式设计，支持桌面和移动端访问

## 📁 项目结构

```
📁 researchopia/
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
└── 📁 doc/                  # 相关文件
```

## 🔧 开发环境

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
```

## 📱 浏览器扩展

研学港提供 Chrome/Edge 浏览器扩展，支持：

- 自动检测学术论文 DOI
- 一键搜索论文评价
- 侧边栏快速预览
- 浮动图标便捷访问

![浏览器扩展](/doc/img/1.png)

### 安装扩展

1. 打开浏览器扩展管理页面
2. 启用"开发者模式"
3. 选择"加载已解压的扩展程序"
4. 选择项目中的 `extension` 文件夹

## 📚 Zotero 插件

集成 Zotero 文献管理器，在 Zotero 中直接查看论文评价。

![Zotero插件](/doc/img/zotero.png)

### 安装 Zotero 插件

1. 将 `zotero-plugin` 文件夹打包压缩为 `.zip` 文件并修改后缀名为 `.xpi`
2. 在 Zotero > Tools > Plugins 中安装插件

## 🛠 技术栈

- **前端框架**: Next.js 15 + React 19
- **样式设计**: Tailwind CSS + Shadcn/ui
- **数据库**: Supabase (PostgreSQL)
- **部署平台**: Vercel
- **开发语言**: TypeScript

## 📄 许可证

本项目采用 AGPL-v3 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献指南

欢迎添加作者微信，或提交 Issue 和 Pull Request 来帮助改进项目！

---

**研学港 Researchopia** - 研学并进，智慧共享 | Where Research Meets Community。
