# Researchopia Android APP 开发全流程方案

## 文档信息
- **版本**: v1.0
- **创建时间**: 2025-01-07
- **状态**: 开发方案
- **优先级**: 中
- **目标**: 将 https://www.researchopia.com/ 移植为Android原生应用

---

## 1. 技术选型对比

### 1.1 三种开发方案

| 方案 | 开发成本 | 性能 | 用户体验 | 功能完整度 | 推荐度 |
|------|---------|------|---------|-----------|--------|
| **原生开发(Kotlin/Jetpack Compose)** | ⭐⭐ (3人月) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **React Native** | ⭐⭐⭐⭐ (1.5人月) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **WebView套壳** | ⭐⭐⭐⭐⭐ (3天) | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

### 1.2 最终选择: React Native

**理由**:
1. ✅ **跨平台**: 与iOS共享90%+代码
2. ✅ **复用现有技术栈**: React + TypeScript
3. ✅ **开发效率高**: 热重载,快速迭代
4. ✅ **社区活跃**: 库丰富,问题易解决
5. ✅ **性能优秀**: 接近原生(新架构Hermes引擎)

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
├── android/                # Android原生代码
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   └── java/
│   │   └── build.gradle
│   └── build.gradle
├── ios/                    # iOS原生代码(共享)
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

#### 2.3.1 用户认证(Google Sign In)

```typescript
// src/services/auth.ts
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { supabase } from './supabase'

export class AuthService {
  /**
   * 初始化Google登录
   */
  static async initGoogleSignIn() {
    await GoogleSignin.configure({
      webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
      offlineAccess: true,
      forceCodeForRefreshToken: true
    })
  }
  
  /**
   * Google登录
   */
  static async signInWithGoogle(): Promise<User> {
    try {
      // 1. 检查Google Play服务
      await GoogleSignin.hasPlayServices()
      
      // 2. 发起Google登录
      const userInfo = await GoogleSignin.signIn()
      const { idToken, user } = userInfo
      
      // 3. 调用后端API验证token
      const response = await fetch(
        'https://www.researchopia.com/api/auth/google',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_token: idToken,
            email: user.email,
            name: user.name,
            photo: user.photo
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
      console.error('[Auth] Google Sign In failed:', error)
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
  
  /**
   * 退出登录
   */
  static async signOut() {
    try {
      await GoogleSignin.signOut()
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user'])
    } catch (error) {
      console.error('[Auth] Sign out failed:', error)
    }
  }
}
```

#### 2.3.2 论文搜索(带缓存)

```typescript
// src/screens/SearchScreen.tsx
import React, { useState } from 'react'
import { View, TextInput, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { PaperService } from '@/services/paper'
import PaperCard from '@/components/PaperCard'

export default function SearchScreen({ navigation }) {
  const [keyword, setKeyword] = useState('')
  
  const { data: papers, isLoading, refetch } = useQuery({
    queryKey: ['papers', keyword],
    queryFn: () => PaperService.search(keyword),
    enabled: keyword.length > 0,
    staleTime: 5 * 60 * 1000  // 5分钟缓存
  })
  
  return (
    <View style={styles.container}>
      {/* Material Design搜索框 */}
      <TextInput
        style={styles.searchInput}
        placeholder="搜索DOI或论文标题"
        value={keyword}
        onChangeText={setKeyword}
        onSubmitEditing={() => refetch()}
        returnKeyType="search"
        autoCapitalize="none"
      />
      
      {/* 结果列表 */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#3cc51f" />
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
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  searchInput: {
    margin: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,  // Android阴影
    fontSize: 16
  },
  list: {
    padding: 16
  }
})
```

#### 2.3.3 PDF阅读器

```typescript
// src/screens/PDFReaderScreen.tsx
import React from 'react'
import Pdf from 'react-native-pdf'
import { View, StyleSheet, Platform } from 'react-native'

export default function PDFReaderScreen({ route }) {
  const { pdfUrl } = route.params
  
  return (
    <View style={styles.container}>
      <Pdf
        source={{
          uri: pdfUrl,
          cache: true,
          cacheFileName: 'researchopia_paper.pdf'
        }}
        onLoadComplete={(numberOfPages) => {
          console.log(`Loaded ${numberOfPages} pages`)
        }}
        onError={(error) => {
          console.error('PDF load error:', error)
        }}
        enablePaging={true}  // Android平滑滚动
        style={styles.pdf}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333'
  },
  pdf: {
    flex: 1,
    width: '100%',
    height: '100%'
  }
})
```

