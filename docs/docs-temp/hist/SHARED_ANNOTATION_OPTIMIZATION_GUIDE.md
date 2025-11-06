# 共享标注显示优化指导文档

## 当前状态（测试4成功配置）

### 实现效果
- ✅ 缩放过程中，共享标注消失
- ✅ 缩放结束后约0.4秒，共享标注准确出现
- ✅ 每次缩放都能正常显示
- ✅ 位置精度完美（使用真实PDF页面尺寸）

### 实现原理
1. **ResizeObserver监听页面容器尺寸变化**
   - 缩放开始时立即隐藏overlay（`opacity = '0'`）
   - 延迟500ms后触发更新（防抖）
   
2. **自动检测并重建overlay**
   - 检测到overlay层被Zotero删除时，自动重建所有overlay
   - 使用`PDFViewerApplication.pdfDocument.getPage().getViewport().viewBox`获取真实PDF尺寸
   
3. **恢复可见性**
   - 更新完成后恢复overlay可见性（`opacity = '1'`）

### 关键代码位置
- **文件**: `zotero-plugin/src/modules/pdfReaderManager.ts`
- **ResizeObserver**: Line 699-757
- **定期检查**: Line 758-780
- **坐标转换**: Line 563-650
- **PDF尺寸获取**: Line 988-1022

---

## 方案1: 继续优化当前方案

### 目标
减少响应时间，提升用户体验，使共享标注在缩放后更快出现。

### 优化方向

#### 1.1 减少ResizeObserver延迟时间
**当前**: 500ms  
**目标**: 尝试300ms、200ms、150ms

**步骤**:
1. 修改`pdfReaderManager.ts` Line 735的延迟时间
2. 构建插件：`npm run build`
3. 测试：进行多次缩放操作（zoom in/out）
4. 观察：
   - 共享标注是否在缩放后快速出现？
   - 是否有闪烁或平移动作？
   - 是否有多次出现/消失的情况？

**预期结果**:
- 延迟时间越短，响应越快
- 但可能导致闪烁（因为Zotero可能还在重建DOM）

**回退条件**:
- 如果出现闪烁或多次出现/消失，回退到500ms

---

#### 1.2 优化overlay重建逻辑
**当前**: 检测到overlay层被删除时，重建所有overlay  
**问题**: 可能导致不必要的重建

**优化思路**:
1. **缓存PDF页面尺寸**，避免每次都重新获取
2. **批量更新overlay位置**，减少DOM操作次数
3. **使用requestAnimationFrame**，在浏览器下一帧渲染时更新

**步骤**:
1. 在`pdfReaderManager.ts`中添加PDF尺寸缓存：
   ```typescript
   private pdfPageDimensionsCache = new Map<number, {width: number, height: number}>();
   ```

2. 修改`updateOverlaysForPage`方法，先检查缓存：
   ```typescript
   let pdfPageWidth, pdfPageHeight;
   const cachedDimensions = this.pdfPageDimensionsCache.get(pageNumber);
   if (cachedDimensions) {
     pdfPageWidth = cachedDimensions.width;
     pdfPageHeight = cachedDimensions.height;
   } else {
     // 获取真实PDF尺寸并缓存
     const page = await pdfDocument.getPage(pageNumber);
     const viewport = page.getViewport({ scale: 1.0 });
     const [x1, y1, x2, y2] = viewport.viewBox;
     pdfPageWidth = x2 - x1;
     pdfPageHeight = y2 - y1;
     this.pdfPageDimensionsCache.set(pageNumber, { width: pdfPageWidth, height: pdfPageHeight });
   }
   ```

3. 使用`requestAnimationFrame`优化渲染：
   ```typescript
   win.requestAnimationFrame(() => {
     overlayLayer.style.opacity = '1';
   });
   ```

4. 测试并观察性能改善

---

#### 1.3 添加CSS transform优化
**当前**: 使用`left`、`top`、`width`、`height`定位  
**优化**: 使用CSS `transform`，利用GPU加速

**步骤**:
1. 修改overlay样式（Line 563-575）：
   ```typescript
   overlay.style.cssText = `
     position: absolute;
     left: 0;
     top: 0;
     width: ${widthPx}px;
     height: ${heightPx}px;
     transform: translate(${leftPx}px, ${topPx}px);
     will-change: transform;
     pointer-events: auto;
     z-index: 3;
     box-sizing: border-box;
     transition: opacity 0.2s;
   `;
   ```

2. 更新overlay位置时使用transform：
   ```typescript
   overlay.style.transform = `translate(${leftPx}px, ${topPx}px)`;
   ```

3. 测试性能改善

**注意**: 使用transform可能导致像素对齐问题，需要仔细测试

---

#### 1.4 使用Intersection Observer优化
**目标**: 只更新可见页面的overlay，减少不必要的计算

