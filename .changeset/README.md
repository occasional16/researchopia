# Changesets 配置

此目录由 [Changesets](https://github.com/changesets/changesets) 用于管理多包版本发布流程。

- `config.json`: 工作区配置，当前以 `main` 为基线分支，默认 `updateInternalDependencies: "patch"`。
- 每次需要发布共享库或其它npm包时，运行 `npm run changeset` 创建变更记录。
- 合并到主分支后，执行 `npm run release:version`（调用 `changeset version`）以更新 `package.json` 与 `CHANGELOG`，然后再发布。
