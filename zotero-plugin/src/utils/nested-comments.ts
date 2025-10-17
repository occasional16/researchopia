/**
 * 嵌套评论渲染辅助方法
 * 用于 ui-manager.ts
 */

/**
 * 递归渲染评论节点(支持嵌套)
 * @param comment 评论节点(包含children)
 * @param depth 当前深度(用于缩进)
 * @param doc Document对象
 * @param currentUserId 当前用户ID
 * @param annotationId 标注ID
 * @param cardElement 卡片元素(用于刷新)
 * @param onReply 回复回调
 * @param onEdit 编辑回调
 * @param onDelete 删除回调
 * @param formatDate 日期格式化函数
 * @returns HTMLElement
 */
export function renderCommentNode(
  comment: any,
  depth: number,
  doc: Document,
  currentUserId: string,
  annotationId: string,
  cardElement: HTMLElement,
  callbacks: {
    onReply: (parentId: string, content: string) => Promise<void>;
    onEdit: (commentId: string, content: string) => Promise<void>;
    onDelete: (commentId: string) => Promise<void>;
    formatDate: (dateString: string) => string;
  }
): HTMLElement {
  const container = doc.createElement('div');
  container.className = 'comment-node';
  container.setAttribute('data-comment-id', comment.id);
  container.setAttribute('data-depth', depth.toString());
  container.style.cssText = `
    margin-left: ${depth * 24}px;
    ${depth > 0 ? 'border-left: 2px solid var(--fill-quinary);' : ''}
    ${depth > 0 ? 'padding-left: 12px;' : ''}
    margin-bottom: 8px;
  `;

  // 评论主体
  const commentBody = doc.createElement('div');
  commentBody.className = 'comment-body';
  commentBody.style.cssText = `
    padding: 8px;
    background: var(--fill-tertiary);
    border-radius: 3px;
    font-size: 12px;
    position: relative;
  `;

  // 头部(用户名、时间、操作按钮)
  const header = doc.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';

  const userInfo = doc.createElement('div');
  userInfo.style.cssText = 'color: var(--fill-secondary); display: flex; gap: 8px; align-items: center;';
  
  const userName = comment.username || '匿名用户';
  const replyCount = comment.reply_count || comment.children?.length || 0;
  
  userInfo.innerHTML = `
    <strong>${userName}</strong>
    <span style="color: var(--fill-quaternary);">·</span>
    <span>${callbacks.formatDate(comment.created_at)}</span>
    ${replyCount > 0 ? `<span style="color: var(--accent-blue);">· ${replyCount} 回复</span>` : ''}
  `;

  header.appendChild(userInfo);

  const isOwnComment = comment.user_id === currentUserId;

  // 操作按钮
  const actions = doc.createElement('div');
  actions.style.cssText = 'display: flex; gap: 8px;';

  // 回复按钮(所有人都能看到)
  const replyBtn = doc.createElement('button');
  replyBtn.textContent = '💬 回复';
  replyBtn.style.cssText = `
    padding: 2px 6px;
    background: transparent;
    color: var(--accent-blue);
    border: 1px solid var(--accent-blue);
    border-radius: 2px;
    cursor: pointer;
    font-size: 11px;
  `;
  replyBtn.addEventListener('click', () => {
    toggleReplyBox(container, comment.id);
  });
  actions.appendChild(replyBtn);

  // 编辑删除按钮(仅自己的评论)
  if (isOwnComment) {
    const editBtn = doc.createElement('button');
    editBtn.textContent = '编辑';
    editBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      color: var(--accent-blue);
      border: 1px solid var(--accent-blue);
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
    `;
    editBtn.addEventListener('click', () => {
      toggleEditMode(commentBody, comment);
    });

    const deleteBtn = doc.createElement('button');
    deleteBtn.textContent = '删除';
    deleteBtn.style.cssText = `
      padding: 2px 6px;
      background: transparent;
      color: var(--accent-red);
      border: 1px solid var(--accent-red);
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
    `;
    deleteBtn.addEventListener('click', async () => {
      const Services = (Zotero as any).getMainWindow().Services;
      const confirmed = Services.prompt.confirm(
        null,
        '确认删除',
        replyCount > 0 
          ? `此评论有 ${replyCount} 条回复,删除后回复也会被删除。确定继续？`
          : '确定要删除这条评论吗?'
      );

      if (confirmed) {
        await callbacks.onDelete(comment.id);
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
  }

  header.appendChild(actions);
  commentBody.appendChild(header);

  // 评论内容
  const contentDiv = doc.createElement('div');
  contentDiv.className = 'comment-content';
  contentDiv.style.cssText = 'color: var(--fill-primary); line-height: 1.5;';
  contentDiv.textContent = comment.content;
  commentBody.appendChild(contentDiv);

  container.appendChild(commentBody);

  // 回复输入框容器(初始隐藏)
  const replyBoxContainer = doc.createElement('div');
  replyBoxContainer.className = 'reply-box-container';
  replyBoxContainer.style.cssText = 'display: none; margin-top: 8px;';
  
  const replyBox = createReplyBox(doc, async (content: string) => {
    await callbacks.onReply(comment.id, content);
    replyBoxContainer.style.display = 'none';
  }, () => {
    replyBoxContainer.style.display = 'none';
  });
  
  replyBoxContainer.appendChild(replyBox);
  container.appendChild(replyBoxContainer);

  // 切换回复框显示
  function toggleReplyBox(containerEl: HTMLElement, parentId: string) {
    const box = containerEl.querySelector('.reply-box-container') as HTMLElement;
    if (box) {
      box.style.display = box.style.display === 'none' ? 'flex' : 'none';
      if (box.style.display === 'flex') {
        const textarea = box.querySelector('textarea');
        textarea?.focus();
      }
    }
  }

  // 切换编辑模式
  function toggleEditMode(bodyEl: HTMLElement, commentData: any) {
    const contentDiv = bodyEl.querySelector('.comment-content') as HTMLElement;
    if (!contentDiv) return;

    // 如果已经在编辑模式,取消
    if (bodyEl.classList.contains('editing')) {
      bodyEl.classList.remove('editing');
      contentDiv.textContent = commentData.content;
      const editForm = bodyEl.querySelector('.edit-form');
      if (editForm) editForm.remove();
      return;
    }

    // 进入编辑模式
    bodyEl.classList.add('editing');
    const originalContent = commentData.content;

    const editForm = doc.createElement('div');
    editForm.className = 'edit-form';
    editForm.style.cssText = 'margin-top: 8px;';

    const textarea = doc.createElement('textarea');
    textarea.value = originalContent;
    textarea.style.cssText = `
      width: 100%;
      padding: 6px;
      border: 1px solid var(--fill-quinary);
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 60px;
      background: var(--material-background);
      color: var(--fill-primary);
      box-sizing: border-box;
    `;

    const buttonGroup = doc.createElement('div');
    buttonGroup.style.cssText = 'display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end;';

    const saveBtn = doc.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.style.cssText = `
      padding: 4px 12px;
      background: var(--accent-blue);
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    saveBtn.addEventListener('click', async () => {
      const newContent = textarea.value.trim();
      if (newContent && newContent !== originalContent) {
        await callbacks.onEdit(commentData.id, newContent);
        commentData.content = newContent;
        contentDiv.textContent = newContent;
      }
      bodyEl.classList.remove('editing');
      editForm.remove();
    });

    const cancelBtn = doc.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 4px 12px;
      background: var(--fill-tertiary);
      color: var(--fill-primary);
      border: 1px solid var(--fill-quinary);
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    cancelBtn.addEventListener('click', () => {
      bodyEl.classList.remove('editing');
      editForm.remove();
    });

    buttonGroup.appendChild(cancelBtn);
    buttonGroup.appendChild(saveBtn);
    editForm.appendChild(textarea);
    editForm.appendChild(buttonGroup);
    bodyEl.appendChild(editForm);

    textarea.focus();
    textarea.select();
  }

  // 递归渲染子评论
  if (comment.children && comment.children.length > 0) {
    const childrenContainer = doc.createElement('div');
    childrenContainer.className = 'comment-children';
    childrenContainer.style.cssText = 'margin-top: 8px;';

    comment.children.forEach((child: any) => {
      const childNode = renderCommentNode(
        child,
        depth + 1,
        doc,
        currentUserId,
        annotationId,
        cardElement,
        callbacks
      );
      childrenContainer.appendChild(childNode);
    });

    container.appendChild(childrenContainer);
  }

  return container;
}