**步骤**:
1. 添加Intersection Observer监听页面可见性：
   ```typescript
   const intersectionObserver = new IntersectionObserver((entries) => {
     entries.forEach(entry => {
       if (entry.isIntersecting) {
         // 页面可见，更新overlay
         this.updateOverlaysForPage(entry.target as HTMLElement);
       }
     });
   }, { threshold: 0.1 });
   
   intersectionObserver.observe(pageContainer);
   ```

2. 测试多页PDF文档的性能改善

---

## 方案2: 使用Zotero原生标注系统

### 目标
将共享标注注入到Zotero的原生annotation系统中，完全复刻原生标注的显示和交互效果。

### 优势
- ✅ 完全与原生标注一致（无闪烁、无消失）
- ✅ 自动处理缩放、旋转、不同页面尺寸
- ✅ 支持点击标注时自动定位到插件面板
- ✅ 与Zotero的UI完全一致

### 挑战
- ⚠️ 需要深度集成Zotero API
- ⚠️ 实现复杂度高
- ⚠️ 可能需要修改Zotero的内部数据结构
- ⚠️ Zotero版本更新可能导致兼容性问题

---

### 2.1 研究Zotero原生标注系统

**步骤**:
1. **查看Zotero官方文档**
   - https://www.zotero.org/support/dev/zotero_8_for_developers
   - https://www.zotero.org/support/dev/client_coding/javascript_api

2. **研究Zotero源码**
   - 克隆Zotero仓库：`git clone https://github.com/zotero/zotero.git`
   - 查看PDF阅读器相关代码：
     - `chrome/content/zotero/xpcom/reader.js`
     - `chrome/content/zotero/xpcom/annotations.js`
     - `pdf-reader/` 目录

3. **分析关键API**
   - `Zotero.Reader` - PDF阅读器主类
   - `reader._annotationManager` - 标注管理器
   - `reader._iframeWindow.PDFViewerApplication` - PDF.js应用实例
   - `Zotero.Annotations` - 标注数据管理

4. **使用浏览器开发者工具**
   - 在Zotero中打开PDF文档
   - 打开开发者工具（Tools > Developer > Browser Console）
   - 检查原生标注的DOM结构：
     ```javascript
     // 获取当前阅读器实例
     let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
     
     // 查看annotation manager
     console.log(reader._annotationManager);
     
     // 查看所有标注
     console.log(reader._annotationManager._annotations);
     ```

---

### 2.2 创建临时标注对象

**目标**: 将共享标注转换为Zotero原生标注格式

**步骤**:
1. **分析Zotero标注数据结构**
   ```javascript
   // 在Zotero Browser Console中执行
   let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
   let annotations = reader._annotationManager._annotations;
   console.log(JSON.stringify(annotations[0], null, 2));
   ```

2. **创建转换函数**（在`pdfReaderManager.ts`中）：
   ```typescript
   private convertSharedAnnotationToZoteroFormat(sharedAnnotation: any): any {
     return {
       id: `shared-${sharedAnnotation.id}`, // 添加前缀区分共享标注
       type: sharedAnnotation.type, // 'highlight', 'underline', 'note'
       color: sharedAnnotation.color,
       sortIndex: sharedAnnotation.sortIndex || '00000|000000|00000',
       position: {
         pageIndex: sharedAnnotation.position.pageIndex,
         rects: sharedAnnotation.position.rects
       },
       text: sharedAnnotation.text || '',
       comment: sharedAnnotation.comment || '',
       tags: [],
       dateModified: sharedAnnotation.updated_at,
       // 添加自定义属性标识这是共享标注
       isShared: true,
       sharedBy: sharedAnnotation.user_name
     };
   }
   ```

3. **测试转换函数**
   - 确保转换后的数据结构与Zotero原生标注一致

---

### 2.3 注入标注到Zotero系统

**步骤**:
1. **获取annotation manager**：
   ```typescript
   const annotationManager = reader._annotationManager;
   if (!annotationManager) {
     logger.error("[PDFReaderManager] Cannot access annotation manager");
     return;
   }
   ```

2. **注入共享标注**：
   ```typescript
   // 方法1: 直接添加到_annotations数组（可能不稳定）
   const zoteroAnnotation = this.convertSharedAnnotationToZoteroFormat(sharedAnnotation);
   annotationManager._annotations.push(zoteroAnnotation);
   
   // 方法2: 使用Zotero API（推荐，但需要研究API）
   // 可能需要调用 annotationManager.addAnnotation() 或类似方法
   ```

3. **触发重新渲染**：
   ```typescript
   // 通知Zotero重新渲染标注
   annotationManager.render();
   // 或
   reader._iframeWindow.PDFViewerApplication.pdfViewer.update();
   ```

4. **测试**：
   - 点击"定位"按钮后，检查PDF页面是否显示共享标注
   - 检查标注样式是否与原生标注一致

---

### 2.4 区分共享标注和私有标注

**目标**: 为共享标注添加视觉标识（如不同颜色、边框、图标）

