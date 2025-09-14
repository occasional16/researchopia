# 🔧 消息路由修复验证

## 问题分析
用户报告显示 content.js 发送的消息 action 为 `'openSidePanel'`，但 background.js 只处理 `'openSidebar'`，导致 "Unknown action" 错误。

## 修复内容
1. 在 background.js 的 `handleMessage` 方法中添加了对 `'openSidePanel'` 消息的处理
2. 改进了日志记录，显示消息来源标签页ID

## 修复后的消息流程
```
Content Script (点击浮动图标) 
    ↓ 发送消息: { action: 'openSidePanel', doi: '...', url: '...' }
Background Script
    ↓ 处理 'openSidePanel' 消息
    ↓ 调用 handleFloatingIconClick()
    ↓ 尝试 chrome.sidePanel.open()
    ↓ 成功: 显示 "✅" 徽章
    ↓ 失败: 显示 "DOI" 徽章引导用户点击扩展图标
```

## 预期修复结果
点击浮动图标后的控制台信息应该变为：
```
🖱️ 鼠标悬停
🖱️ 鼠标按下，起始位置: 60 452  
👆 检测到点击事件
👆 浮动图标被点击
📖 尝试打开侧边栏，DOI: 10.1038/s41467-025-62625-w
📬 收到消息: openSidePanel from tab: 123
🎯 处理浮动图标点击，tab: 123, doi: 10.1038/s41467-025-62625-w
💾 已保存DOI到storage: 10.1038/s41467-025-62625-w
✅ 侧边栏已自动打开  (如果成功)
或
⚠️ 无法自动打开侧边栏，可能是用户手势限制  (如果失败)
📨 Background响应: {success: true}
```

## 测试指令
1. 重新加载扩展 (chrome://extensions/)
2. 访问学术网站 (如 nature.com 的论文页面)
3. 点击浮动图标
4. 检查控制台输出，确认不再出现 "Unknown action" 错误
5. 验证侧边栏是否自动打开，或徽章是否正确显示