### 2.4 开发流程

#### 2.4.1 环境搭建(Windows/macOS/Linux)

```bash
# 1. 安装Node.js (推荐v18+)
# https://nodejs.org/

# 2. 安装JDK 11 (必需)
# Windows: https://adoptium.net/
# macOS: brew install openjdk@11
# Linux: sudo apt install openjdk-11-jdk

# 3. 安装Android Studio
# https://developer.android.com/studio
# 安装时勾选 Android SDK, Android SDK Platform, Android Virtual Device

# 4. 配置环境变量(Windows)
# ANDROID_HOME = C:\Users\YourName\AppData\Local\Android\Sdk
# Path += %ANDROID_HOME%\platform-tools
# Path += %ANDROID_HOME%\emulator
# Path += %ANDROID_HOME%\tools

# macOS/Linux添加到~/.bash_profile或~/.zshrc:
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# 5. 创建React Native项目
npx react-native@latest init ResearchopiaApp --template react-native-template-typescript

# 6. 安装依赖
cd ResearchopiaApp
npm install

# 7. 启动Metro bundler
npm start

# 8. 运行Android模拟器
npm run android
```

#### 2.4.2 真机调试

```bash
# 1. 手机开启开发者选项
# 设置 → 关于手机 → 连续点击版本号7次

# 2. 开启USB调试
# 开发者选项 → USB调试 → 开启

# 3. 连接手机到电脑,授权调试

# 4. 检查设备连接
adb devices

# 5. 运行APP
npm run android
```

#### 2.4.3 开发工作流

```bash
# 启动Metro
npm start

# 运行Android(默认模拟器)
npm run android

# 热重载
# 摇晃手机或按 Ctrl+M → Enable Fast Refresh

# 查看日志
adb logcat *:S ReactNative:V ReactNativeJS:V

# 清理缓存
npm start -- --reset-cache
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
    "@react-navigation/material-bottom-tabs": "^6.2.19",
    "@tanstack/react-query": "^5.17.0",
    "@reduxjs/toolkit": "^2.0.1",
    "react-redux": "^9.0.4",
    "@supabase/supabase-js": "^2.39.0",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "@react-native-google-signin/google-signin": "^10.1.1",
    "react-native-pdf": "^6.7.3",
    "react-native-fast-image": "^8.6.3",
    "react-native-vector-icons": "^10.0.3",
    "react-native-gesture-handler": "^2.14.1",
    "react-native-reanimated": "^3.6.1",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.45",
    "@types/react-native": "^0.73.0",
    "typescript": "^5.3.3",
    "eslint": "^8.56.0",
    "@react-native/metro-config": "^0.73.0"
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
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.container}>
        <WebView
          source={{ uri: 'https://www.researchopia.com/' }}
          startInLoadingState={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          cacheEnabled={true}
          onMessage={(event) => {
            // 接收Web端消息
            console.log('Message from web:', event.nativeEvent.data)
          }}
          // Android专属优化
          androidLayerType="hardware"  // 硬件加速
          androidHardwareAccelerationDisabled={false}
        />
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  }
})
```

### 3.2 快速开发流程

```bash
# 1. 创建项目(5分钟)
npx react-native init ResearchopiaApp --template react-native-template-typescript

# 2. 安装WebView(2分钟)
npm install react-native-webview

# 3. 修改App.tsx(3分钟)
# 粘贴上面的代码

# 4. 运行测试(5分钟)
npm run android

# 总耗时: 15分钟
```

### 3.3 Android特定配置

#### 3.3.1 网络权限

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  
  <!-- 添加网络权限 -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  
  <application
    android:usesCleartextTraffic="true"  <!-- 允许HTTP(开发用) -->
    ...>
    ...
  </application>
