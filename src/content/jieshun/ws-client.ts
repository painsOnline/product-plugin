/**
 * 文件名称：ws-client.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 街顺页面 WebSocket 客户端，格式化渲染后端推送的各类消息.
 */
import { getAuthHeaders, getUserId } from '@/shared/auth';
import { WS_BASE_URL, WS_CONFIG } from '@/shared/constants';
import type { TargetAttr, ManualData, FinalData } from '@/shared/types';
import { fillProductName, showAutoMatchResultPanel, getCachedOriginalAttrs } from './importer';
import { matchAttributes } from './attribute-matcher';
import type { AttrMapping } from './attribute-matcher';

let wsConnection: WebSocket | null = null;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _reconnectAttempts = 0;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _lastFinalData: FinalData | null = null;

/** 格式化时间戳 */
function ts(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/** 解析 stream 文本，提取可读信息 */
function formatStreamContent(raw: string): string {
  const text = raw.trim();
  if (!text) return '';

  // 跳过 handoff 相关文本
  if (text.includes('Transferring back to') || text.includes('Successfully transferred')) {
    return '';
  }

  // todo list 格式化
  if (text.startsWith('Updated todo list to')) {
    try {
      const jsonStr = text.replace('Updated todo list to ', '').trim();
      const items = JSON.parse(jsonStr) as Array<{ content: string; status: string }>;
      return items.map((item) => {
        const icon = item.status === 'completed' ? 'OK' :
          item.status === 'in_progress' ? '>>' : '--';
        return `  ${icon} ${item.content}`;
      }).join('\n');
    } catch { /* fall through */ }
  }

  // 尝试解析 JSON，提取可读字段
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      if (typeof obj !== 'object' || obj === null) return text;

      // 标题优化结果
      if (obj.new_title) {
        const parts = [`推荐标题: ${obj.new_title}`];
        if (obj.title_note) parts.push(`说明: ${obj.title_note}`);
        return parts.join('\n');
      }
      // 属性匹配结果
      if (obj.attr_mapping) {
        const count = Array.isArray(obj.attr_mapping) ? obj.attr_mapping.length : 0;
        return `属性匹配: ${count} 条`;
      }
      // 通用 content 字段
      if (obj.content) return String(obj.content);
      // 回复 — 由 respond 消息统一展示，stream 阶段不重复显示
      if (obj.reply) return '';

      return text;
    } catch {
      return text;
    }
  }
  return text;
}

/** 创建消息 DOM */
export function addMessage(
  area: HTMLElement,
  role: 'user' | 'assistant' | 'system',
  content: string,
  extra: string = '',
): void {
  const msg = document.createElement('div');
  msg.style.cssText = `
    margin-bottom: 6px; padding: 6px 10px; border-radius: 6px;
    max-width: 85%; font-size: 13px; word-wrap: break-word;
    line-height: 1.5;
  `;

  if (role === 'user') {
    msg.style.background = '#e3f2fd';
  } else if (role === 'assistant') {
    msg.style.background = '#e8f5e9';
  } else {
    msg.style.background = '#fff3e0';
    msg.style.maxWidth = '100%';
  }

  const timeEl = document.createElement('div');
  timeEl.style.cssText = 'font-size: 11px; color: #999; margin-bottom: 2px;';
  timeEl.textContent = ts();

  msg.appendChild(timeEl);
  if (extra) {
    const extraEl = document.createElement('div');
    extraEl.style.cssText = 'font-size: 11px; color: #666; margin-bottom: 2px;';
    extraEl.textContent = extra;
    msg.appendChild(extraEl);
  }
  const body = document.createElement('div');
  body.textContent = content;
  body.style.whiteSpace = 'pre-wrap';
  msg.appendChild(body);

  area.appendChild(msg);
  area.scrollTop = area.scrollHeight;
}

/** 清理连接 */
function cleanup(): void {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (wsConnection) {
    wsConnection.onclose = null;
    wsConnection.onerror = null;
    wsConnection.onmessage = null;
    wsConnection.close();
    wsConnection = null;
  }
}

