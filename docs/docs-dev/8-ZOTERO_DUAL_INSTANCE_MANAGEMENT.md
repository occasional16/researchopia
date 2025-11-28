# Zotero 双实例管理：独立关闭 Dev 方案

## 问题现象

使用 `npm start` 启动 Dev 实例后，按 `Ctrl+C` 关闭时**同时关闭了 Default 实例**。

---

## 标准流程 ✅

```powershell
# 启动 Dev 实例
cd zotero-plugin
npm start

# 关闭 Dev 实例（不影响 Default）
cd zotero-plugin\scripts
.\kill-dev.ps1
```

**脚本位置**: `zotero-plugin\scripts\kill-dev.ps1`

---

## 技术原理

### 为什么 Ctrl+C 会影响 Default？

#### 1. 进程树结构

```
PowerShell 终端
├─ npm.cmd (Windows 批处理)
│  └─ node.exe (npm 主进程)
│     └─ node.exe (zotero-plugin serve)
│        └─ zotero.exe (Dev 实例) --purgecaches
│
独立桌面快捷方式
└─ zotero.exe (Default 实例) -no-remote -P Default
```

#### 2. Ctrl+C 的杀伤链

**Windows 控制台机制**:
- 按下 Ctrl+C → 系统向**整个进程组**发送 `CTRL_BREAK_EVENT`
- 进程组包含：PowerShell、npm、node、zotero (Dev)
- 所有进程**同时被强制终止**，没有执行清理代码的机会

**Zotero 的全局状态管理**:
```
%APPDATA%\Zotero\
├─ profiles.ini        (全局 Profile 配置)
├─ zotero.sqlite      (元数据库)
└─ Profiles\
   ├─ Default\
   │  ├─ zotero.sqlite (Default 数据)
   │  └─ *.lock        (进程锁文件)
   └─ Dev\
      ├─ zotero.sqlite
      └─ *.lock
```

**关键机制**:
1. **IPC 通信**: Zotero 使用 Windows 命名管道 (`\\.\pipe\ZoteroIPC`) 实现实例间通信
2. **进程锁**: 每个 Profile 有独立锁文件，但**锁的释放需要正常退出流程**
3. **共享状态**: 部分全局钩子（如剪贴板监听、快捷键注册）在 `profiles.ini` 级别共享

**崩溃传播路径**:
```
Ctrl+C 强制终止 Dev
  ↓
Dev 实例未执行 cleanup 代码
  ↓
锁文件未释放 + IPC 管道未关闭 + 全局钩子残留
  ↓
Zotero 全局管理器检测到异常状态
  ↓
触发保护性关闭所有实例（避免数据损坏）
```

#### 3. 脚本的精确打击

**`kill-dev.ps1` 工作原理**:

```powershell
# 第一步：识别 Dev 相关进程
1. 查找 cmd.exe: CommandLine 包含 "npm*start"
2. 查找 zotero.exe: CommandLine 包含 "--purgecaches" (Dev 特有标志)

# 第二步：精确杀死
- 仅杀死 cmd.exe (父进程)
- 仅杀死 Dev zotero.exe (子进程)
- Default zotero.exe 不在目标列表

# 第三步：等待清理
- 等待 2 秒，让系统清理子进程资源
```

**为什么脚本不会影响 Default？**

| 因素 | Ctrl+C | kill-dev.ps1 |
|------|--------|--------------|
| 触发方式 | 系统信号广播 | 精确 PID 定向 |
| 影响范围 | 整个进程组 | 仅 Dev 进程 |
| Default 在进程组内？ | ❌ 否（独立启动） | ❌ 否（不在目标列表） |
| Dev 清理代码执行？ | ❌ 强制终止 | ⚠️ 部分执行 |
| 锁文件释放？ | ❌ 未释放 | ✅ 系统自动清理 |

**关键差异**: 
- Ctrl+C 触发**进程组级联终止** + **全局状态异常检测**
- kill-dev.ps1 仅终止**单个进程** + **不触发 Zotero 全局保护机制**

---

## 失败方案分析

| 方案 | 测试结果 | 失败原因 |
|------|---------|----------|
| 独立终端窗口 | ❌ 无效 | 进程组仍共享，Ctrl+C 广播范围不变 |
| PM2 进程管理 | ⚠️ 不适用 | 后台运行无 GUI 窗口，不适合桌面应用 |
| 独立 Dev Profile | ⚠️ 过于复杂 | 需修改配置 + 创建 Profile，维护成本高 |

---

**文档版本**: v1.0  
**最后更新**: 2025-11-26  
**维护者**: Researchopia Team
