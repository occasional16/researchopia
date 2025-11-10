# DOI论文全文获取技术研究与合规方案设计

## 文档信息
- **版本**: v1.0
- **创建时间**: 2025-01-07
- **状态**: 技术研究
- **研究范围**: 论文全文自动获取技术、版权合规、Researchopia集成方案

---

## 1. 科研通（AbleSci）技术分析

### 1.1 平台定位
科研通（https://www.ablesci.com/）是一个**众包人工互助平台**，而非自动化机器人系统。

### 1.2 运作机制
```
用户发布求助 → 悬赏积分 → 志愿者应助 → 上传PDF → 求助者确认 → 完成交易
```

**关键特征**：
- 🧑‍🤝‍🧑 **人工互助**：志愿者手动下载并上传文献
- 💰 **积分激励**：通过虚拟积分激励志愿者提供文献
- ⏱️ **响应时间**：快速求助通常15分钟内完成，高分求助可在数秒内响应
- 📚 **资源池**：依赖志愿者的机构订阅（高校图书馆、研究所等）

### 1.3 志愿者资源来源
1. **高校图书馆订阅**：志愿者通过学校VPN访问数据库
2. **研究所机构订阅**：科研机构员工利用单位资源
3. **Open Access资源**：部分论文来自开放获取渠道
4. **私人订阅账号**：个人付费订阅的数据库

### 1.4 底层技术栈（推测）
- **Web爬虫**：无（人工操作）
- **API集成**：无直接集成出版商API
- **文件存储**：云存储（阿里云OSS/腾讯云COS）
- **任务分发**：消息队列（RabbitMQ/Kafka）+ WebSocket实时推送
- **用户系统**：积分系统、信誉评级、防滥用机制

**核心逻辑**：
```javascript
// 伪代码示例
class PaperRequestSystem {
  async createRequest(doi, title, bounty) {
    // 1. 创建求助任务
    const task = await DB.insert({
      doi, title, bounty,
      status: 'pending',
      created_at: Date.now()
    });
    
    // 2. 实时推送给在线志愿者
    await MessageQueue.publish('task.new', {
      id: task.id,
      doi, title, bounty
    });
    
    // 3. WebSocket通知客户端
    await WebSocket.broadcast('volunteers', task);
    
    return task;
  }
  
  async submitPaper(taskId, pdfFile, volunteerId) {
    // 1. 上传PDF到云存储
    const fileUrl = await OSS.upload(pdfFile);
    
    // 2. 更新任务状态
    await DB.update(taskId, {
      status: 'submitted',
      file_url: fileUrl,
      volunteer_id: volunteerId
    });
    
    // 3. 通知求助者验证
    await Notification.send(task.user_id, {
      type: 'paper_ready',
      task_id: taskId
    });
  }
}
```

### 1.5 关键优势
- ✅ **高覆盖率**：依赖全球志愿者的多样化资源
- ✅ **快速响应**：激励机制驱动志愿者快速应答
- ✅ **灵活性**：可处理各类特殊需求（补充材料、特定章节等）

### 1.6 法律风险分析
⚠️ **灰色地带**：
- 志愿者通过机构订阅下载文献供他人使用，**可能违反订阅协议**
- 平台作为中介，法律责任复杂
- 类似案例：Sci-Hub（明确违法）、ResearchGate（部分合规）

---

## 2. 论文全文自动获取技术路线

### 2.1 合法技术路径

#### 路径A：开放获取（Open Access）聚合
```
Unpaywall API → DOAJ → PubMed Central → arXiv → bioRxiv
```

