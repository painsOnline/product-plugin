/**
 * 文件名称：chat-ui.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 街顺页面内 LLM 对话窗口 UI 构建（SRP）。

 * 纯 DOM 构建，不涉及 WebSocket 连接逻辑。
 */
import { createModal, createButton } from '@/content/utils/dom';
import { addMessage, sendChatMessage } from './ws-client';

/** 打开空的 LLM 对话窗口 */
export function openChatDialog(): void {
  openChatDialogWithData('', {}, '', '', '');
}

/** 打开带商品数据的 LLM 对话窗口 */
export function openChatDialogWithData(
  title: string,
  attrs: Record<string, string>,
  extFrom: string,
  extProductId: string,
  threadId: string,
): void {
  const content = document.createElement('div');
  content.style.cssText = 'max-height: 60vh; overflow-y: auto;';

  const messageArea = document.createElement('div');
  messageArea.id = 'chat-message-area';
  messageArea.style.cssText = `
    height: 300px; overflow-y: auto; border: 1px solid #eee;
    border-radius: 4px; padding: 12px; margin-bottom: 12px;
    background: #fafafa; font-size: 13px;
  `;

  const inputArea = document.createElement('div');
  inputArea.style.cssText = 'display: flex; gap: 8px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '请输入您的要求，例如：精简标题，去掉营销词...';
  input.style.cssText = `
    flex: 1; padding: 8px 12px; border: 1px solid #ddd;
    border-radius: 4px; font-size: 14px;
  `;

  const sendBtn = createButton('发送', () => {
    const userContent = input.value.trim();
    if (!userContent) return;
    sendChatMessage(threadId, userContent, title, attrs, messageArea);
    input.value = '';
  }, { background: '#409eff', color: '#fff' });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendBtn.click();
  });

  inputArea.appendChild(input);
  inputArea.appendChild(sendBtn);
  content.appendChild(messageArea);
  content.appendChild(inputArea);

  if (title) {
    addMessage(messageArea, 'system', `已加载商品: ${title}`);
    addMessage(messageArea, 'system', `属性: ${JSON.stringify(attrs)}`);
    addMessage(messageArea, 'assistant', '您好！我已准备好帮助您优化商品标题和匹配属性。请告诉我您的要求。');
  }

  createModal('LLM 对话 - 商品信息调整', content);
}
