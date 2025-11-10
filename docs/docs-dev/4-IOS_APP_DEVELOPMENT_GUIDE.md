# Researchopia iOS APP 开发全流程方案

## 文档信息
- **版本**: v1.0
- **创建时间**: 2025-01-07
- **状态**: 开发方案
- **优先级**: 中
- **目标**: 将 https://www.researchopia.com/ 移植为iOS原生应用

---

## 1. 技术选型对比

### 1.1 三种开发方案

| 方案 | 开发成本 | 性能 | 用户体验 | 功能完整度 | 推荐度 |
|------|---------|------|---------|-----------|--------|
| **原生开发(Swift/SwiftUI)** | ⭐⭐ (3人月) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **React Native** | ⭐⭐⭐⭐ (1.5人月) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **WebView套壳** | ⭐⭐⭐⭐⭐ (3天) | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

### 1.2 最终选择: React Native

**理由**:
1. ✅ 复用现有React组件逻辑(与Next.js相同技术栈)
2. ✅ 一次开发,iOS+Android双端发布
3. ✅ 性能接近原生(Hermes引擎)
4. ✅ 社区活跃,生态成熟
5. ✅ 支持热更新(CodePush)

---

## 2. 原生开发方案(React Native)

### 2.1 技术栈

```
┌─────────────────────────────────────────────┐
│  前端层                                      │
│  - React Native 0.73+                       │
│  - TypeScript                                │
│  - React Navigation (路由)                   │
│  - Redux Toolkit (状态管理)                  │
│  - React Query (数据缓存)                    │
└─────────────────────────────────────────────┘
         │
         ▼ HTTPS API
┌─────────────────────────────────────────────┐
│  中间层                                      │
│  - Next.js API Routes (复用现有)             │
│  - REST API                                  │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  后端层                                      │
│  - Supabase (复用现有)                       │
│  - PostgreSQL                                │
│  - Supabase Auth (JWT Token)                │
└─────────────────────────────────────────────┘
```

### 2.2 项目结构

```
ResearchopiaApp/
├── ios/                    # iOS原生代码
│   ├── Podfile
│   └── ResearchopiaApp.xcworkspace
├── android/                # Android原生代码
│   ├── app/
│   └── build.gradle
├── src/
│   ├── App.tsx            # 入口
│   ├── navigation/        # 路由
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   ├── screens/           # 页面
│   │   ├── HomeScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   ├── PaperDetailScreen.tsx
│   │   ├── SessionListScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── components/        # 组件
│   │   ├── PaperCard.tsx
│   │   ├── AnnotationItem.tsx
│   │   └── Button.tsx
│   ├── services/          # API服务
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── paper.ts
│   ├── store/             # Redux状态
│   │   ├── slices/
│   │   └── store.ts
│   ├── hooks/             # 自定义Hooks
│   ├── types/             # TypeScript类型
│   ├── utils/             # 工具函数
│   └── constants/         # 常量
├── package.json
└── tsconfig.json
```

### 2.3 核心功能实现

#### 2.3.1 用户认证(Apple Sign In)

```typescript
// src/services/auth.ts
import { appleAuth } from '@invertase/react-native-apple-authentication'
import { supabase } from './supabase'

export class AuthService {
  /**
   * Apple登录
   */
  static async signInWithApple(): Promise<User> {
    try {
      // 1. 发起Apple登录
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [
          appleAuth.Scope.EMAIL,
          appleAuth.Scope.FULL_NAME
        ]
      })
      
      const { identityToken, user, email, fullName } = appleAuthRequestResponse
      
      // 2. 验证凭证
      const credentialState = await appleAuth.getCredentialStateForUser(user)
      if (credentialState !== appleAuth.State.AUTHORIZED) {
        throw new Error('Apple登录失败')
      }
      
      // 3. 调用后端API验证token
      const response = await fetch(
        'https://www.researchopia.com/api/auth/apple',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identity_token: identityToken,
            user_id: user,
            email: email,
            full_name: fullName
          })
        }
      )
      
      const { access_token, refresh_token, user: userData } = await response.json()
      
      // 4. 存储token
      await AsyncStorage.setItem('access_token', access_token)
      await AsyncStorage.setItem('refresh_token', refresh_token)
      await AsyncStorage.setItem('user', JSON.stringify(userData))
      
      return userData
      
    } catch (error) {
      console.error('[Auth] Apple Sign In failed:', error)
      throw error
    }
  }
  
  /**
   * 邮箱登录
   */
  static async signInWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    
    await AsyncStorage.setItem('access_token', data.session.access_token)
    return data.user
  }
}
```