**实现方案**：
```typescript
// Unpaywall API集成示例
class OpenAccessFinder {
  async findFulltext(doi: string): Promise<PaperFulltext | null> {
    // 1. 查询Unpaywall
    const response = await fetch(
      `https://api.unpaywall.org/v2/${doi}?email=YOUR_EMAIL`
    );
    const data = await response.json();
    
    if (data.is_oa && data.best_oa_location) {
      return {
        source: 'unpaywall',
        pdf_url: data.best_oa_location.url_for_pdf,
        version: data.best_oa_location.version, // 'publishedVersion' or 'acceptedVersion'
        license: data.best_oa_location.license
      };
    }
    
    // 2. 查询其他OA源
    return await this.fallbackToOtherSources(doi);
  }
  
  async fallbackToOtherSources(doi: string) {
    // DOAJ, PubMed Central, arXiv等
    const sources = [
      this.queryDOAJ(doi),
      this.queryPMC(doi),
      this.queryArXiv(doi)
    ];
    
    const results = await Promise.race(sources);
    return results;
  }
}
```

**优势**：
- ✅ 完全合法
- ✅ 无版权风险
- ✅ 覆盖率：约30-40%的学术论文

**劣势**：
- ❌ 覆盖率有限
- ❌ 版本可能非最终出版版（preprint/accepted manuscript）

---

#### 路径B：出版商API合法访问
```
Springer Nature API → Elsevier ScienceDirect → Wiley → Taylor & Francis
```

**实现方案**：
```typescript
class PublisherAPIClient {
  async requestFulltext(doi: string): Promise<AccessResult> {
    // 1. 检测出版商
    const publisher = await this.detectPublisher(doi);
    
    // 2. 根据出版商选择API
    switch(publisher) {
      case 'springer':
        return await this.springerAPI.request(doi);
      case 'elsevier':
        return await this.elsevierAPI.request(doi);
      // ... 其他出版商
    }
  }
  
