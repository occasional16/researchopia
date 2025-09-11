# 🚨 Git远程仓库配置修复指南

## 问题诊断
**错误**: `fatal: 'origin' does not appear to be a git repository`
**原因**: 本地Git仓库没有配置远程GitHub仓库

## 📋 解决步骤

### 方案一：连接到现有的GitHub仓库

如果您已经有GitHub仓库，请按以下步骤操作：

```powershell
# 1. 进入项目目录
cd "d:\AI\Rating\academic-rating"

# 2. 添加远程仓库（替换为您的实际仓库地址）
git remote add origin https://github.com/您的用户名/academic-rating.git

# 3. 验证远程仓库配置
git remote -v

# 4. 推送到远程仓库
git push -u origin main
```

### 方案二：创建新的GitHub仓库

如果您还没有GitHub仓库：

1. **访问GitHub**: https://github.com
2. **点击"New repository"**
3. **仓库名称**: `academic-rating` 或 `research-hub`
4. **设置为Public或Private**
5. **不要初始化README** (因为本地已有代码)
6. **创建仓库**

然后执行：
```powershell
# 连接到新创建的仓库
git remote add origin https://github.com/您的用户名/仓库名.git
git branch -M main
git push -u origin main
```

### 方案三：使用Vercel GitHub集成 (推荐)

如果您使用Vercel部署：

1. **访问Vercel Dashboard**: https://vercel.com/dashboard
2. **Import Project** → **From Git Repository**
3. **Connect with GitHub** → 授权GitHub访问
4. **Import your existing repository** 或 **Create new repository**

## 🔍 当前状态检查

```powershell
# 检查Git状态
git status

# 检查远程仓库
git remote -v

# 查看分支
git branch -a
```

## 🚀 自动化脚本

我将为您创建一个自动化脚本来处理这个问题。