</manifest>
```

#### 3.3.2 文件下载支持

```typescript
// App.tsx
import { WebView } from 'react-native-webview'
import RNFetchBlob from 'react-native-blob-util'

export default function App() {
  const handleFileDownload = ({ nativeEvent }) => {
    const { downloadUrl } = nativeEvent
    
    RNFetchBlob.config({
      fileCache: true,
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        path: `${RNFetchBlob.fs.dirs.DownloadDir}/paper.pdf`,
        description: 'Downloading paper...'
      }
    })
    .fetch('GET', downloadUrl)
    .then((res) => {
      console.log('Download success:', res.path())
    })
  }
  
  return (
    <WebView
      source={{ uri: 'https://www.researchopia.com/' }}
      onFileDownload={handleFileDownload}
    />
  )
}
```

### 3.4 优劣分析

**优势**:
- ⚡ 开发速度极快(半天完成)
- ✅ 网站更新,APP自动同步
- ✅ 零维护成本
- ✅ 功能100%复用

**劣势**:
- ❌ 加载慢(首屏3-5秒)
- ❌ 不支持离线缓存
- ❌ 无法调用原生API(推送、生物识别等)
- ❌ Google Play审核可能被拒

---

## 4. Google Play 上架流程

### 4.1 准备工作

#### 4.1.1 注册Google Play开发者账号

1. 访问 https://play.google.com/console/
2. 注册费用: **$25**(一次性,终身有效)
3. 审核周期: 即时生效

#### 4.1.2 生成签名密钥

```bash
# 生成keystore文件
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore researchopia.keystore \
  -alias researchopia \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 输入密码和信息
# 将researchopia.keystore保存到安全位置
```

#### 4.1.3 配置Gradle签名

```gradle
// android/app/build.gradle
android {
  ...
  signingConfigs {
    release {
      storeFile file('researchopia.keystore')
      storePassword 'YOUR_KEYSTORE_PASSWORD'
      keyAlias 'researchopia'
      keyPassword 'YOUR_KEY_PASSWORD'
    }
  }
  
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled true
      proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
  }
}
```

#### 4.1.4 准备资源

**图标**:
- 512x512 (高分辨率图标)
- 多尺寸自动生成

**截图**(至少2张,最多8张):
- 手机: 1080 x 1920 或 1440 x 2560
- 平板(可选): 1200 x 1920

**功能图片**(可选):
- 1024 x 500 (展示APP核心功能)

**宣传视频**(可选):
- YouTube链接

### 4.2 构建与上传

#### 4.2.1 生成Release APK/AAB

```bash
# 1. 清理缓存
cd android && ./gradlew clean && cd ..

# 2. 生成AAB (推荐,Google Play要求)
cd android && ./gradlew bundleRelease

# 输出位置:
# android/app/build/outputs/bundle/release/app-release.aab

# 3. 生成APK (可选,用于直接安装测试)
cd android && ./gradlew assembleRelease

# 输出位置:
# android/app/build/outputs/apk/release/app-release.apk
```

#### 4.2.2 测试Release版本

```bash
# 安装APK到真机
adb install android/app/build/outputs/apk/release/app-release.apk

