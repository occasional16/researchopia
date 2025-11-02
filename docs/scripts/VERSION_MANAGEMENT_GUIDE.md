# 版本号管理指南

本文档说明如何管理Researchopia项目及其组件的版本号。

---

## 📋 版本号体系

Researchopia采用**独立版本号策略**:

```
项目主版本: v0.3.0 (根目录package.json)
  ├─ 网站(Next.js): v0.3.0 (跟随主版本)
  ├─ Zotero插件: v0.3.3 (独立版本)
  ├─ 浏览器扩展: v0.1.1 (独立版本)
  └─ 文档: v0.1 (独立版本)
```

### 为什么采用独立版本?

1. **组件独立发布**: Zotero插件和浏览器扩展可以独立于网站发布
2. **用户体验**: 用户可以清楚知道每个组件的版本号
3. **发布灵活性**: 不同组件的发布频率不同

---

## 🔧 使用方法

### 1. 检查当前版本

```bash
npm run version:check
```

**输出示例**:
```
🔍 开始检查组件版本号...

项目主版本: 0.3.0

✅ Zotero插件: 0.3.3 (正确)
✅ 浏览器扩展: 0.1.1 (正确)
✅ 文档: v0.1 (正确)

🎉 版本号检查通过!
```

### 2. 更新组件版本

**手动编辑** 根目录 `package.json`:

```json
{
  "version": "0.3.0",
  "components": {
    "website": "0.3.0",
    "zotero-plugin": "0.3.4",  // 修改这里
    "browser-extension": "0.1.2",  // 修改这里
    "docs": "0.1"
  }
}
```

**然后运行**:
```bash
npm run version:sync
```

**输出示例**:
```
📦 开始同步组件版本号...

项目主版本: 0.3.0
组件版本:
  - website: 0.3.0
  - zotero-plugin: 0.3.4
  - browser-extension: 0.1.2
  - docs: 0.1

✅ Zotero插件: 0.3.3 → 0.3.4
✅ 浏览器扩展: 0.1.1 → 0.1.2
✅ 文档: v0.1 → v0.1

🎉 版本号同步完成!
```

### 3. 提交变更

```bash
# 检查变更
git diff

# 提交
git add -A
git commit -m "chore: bump zotero-plugin to v0.3.4, browser-extension to v0.1.2"

# 创建Git Tag (可选)
git tag v0.3.0
git tag zotero-plugin/v0.3.4
git tag extension/v0.1.2
```

---

## 📂 版本号存储位置

| 组件 | 文件位置 | 版本字段 |
|------|---------|----------|
| 项目主版本 | `package.json` | `version` |
| 网站 | `package.json` | `version` (同主版本) |
| Zotero插件 | `zotero-plugin/package.json` | `version` |
| 浏览器扩展 | `extension/manifest.json` | `version` |
| 文档 | `docs/README.md` | `**文档版本**: vX.X` |

---

## 🎯 版本号规则

遵循**语义化版本(Semantic Versioning)**:

### 格式: `主版本号.次版本号.修订号`

- **主版本号**: 不兼容的API变更、重大架构调整
- **次版本号**: 向下兼容的功能新增
- **修订号**: Bug修复、小优化

### 示例

```
v0.3.0 → v0.3.1  (Bug修复)
v0.3.1 → v0.4.0  (新增功能)
v0.4.0 → v1.0.0  (重大变更,API不兼容)
```

---

## 📝 发布流程

### 发布Zotero插件

1. **更新版本号**:
   ```json
   // package.json
   {
     "components": {
       "zotero-plugin": "0.3.4"
     }
   }
   ```

2. **同步版本号**:
   ```bash
   npm run version:sync
   ```

3. **构建插件**:
   ```bash
   cd zotero-plugin
   npm run build
   ```

4. **提交并创建Tag**:
   ```bash
   git add -A
   git commit -m "chore: release zotero-plugin v0.3.4"
   git tag zotero-plugin/v0.3.4
   git push origin main --tags
   ```

5. **在GitHub创建Release**:
   - Tag: `zotero-plugin/v0.3.4`
   - Title: `Zotero Plugin v0.3.4`
   - Description: 更新日志
   - Attach: `zotero-plugin/build/researchopia.xpi`

### 发布浏览器扩展

1. **更新版本号** (同上)