#### 2.3.2 论文搜索

```typescript
// src/screens/SearchScreen.tsx
import React, { useState } from 'react'
import { View, TextInput, FlatList, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { PaperService } from '@/services/paper'
import PaperCard from '@/components/PaperCard'

export default function SearchScreen({ navigation }) {
  const [keyword, setKeyword] = useState('')
  
  const { data: papers, isLoading, refetch } = useQuery({
    queryKey: ['papers', keyword],
    queryFn: () => PaperService.search(keyword),
    enabled: keyword.length > 0
  })
  
  return (
    <View style={styles.container}>
      {/* 搜索框 */}
      <TextInput
        style={styles.searchInput}
        placeholder="搜索DOI或论文标题"
        value={keyword}
        onChangeText={setKeyword}
        onSubmitEditing={() => refetch()}
      />
      
      {/* 结果列表 */}
      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={papers}
          keyExtractor={(item) => item.doi}
          renderItem={({ item }) => (
            <PaperCard
              paper={item}
              onPress={() => navigation.navigate('PaperDetail', { doi: item.doi })}
            />
          )}
        />
      )}
    </View>
  )
}
```

#### 2.3.3 PDF阅读器集成

```typescript
// src/screens/PDFReaderScreen.tsx
import React from 'react'
import Pdf from 'react-native-pdf'
import { View, StyleSheet } from 'react-native'

export default function PDFReaderScreen({ route }) {
  const { pdfUrl } = route.params
  
  return (
    <View style={styles.container}>
      <Pdf
        source={{ uri: pdfUrl, cache: true }}
        onLoadComplete={(numberOfPages) => {
          console.log(`Loaded ${numberOfPages} pages`)
        }}
        onError={(error) => {
          console.error('PDF load error:', error)
        }}
        style={styles.pdf}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  pdf: {
    flex: 1,
    width: '100%',
    height: '100%'
  }
})
```

### 2.4 开发流程

#### 2.4.1 环境搭建

```bash
# 1. 安装Homebrew (macOS)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安装Node.js
brew install node

# 3. 安装Watchman
brew install watchman

# 4. 安装CocoaPods
sudo gem install cocoapods

# 5. 安装Xcode (从App Store)
# 版本要求: Xcode 14+

# 6. 创建React Native项目
npx react-native@latest init ResearchopiaApp --template react-native-template-typescript

# 7. 安装依赖
cd ResearchopiaApp
npm install

# 8. iOS依赖安装
cd ios && pod install && cd ..

# 9. 启动开发服务器
npm start

# 10. 运行iOS模拟器
npm run ios
```

#### 2.4.2 开发工作流

```bash
# 启动Metro bundler
npm start

# iOS开发
npm run ios                    # 默认模拟器
npm run ios -- --simulator="iPhone 15 Pro"  # 指定模拟器

# 真机调试
# Xcode → 选择真机设备 → 运行

# 热重载
# 模拟器内按 Cmd+D → Enable Fast Refresh
```

### 2.5 核心库依赖

```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.73.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/stack": "^6.3.20",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "@tanstack/react-query": "^5.17.0",
    "@reduxjs/toolkit": "^2.0.1",
    "react-redux": "^9.0.4",
    "@supabase/supabase-js": "^2.39.0",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "@invertase/react-native-apple-authentication": "^2.3.0",
    "react-native-pdf": "^6.7.3",
    "react-native-fast-image": "^8.6.3",
    "react-native-vector-icons": "^10.0.3",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.45",
    "@types/react-native": "^0.73.0",
    "typescript": "^5.3.3",
    "eslint": "^8.56.0"
  }
}
```

---

## 3. WebView 套壳方案(极简)

### 3.1 方案描述

**核心**: 使用 `react-native-webview` 直接加载网站

```typescript
// App.tsx (完整代码)
import React from 'react'
import { SafeAreaView, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: 'https://www.researchopia.com/' }}
        startInLoadingState={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        onMessage={(event) => {
          // 接收Web端消息
          console.log('Message from web:', event.nativeEvent.data)
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
})
```

### 3.2 快速开发流程