# 检查功能
# - 登录是否正常
# - API请求是否成功
# - 性能是否流畅
```

### 4.3 Google Play Console配置

#### 4.3.1 创建新应用

登录 https://play.google.com/console/

1. **创建应用**
2. 填写信息:
   - 应用名称: 研学港 (Researchopia)
   - 默认语言: 简体中文
   - 应用类型: 应用
   - 免费/付费: 免费

#### 4.3.2 填写商店信息

**应用详情**:
- 简短描述(80字):
  ```
  学术论文交流与共享平台,支持论文搜索、标注、共读会话等功能。
  ```

- 完整描述(4000字):
  ```
  研学港是一个开放的学术交流和共享平台,旨在为科研工作者提供高效的论文管理和协作工具。
  
  核心功能:
  ✅ 论文搜索与管理
  通过DOI或标题快速检索学术论文,查看详细信息和引用数据。
  
  ✅ 智能标注与评论
  在线阅读PDF,支持文字高亮、批注和笔记,与全球学者交流见解。
  
  ✅ 文献共读会话
  创建或加入共读小组,实时同步阅读进度和标注,提升协作效率。
  
  ✅ 学术社交网络
  关注同领域学者,查看最新研究动态,建立学术人脉。
  
  适用人群:
  • 科研工作者
  • 研究生、博士生
  • 高校教师
  • 学术期刊编辑
  
  联系我们:
  官网: https://www.researchopia.com
  邮箱: support@researchopia.com
  ```

**应用分类**:
- 类别: 教育
- 标签: 学术、论文、科研、阅读

**隐私政策URL**:
- https://www.researchopia.com/privacy-android

#### 4.3.3 上传APK/AAB

1. **生产 → 创建新版本**
2. 上传 `app-release.aab`
3. 填写版本号: 1.0.0 (versionCode: 1)
4. 填写更新说明:
   ```
   首次发布:
   - 论文搜索与浏览
   - 共读会话功能
   - 智能标注系统
   - 个人中心
   ```

#### 4.3.4 内容分级

1. 填写问卷:
   - 应用是否包含暴力内容? **否**
   - 应用是否包含性暗示内容? **否**
   - 应用是否包含仇恨言论? **否**
   - 应用是否包含赌博内容? **否**
   - 应用是否包含用户生成内容? **是**
2. 系统自动评级: **所有人** (Everyone)

#### 4.3.5 目标受众

- 目标年龄组: **13岁及以上**
- 是否吸引儿童: **否**

#### 4.3.6 数据安全

填写应用收集的数据:
- **位置**: 否
- **个人信息**: 是(姓名、邮箱)
- **财务信息**: 否
- **健康信息**: 否
- **照片和视频**: 否
- **文件和文档**: 是(论文PDF)
- **应用活动**: 是(搜索历史、阅读记录)

数据使用目的:
- 应用功能
- 个性化推荐
- 账号管理

数据传输:
- 是否加密传输: **是**(HTTPS)
- 用户是否可删除数据: **是**

### 4.4 提交审核

1. 检查清单(全部完成):
   - ✅ 应用详情
   - ✅ 商店信息
   - ✅ 内容分级
   - ✅ 目标受众
   - ✅ 数据安全
   - ✅ APK/AAB上传
2. 点击"提交审核"

**审核周期**: 通常 **1-3天**

### 4.5 审核要点

#### 易被拒绝的情况

- ❌ APP仅是网站的壳子(WebView方案风险)
- ❌ 崩溃或ANR(应用无响应)
- ❌ 缺少隐私政策
- ❌ 权限使用不合理
- ❌ 内容违规(侵权、暴力等)

#### 提高通过率的技巧

- ✅ 提供详细的应用描述和截图
- ✅ 确保APP稳定性(无崩溃)
- ✅ 适配多种屏幕尺寸
- ✅ 遵守Material Design规范
- ✅ 及时响应审核反馈

---

## 5. 混合方案(推荐)

### 5.1 方案描述

**核心页面用React Native,复杂页面用WebView**

```
┌─────────────────────────────────────┐
│  Android APP                        │
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
| Material Design适配 | 3天 | 遵循Android设计规范 |
| 测试优化 | 7天 | 多设备测试、性能优化 |
| Google Play准备 | 2天 | 截图、描述、审核提交 |
| **总计** | **35天** | 约1.5人月 |

### 5.3 Material Design适配

```typescript
// 使用react-native-paper组件库
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper'

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#3cc51f',
    accent: '#f59e0b'
  }
}

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <Navigation />
    </PaperProvider>
  )
}
```

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
| **Google Play开发者** | $25 | 终身 | 一次性费用 |
| **签名密钥** | $0 | - | 自行生成 |
| **Firebase推送** | $0 | 月 | 免费额度足够 |
| **崩溃监控(Sentry)** | $26 | 月 | 可选 |
| **首年总计** | **$337** | | |

---

## 7. Android特定优化

### 7.1 启动优化

```xml
<!-- android/app/src/main/res/values/styles.xml -->
<resources>
  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:windowBackground">@drawable/splash_screen</item>
  </style>
</resources>
```

