# 11. 部署优化与平台选型

> 背景：Vercel 免费版因超额被暂停，需优化并考虑替代方案

## 1. 当前问题分析

### 1.1 项目状态（MCP 查询结果 2024-12-22）

```json
{
  "project": "researchopia",
  "live": false,  // ⚠️ 已暂停
  "latestDeployment": "READY",
  "team": "team_3qZg6D4ijwWXoogKSgIhuLAb"
}
```

### 1.2 Vercel 免费版额度限制

| 资源 | 免费额度 | 项目现状 | 风险 |
|------|----------|----------|------|
| Serverless 函数执行 | 100k/月 | 101个 API 路由 | ⚠️ 高频调用易超额 |
| 函数执行时间 | 100 GB-Hrs | maxDuration: 10s | ⚠️ 中等风险 |
| Analytics 数据点 | 25k/月 | 已启用 | ⚠️ 中等风险 |
| Speed Insights | 10k/月 | 已启用 | ⚠️ 中等风险 |
| 带宽 | 100 GB | 含 PDF 处理 | ⚠️ 中等风险 |

### 1.2 优化建议

**立即可做**：
1. **关闭 Analytics/SpeedInsights** - 在 `layout.tsx` 移除 `<SpeedInsights />` 和 `<Analytics />`
2. **合并 API 路由** - 考虑将相似功能的路由合并，减少冷启动
3. **增加缓存** - 利用 `stale-while-revalidate` 减少函数调用
4. **降低 maxDuration** - 从 10s 降至 5s（`vercel.json`）

**中期优化**：
- 使用 Edge Functions 替代部分 Serverless（更快、更便宜）
- 静态生成更多页面（SSG > SSR）

---

## 2. 替代平台对比

| 平台 | 免费额度 | MCP 支持 | 适合场景 | 推荐度 |
|------|----------|----------|----------|--------|
| **Cloudflare Pages** | 无限请求 + 100k Workers/天 | ✅ 有 | Next.js SSR/边缘 | ⭐⭐⭐⭐⭐ |
| **Railway** | $5/月赠金 | ❌ | 全栈 + 数据库 | ⭐⭐⭐⭐ |
| **Render** | 750 hrs/月 | ❌ | 静态 + API | ⭐⭐⭐ |
| **Netlify** | 125k 函数/月 | ❌ | JAMstack | ⭐⭐⭐ |
| **Zeabur** | 按量计费 | ❌ | 中文友好 | ⭐⭐⭐ |
| **Fly.io** | 3 VMs 免费 | ❌ | 容器化部署 | ⭐⭐⭐ |

### 2.1 首推：Cloudflare Pages

**优势**：
- 🆓 无限静态请求，Workers 每天 100k 免费调用
- ⚡ 边缘部署，全球加速
- 🔌 有 MCP 服务（`@anthropic/mcp-server-cloudflare`）
- 💰 超出后按量计费，价格低廉
- 🔄 支持 Next.js（通过 `@cloudflare/next-on-pages`）

**迁移复杂度**：中等（需适配 Edge Runtime）

### 2.2 备选：Railway

**优势**：
- 每月 $5 免费额度（足够轻度使用）
- 一键部署 Next.js
- 支持 PostgreSQL、Redis

**劣势**：无 MCP 支持

---

## 3. 迁移方案（Cloudflare Pages）

```bash
# 1. 安装适配器
npm install @cloudflare/next-on-pages

# 2. 修改 next.config.ts
# 添加 runtime: 'edge' 到需要的路由

# 3. 部署命令
npx @cloudflare/next-on-pages
```

**注意事项**：
- 部分 Node.js API 在 Edge Runtime 不可用
- 需逐步迁移，先测试核心功能

---

## 4. 决策建议

| 优先级 | 行动 | 预期效果 |
|--------|------|----------|
| P0 | 关闭 Analytics + SpeedInsights | 减少 35k 数据点/月 | ✅ 代码已完成，需在 Dashboard 确认 |
| P0 | 审查 API 调用频率 | 定位超额根因 |
| P1 | 迁移至 Cloudflare Pages | 长期免费解决方案 |
| P2 | 优化 API 路由结构 | 减少冷启动开销 |

---

*创建时间: 2024-12-22*
