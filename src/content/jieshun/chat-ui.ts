/**
 * 文件名称：chat-ui.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 街顺页面内 LLM 对话窗口 UI 构建，打开时先加载历史消息（SRP）。
 */
import { createModal, createButton } from '@/content/utils/dom';
import { apiGet } from '@/content/utils/api';
import { API_PATHS } from '@/shared/constants';
import { getAuthHeaders } from '@/shared/auth';
import { addMessage, sendChatMessage } from './ws-client';
import type { TargetAttr } from '@/shared/types';

interface HistoryItem {
  time: string;
  role: string;
  content: string;
}

/** 通过 REST API 获取历史消息并渲染 */
async function loadAndRenderHistory(
  threadId: string,
  importProductId: string,
  messageArea: HTMLElement,
): Promise<void> {
  if (!threadId || !importProductId) return;
  try {
    const result = await apiGet<{ messages: HistoryItem[] }>(API_PATHS.CHAT_HISTORY, {
      thread_id: threadId,
      import_product_id: importProductId,
    });
    if (result.code !== '200' || !result.result?.messages?.length) return;

    const items = result.result.messages;
    addMessage(messageArea, 'system', `--- 历史对话 (${items.length} 条) ---`);
    for (const item of items) {
      const roleMap: Record<string, 'user' | 'assistant' | 'system'> = {
        user: 'user', assistant: 'assistant', system: 'system', tool: 'system',
      };
      addMessage(messageArea, roleMap[item.role] || 'system', item.content, item.time);
    }
    addMessage(messageArea, 'system', '--- 以上为历史对话 ---');
  } catch {
    // 历史加载失败不影响主流程
  }
}

/** 让弹窗可拖拽（通过标题栏拖动） */
function makeDraggable(panel: HTMLElement): void {
  const header = panel.querySelector('h3') as HTMLElement | null;
  if (!header) return;

  header.style.cursor = 'move';
  header.style.userSelect = 'none';

  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  header.addEventListener('mousedown', (e: Event) => {
    const me = e as MouseEvent;
    if ((me.target as HTMLElement).tagName === 'BUTTON') return;
    dragging = true;
    startX = me.clientX;
    startY = me.clientY;
    // 如果还是 translate 居中状态，先转为像素坐标
    const rect = panel.getBoundingClientRect();
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.transform = '';
    startLeft = rect.left;
    startTop = rect.top;
    panel.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = `${startLeft + dx}px`;
    panel.style.top = `${startTop + dy}px`;
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      panel.style.transition = '';
    }
  });
}

async function isLoggedIn(): Promise<boolean> {
  const headers = await getAuthHeaders();
  return !!(headers['Authorization'] && headers['Tenant']);
}

function triggerLogin(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SHOW_LOGIN_DIALOG' },
      (response) => { resolve(response?.success ?? false); }
    );
  });
}

export async function openChatDialog(): Promise<void> {
  if (!(await isLoggedIn())) {
    const loggedIn = await triggerLogin();
    if (!loggedIn) return;
  }
  openChatDialogWithData('', [], '', '', '', '');
}

export async function openChatDialogWithData(
  title: string,
  targetAttrs: TargetAttr[],
  extFrom: string,
  extProductId: string,
  threadId: string,
  importProductId: string,
): Promise<void> {
  if (title && !(await isLoggedIn())) {
    const loggedIn = await triggerLogin();
    if (!loggedIn) return;
  }

  const content = document.createElement('div');
  content.style.cssText = 'max-height: 70vh; overflow-y: auto; min-width: 600px;';

  const messageArea = document.createElement('div');
  messageArea.id = 'chat-message-area';
  messageArea.style.cssText = `
    height: 400px; overflow-y: auto; border: 1px solid #eee;
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
    sendChatMessage(threadId, importProductId, userContent, targetAttrs, messageArea);
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
  }
  if (targetAttrs.length === 0) {
    addMessage(messageArea, 'system', '注意：未选择渠道类目，仅支持标题编辑。');
  }

  // 首次打开时通过 REST API 加载历史记录
  loadAndRenderHistory(threadId, importProductId, messageArea);

  addMessage(messageArea, 'assistant', '您好！我已准备好帮助您优化商品标题和匹配属性。请告诉我您的要求。');

  const { modal, overlay } = createModal('LLM 对话 - 商品信息调整', content);
  modal.style.maxWidth = '900px';
  modal.style.width = '86%';
  modal.style.position = 'fixed';
  modal.style.cursor = 'default';
  // 初始居中
  modal.style.left = '50%';
  modal.style.top = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.margin = '0';
  // overlay 不做 flex 居中，由 modal 自身定位
  overlay.style.display = 'block';
  overlay.style.alignItems = '';
  overlay.style.justifyContent = '';

  makeDraggable(modal);
}
