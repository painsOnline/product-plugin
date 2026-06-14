/**
 * 文件名称：ws-client.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 街顺页面 WebSocket 客户端，封装连接、收发、消息渲染（SRP）。
 */
import { getUserId } from '@/shared/auth';
import { WS_BASE_URL } from '@/shared/constants';

let wsConnection: WebSocket | null = null;

/** 添加消息到对话区域 */
export function addMessage(area: HTMLElement, role: string, content: string): void {
  const msg = document.createElement('div');
  msg.style.cssText = `
    margin-bottom: 8px; padding: 6px 10px; border-radius: 6px;
    max-width: 80%; font-size: 13px;
  `;

  if (role === 'user') {
    msg.style.cssText += 'background: #e3f2fd; margin-left: auto;';
  } else if (role === 'assistant') {
    msg.style.cssText += 'background: #e8f5e9;';
  } else {
    msg.style.cssText += 'background: #fff3e0; text-align: center; width: 100%; max-width: 100%;';
  }

  msg.textContent = content;
  area.appendChild(msg);
  area.scrollTop = area.scrollHeight;
}

/** 发送聊天消息（触发 WebSocket 连接） */
export function sendChatMessage(
  threadId: string,
  userContent: string,
  title: string,
  attrs: Record<string, string>,
  messageArea: HTMLElement,
): void {
  addMessage(messageArea, 'user', userContent);

  if (!threadId) {
    addMessage(messageArea, 'assistant', '请先导入商品数据后再使用对话功能。');
    return;
  }

  connectWebSocket(threadId, userContent, title, attrs, messageArea);
}

/** 建立 WebSocket 连接并发送消息 */
async function connectWebSocket(
  threadId: string,
  userContent: string,
  title: string,
  attrs: Record<string, string>,
  messageArea: HTMLElement,
): Promise<void> {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.close();
  }

  const wsUrl = `${WS_BASE_URL}/agent/chat`;
  wsConnection = new WebSocket(wsUrl);

  wsConnection.onopen = async () => {
    const userId = await getUserId();
    wsConnection?.send(JSON.stringify({
      type: 'chat',
      thread_id: threadId,
      import_product_id: '',
      user_id: userId,
      user_content: userContent,
      operate_type: 'both',
      origin_title: title,
      origin_attrs: Object.entries(attrs).map(([k, v]) => ({
        source_name: k,
        source_value: v,
      })),
    }));
  };

  wsConnection.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'stream') {
        addMessage(messageArea, 'assistant', data.content);
      } else if (data.type === 'final') {
        addMessage(
          messageArea, 'assistant',
          `推荐标题: ${data.data.new_title}\n属性映射: ${data.data.attr_mapping?.length || 0} 条`
        );
      } else if (data.type === 'error') {
        addMessage(messageArea, 'system', `错误: ${data.msg}`);
      }
    } catch { /* ignore parse errors */ }
  };

  wsConnection.onerror = () => {
    addMessage(messageArea, 'system', '连接失败，请重试');
  };
}