  async springerAPI.request(doi: string) {
    // 需要用户提供API密钥或OAuth授权
    const response = await fetch(
      `https://api.springernature.com/metadata/json?q=doi:${doi}`,
      {
        headers: {
          'Authorization': `Bearer ${user.apiKey}`
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return {
        available: true,
        access_type: data.records[0].url[0].format, // PDF or HTML
        url: data.records[0].url[0].value
      };
    }
    
    return { available: false, reason: 'No access rights' };
  }
}
```

**优势**：
- ✅ 完全合法
- ✅ 最终出版版本
- ✅ 高质量PDF

**劣势**：
- ❌ 需要用户自行获取API密钥/订阅
- ❌ 实现复杂（每个出版商API不同）
- ❌ 成本高（机构订阅或按篇付费）

---

#### 路径C：图书馆代理/VPN集成
```
用户机构订阅 → EZProxy → Shibboleth → 自动登录 → 下载PDF
```

**实现方案**：
```typescript
class InstitutionalAccess {
  async setupProxy(userInstitution: string) {
    // 1. 用户配置机构信息
    const config = {
      institution: 'MIT',
      ezproxy_url: 'https://ezproxy.mit.edu/login',
      credentials: {
        username: user.libUsername,
        password: user.libPassword // 加密存储
      }
    };
    
    // 2. 通过代理访问
    await this.proxyClient.authenticate(config);
  }
  
  async downloadViProxy(doi: string) {
    // 通过EZProxy重写URL
    const publisherUrl = await this.resolveDoiToUrl(doi);
    const proxiedUrl = this.ezproxyRewrite(publisherUrl);
    
    // 自动登录并下载
    return await this.browserAutomation.download(proxiedUrl);
  }
  
  ezproxyRewrite(url: string): string {
    // Example: https://ezproxy.mit.edu/login?url=https://doi.org/10.xxxx
    return `${this.proxyUrl}/login?url=${url}`;
  }
}
```

**优势**：
- ✅ 利用用户现有订阅
- ✅ 覆盖率高（取决于机构订阅）
- ✅ 最终出版版本

**劣势**：
- ❌ 需要用户主动配置
- ❌ 存储用户凭证的安全风险
- ❌ 可能违反机构IT政策

---

### 2.2 灰色地带技术路径（仅作技术研究，不推荐）

#### 路径D：Sci-Hub API镜像
```
Sci-Hub API → 多个镜像站 → 负载均衡 → 自动下载
```

**技术原理**：
- Sci-Hub通过LibGen、俄罗斯镜像站点存储海量论文
- API: `https://sci-hub.se/{doi}` 或 `https://sci-hub.st/{doi}`
- 自动解析并返回PDF直链

**法律风险**：
- ⚠️ **明确违法**：侵犯版权
- ⚠️ 多国法院判决Sci-Hub非法
- ⚠️ 集成Sci-Hub可能导致项目被封禁

**不推荐理由**：
- ❌ 违反版权法
- ❌ 商业项目不可用
- ❌ 可能被出版商起诉

---

## 3. Researchopia合规集成方案

### 3.1 推荐技术架构

#### 架构设计：分层访问策略
```
┌─────────────────────────────────────────────┐
│           用户请求（DOI）                    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│    Layer 1: 开放获取检测 (Unpaywall API)    │
│    - 免费OA资源优先                          │
│    - 覆盖率: ~30%                            │
└─────────────────────────────────────────────┘
                    ↓ (未找到)
┌─────────────────────────────────────────────┐
│  Layer 2: 用户机构订阅 (EZProxy/Shibboleth)│
│    - 用户自愿配置                            │
│    - 覆盖率: 取决于机构                      │
└─────────────────────────────────────────────┘
                    ↓ (未找到)
┌─────────────────────────────────────────────┐
│   Layer 3: 合作互助平台 (类似科研通)        │
│    - 人工互助社区                            │
│    - 积分激励机制                            │
└─────────────────────────────────────────────┘
                    ↓ (未找到)
┌─────────────────────────────────────────────┐
│    Layer 4: 付费获取 (出版商直购)           │
│    - 单篇购买链接                            │
│    - 价格透明展示                            │
└─────────────────────────────────────────────┘
```

### 3.2 功能模块设计

#### 模块1：智能全文检测器
```typescript
// src/lib/fulltext-finder.ts
export class FulltextFinder {
  async findFulltext(doi: string): Promise<FulltextResult> {
    const result: FulltextResult = {
      doi,
      available: false,
      sources: []
    };
    
    // Layer 1: 开放获取
    const oaResult = await this.checkOpenAccess(doi);
    if (oaResult.available) {
      result.sources.push(oaResult);
      result.available = true;
    }
    
    // Layer 2: 机构订阅
    if (user.hasInstitutionalAccess) {
      const instResult = await this.checkInstitutional(doi);
      if (instResult.available) {
        result.sources.push(instResult);
        result.available = true;
      }
    }
    
    // Layer 3: 互助平台
    if (!result.available) {
      result.sources.push({
        type: 'mutual_aid',
        provider: 'Researchopia Community',
        action: 'request_help',
        estimated_time: '15 minutes'
      });
    }
    
    // Layer 4: 付费购买链接
    result.sources.push({
      type: 'purchase',
      provider: await this.detectPublisher(doi),
      price: await this.estimatePrice(doi),
      url: `https://doi.org/${doi}`
    });
    
    return result;
  }
  
  async checkOpenAccess(doi: string): Promise<Source> {
    const unpaywall = await fetch(
      `https://api.unpaywall.org/v2/${doi}?email=${config.email}`
    );
    const data = await unpaywall.json();
    
    if (data.is_oa && data.best_oa_location) {
      return {
        type: 'open_access',
        provider: 'Unpaywall',
        available: true,
        pdf_url: data.best_oa_location.url_for_pdf,
        license: data.best_oa_location.license,
        version: data.best_oa_location.version
      };
    }
    
    return { type: 'open_access', available: false };
  }
}
```

#### 模块2：Zotero插件集成
```typescript
// zotero-plugin/src/modules/fulltextManager.ts
export class FulltextManager {
  async requestFulltext(item: Zotero.Item): Promise<void> {
    const doi = item.getField('DOI');
    if (!doi) {
      throw new Error('No DOI found');
    }
    
    // 1. 显示加载动画
    UIManager.showLoader('正在检测全文来源...');
    
    // 2. 调用API检测
    const result = await apiClient.get(
      `/api/fulltext/find?doi=${encodeURIComponent(doi)}`
    );
    
    // 3. 根据结果展示选项
    if (result.sources.length > 0) {
      UIManager.showFulltextOptions({
        doi,
        sources: result.sources,
        onSelect: async (source) => {
          if (source.type === 'open_access') {
            await this.downloadAndAttach(item, source.pdf_url);
          } else if (source.type === 'mutual_aid') {
            await this.createHelpRequest(doi, item);
          } else if (source.type === 'purchase') {
            Zotero.launchURL(source.url);
          }
        }
      });
    } else {
      UIManager.showError('未找到可用的全文来源');
    }
  }
  
  async createHelpRequest(doi: string, item: Zotero.Item): Promise<void> {
    const title = item.getField('title');
    const request = await apiClient.post('/api/mutual-aid/request', {
      doi, title,
      bounty: 10, // 默认积分
      user_id: AuthManager.getCurrentUser().id
    });
    
    UIManager.showSuccess(
      `已创建求助请求！预计15分钟内会有响应\n` +
      `请在网站查看进度：${config.webUrl}/help/${request.id}`
    );
    
    // 开启轮询检查状态
    this.pollRequestStatus(request.id);
  }
  