/**
 * 创建回复输入框
 */
function createReplyBox(
  doc: Document,
  onSubmit: (content: string) => Promise<void>,
  onCancel: () => void
): HTMLElement {
  const container = doc.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding: 8px; background: var(--fill-secondary); border-radius: 3px;';

  const textarea = doc.createElement('textarea');
  textarea.placeholder = '输入回复内容...';
  textarea.style.cssText = `
    padding: 6px;
    border: 1px solid var(--fill-quinary);
    border-radius: 3px;
    font-size: 12px;
    font-family: inherit;
    resize: vertical;
    min-height: 50px;
    background: var(--material-background);
    color: var(--fill-primary);
  `;

  const buttonGroup = doc.createElement('div');
  buttonGroup.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

  const submitBtn = doc.createElement('button');
  submitBtn.textContent = '发送';
  submitBtn.style.cssText = `
    padding: 4px 12px;
    background: var(--accent-blue);
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  `;
  submitBtn.addEventListener('click', async () => {
    const content = textarea.value.trim();
    if (!content) return;

    try {
      await onSubmit(content);
      textarea.value = '';
    } catch (error) {
      console.error('Reply failed:', error);
    }
  });

  const cancelBtn = doc.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = `
    padding: 4px 12px;
    background: var(--fill-tertiary);
    color: var(--fill-primary);
    border: 1px solid var(--fill-quinary);
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  `;
  cancelBtn.addEventListener('click', onCancel);

  buttonGroup.appendChild(cancelBtn);
  buttonGroup.appendChild(submitBtn);
  container.appendChild(textarea);
  container.appendChild(buttonGroup);

  return container;
}
