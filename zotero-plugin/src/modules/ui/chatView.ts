/**
 * 实时聊天视图
 * 显示当前会话的聊天消息
 */

import { logger } from "../../utils/logger";
import type { BaseViewContext } from "./types";
import { ReadingSessionManager } from "../readingSessionManager";
import { SessionLogManager } from "../sessionLogManager";
import { formatDate } from "./helpers";
import { containerPadding } from "./styles";

export class ChatView {
  private sessionManager = ReadingSessionManager.getInstance();
  private logManager = SessionLogManager.getInstance();
  private chatPollingInterval: any = null;
  private lastMessageId: string | null = null;

  constructor(private readonly context: BaseViewContext) {
    logger.log("[ChatView] 💬 Initializing...");
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
      this.chatPollingInterval = null;
    }
  }

  /**
   * 渲染聊天视图
   */
  public async render(container: HTMLElement): Promise<void> {
    try {
      logger.log("[ChatView] 🎨 Rendering chat view...");
      
      const session = this.sessionManager.getCurrentSession();
      if (!session) {
        container.innerHTML = '<div style="padding: 32px; text-align: center; color: #666;">未找到当前会话</div>';
        return;
      }

      const doc = container.ownerDocument;
      container.innerHTML = '';
      
      // 直接使用container渲染聊天窗口
      await this.renderChatWindow(container, doc, session.id);
      
      logger.log("[ChatView] ✅ Chat view rendered");
    } catch (error) {
      logger.error("[ChatView] Error rendering:", error);
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <div>❌ 加载失败</div>
          <div style="font-size: 12px; margin-top: 8px;">${
            error instanceof Error ? error.message : '未知错误'
          }</div>
        </div>
      `;
    }
  }

  /**
   * 渲染聊天窗口
   */
  private async renderChatWindow(container: HTMLElement, doc: Document, sessionId: string): Promise<void> {
    logger.log('[ChatView] 💬 Rendering chat window...');
    
    // 强制设置container样式,避免溢出
    container.style.cssText = `
      display: block;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      height: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      overflow-y: auto;
      background: white;
    `;
    
    // 聊天标题
    const chatHeader = doc.createElement('div');
    chatHeader.style.cssText = `
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      font-size: 15px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      word-break: break-word;
    `;
    chatHeader.textContent = '💬 实时聊天';
    container.appendChild(chatHeader);

    // 消息列表容器
    const messageList = doc.createElement('div');
    messageList.id = `chat-messages-${sessionId}`;
    messageList.style.cssText = `
      min-height: 300px;
      max-height: 400px;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px;
      background: #f8f9fa;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;
    container.appendChild(messageList);

    // 先显示空状态,让用户可以立即发送消息
    const emptyPlaceholder = doc.createElement('div');
    emptyPlaceholder.style.cssText = `
      padding: 40px;
      text-align: center;
      color: #6b7280;
      width: 100%;
      box-sizing: border-box;
    `;
    emptyPlaceholder.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
      <div style="font-size: 14px;">加载中...</div>
    `;
    messageList.appendChild(emptyPlaceholder);

    // 异步加载现有消息(不阻塞UI)
    this.loadChatMessages(messageList, doc, sessionId).catch(error => {
      logger.warn('[ChatView] Failed to load chat messages:', error);
      // 失败也没关系,用户依然可以发送新消息
    });

    // 输入区域
    const inputArea = doc.createElement('div');
    inputArea.style.cssText = `
      padding: 12px;
      background: white;
      border-top: 1px solid #e9ecef;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    `;

    // 表情选择器(简化版,使用inline-block避免flex可能的问题)
    const emojiPicker = doc.createElement('div');
    emojiPicker.style.cssText = `
      margin-bottom: 8px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    `;
    const emojis = ['😊', '👍', '❤️', '🎉'];
    const textarea = doc.createElement('textarea') as HTMLTextAreaElement;
    
    for (const emoji of emojis) {
      const emojiBtn = doc.createElement('button');
      emojiBtn.textContent = emoji;
      emojiBtn.style.cssText = `
        width: 28px;
        height: 28px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
        margin-right: 6px;
        display: inline-block;
      `;
      emojiBtn.addEventListener('mouseenter', () => {
        emojiBtn.style.background = '#f0f0f0';
        emojiBtn.style.transform = 'scale(1.1)';
      });
      emojiBtn.addEventListener('mouseleave', () => {
        emojiBtn.style.background = 'white';
        emojiBtn.style.transform = 'scale(1)';
      });
      emojiBtn.addEventListener('click', () => {
        textarea.value += emoji;
        textarea.focus();
      });
      emojiPicker.appendChild(emojiBtn);
    }
    inputArea.appendChild(emojiPicker);

    // 输入框(独立一行)
    textarea.placeholder = '输入消息...';
    textarea.style.cssText = `
      width: 100%;
      max-width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      resize: none;
      font-size: 14px;
      font-family: inherit;
      height: 60px;
      box-sizing: border-box;
      margin-bottom: 8px;
    `;
    inputArea.appendChild(textarea);

    // 发送按钮(独立一行,避免flex导致的宽度问题)
    const sendButton = doc.createElement('button');
    sendButton.textContent = '📤 发送';
    sendButton.style.cssText = `
      width: 100%;
      max-width: 100%;
      padding: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      box-sizing: border-box;
    `;
    sendButton.addEventListener('mouseenter', () => {
      sendButton.style.transform = 'translateY(-2px)';
    });
    sendButton.addEventListener('mouseleave', () => {
      sendButton.style.transform = 'translateY(0)';
    });
    sendButton.addEventListener('click', async () => {
      await this.handleSendMessage(sessionId, textarea, messageList, doc);
    });
    inputArea.appendChild(sendButton);

    container.appendChild(inputArea);

    // 启动轮询机制
    this.startChatPolling(sessionId, messageList, doc);
  }

  /**
   * 加载聊天消息
   */
  private async loadChatMessages(container: HTMLElement, doc: Document, sessionId: string): Promise<void> {
    try {
      logger.log('[ChatView] 📨 Loading chat messages...');
      
      container.innerHTML = '';
      
      const messages = await this.logManager.getChatMessages(sessionId, 1, 50);
      
      logger.log(`[ChatView] 📊 loadChatMessages received ${messages.length} messages`);
      
      if (messages.length === 0) {
        const placeholder = doc.createElement('div');
        placeholder.style.cssText = `
          padding: 40px;
          text-align: center;
          color: #6b7280;
          width: 100%;
          box-sizing: border-box;
        `;
        placeholder.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
          <div style="font-size: 14px;">暂无聊天消息</div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">发送第一条消息开始对话吧!</div>
        `;
        container.appendChild(placeholder);
      } else {
        for (const message of messages) {
          const msgElement = this.createMessageElement(doc, message);
          container.appendChild(msgElement);
        }
        // 只在第一次加载时设置lastMessageId，避免重新加载时覆盖
        if (!this.lastMessageId && messages.length > 0) {
          this.lastMessageId = messages[messages.length - 1].id;
        }
        container.scrollTop = container.scrollHeight;
      }
      
      logger.log('[ChatView] ✅ Chat messages loaded');
    } catch (error) {
      logger.error('[ChatView] Error loading chat messages:', error);
      throw error;
    }
  }

  /**
   * 创建消息元素
   */
  private createMessageElement(doc: Document, message: any): HTMLElement {
    const msgDiv = doc.createElement('div');
    msgDiv.setAttribute('data-message-id', message.id || '');
    msgDiv.style.cssText = `
      background: white;
      padding: 10px 12px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow: hidden;
      margin-bottom: 12px;
    `;

    // 用户名和时间(简化布局,避免flex)
    const userName = doc.createElement('strong');
    userName.textContent = message.user_name || '未知用户';
    userName.style.cssText = `
      color: #667eea;
      font-size: 13px;
      margin-right: 8px;
      word-break: break-word;
    `;
    msgDiv.appendChild(userName);

    const time = doc.createElement('span');
    time.textContent = formatDate(message.created_at);
    time.style.cssText = `
      color: #999;
      font-size: 11px;
      word-break: break-word;
    `;
    msgDiv.appendChild(time);

    // 消息内容
    const content = doc.createElement('div');
    content.textContent = message.message;
    content.style.cssText = `
      color: #333;
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      margin-top: 6px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;
    msgDiv.appendChild(content);

    return msgDiv;
  }

  /**
   * 发送消息
   */
  private async handleSendMessage(
    sessionId: string,
    textarea: HTMLTextAreaElement,
    messageList: HTMLElement,
    doc: Document
  ): Promise<void> {
    const message = textarea.value.trim();
    if (!message) {
      return;
    }

    try {
      logger.log('[ChatView] 📤 Sending message...');
      const newMessage = await this.logManager.sendChatMessage(sessionId, message);
      textarea.value = '';
      
      // 直接将新消息添加到列表末尾，避免重新加载导致的延迟
      if (newMessage && newMessage.id) {
        const msgElement = this.createMessageElement(doc, newMessage);
        messageList.appendChild(msgElement);
        messageList.scrollTop = messageList.scrollHeight;
        this.lastMessageId = newMessage.id;
        logger.log('[ChatView] ✅ Message sent and displayed');
        
        // 重置轮询计时器，避免立即轮询导致找不到消息
        this.startChatPolling(sessionId, messageList, doc);
      } else {
        // 如果没有返回消息ID，则重新加载
        messageList.innerHTML = '';
        await this.loadChatMessages(messageList, doc, sessionId);
        logger.log('[ChatView] ✅ Message sent (reloaded)');
      }
    } catch (error) {
      logger.error('[ChatView] Error sending message:', error);
      this.context.showMessage('发送消息失败', 'error');
    }
  }

  /**
   * 启动聊天轮询
   */
  private startChatPolling(sessionId: string, messageList: HTMLElement, doc: Document): void {
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
    }

    this.chatPollingInterval = setInterval(async () => {
      try {
        logger.log('[ChatView] 🔄 Polling for new messages...');
        const messages = await this.logManager.getChatMessages(sessionId, 1, 50);
        
        logger.log(`[ChatView] 📊 Got ${messages.length} messages, lastMessageId=${this.lastMessageId}`);
        logger.log(`[ChatView] 📊 Message IDs: ${messages.map((m: any) => m.id).join(', ')}`);
        
        if (messages.length === 0) {
          logger.log('[ChatView] ⚠️ No messages returned, skipping');
          return;
        }
        
        // 检查是否有新消息（比较最新消息ID）
        const latestMessage = messages[messages.length - 1];
        logger.log(`[ChatView] 📊 Latest message ID: ${latestMessage.id}`);
        
        if (!this.lastMessageId) {
          logger.log('[ChatView] ⚠️ No lastMessageId set, skipping first poll');
          this.lastMessageId = latestMessage.id;
          return;
        }
        
        if (latestMessage.id === this.lastMessageId) {
          logger.log('[ChatView] ✅ No new messages');
          return;
        }
        
        // 找出所有比lastMessageId更新的消息
        const lastIndex = messages.findIndex((m: any) => m.id === this.lastMessageId);
        logger.log(`[ChatView] 📊 Last message index: ${lastIndex}, searching for: ${this.lastMessageId}`);
        
        if (lastIndex === -1) {
          // 找不到上次的消息ID，可能是消息太多被分页了，需要重新加载全部
          logger.warn(`[ChatView] ⚠️ Cannot find lastMessageId in ${messages.length} messages, reloading all...`);
          const isScrolledToBottom = messageList.scrollHeight - messageList.scrollTop <= messageList.clientHeight + 50;
          messageList.innerHTML = '';
          await this.loadChatMessages(messageList, doc, sessionId);
          if (isScrolledToBottom) {
            messageList.scrollTop = messageList.scrollHeight;
          }
        } else {
          // 只添加新消息
          const newMessages = messages.slice(lastIndex + 1);
          if (newMessages.length > 0) {
            logger.log(`[ChatView] 🆕 Adding ${newMessages.length} new message(s)...`);
            const isScrolledToBottom = messageList.scrollHeight - messageList.scrollTop <= messageList.clientHeight + 50;
            for (const message of newMessages) {
              const msgElement = this.createMessageElement(doc, message);
              messageList.appendChild(msgElement);
              this.lastMessageId = message.id;
            }
            if (isScrolledToBottom) {
              messageList.scrollTop = messageList.scrollHeight;
            }
          }
        }
      } catch (error) {
        logger.warn('[ChatView] Error polling messages:', error);
      }
    }, 5000); // 从3秒改为5秒,减少API调用频率
  }
}
