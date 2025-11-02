# 详细开发指南

本文档提供 Researchopia 项目三大组件的深入开发指南,包括架构详解、核心代码解析、最佳实践和常见问题。

---

## 目录

### 第一部分：Next.js 网站开发
1. [Next.js 15 App Router 最佳实践](#nextjs-app-router)
2. [API 路由设计](#api-routes)
3. [React 组件开发](#react-components)
4. [状态管理](#state-management)
5. [Supabase 客户端使用](#supabase-client)

### 第二部分：Zotero 插件开发
6. [插件架构详解](#plugin-architecture)
7. [核心模块说明](#core-modules)
8. [UI 视图开发](#ui-views)
9. [事件系统](#event-system)
10. [与 Zotero API 交互](#zotero-api)
11. [热重载开发](#hot-reload)

### 第三部分：浏览器扩展开发
12. [Manifest V3 结构](#manifest-v3)
13. [Content Script 开发](#content-script)
14. [Background Service Worker](#background-worker)
15. [消息传递机制](#message-passing)
16. [Storage API 使用](#storage-api)

---

# 第一部分：Next.js 网站开发

<a name="nextjs-app-router"></a>
## 1. Next.js 15 App Router 最佳实践

### 1.1 Server Components vs Client Components

**使用 Server Components** (默认):
```tsx
// src/app/papers/[doi]/page.tsx
// 不需要 'use client' 指令

import { getPaperByDoi } from '@/lib/papers';

export default async function PaperPage({ params }: { params: { doi: string } }) {
  const paper = await getPaperByDoi(params.doi);
  
  return (
    <div>
      <h1>{paper.title}</h1>
      <p>{paper.abstract}</p>
    </div>
  );
}
```

**使用 Client Components** (需要交互):
```tsx
// src/components/SearchBar.tsx
'use client'; // 必须声明

import { useState } from 'react';

export function SearchBar() {
  const [query, setQuery] = useState('');
  
  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="搜索论文..."
    />
  );
}
```

### 1.2 数据获取策略

**服务端获取**(SSR):
```tsx
// 默认行为,每次请求都获取最新数据
export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <div>{JSON.stringify(data)}</div>;
}
```

**静态生成**(SSG):
```tsx
// 构建时生成,适用于静态内容
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}
```

**增量静态再生成**(ISR):
```tsx
// 定期重新生成静态页面
export const revalidate = 3600; // 每小时重新验证

export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <div>{JSON.stringify(data)}</div>;
}
```

### 1.3 路由和布局

**嵌套布局**:
```tsx
// src/app/layout.tsx (根布局)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}

// src/app/papers/layout.tsx (论文子布局)
export default function PapersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="papers-container">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

**并行路由**:
```tsx
// src/app/@modal/(.)paper/[doi]/page.tsx
// 拦截路由,显示为模态框
export default function PaperModal({ params }: { params: { doi: string } }) {
  return (
    <div className="modal">
      <h2>Paper: {params.doi}</h2>
    </div>
  );
}
```

<a name="api-routes"></a>
## 2. API 路由设计

### 2.1 RESTful API 结构

```typescript
// src/app/api/papers/[doi]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/papers/[doi]
export async function GET(
  request: NextRequest,
  { params }: { params: { doi: string } }
) {
  try {
    // 1. 验证请求
    const token = request.headers.get('authorization');
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 业务逻辑
    const supabase = createClient();
    const { data, error } = await supabase
      .from('papers')
      .select('*')
      .eq('doi', params.doi)
      .single();

    if (error) throw error;

    // 3. 返回响应
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/papers/[doi]
export async function POST(
  request: NextRequest,
  { params }: { params: { doi: string } }
) {
  const body = await request.json();
  // 处理 POST 请求
}
```

### 2.2 错误处理

**统一错误响应格式**:
```typescript
// src/lib/api-error.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string
  ) {
    super(message);
  }
}

export function handleAPIError(error: unknown) {
  if (error instanceof APIError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

### 2.3 中间件

**认证中间件**:
```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 检查认证 Token
  const token = request.cookies.get('session-token');
  
  if (!token && request.nextUrl.pathname.startsWith('/api/protected')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

<a name="react-components"></a>
## 3. React 组件开发

### 3.1 组件命名和文件结构

```
src/components/
├── papers/
│   ├── PaperCard.tsx          # 论文卡片
│   ├── PaperList.tsx          # 论文列表
│   └── PaperDetails.tsx       # 论文详情
├── ui/
│   ├── Button.tsx             # 基础按钮
│   ├── Input.tsx              # 基础输入框
│   └── Modal.tsx              # 基础模态框
└── layout/
    ├── Header.tsx             # 页头
    ├── Footer.tsx             # 页脚
    └── Sidebar.tsx            # 侧边栏
```

### 3.2 组件模板

**基础组件**:
```tsx
// src/components/papers/PaperCard.tsx
'use client';

import React from 'react';

export interface PaperCardProps {
  title: string;
  authors: string[];
  doi: string;
  abstract?: string;
  onView?: (doi: string) => void;
}

export function PaperCard({ 
  title, 
  authors, 
  doi, 
  abstract, 
  onView 
}: PaperCardProps) {
  return (
    <div className="paper-card">
      <h3>{title}</h3>
      <p className="authors">{authors.join(', ')}</p>
      <span className="doi">DOI: {doi}</span>
      {abstract && <p className="abstract">{abstract}</p>}
      <button onClick={() => onView?.(doi)}>查看详情</button>
    </div>
  );
}
```

### 3.3 自定义 Hooks

**useAuthenticatedFetch**:
```typescript
// src/hooks/useAuthenticatedFetch.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useAuthenticatedFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('API request failed');
        }
        
        const json = await response.json();
        setData(json.data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url, token]);

  return { data, loading, error };
}
```

<a name="state-management"></a>
## 4. 状态管理

### 4.1 使用 React Context

**AuthContext**:
```typescript
// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    const { user, token } = await response.json();
    setUser(user);
    setToken(token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 4.2 使用 Zustand (轻量级状态管理)

```typescript
// src/stores/searchStore.ts
import { create } from 'zustand';

interface SearchState {
  query: string;
  results: Paper[];
  loading: boolean;
  setQuery: (query: string) => void;
  search: () => Promise<void>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  loading: false,
  
  setQuery: (query) => set({ query }),
  
  search: async () => {
    set({ loading: true });
    const response = await fetch(`/api/search?q=${get().query}`);
    const { data } = await response.json();
    set({ results: data, loading: false });
  },
}));
```

<a name="supabase-client"></a>
## 5. Supabase 客户端使用

### 5.1 服务端客户端

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}
```

### 5.2 客户端客户端

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 5.3 实时订阅

```typescript
// src/hooks/useRealtimeAnnotations.ts
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeAnnotations(paperId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // 初始加载
    const fetchAnnotations = async () => {
      const { data } = await supabase
        .from('annotations')
        .select('*')
        .eq('paper_id', paperId);
      
      setAnnotations(data || []);
    };

    fetchAnnotations();

    // 实时订阅
    const channel = supabase
      .channel(`annotations:${paperId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'annotations',
          filter: `paper_id=eq.${paperId}`,
        },
        (payload) => {
          setAnnotations((prev) => [...prev, payload.new as Annotation]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [paperId, supabase]);

  return annotations;
}
```

---

# 第二部分：Zotero 插件开发

<a name="plugin-architecture"></a>
## 6. 插件架构详解

### 6.1 MVC + Service Layer 架构

```
┌─────────────────────────────────────────┐
│             Zotero API                  │
│         (文献、PDF、标注)                │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│        Plugin Entry (addon.ts)          │
│     - 生命周期管理 (startup/shutdown)    │
└────────┬────────────────────────────────┘
         │
         ├──────────────┬──────────────┬──────────────┐
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
│ AuthManager │ │ SessionMgr  │ │ PDFReaderMgr │ │ SupabaseMgr  │
│ (认证管理)   │ │ (会话管理)   │ │ (PDF监听)    │ │ (数据封装)   │
└──────┬──────┘ └──────┬──────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │
       └────────────────┴────────────────┴────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │   UIManager     │
               │  (视图管理)      │
               └────────┬────────┘
                        │
       ┌────────────────┼────────────────┐
       │                │                │
       ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ SessionView  │ │ AnnotView    │ │ SessionList  │
│ (会话主视图)  │ │ (标注视图)   │ │ (会话列表)   │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 6.2 插件生命周期

```typescript
// src/addon.ts
class Addon {
  public async startup() {
    // 1. 初始化配置
    await this.initConfig();
    
    // 2. 注册 UI
    await addon.managers.uiManager.registerViews();
    
    // 3. 启动服务
    await addon.managers.authManager.restoreSession();
    await addon.managers.pdfReaderManager.startListening();
    
    // 4. 注册菜单和快捷键
    this.registerMenuItems();
    this.registerShortcuts();
    
    logger.log('Plugin started successfully');
  }

  public async shutdown() {
    // 1. 清理监听器
    addon.managers.pdfReaderManager.stopListening();
    addon.managers.sessionManager.cleanup();
    
    // 2. 保存状态
    await addon.managers.authManager.saveSession();
    
    // 3. 卸载 UI
    addon.managers.uiManager.unregisterViews();
    
    logger.log('Plugin shut down');
  }
}
```

<a name="core-modules"></a>
## 7. 核心模块说明

### 7.1 AuthManager (认证管理器)

**职责**:
- 用户登录/注册
- Token 存储和刷新
- 会话状态维护

**核心代码**:
```typescript
// src/modules/auth.ts
export class AuthManager {
  private user: User | null = null;
  private token: string | null = null;

  public async login(email: string, password: string): Promise<void> {
    const response = await apiClient.post('/api/proxy/auth/login', {
      email,
      password,
    });

    this.user = response.data.user;
    this.token = response.data.token;

    // 保存到 Zotero 偏好设置
    Zotero.Prefs.set('researchopia.user', JSON.stringify(this.user));
    Zotero.Prefs.set('researchopia.token', this.token);

    logger.log('User logged in:', this.user?.email);
  }

  public async refreshToken(): Promise<void> {
    const response = await apiClient.post('/api/proxy/auth/refresh', {
      token: this.token,
    });

    this.token = response.data.token;
    Zotero.Prefs.set('researchopia.token', this.token);
  }

  public logout(): void {
    this.user = null;
    this.token = null;
    Zotero.Prefs.clear('researchopia.user');
    Zotero.Prefs.clear('researchopia.token');
  }

  public getToken(): string | null {
    return this.token;
  }
}
```

### 7.2 ReadingSessionManager (会话管理器)

**职责**:
- 创建/加入共读会话
- 实时同步标注和聊天
- 成员状态管理

**核心代码**:
```typescript
// src/modules/readingSessionManager.ts
export class ReadingSessionManager {
  private currentSession: ReadingSession | null = null;
  private pollingInterval: number | null = null;
  private callbacks: Map<string, Function[]> = new Map();

  public async createSession(
    paperDoi: string,
    sessionType: 'public' | 'private'
  ): Promise<ReadingSession> {
    const response = await apiClient.post('/api/proxy/reading-session/create', {
      paper_doi: paperDoi,
      session_type: sessionType,
    });

    this.currentSession = response.data.session;
    this.startPolling();

    return this.currentSession;
  }

  public async joinSession(sessionId: string): Promise<void> {
    const response = await apiClient.post('/api/proxy/reading-session/join', {
      session_id: sessionId,
    });

    this.currentSession = response.data.session;
    this.startPolling();
  }

  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      await this.syncAnnotations();
      await this.syncMembers();
      await this.syncChat();
    }, 5000) as unknown as number;
  }

  private async syncAnnotations(): Promise<void> {
    const annotations = await apiClient.get(
      `/api/proxy/annotations/list?session_id=${this.currentSession!.id}`
    );

    // 触发 onAnnotation 回调
    this.trigger('annotation', annotations.data);
  }

  public onAnnotation(callback: (annotations: Annotation[]) => void): void {
    this.register('annotation', callback);
  }

  private register(event: string, callback: Function): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
  }

  private trigger(event: string, data: any): void {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.forEach((cb) => cb(data));
  }

  public cleanup(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.callbacks.clear();
  }
}
```

### 7.3 PDFReaderManager (PDF阅读器管理器)

**职责**:
- 监听 Zotero PDF 标注事件
- 提取标注数据
- 触发同步流程

**核心代码**:
```typescript
// src/modules/pdfReaderManager.ts
export class PDFReaderManager {
  private listeners: Set<Function> = new Set();

  public startListening(): void {
    // 监听 Zotero 的标注事件
    Zotero.Notifier.registerObserver(this, ['annotation']);
    logger.log('PDF reader manager started listening');
  }

  public async notify(event: string, type: string, ids: string[]): Promise<void> {
    if (type !== 'annotation') return;

    for (const id of ids) {
      const annotation = await Zotero.Annotations.get(id);
      
      if (event === 'add') {
        await this.handleAnnotationAdded(annotation);
      } else if (event === 'modify') {
        await this.handleAnnotationModified(annotation);
      } else if (event === 'delete') {
        await this.handleAnnotationDeleted(annotation);
      }
    }
  }

  private async handleAnnotationAdded(annotation: any): Promise<void> {
    logger.log('Annotation added:', annotation.id);

    // 提取标注数据
    const annotationData = {
      zotero_key: annotation.key,
      text: annotation.annotationText,
      comment: annotation.annotationComment,
      page_number: annotation.annotationPageLabel,
      type: annotation.annotationType,
      color: annotation.annotationColor,
    };

    // 同步到服务器
    await apiClient.post('/api/proxy/annotations/create', {
      annotation_data: annotationData,
      paper_doi: this.getCurrentPaperDoi(),
    });

    // 触发回调
    this.listeners.forEach((listener) => listener(annotationData));
  }

  public onChange(callback: Function): void {
    this.listeners.add(callback);
  }

  public stopListening(): void {
    Zotero.Notifier.unregisterObserver(this);
    this.listeners.clear();
  }
}
```

<a name="ui-views"></a>
## 8. UI 视图开发

### 8.1 注册视图

```typescript
// src/modules/ui-manager.ts
export class UIManager {
  public async registerViews(): Promise<void> {
    // 注册 Item Pane 视图
    ztoolkit.ItemPane.register(
      'reading-session',
      'Reading Session',
      (item: Zotero.Item) => new ReadingSessionView(item)
    );

    ztoolkit.ItemPane.register(
      'community-annotations',
      'Community Annotations',
      (item: Zotero.Item) => new SharedAnnotationsView(item)
    );

    logger.log('UI views registered');
  }

  public unregisterViews(): void {
    ztoolkit.ItemPane.unregister('reading-session');
    ztoolkit.ItemPane.unregister('community-annotations');
  }
}
```

### 8.2 视图实现

```typescript
// src/modules/ui/readingSessionView.ts
export class ReadingSessionView {
  private container: HTMLElement;
  private item: Zotero.Item;

  constructor(item: Zotero.Item) {
    this.item = item;
    this.container = document.createElement('div');
    this.render();
    this.registerEventListeners();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="session-view">
        <h3>共读会话</h3>
        <button id="create-session">创建会话</button>
        <button id="join-session">加入会话</button>
        <div id="session-info"></div>
        <div id="annotation-list"></div>
      </div>
    `;
  }

  private registerEventListeners(): void {
    this.container.querySelector('#create-session')
      ?.addEventListener('click', () => this.handleCreateSession());

    this.container.querySelector('#join-session')
      ?.addEventListener('click', () => this.handleJoinSession());

    // 监听标注变化
    addon.managers.sessionManager.onAnnotation((annotations) => {
      this.renderAnnotationsList(annotations);
    });
  }

  private async handleCreateSession(): Promise<void> {
    const doi = this.item.getField('DOI');
    const session = await addon.managers.sessionManager.createSession(doi, 'public');
    this.renderSessionInfo(session);
  }

  private renderAnnotationsList(annotations: Annotation[]): void {
    const listElement = this.container.querySelector('#annotation-list');
    if (!listElement) return;

    listElement.innerHTML = annotations.map((annotation) => `
      <div class="annotation-item">
        <p>${annotation.annotation_text}</p>
        <small>Page: ${annotation.page_number}</small>
      </div>
    `).join('');
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public destroy(): void {
    // 清理监听器
  }
}
```

<a name="event-system"></a>
## 9. 事件系统

### 9.1 事件监听

```typescript
// 注册监听器
addon.managers.sessionManager.onAnnotation((annotations) => {
  console.log('New annotations:', annotations);
});

addon.managers.sessionManager.onPresence((members) => {
  console.log('Members changed:', members);
});

addon.managers.sessionManager.onMembersChange((members) => {
  console.log('Members list updated:', members);
});
```

### 9.2 事件触发

```typescript
// 在 ReadingSessionManager 中触发事件
private trigger(event: string, data: any): void {
  const callbacks = this.callbacks.get(event) || [];
  callbacks.forEach((cb) => cb(data));
}

// 触发示例
this.trigger('annotation', annotations);
this.trigger('presence', { userId: 'xxx', status: 'online' });
```

<a name="zotero-api"></a>
## 10. 与 Zotero API 交互

### 10.1 读取文献信息

```typescript
// 获取当前选中的文献
const items = Zotero.getActiveZoteroPane().getSelectedItems();
const item = items[0];

// 读取字段
const title = item.getField('title');
const doi = item.getField('DOI');
const year = item.getField('year');
const authors = item.getCreators().map((c) => c.firstName + ' ' + c.lastName);

logger.log(`Paper: ${title}, DOI: ${doi}`);
```

### 10.2 读取 PDF 标注

```typescript
// 获取文献的所有标注
const annotations = await Zotero.Annotations.getByParent(item.id);

for (const annotation of annotations) {
  logger.log({
    text: annotation.annotationText,
    comment: annotation.annotationComment,
    page: annotation.annotationPageLabel,
    type: annotation.annotationType,
    color: annotation.annotationColor,
  });
}
```

### 10.3 创建标注

```typescript
// 在 PDF 中创建高亮标注
const annotation = new Zotero.Item('annotation');
annotation.parentID = item.id;
annotation.annotationType = 'highlight';
annotation.annotationText = 'Highlighted text';
annotation.annotationComment = 'My comment';
annotation.annotationPageLabel = '1';
annotation.annotationSortIndex = '00001|001234|00567';
await annotation.saveTx();

logger.log('Annotation created:', annotation.id);
```

<a name="hot-reload"></a>
## 11. 热重载开发

### 11.1 配置热重载

**环境变量** (`.env`):
```bash
ZOTERO_PLUGIN_ZOTERO_BIN_PATH=C:\Program Files\Zotero\zotero.exe
```

**启动热重载**:
```bash
npm start
```

### 11.2 工作原理

1. **监听文件变更**: Webpack 监听 `src/` 和 `addon/` 目录
2. **自动编译**: 检测到更改立即重新编译插件
3. **重启 Zotero**: 杀死当前 Zotero 进程,启动新进程
4. **重载插件**: 新进程自动加载最新版本插件

### 11.3 调试输出

```typescript
// 使用内置 logger
import { logger } from '../utils/logger';

logger.log('Debug message');
logger.error('Error message:', error);
logger.warn('Warning message');
```

**查看日志**:
- Zotero → 帮助 → Debug Output Logging → View Output

---

# 第三部分：浏览器扩展开发

<a name="manifest-v3"></a>
## 12. Manifest V3 结构

### 12.1 完整 manifest.json

```json
{
  "manifest_version": 3,
  "name": "Researchopia",
  "version": "0.1.1",
  "description": "学术研究助手,智能 DOI 检测",
  
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  
  "host_permissions": [
    "*://*/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

<a name="content-script"></a>
## 13. Content Script 开发

### 13.1 DOI 检测算法

```javascript
// extension/content.js

function detectDOI() {
  // 1. 检测 meta 标签
  let doi = document.querySelector('meta[name="citation_doi"]')?.content;
  
  // 2. 检测 JSON-LD
  if (!doi) {
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent);
        doi = data.doi || data['@id'];
      } catch (e) {
        console.error('Failed to parse JSON-LD:', e);
      }
    }
  }
  
  // 3. 检测页面文本
  if (!doi) {
    const bodyText = document.body.innerText;
    const match = bodyText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    doi = match?.[0];
  }
  
  // 4. 检测 URL
  if (!doi) {
    const urlMatch = window.location.href.match(/\/doi\/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
    doi = urlMatch?.[1];
  }
  
  return doi;
}

// 页面加载完成后检测
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForDOI);
} else {
  checkForDOI();
}

function checkForDOI() {
  const doi = detectDOI();
  
  if (doi) {
    console.log('[Content Script] Detected DOI:', doi);
    
    // 发送消息到 Background
    chrome.runtime.sendMessage({
      type: 'DOI_DETECTED',
      doi: doi,
    });
    
    // 显示悬浮图标
    showFloatingIcon(doi);
  }
}
```

### 13.2 悬浮图标渲染

```javascript
// extension/content.js

function showFloatingIcon(doi) {
  // 检查是否已存在
  if (document.getElementById('researchopia-float-icon')) {
    return;
  }
  
  // 创建悬浮图标
  const icon = document.createElement('div');
  icon.id = 'researchopia-float-icon';
  icon.className = 'researchopia-float';
  icon.innerHTML = `
    <div class="icon-indicator active"></div>
    <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="Researchopia" />
  `;
  
  // 添加拖拽逻辑
  let isDragging = false;
  let offsetX, offsetY;
  
  icon.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - icon.offsetLeft;
    offsetY = e.clientY - icon.offsetTop;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    icon.style.left = `${e.clientX - offsetX}px`;
    icon.style.top = `${e.clientY - offsetY}px`;
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      
      // 自动吸附到边缘
      const iconRect = icon.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      if (iconRect.left < viewportWidth / 2) {
        icon.style.left = '20px';
      } else {
        icon.style.left = `${viewportWidth - iconRect.width - 20}px`;
      }
    }
  });
  
  // 点击事件 - 打开侧边栏
  icon.addEventListener('click', () => {
    openSidebar(doi);
  });
  
  document.body.appendChild(icon);
}
```

### 13.3 侧边栏集成

```javascript
// extension/content.js

function openSidebar(doi) {
  // 检查是否已存在
  if (document.getElementById('researchopia-sidebar')) {
    return;
  }
  
  // 创建侧边栏
  const sidebar = document.createElement('div');
  sidebar.id = 'researchopia-sidebar';
  sidebar.className = 'researchopia-sidebar';
  
  // 创建 iframe
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.researchopia.com/doi/${encodeURIComponent(doi)}`;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  
  // 创建关闭按钮
  const closeButton = document.createElement('button');
  closeButton.className = 'sidebar-close';
  closeButton.innerHTML = '×';
  closeButton.addEventListener('click', () => {
    sidebar.remove();
  });
  
  sidebar.appendChild(closeButton);
  sidebar.appendChild(iframe);
  document.body.appendChild(sidebar);
}
```

<a name="background-worker"></a>
## 14. Background Service Worker

### 14.1 消息监听

```javascript
// extension/background.js

// 监听来自 Content Script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message);
  
  if (message.type === 'DOI_DETECTED') {
    handleDOIDetected(message.doi, sender.tab.id);
  }
  
  return true; // 保持消息通道开放
});

function handleDOIDetected(doi, tabId) {
  console.log(`[Background] DOI detected in tab ${tabId}:`, doi);
  
  // 更新图标状态
  chrome.action.setIcon({
    tabId: tabId,
    path: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png'
    }
  });
  
  // 显示徽章
  chrome.action.setBadgeText({
    tabId: tabId,
    text: '✓'
  });
  
  chrome.action.setBadgeBackgroundColor({
    tabId: tabId,
    color: '#4CAF50'
  });
  
  // 保存 DOI 到 storage
  chrome.storage.local.set({
    [`doi_${tabId}`]: doi
  });
}
```

<a name="message-passing"></a>
## 15. 消息传递机制

### 15.1 Content Script → Background

```javascript
// extension/content.js

// 发送消息
chrome.runtime.sendMessage({
  type: 'DOI_DETECTED',
  doi: detectedDOI
}, (response) => {
  console.log('Background response:', response);
});
```

### 15.2 Background → Content Script

```javascript
// extension/background.js

// 发送消息到特定标签页
chrome.tabs.sendMessage(tabId, {
  type: 'UPDATE_DOI',
  doi: newDOI
});
```

### 15.3 Popup → Background

```javascript
// extension/popup.js

// 获取 Background 中的数据
chrome.runtime.getBackgroundPage((bgPage) => {
  console.log('Background page:', bgPage);
});

// 发送消息
chrome.runtime.sendMessage({
  type: 'GET_CURRENT_DOI'
}, (response) => {
  document.getElementById('doi-display').textContent = response.doi;
});
```

<a name="storage-api"></a>
## 16. Storage API 使用

### 16.1 保存配置

```javascript
// extension/popup.js

// 保存配置
chrome.storage.sync.set({
  researchopiaUrl: 'https://www.researchopia.com',
  autoDetectDOI: true,
  floatingEnabled: true,
  sidebarWidth: 400
}, () => {
  console.log('Settings saved');
});
```

### 16.2 读取配置

```javascript
// extension/content.js

// 读取配置
chrome.storage.sync.get([
  'researchopiaUrl',
  'autoDetectDOI',
  'floatingEnabled',
  'sidebarWidth'
], (result) => {
  console.log('Current settings:', result);
  
  if (result.autoDetectDOI !== false) {
    checkForDOI();
  }
  
  if (result.floatingEnabled) {
    showFloatingIcon();
  }
});
```

### 16.3 监听配置变化

```javascript
// extension/content.js

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed:', changes);
  
  if (changes.floatingEnabled) {
    if (changes.floatingEnabled.newValue) {
      showFloatingIcon();
    } else {
      hideFloatingIcon();
    }
  }
});
```

---

## 附录

### A. 常用命令速查

**Zotero 插件**:
```bash
# 开发模式(热重载)
npm start

# 构建开发版本
npm run build

# 构建生产版本
npm run build:prod

# 生成 XPI 包
npm run release

# 运行测试
npm test

# 代码检查
npm run lint:check
npm run lint:fix
```

**浏览器扩展**:
```bash
# 打包扩展
cd extension
zip -r researchopia-extension.zip . -x "*.DS_Store" "*.git*"
```

**Next.js 网站**:
```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

### B. 相关文档

- [项目架构说明](./ARCHITECTURE.md)
- [贡献指南](./CONTRIBUTING.md)
- [问题排查](./TROUBLESHOOTING.md)
- [项目优化计划](../Debug/docs/PROJECT_OPTIMIZATION_PLAN.md)

---

**维护者**: Researchopia Team  
**最后更新**: 2025-11-02  
**许可证**: AGPL-3.0-or-later
