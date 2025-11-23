# 脚本与发布工具一览

本目录收录与版本管理相关的文档与脚本说明。

| 文件 | 说明 |
|------|------|
| `VERSION_MANAGEMENT_GUIDE.md` | 版本号策略、Changesets 流程、发布步骤 |
| `check-email-config.js` | 校验 `.env` 系列文件中的 SMTP 配置是否完整 |
| `check-changeset.js` | 检测 `packages/*` 改动是否缺少 changeset 说明 |

## 常用命令速查

```bash
# 版本号同步/检查
npm run version:sync
npm run version:check

# 邮件配置体检
npm run check-email            # 默认读取 .env.local / .env
node scripts/check-email-config.js --file .env.example --verbose

# Changeset 守卫
npm run changeset:check

# Changesets 发布流
npm run changeset        # 交互式创建变更记录
npm run release:version  # 根据变更提升版本并更新changelog
npm run release:publish  # 发布到 npm (需凭证)
```

更多信息请参阅主文档 `VERSION_MANAGEMENT_GUIDE.md` 与 `docs/docs-dev/7.2-PROJECT_STRUCTURE_AND_OPTIMIZATION.md` 的治理记录。
