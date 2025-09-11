## 🚀 研学港同步 - 手动上传方案

由于Git推送连接问题，以下是手动同步方案：

### 📋 需要上传的关键文件

1. **package.json** (最重要 - 修复了项目名称)
2. **src/app/page.tsx** (包含研学港品牌)
3. **src/components/ui/BrandLogo.tsx** (品牌Logo组件)

### 🌐 手动上传步骤

#### 方法A: 使用GitHub网页版
1. 访问: https://github.com/occasional15/researchopia
2. 点击 `package.json` 文件
3. 点击编辑按钮 (✏️)
4. 将 `"name": "researchopia"` 改为 `"name": "academic-rating"`
5. 提交更改: "Fix Vercel project name mismatch"

#### 方法B: 使用GitHub Desktop
1. 下载安装 GitHub Desktop
2. Clone 仓库到本地
3. 复制当前目录的文件覆盖
4. 提交并推送

#### 方法C: 压缩上传
1. 将以下文件打包：
   - package.json
   - src/app/page.tsx  
   - src/components/ui/BrandLogo.tsx
2. 发送给有GitHub访问权限的人员上传

### ⚡ 快速验证

上传成功后：
1. 等待2-3分钟
2. 访问: https://academic-rating.vercel.app/
3. 检查是否显示"研学港 Researchopia"

### 🔧 本地Git修复

同时尝试修复本地Git连接：
```cmd
# 清除Git缓存
git config --global --unset-all credential.helper
git config --global credential.helper manager-core

# 更新远程URL
git remote set-url origin https://github.com/occasional15/researchopia.git

# 重新推送
git push origin main --force
```

### 📞 技术支持

如果以上方案都不行：
1. 检查网络防火墙设置
2. 尝试使用VPN
3. 更换网络环境（手机热点等）
4. 联系网络管理员检查端口443访问权限