/** 建立 WebSocket 连接 */
async function connectWebSocket(
  threadId: string,
  importProductId: string,
  userContent: string,
  targetAttrs: TargetAttr[],
  messageArea: HTMLElement,
  manualData?: ManualData,
): Promise<void> {
  cleanup();

  const authHeaders = await getAuthHeaders();
  const token = authHeaders['Authorization']?.replace('Bearer ', '') || '';
  const tenantCode = authHeaders['Tenant'] || '';

  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (tenantCode) params.set('tenant', tenantCode);

  const wsUrl = `${WS_BASE_URL}/agent/chat?${params.toString()}`;
  wsConnection = new WebSocket(wsUrl);

  wsConnection.onopen = async () => {
    _reconnectAttempts = 0;
    // 重连不重置 _historyShown，历史只在首次连接时展示一次
    const userId = await getUserId();

    const chatPayload: Record<string, unknown> = {
      type: 'chat',
      thread_id: threadId,
      import_product_id: importProductId,
      user_id: userId,
      user_content: userContent,
      operate_type: 'both',
      target_attrs: targetAttrs,
    };
    if (manualData) {
      chatPayload['manual_data'] = manualData;
    }
    wsConnection?.send(JSON.stringify(chatPayload));

    _heartbeatTimer = setInterval(() => {
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
          type: 'heartbeat',
          time: new Date().toISOString(),
        }));
      }
    }, WS_CONFIG.HEARTBEAT_INTERVAL);
  };

  wsConnection.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'step':
          // 内部进度跟踪，不展示到聊天窗口
          break;
        case 'stream':
          addMessage(messageArea, 'assistant', formatStreamContent(data.content));
          break;
        case 'respond': {
          const d = data.data || {};
          const reply = d.reply || '';
          if (reply) {
            const isRejected = d.is_rejected === true;
            const msg = document.createElement('div');
            msg.style.cssText = `
              margin-bottom: 6px; padding: 6px 10px; border-radius: 6px;
              max-width: 85%; font-size: 13px; word-wrap: break-word; line-height: 1.5;
              background: ${isRejected ? '#fdf6ec' : '#e8f5e9'};
              ${isRejected ? 'border-left: 3px solid #f56c6c;' : ''}
            `;
            const timeEl = document.createElement('div');
            timeEl.style.cssText = 'font-size: 11px; color: #999; margin-bottom: 2px;';
            timeEl.textContent = ts();
            const body = document.createElement('div');
            body.style.whiteSpace = 'pre-wrap';
            if (isRejected) {
              const xSpan = document.createElement('span');
              xSpan.style.cssText = 'color:#f56c6c;font-weight:bold;font-size:16px;margin-right:6px;';
              xSpan.textContent = '✗';
              body.appendChild(xSpan);
              body.appendChild(document.createTextNode(reply));
            } else {
              body.textContent = reply;
            }
            msg.appendChild(timeEl);
            msg.appendChild(body);
            messageArea.appendChild(msg);
            messageArea.scrollTop = messageArea.scrollHeight;
          }
          break;
        }
        case 'final': {
          const d = data.data || {};
          _lastFinalData = d as FinalData;
          const items = [
            `推荐标题: ${d.new_title || '(无)'}`,
            `标题备注: ${d.title_note || '(无)'}`,
            `属性映射: ${d.attr_mapping?.length || 0} 条`,
          ];
          if (d.warning?.has_warn) {
            items.push(`警告: ${d.warning.warn_content}`);
          }
          if (d.suggestion?.summary) {
            items.push(`建议: ${d.suggestion.summary}`);
          }
          addMessage(messageArea, 'assistant', items.join('\n'), '最终结果');
          break;
        }
        case 'error':
          addMessage(messageArea, 'system', data.msg, `错误码: ${data.code || '-'}`);
          break;
        case 'confirm': {
          if (data.data) {
            _lastFinalData = data.data as FinalData;
          }
          const confirmMsg = document.createElement('div');
          confirmMsg.style.cssText = `
            margin-bottom: 6px; padding: 8px 10px; border-radius: 6px;
            background: #fff3e0; font-size: 13px; line-height: 1.5;
          `;
          const timeEl = document.createElement('div');
          timeEl.style.cssText = 'font-size: 11px; color: #999; margin-bottom: 4px;';
          timeEl.textContent = ts();
          const textEl = document.createElement('div');
          textEl.textContent = data.content || '是否应用本次修改？';
          textEl.style.marginBottom = '8px';
          const btnRow = document.createElement('div');
          btnRow.style.cssText = 'display: flex; gap: 10px;';

          const confirmBtn = document.createElement('button');
          confirmBtn.textContent = '确认修改';
          confirmBtn.style.cssText = `
            padding: 6px 18px; background: #409eff; color: #fff;
            border: none; border-radius: 4px; cursor: pointer; font-size: 13px;
          `;
          confirmBtn.addEventListener('click', async () => {
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;
            confirmBtn.textContent = '正在应用...';

            const data = _lastFinalData;
            if (data) {
              // 应用标题
              if (data.new_title) {
                fillProductName(data.new_title);
              }
              // 应用属性匹配
              let attrResults: { attrName: string; success: boolean; reason?: string }[] | undefined;
              if (data.attr_mapping?.length) {
                attrResults = await matchAttributes(data.attr_mapping as AttrMapping[]);
              }
              // 格式化展示结果
              showAutoMatchResultPanel({
                originalTitle: data.original_title || '',
                newTitle: data.new_title || '',
                titleNote: data.title_note || '',
                originalAttrs: getCachedOriginalAttrs(),
                attrResults,
                attrMapping: data.attr_mapping as AttrMapping[],
                suggestion: data.suggestion as any,
                warning: data.warning as any,
              });
              addMessage(messageArea, 'system', '修改已应用');
            }

            wsConnection?.send(JSON.stringify({
              type: 'confirm_reply',
              operate_result: 'confirm',
              payload: data,
            }));
            confirmBtn.textContent = '已应用';
            confirmBtn.style.opacity = '0.6';
            cancelBtn.style.opacity = '0.6';
          });

          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = '取消修改';
          cancelBtn.style.cssText = `
            padding: 6px 18px; background: #999; color: #fff;
            border: none; border-radius: 4px; cursor: pointer; font-size: 13px;
          `;
          cancelBtn.addEventListener('click', () => {
            wsConnection?.send(JSON.stringify({
              type: 'confirm_reply',
              operate_result: 'cancel',
              payload: _lastFinalData,
            }));
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;
            cancelBtn.textContent = '已取消';
            confirmBtn.style.opacity = '0.6';
            cancelBtn.style.opacity = '0.6';
          });

          btnRow.appendChild(confirmBtn);
          btnRow.appendChild(cancelBtn);
          confirmMsg.appendChild(timeEl);
          confirmMsg.appendChild(textEl);
          confirmMsg.appendChild(btnRow);
          messageArea.appendChild(confirmMsg);
          messageArea.scrollTop = messageArea.scrollHeight;
          break;
        }
        case 'heartbeat':
          break;
      }
    } catch { /* ignore */ }
  };

  wsConnection.onerror = () => {
    addMessage(messageArea, 'system', '连接失败，请重试');
  };

  wsConnection.onclose = (event) => {
    if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
    if (!event.wasClean && _reconnectAttempts < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      const delay = WS_CONFIG.RECONNECT_DELAYS[
        Math.min(_reconnectAttempts, WS_CONFIG.RECONNECT_DELAYS.length - 1)
      ];
      _reconnectAttempts++;
      addMessage(messageArea, 'system',
        `连接断开，${delay / 1000}s 后自动重连 (${_reconnectAttempts}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`
      );
      _reconnectTimer = setTimeout(() => {
        connectWebSocket(threadId, importProductId, userContent, targetAttrs, messageArea, manualData);
      }, delay);
    } else if (_reconnectAttempts >= WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      addMessage(messageArea, 'system', '重连失败，请刷新页面重试');
    }
  };
}

export function sendChatMessage(
  threadId: string,
  importProductId: string,
  userContent: string,
  targetAttrs: TargetAttr[],
  messageArea: HTMLElement,
  manualData?: ManualData,
): void {
  addMessage(messageArea, 'user', userContent);
  if (!threadId) {
    addMessage(messageArea, 'assistant', '请先导入商品数据后再使用对话功能。');
    return;
  }
  connectWebSocket(threadId, importProductId, userContent, targetAttrs, messageArea, manualData);
}