```typescript
// 隐藏启动屏
import SplashScreen from 'react-native-splash-screen'

export default function App() {
  useEffect(() => {
    SplashScreen.hide()
  }, [])
  
  return <Navigation />
}
```

### 7.2 内存优化

```gradle
// android/app/build.gradle
android {
  defaultConfig {
    ...
    ndk {
      abiFilters "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
    }
  }
  
  buildTypes {
    release {
      shrinkResources true  // 移除未使用资源
      minifyEnabled true    // 代码混淆
    }
  }
}
```

### 7.3 多设备适配

```typescript
// 使用Dimensions适配不同屏幕
import { Dimensions, PixelRatio } from 'react-native'

const { width, height } = Dimensions.get('window')
const scale = width / 375  // 以iPhone 6为基准

export const normalize = (size: number) => {
  const newSize = size * scale
  return Math.round(PixelRatio.roundToNearestPixel(newSize))
}

// 使用
const styles = StyleSheet.create({
  title: {
    fontSize: normalize(18)  // 自动适配
  }
})
```

---

## 8. 跨平台复用(iOS + Android)

### 8.1 代码复用率

**React Native项目**:
- 共享代码: **90%+**
- iOS专属: 5% (Apple Sign In等)
- Android专属: 5% (Google Sign In等)

### 8.2 平台特定代码

```typescript
// 使用Platform模块
import { Platform } from 'react-native'

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.select({
      ios: 20,      // iOS状态栏
      android: 0    // Android自动处理
    })
  }
})

// 加载平台专属组件
const Button = Platform.select({
  ios: () => require('./ButtonIOS').default,
  android: () => require('./ButtonAndroid').default
})()
```

---

## 9. 推荐方案

### 9.1 阶段性策略

```
Phase 1 (Week 1): 
  WebView套壳 → 快速上线验证
  ↓
Phase 2 (Month 2): 
  混合开发 → 核心页面原生化
  ↓
Phase 3 (Month 4): 
  iOS+Android全原生 → 双端同步开发
```

### 9.2 关键指标

- DAU < 100: WebView即可
- DAU 100-1000: 混合开发
- DAU > 1000: 双端全原生

---

## 10. 风险与应对

| 风险 | 等级 | 应对措施 |
|------|------|----------|
| Google Play审核被拒(WebView) | 🟡 中 | 添加原生功能,说明后续优化 |
| Android碎片化(多设备适配) | 🟡 中 | 使用响应式布局,覆盖主流设备 |
| 性能问题(低端机) | 🟢 低 | React Native性能优秀 |

---

## 11. 总结

### 11.1 方案推荐

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| **快速验证** | WebView套壳 | 半天完成 |
| **平衡成本** | 混合开发(RN+WebView) | 1.5人月,体验优秀 |
| **追求极致** | 纯React Native | 2.5人月,性能最佳 |
| **跨平台** | React Native | iOS+Android共享90%代码 |

### 11.2 行动清单

**立即开始(WebView方案)**:
- [ ] 注册Google Play开发者账号(即时)
- [ ] 创建React Native项目(1小时)
- [ ] 集成WebView(1小时)
- [ ] 生成签名密钥(15分钟)
- [ ] 真机测试(2小时)
- [ ] 提交Google Play(1-3天审核)

**总耗时**: 1天 + 审核等待

---

## 12. iOS vs Android 对比

| 维度 | iOS | Android | 备注 |
|------|-----|---------|------|
| **开发者费用** | $99/年 | $25(终身) | Android更便宜 |
| **审核周期** | 1-7天 | 1-3天 | Android更快 |
| **审核严格度** | 严格 | 宽松 | iOS更难通过 |
| **市场份额(全球)** | 27% | 72% | Android用户更多 |
| **市场份额(中国)** | 19% | 81% | Android主导 |
| **用户付费意愿** | 高 | 中 | iOS用户更愿付费 |
| **开发难度** | 中 | 中 | React Native抹平差异 |

**建议**: 同时开发iOS + Android,使用React Native一次性解决

---

**文档结束**

**建议**: 先用WebView快速上线Android,验证需求后投入React Native开发iOS+Android双端。