```bash
# 1. 创建项目(5分钟)
npx react-native init ResearchopiaApp --template react-native-template-typescript

# 2. 安装WebView(2分钟)
npm install react-native-webview
cd ios && pod install && cd ..

# 3. 修改App.tsx(3分钟)
# 粘贴上面的代码

# 4. 运行测试(5分钟)
npm run ios

# 总耗时: 15分钟
```

### 3.3 优劣分析

**优势**:
- ⚡ 开发速度极快(半天完成)
- ✅ 网站更新,APP自动同步
- ✅ 零维护成本
- ✅ 功能100%复用

**劣势**:
- ❌ 加载慢(首屏3-5秒)
- ❌ 不支持离线缓存
- ❌ 无法调用原生API(推送、Touch ID等)
- ❌ App Store审核可能被拒

---

## 4. App Store 上架流程

### 4.1 准备工作

#### 4.1.1 注册Apple开发者账号

1. 访问 https://developer.apple.com/programs/
2. 注册费用: **$99/年** (个人) 或 **$299/年** (企业)
3. 审核周期: 1-3个工作日

#### 4.1.2 创建App ID

```bash
# Xcode → Signing & Capabilities
Bundle Identifier: com.researchopia.app
Team: 选择你的开发者账号
```

#### 4.1.3 准备资源

**图标**:
- 1024x1024 (App Store展示图标)
- 多尺寸图标(通过工具自动生成)

**截图** (必需,至少4张):
- iPhone 15 Pro Max: 1290 x 2796 pixels
- iPhone 8 Plus: 1242 x 2208 pixels
- iPad Pro 12.9": 2048 x 2732 pixels

**隐私政策URL**:
- 必须提供,例如: https://www.researchopia.com/privacy-ios

### 4.2 构建与上传

#### 4.2.1 配置Release版本

```bash
# 1. 增加版本号
# ios/ResearchopiaApp/Info.plist
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
<key>CFBundleVersion</key>
<string>1</string>

# 2. 生成Release构建
npm run build:ios
```

#### 4.2.2 Xcode上传

1. Xcode → Product → Archive
2. 等待构建完成(5-10分钟)
3. Window → Organizer → Archives
4. 选择构建 → Distribute App
5. 选择"App Store Connect" → Upload

### 4.3 App Store Connect配置

#### 4.3.1 创建新APP

登录 https://appstoreconnect.apple.com/

1. **我的App** → **+** → **新建App**
2. 填写信息:
   - 名称: 研学港 (Researchopia)
   - 语言: 简体中文 + 英语
   - Bundle ID: com.researchopia.app
   - SKU: RESEARCHOPIA_001

#### 4.3.2 填写App信息

**必填字段**:
- 副标题: 学术论文交流与共享平台
- 类别: 教育 → 参考资料
- 关键词: 论文,学术,科研,标注,Zotero
- 描述:
  ```
  研学港是一个开放的学术交流和共享平台。
  
  核心功能:
  • 论文搜索与管理
  • 文献共读会话
  • 智能标注与评论
  • 学术社交网络
  
  适用于科研工作者、研究生、学者等学术群体。
  ```

**应用内购买**: 无 (如无付费功能)

**隐私详情** (iOS 14+要求):
- 数据类型: 联系信息、用户内容
- 使用目的: 应用功能、分析
- 是否关联用户: 是

#### 4.3.3 提交审核

1. 选择构建版本
2. 上传截图(4-6张)
3. 填写审核信息:
   - 联系人
   - 演示账号(测试账号)
   - 审核备注
4. 点击"提交审核"

**审核周期**: 通常 **1-7天**

### 4.4 审核要点

#### 易被拒绝的情况

- ❌ App仅是网站的壳子(WebView方案风险)
- ❌ 崩溃或严重bug
- ❌ 缺少隐私政策
- ❌ 使用了未申报的API
- ❌ 内容违规(侵权、暴力等)

#### 提高通过率的技巧

- ✅ 提供详细的测试账号和使用说明
- ✅ 截图展示核心功能
- ✅ 审核备注中说明技术亮点
- ✅ 确保App稳定性(无崩溃)
- ✅ 适配最新iOS版本

---

## 5. 混合方案(推荐)

### 5.1 方案描述

**核心页面用React Native,复杂页面用WebView**