**步骤**:
1. **添加CSS样式**（在`content.css`中）：
   ```css
   /* 共享标注样式 */
   .annotationLayer .shared-annotation {
     border: 2px dashed rgba(0, 123, 255, 0.5) !important;
   }
   
   .annotationLayer .shared-annotation::after {
     content: '👥';
     position: absolute;
     top: -20px;
     right: 0;
     font-size: 12px;
     background: rgba(0, 123, 255, 0.8);
     color: white;
     padding: 2px 6px;
     border-radius: 3px;
   }
   ```

2. **在注入时添加CSS类**：
   ```typescript
   // 在注入后，为共享标注的DOM元素添加CSS类
   const annotationElement = pageContainer.querySelector(`[data-annotation-id="${zoteroAnnotation.id}"]`);
   if (annotationElement) {
     annotationElement.classList.add('shared-annotation');
   }
   ```

3. **测试视觉效果**

---

### 2.5 实现点击交互

**目标**: 点击共享标注时，显示comment和评论，并定位到插件面板

**步骤**:
1. **监听标注点击事件**：
   ```typescript
   // 在Zotero的annotation manager中添加事件监听
   annotationManager.on('annotationClick', (annotation) => {
     if (annotation.isShared) {
       // 处理共享标注点击
       this.handleSharedAnnotationClick(annotation);
     }
   });
   ```

2. **显示comment和评论**：
   ```typescript
   private handleSharedAnnotationClick(annotation: any) {
     // 在PDF下方显示comment和评论
     // 可能需要使用Zotero的sidebar或创建自定义UI
     
     // 定位到插件面板
     this.scrollToAnnotationInPanel(annotation.id);
   }
   ```

3. **测试交互效果**

---

### 2.6 处理标注同步

**目标**: 当共享标注更新时，自动更新Zotero中的临时标注

**步骤**:
1. **监听Supabase实时更新**（已有）
2. **更新Zotero中的标注**：
   ```typescript
   private updateZoteroAnnotation(annotationId: string, updates: any) {
     const annotationManager = this.currentReader?._annotationManager;
     if (!annotationManager) return;
     
     const annotation = annotationManager._annotations.find(
       (a: any) => a.id === `shared-${annotationId}`
     );
     
     if (annotation) {
       Object.assign(annotation, updates);
       annotationManager.render();
     }
   }
   ```

3. **测试实时同步**

---

### 2.7 清理临时标注

**目标**: 当用户关闭PDF或切换文档时，清理注入的共享标注

**步骤**:
1. **在PDF关闭时清理**：
   ```typescript
   private cleanupSharedAnnotations(reader: any) {
     const annotationManager = reader._annotationManager;
     if (!annotationManager) return;
     
     // 移除所有共享标注
     annotationManager._annotations = annotationManager._annotations.filter(
       (a: any) => !a.isShared
     );
     
     annotationManager.render();
   }
   ```

2. **在`unregisterReader`中调用清理函数**

3. **测试清理逻辑**

---

## 测试流程

### 测试环境
- Zotero版本：7.x / 8.x beta
- 测试PDF：不同尺寸、不同页数的PDF文档
- 测试操作：缩放、滚动、切换页面、旋转

### 测试用例

#### 1. 基础显示测试
- [ ] 点击"定位"按钮后，共享标注准确出现
- [ ] 共享标注位置与原生标注完全重合
- [ ] 共享标注颜色、样式正确

#### 2. 缩放测试
- [ ] Zoom in：共享标注跟随缩放，位置准确
- [ ] Zoom out：共享标注跟随缩放，位置准确
- [ ] 连续缩放：无闪烁、无多次出现/消失

#### 3. 交互测试
- [ ] 点击共享标注：显示comment和评论
- [ ] 点击共享标注：插件面板自动定位到对应标注
- [ ] 点击原生标注：不影响共享标注

#### 4. 性能测试
- [ ] 多页PDF（100+页）：加载速度
- [ ] 多个共享标注（50+个）：渲染性能
- [ ] 长时间使用：内存占用

#### 5. 兼容性测试
- [ ] Zotero 7.x：功能正常
- [ ] Zotero 8.x beta：功能正常
- [ ] 不同操作系统：Windows、macOS、Linux

---

## 回退策略

如果方案2（Zotero原生标注系统）遇到无法解决的问题：
1. 回退到方案1（当前HTML overlay方案）
2. 继续优化方案1，提升用户体验
3. 在Zotero官方论坛寻求帮助或提交feature request

---

## 参考资源

### Zotero官方文档
- https://www.zotero.org/support/dev/zotero_8_for_developers
- https://www.zotero.org/support/dev/client_coding/javascript_api

### Zotero源码
- https://github.com/zotero/zotero
- https://github.com/zotero/pdf-reader

### 插件开发资源
- https://github.com/windingwind/zotero-plugin-template
- https://windingwind.github.io/doc-for-zotero-plugin-dev/

### PDF.js文档
- https://mozilla.github.io/pdf.js/
- https://github.com/mozilla/pdf.js

---

## 更新日志

- 2025-10-15: 创建文档，记录测试4成功配置和优化方案