  async downloadAndAttach(item: Zotero.Item, pdfUrl: string): Promise<void> {
    try {
      // 1. 下载PDF
      const pdfBlob = await fetch(pdfUrl).then(r => r.blob());
      
      // 2. 创建临时文件
      const tempFile = await this.saveTempFile(pdfBlob, 'paper.pdf');
      
      // 3. 附加到Zotero条目
      const attachment = await Zotero.Attachments.importFromFile({
        file: tempFile,
        parentItemID: item.id,
        title: 'Full Text PDF'
      });
      
      UIManager.showSuccess('PDF已成功下载并附加到文献！');
    } catch (error) {
      logger.error('Download failed:', error);
      UIManager.showError('下载失败，请稍后重试');
    }
  }
}
```

#### 模块3：互助社区功能
```typescript
// src/app/api/mutual-aid/request/route.ts
export async function POST(req: Request) {
  const { doi, title, bounty, user_id } = await req.json();
  
  // 1. 检查用户积分
  const user = await getUserById(user_id);
  if (user.credits < bounty) {
    return Response.json({ error: 'Insufficient credits' }, { status: 400 });
  }
  
  // 2. 创建求助任务
  const request = await supabase
    .from('paper_requests')
    .insert({
      doi, title, bounty,
      user_id,
      status: 'pending',
      created_at: new Date()
    })
    .select()
    .single();
  
  // 3. 扣除用户积分（暂时锁定）
  await supabase
    .from('users')
    .update({ credits: user.credits - bounty, locked_credits: bounty })
    .eq('id', user_id);
  
  // 4. 推送给在线志愿者
  await notifyVolunteers({
    type: 'new_request',
    request_id: request.id,
    doi, title, bounty
  });
  
  // 5. 记录操作日志
  await logActivity({
    user_id,
    action: 'create_help_request',
    details: { doi, bounty }
  });
  
  return Response.json({ success: true, request });
}

// src/app/api/mutual-aid/submit/route.ts
export async function POST(req: Request) {
  const { request_id, pdf_file, volunteer_id } = await req.json();
  
  // 1. 上传PDF到云存储
  const fileUrl = await uploadToS3(pdf_file);
  
  // 2. 更新任务状态
  await supabase
    .from('paper_requests')
    .update({
      status: 'submitted',
      file_url: fileUrl,
      volunteer_id,
      submitted_at: new Date()
    })
    .eq('id', request_id);
  
  // 3. 通知求助者
  const request = await getRequestById(request_id);
  await sendNotification({
    user_id: request.user_id,
    type: 'paper_ready',
    message: `您求助的论文《${request.title}》已由志愿者提交！`,
    link: `/help/${request_id}`
  });
  
  return Response.json({ success: true });
}

// src/app/api/mutual-aid/confirm/route.ts
export async function POST(req: Request) {
  const { request_id, satisfied } = await req.json();
  
  const request = await getRequestById(request_id);
  
  if (satisfied) {
    // 1. 转移积分给志愿者
    await transferCredits({
      from: request.user_id,
      to: request.volunteer_id,
      amount: request.bounty
    });
    
    // 2. 更新任务状态
    await supabase
      .from('paper_requests')
      .update({ status: 'completed' })
      .eq('id', request_id);
    
    // 3. 记录志愿者贡献
    await incrementVolunteerStats(request.volunteer_id);
  } else {
    // 退回积分并重新发布
    await refundCredits(request.user_id, request.bounty);
    await republishRequest(request_id);
  }
  
  return Response.json({ success: true });
}
```

### 3.3 版权合规措施

#### 合规清单
```markdown
✅ 免责声明
- 网站显眼位置声明："仅供学术交流，禁止商业传播"
- 用户协议明确版权责任归用户自行承担

✅ 来源标注
- 所有下载的PDF标注来源（OA/机构订阅/互助）
- 非OA资源显示"该文献通过用户机构订阅获取"

✅ 用户教育
- 提供版权知识普及页面
- 鼓励优先使用OA资源
- 提示尊重出版商权益

✅ 滥用防范
- 每日下载次数限制
- 异常流量检测
- 禁止批量爬取

✅ DMCA合规
- 设置DMCA投诉通道
- 及时处理侵权举报
- 记录处理日志

✅ 数据安全
- 用户机构凭证加密存储
- 严格权限控制
- 定期安全审计
```

#### 用户协议示例
```markdown
### Researchopia 论文全文服务条款