2. **同步版本号**:
   ```bash
   npm run version:sync
   ```

3. **提交并创建Tag**:
   ```bash
   git add -A
   git commit -m "chore: release browser-extension v0.1.2"
   git tag extension/v0.1.2
   git push origin main --tags
   ```

4. **上传到Chrome Web Store**:
   - 打包 `extension/` 目录为ZIP
   - 在Chrome Web Store开发者控制台上传
   - 填写更新日志

### 发布网站(Next.js)

网站版本跟随主项目版本,使用Vercel自动部署:

1. **更新主版本号**:
   ```json
   // package.json
   {
     "version": "0.4.0"
   }
   ```

2. **提交**:
   ```bash
   git add -A
   git commit -m "chore: release v0.4.0"
   git tag v0.4.0
   git push origin main --tags
   ```

3. **Vercel自动部署**:
   - Push到main分支自动触发部署
   - 查看: https://vercel.com/your-project/deployments

---

## 🛠 脚本说明

### `scripts/sync-versions.js`

**功能**: 从根目录 `package.json` 读取版本号,同步到各组件

**更新的文件**:
- `zotero-plugin/package.json` → `version`
- `extension/manifest.json` → `version`
- `docs/README.md` → `**文档版本**: vX.X` + `**最后更新**: YYYY-MM-DD`

**示例**:
```bash
npm run version:sync
```

### `scripts/check-versions.js`

**功能**: 验证所有组件版本号是否与根 `package.json` 一致

**退出码**:
- `0`: 所有版本号正确
- `1`: 发现不一致的版本号

**示例**:
```bash
npm run version:check

# 在CI/CD中使用
npm run version:check || exit 1
```

---

## 💡 最佳实践

### 1. 始终先更新版本号
```bash
# ❌ 错误做法
git commit -m "add new feature"
git push
# (忘记更新版本号)

# ✅ 正确做法
# 1. 编辑 package.json 更新版本号
# 2. npm run version:sync
# 3. git add -A && git commit -m "chore: bump version to vX.X.X"
# 4. git tag vX.X.X
# 5. git push origin main --tags
```

### 2. 使用语义化版本
```bash
# Bug修复
v0.3.0 → v0.3.1

# 新增功能(向下兼容)
v0.3.1 → v0.4.0

# 重大变更(Breaking Changes)
v0.4.0 → v1.0.0
```

### 3. 在CI/CD中验证版本号
```yaml
# .github/workflows/ci.yml
- name: Check versions
  run: npm run version:check
```

### 4. Git Tag命名规范
```bash
# 主版本
git tag v0.3.0

# 组件版本
git tag zotero-plugin/v0.3.4
git tag extension/v0.1.2
git tag docs/v0.2
```

---

## ❓ 常见问题

### Q: 如何回滚版本号?

**A**: 手动编辑 `package.json`,然后运行 `npm run version:sync`

```json
{
  "components": {
    "zotero-plugin": "0.3.2"  // 从0.3.3回滚到0.3.2
  }
}
```

### Q: 文档版本号什么时候更新?

**A**: 文档大版本更新时:
- 新增核心文档(如新增组件)
- 文档结构重大调整
- 按季度审查(每3个月)

### Q: 可以只更新一个组件吗?

**A**: 可以,只需在 `package.json` 中修改对应组件的版本号

```json
{
  "components": {
    "website": "0.3.0",  // 不变
    "zotero-plugin": "0.3.4",  // 只更新这个
    "browser-extension": "0.1.1",  // 不变
    "docs": "0.1"  // 不变
  }
}
```

### Q: 版本号同步失败怎么办?

**A**: 检查文件是否存在和格式是否正确

```bash
# 查看详细错误信息
npm run version:sync

# 检查文件是否存在
ls zotero-plugin/package.json
ls extension/manifest.json
ls docs/README.md

# 检查JSON格式
cat zotero-plugin/package.json | jq .
cat extension/manifest.json | jq .
```

---

## 📚 相关文档

- [CONTRIBUTING.md](../CONTRIBUTING.md) - 贡献指南
- [docs/README.md](../docs/README.md) - 文档索引和规范
- [GitHub Releases](https://github.com/occasional16/researchopia/releases) - 发布历史

---

**最后更新**: 2025-01-02  
**维护者**: Researchopia Team