```
┌─────────────────────────────────────┐
│  iOS APP                            │
│                                     │
│  ┌─────────┐  ┌─────────┐         │
│  │ 首页    │  │ 搜索页  │  RN     │
│  │ (原生)  │  │ (原生)  │  原生   │
│  └─────────┘  └─────────┘         │
│                                     │
│  ┌─────────────────────────────┐  │
│  │  论文详情 / PDF阅读器       │  │
│  │  (WebView或原生PDF组件)     │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────┐  ┌─────────┐         │
│  │ 会话列表│  │ 个人中心│  RN     │
│  │ (原生)  │  │ (原生)  │  原生   │
│  └─────────┘  └─────────┘         │
└─────────────────────────────────────┘
```

### 5.2 开发成本

| 阶段 | 工时 | 说明 |
|------|------|------|
| 原生页面(5个) | 15天 | 首页、搜索、会话列表、个人中心、登录 |
| WebView集成 | 3天 | 论文详情、标注详情 |
| PDF阅读器 | 5天 | 原生PDF组件集成 |
| 通信桥接 | 3天 | RN ↔ WebView 数据传递 |
| 测试优化 | 7天 | 真机测试、性能优化 |
| App Store准备 | 2天 | 截图、描述、审核提交 |
| **总计** | **35天** | 约1.5人月 |

---

## 6. 成本估算

### 6.1 开发成本

| 方案 | 人力 | 周期 | 说明 |
|------|------|------|------|
| **纯WebView** | 1人 | 0.5天 | 仅配置WebView |
| **混合开发** | 2人 | 1.5月 | RN + WebView |
| **纯原生RN** | 2人 | 2.5月 | 全部React Native |

### 6.2 运营成本

| 项目 | 费用 | 周期 | 说明 |
|------|------|------|------|
| **Apple开发者账号** | $99 | 年 | 必需 |
| **HTTPS证书** | $0 | 年 | 复用现有 |
| **CodePush热更新** | $0 | 月 | 开源免费 |
| **崩溃监控(Sentry)** | $26 | 月 | 可选 |
| **年度总计** | **$411** | | |

---

## 7. 性能优化

### 7.1 启动优化

```typescript
// 使用React Native Bootsplash
import BootSplash from 'react-native-bootsplash'

export default function App() {
  useEffect(() => {
    BootSplash.hide({ fade: true })
  }, [])
  
  return <Navigation />
}
```

### 7.2 图片优化

```typescript
// 使用Fast Image替代Image
import FastImage from 'react-native-fast-image'

<FastImage
  source={{
    uri: 'https://cdn.researchopia.com/avatar.jpg',
    priority: FastImage.priority.high,
    cache: FastImage.cacheControl.immutable
  }}
  style={styles.avatar}
/>
```

### 7.3 列表优化

```typescript
// 使用FlatList虚拟滚动
<FlatList
  data={papers}
  keyExtractor={(item) => item.doi}
  renderItem={({ item }) => <PaperCard paper={item} />}
  initialNumToRender={10}
  maxToRenderPerBatch={5}
  windowSize={10}
  removeClippedSubviews={true}
/>
```

---

## 8. 推荐方案

### 8.1 阶段性策略

```
Phase 1 (Week 1): 
  WebView套壳 → 快速验证需求
  ↓
Phase 2 (Month 2): 
  混合开发 → 核心页面原生化
  ↓
Phase 3 (Month 4): 
  全原生 → 追求极致体验
```

### 8.2 关键指标

- DAU < 100: WebView即可
- DAU 100-1000: 混合开发
- DAU > 1000: 全原生

---

## 9. 风险与应对

| 风险 | 等级 | 应对措施 |
|------|------|----------|
| App Store审核被拒(WebView) | 🟡 中 | 添加原生功能,说明后续优化 |
| 开发成本超支 | 🟢 低 | 选择混合方案 |
| 性能不达标 | 🟢 低 | React Native性能接近原生 |

---

## 10. 总结

### 10.1 方案推荐

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| **快速验证** | WebView套壳 | 半天完成 |
| **平衡成本** | 混合开发(RN+WebView) | 1.5人月,体验优秀 |
| **追求极致** | 纯React Native | 2.5人月,性能最佳 |

### 10.2 行动清单

**立即开始(WebView方案)**:
- [ ] 注册Apple开发者账号(1-3天)
- [ ] 创建React Native项目(1小时)
- [ ] 集成WebView(1小时)
- [ ] 真机测试(2小时)
- [ ] 提交App Store(1-7天审核)

**总耗时**: 1天 + 审核等待

---

**文档结束**

**建议**: 先用WebView快速上线,验证需求后投入混合开发。