1. **服务范围**
   - 本服务仅协助用户检测和获取**合法可用**的论文全文
   - 优先使用开放获取（Open Access）资源
   - 支持用户通过自有机构订阅访问

2. **版权声明**
   - 用户通过本平台获取的文献仅供个人学习研究使用
   - 禁止任何形式的商业传播或盈利使用
   - 用户需自行确认是否拥有合法访问权限

3. **互助社区规则**
   - 志愿者提供的文献必须来自合法渠道（机构订阅/OA）
   - 严禁上传通过非法途径获取的文献
   - 违规用户将被永久封禁

4. **免责条款**
   - Researchopia作为技术平台，不对用户行为承担版权责任
   - 如有侵权行为，责任由上传者和下载者自行承担
   - 平台收到侵权通知后将立即移除相关内容

5. **DMCA投诉**
   - 版权所有者可通过 dmca@researchopia.com 提交投诉
   - 我们承诺在24小时内处理合法投诉
```

### 3.4 UI/UX设计

#### Zotero插件界面
```
┌─────────────────────────────────────────┐
│  📄 论文全文获取                         │
├─────────────────────────────────────────┤
│  DOI: 10.1038/nature12345               │
│  标题: Example Paper Title              │
├─────────────────────────────────────────┤
│  检测结果：                              │
│                                          │
│  ✅ 开放获取 (Unpaywall)                │
│     ├─ 版本: Published Version         │
│     ├─ 许可: CC BY 4.0                  │
│     └─ [立即下载]                        │
│                                          │
│  ⚙️ 机构订阅 (MIT Libraries)            │
│     ├─ 状态: 可用                       │
│     └─ [通过代理下载]                    │
│                                          │
│  🤝 互助社区                             │
│     ├─ 预计等待: 15分钟                 │
│     ├─ 所需积分: 10                      │
│     └─ [发起求助]                        │
│                                          │
│  💰 付费购买 (Nature)                    │
│     ├─ 价格: $32                         │
│     └─ [前往购买]                        │
└─────────────────────────────────────────┘
```

#### 网站互助社区页面
```
┌─────────────────────────────────────────┐
│  📚 论文互助广场                         │
├─────────────────────────────────────────┤
│  [发布求助] [我的求助] [我要应助]       │
├─────────────────────────────────────────┤
│                                          │
│  ┌───────────────────────────────────┐  │
│  │ 🔥 悬赏50积分                      │  │
│  │ Nature · AI-driven protein design │  │
│  │ DOI: 10.1038/nature12345          │  │
│  │ 发布者: user123 · 5分钟前         │  │
│  │ [我来应助]                         │  │
│  └───────────────────────────────────┘  │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │ ⏱️ 悬赏30积分                      │  │
│  │ Science · Quantum computing       │  │
│  │ DOI: 10.1126/science.abc1234      │  │
│  │ 发布者: researcher456 · 12分钟前  │  │
│  │ [我来应助]                         │  │
│  └───────────────────────────────────┘  │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │ ✅ 已完成                          │  │
│  │ Cell · CRISPR gene editing        │  │
│  │ DOI: 10.1016/j.cell.2023.001      │  │
│  │ 应助者: volunteer789 · 2分钟完成  │  │
│  └───────────────────────────────────┘  │
│                                          │
└─────────────────────────────────────────┘
```

---

## 4. 实施路线图

### Phase 1: 基础设施 (Week 1-2)
- [ ] 集成Unpaywall API
- [ ] 实现开放获取检测
- [ ] 基础UI组件（Zotero插件）
- [ ] 网站全文检测页面

### Phase 2: 互助社区 (Week 3-4)
- [ ] 设计数据库表（paper_requests, volunteers）
- [ ] 实现任务发布/应助流程
- [ ] 积分系统和激励机制
- [ ] 实时通知（WebSocket/Server-Sent Events）

### Phase 3: 高级功能 (Week 5-6)
- [ ] 机构订阅集成（EZProxy支持）
- [ ] 批量全文检测
- [ ] 下载历史和管理
- [ ] 志愿者信誉系统

### Phase 4: 合规与优化 (Week 7-8)
- [ ] 完善用户协议和免责声明
- [ ] DMCA投诉处理流程
- [ ] 性能优化（CDN、缓存）
- [ ] 安全审计

---

## 5. 成本估算

### 技术成本
- **Unpaywall API**: 免费（需要注册邮箱）
- **云存储（S3/OSS）**: 约$0.02/GB，预计$50/月
- **带宽**: 按流量计费，预计$100/月
- **服务器**: 已有（Next.js托管在Vercel）

### 开发成本
- **全职开发**: 2人 × 2个月 ≈ 4人月
- **测试与部署**: 1人 × 2周 ≈ 0.5人月

### 运营成本
- **社区管理**: 1人 × 兼职
- **客服支持**: 自动化 + 社区自治

**总计**: 约$150/月 + 初期开发投入

---

## 6. 风险评估与应对

### 法律风险
| 风险 | 等级 | 应对措施 |
|------|------|----------|
| 版权侵权诉讼 | 🟡 中 | 严格审核上传内容 + DMCA快速响应 |
| 出版商封禁 | 🟢 低 | 优先使用OA资源 + 明确免责 |
| 用户数据泄露 | 🟡 中 | 加密存储 + 最小化权限 |

### 技术风险
| 风险 | 等级 | 应对措施 |
|------|------|----------|
| API限流/封禁 | 🟡 中 | 多API源负载均衡 + 缓存 |
| 服务器过载 | 🟢 低 | 云服务自动扩容 + CDN |
| 恶意爬虫 | 🟡 中 | 速率限制 + 验证码 |

### 运营风险
| 风险 | 等级 | 应对措施 |
|------|------|----------|
| 社区滥用 | 🟡 中 | 积分惩罚 + 用户举报机制 |
| 志愿者不足 | 🟢 低 | 激励机制 + 徽章系统 |

---

## 7. 竞品分析

### 同类产品对比

| 产品 | 覆盖率 | 速度 | 合法性 | 成本 |
|------|--------|------|--------|------|
| **Unpaywall** | 30% | 即时 | ✅ 合法 | 免费 |
| **ResearchGate** | 40% | 慢（需作者上传） | 🟡 灰色 | 免费 |
| **Sci-Hub** | 85% | 快 | ❌ 非法 | 免费 |
| **科研通** | 70% | 中（15分钟） | 🟡 灰色 | 积分/付费 |
| **Researchopia方案** | 50%+ | 中-快 | ✅ 合规 | 积分互助 |

### 差异化优势
- ✅ **合规优先**：明确法律边界，避免平台风险
- ✅ **社区驱动**：互助模式建立用户粘性
- ✅ **多源整合**：OA + 机构订阅 + 互助，最大化覆盖率
- ✅ **Zotero深度集成**：无缝工作流

---

## 8. 总结与建议

### 推荐方案
**采用"分层访问策略 + 互助社区"模式**：

1. **优先OA资源**（Unpaywall API）- 合法、免费、即时
2. **支持机构订阅**（用户自愿配置）- 合法、覆盖广
3. **互助社区兜底**（类科研通）- 灵活、快速、可控
4. **引导付费购买**（最后手段）- 支持出版商、完全合法

### 核心原则
- ✅ **合规第一**：不集成Sci-Hub等明确违法服务
- ✅ **用户自主**：尊重用户选择，提供多种途径
- ✅ **社区共建**：通过互助建立生态，而非纯技术手段
- ✅ **透明运营**：明确告知每种途径的合法性和限制

### 下一步行动
1. **技术验证**：集成Unpaywall API，测试覆盖率
2. **社区MVP**：先建立小规模互助社区（100人内测）
3. **法律咨询**：与专业律师确认方案合规性
4. **用户调研**：收集Zotero用户对全文获取功能的需求

---

## 附录

### A. Unpaywall API文档
- 官网: https://unpaywall.org/products/api
- 注册: 发送邮件到 team@ourresearch.org
- 速率限制: 100,000 请求/天（免费）
- 数据覆盖: 3000万+ OA论文

### B. 相关法律法规
- 《中华人民共和国著作权法》
- Digital Millennium Copyright Act (DMCA)
- 各出版商Terms of Service

### C. 技术参考资料
- Zotero Translator API: https://www.zotero.org/support/dev/translators
- Sci-Hub技术分析（学术研究）: 
  - "The State of OA: A large-scale analysis" (2018)
  - "Shadow Libraries" research by Joe Karaganis

### D. 社区运营案例
- Stack Overflow 积分系统
- Wikipedia 志愿者激励
- Reddit Karma机制

---

**文档结束**

---

**版权声明**: 本文档仅供技术研究和学术交流，不构成任何法律建议。实际应用前请咨询专业法律顾问。
