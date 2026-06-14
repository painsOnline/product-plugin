/**
 * 文件名称：jieshun.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 街顺商品编辑页 Content Script
 *
 * 功能：
 * - 检测街顺商品编辑页 URL
 * - 判断用户是否绑定了1688账号并填写了1688商品ID
 * - 显示"一键导入1688商品数据" 或 "一键导入taobao商品数据"按钮
 * - 调用后端 API 获取商品数据
 * - 自动填充商品名称、属性、上传图片
 * - WebSocket 连接进行 LLM 对话
 * - Tab 冲突检测
 */
import { extract1688ProductId } from '@/shared/utils';
import { createModal, createButton } from '@/content/utils/dom';
import { apiGet } from '@/content/utils/api';
import { API_PATHS, STORAGE_KEYS, WS_BASE_URL } from '@/shared/constants';

let wsConnection: WebSocket | null = null;

/** 检测1688输入框是否已填写（完整判断） */
function has1688Input(): boolean {
  // 1. 检查 class="input1688" 的 div 中 input 是否有值
  const input1688 = document.querySelector('.input1688 input');
  if (!input1688) return false;
  const value = (input1688 as HTMLInputElement).value;
  if (value.trim().length === 0) return false;

  // 2. 检查是否存在 span 内容为"商品名称"
  const spanElements = document.querySelectorAll('span');
  let hasProductName = false;
  spanElements.forEach((span) => {
    if (span.textContent?.trim() === '商品名称') {
      hasProductName = true;
    }
  });
  if (!hasProductName) return false;

  // 3. 检查"建议命名形式为..."上方 input 是否有名称
  const hintSpans = document.querySelectorAll('span');
  hintSpans.forEach((span) => {
    const text = span.textContent || '';
    if (text.includes('建议命名形式为')) {
      const parentDiv = span.closest('.flexColumn, div');
      if (parentDiv) {
        const nameInput = parentDiv.querySelector('input.el-input__inner');
        if (nameInput && (nameInput as HTMLInputElement).value.trim().length > 0) {
          hasProductName = true;
        }
      }
    }
  });

  return hasProductName;
}

/** 获取1688商品ID */
function get1688ProductId(): string | null {
  const input = document.querySelector('.input1688 input') as HTMLInputElement;
  if (!input) return null;
  const value = input.value;
  return extract1688ProductId(value) || value;
}

/** 填充商品名称 */
function fillProductName(name: string): void {
  const inputs = document.querySelectorAll('input.el-input__inner[type="text"]');
  for (const input of inputs) {
    const el = input as HTMLInputElement;
    if (el.maxLength === 45 && !el.readOnly) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, 'value'
      )?.set;
      nativeInputValueSetter?.call(el, name);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }
}

/** 显示一键导入按钮 */
function injectImportButton(): void {
  const existing = document.getElementById('product-plugin-import-btn');
  if (existing) return;

  const container = document.createElement('div');
  container.id = 'product-plugin-import-container';
  container.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 99999;
  `;

  const is1688 = has1688Input();
  const btnText = is1688 ? '一键导入1688商品数据' : '一键导入taobao商品数据';

  const btn = document.createElement('button');
  btn.id = 'product-plugin-import-btn';
  btn.style.cssText = `
    background: #ff6b00; color: #fff; border: none; padding: 12px 24px;
    border-radius: 6px; cursor: pointer; font-size: 15px; font-weight: bold;
    box-shadow: 0 2px 12px rgba(255,107,0,0.4);
  `;
  btn.textContent = btnText;

  btn.addEventListener('click', () => handleImportClick(is1688));
  container.appendChild(btn);

  const chatBtn = document.createElement('button');
  chatBtn.id = 'product-plugin-chat-btn';
  chatBtn.style.cssText = `
    background: #409eff; color: #fff; border: none; padding: 12px 24px;
    border-radius: 6px; cursor: pointer; font-size: 15px; font-weight: bold;
    box-shadow: 0 2px 12px rgba(64,158,255,0.4); margin-left: 10px;
  `;
  chatBtn.textContent = '信息匹配需要调整';
  chatBtn.addEventListener('click', () => openChatDialog());

  container.appendChild(chatBtn);
  document.body.appendChild(container);
}

/** 处理一键导入点击 */
async function handleImportClick(is1688: boolean): Promise<void> {
  if (is1688) {
    const productId = get1688ProductId();
    if (!productId) {
      alert('未检测到 1688 商品 ID');
      return;
    }
    await importProduct('1688', productId);
  } else {
    const productId = prompt('请输入淘宝商品 ID：');
    if (!productId) return;
    await importProduct('taobao', productId);
  }
}

/** 导入商品数据 */
async function importProduct(extFrom: string, extProductId: string): Promise<void> {
  try {
    const result = await apiGet(API_PATHS.PRODUCT_GET, {
      ext_from: extFrom,
      ext_product_id: extProductId,
    });

    if (result.code !== '200' || !result.result) {
      const extUrl = extFrom === '1688'
        ? 'https://detail.1688.com/'
        : 'https://www.taobao.com/';
      if (confirm(`商品未找到: ${result.msg}\n请先到 ${extFrom} 上抓取此商品。\n\n点击"确定"跳转到${extFrom}`)) {
        window.open(extUrl, '_blank');
      }
      return;
    }

    const product = result.result as Record<string, unknown>;
    const productName = (product.ext_product_name as string) || '';
    const attrs = (product.attrs as Record<string, string>) || {};

    fillProductName(productName);

    const threadId = `${await getUserId()}_${extProductId}`;
    openChatDialogWithData(productName, attrs, extFrom, extProductId, threadId);

    alert(`商品数据已加载\n标题: ${productName}\n属性数量: ${Object.keys(attrs).length}`);
  } catch (e) {
    alert(`导入失败: ${e}`);
  }
}

/** 获取当前用户ID */
async function getUserId(): Promise<string> {
  const result = await chrome.storage.local.get(['auth_token']);
  if (!result.auth_token) return 'anonymous';
  try {
    const parts = (result.auth_token as string).split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return payload.sub || 'anonymous';
    }
  } catch { /* fall through */ }
  return 'anonymous';
}

/** 打开 LLM 对话窗口 */
function openChatDialog(): void {
  openChatDialogWithData('', {}, '', '', '');
}

/** 打开带数据的 LLM 对话窗口 */
function openChatDialogWithData(
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
    if (e.key === 'Enter') {
      sendBtn.click();
    }
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

/** 发送聊天消息 */
function sendChatMessage(
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

/** 添加消息到对话区域 */
function addMessage(area: HTMLElement, role: string, content: string): void {
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

/** 连接 WebSocket */
function connectWebSocket(
  threadId: string,
  userContent: string,
  title: string,
  attrs: Record<string, string>,
  messageArea: HTMLElement,
): void {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.close();
  }

  const wsUrl = `${WS_BASE_URL}/agent/chat`;
  wsConnection = new WebSocket(wsUrl);

  wsConnection.onopen = async () => {
    const storage = await chrome.storage.local.get(['auth_token']);
    const msg = {
      type: 'chat',
      thread_id: threadId,
      import_product_id: '',
      user_id: await getUserId(),
      user_content: userContent,
      operate_type: 'both',
      origin_title: title,
      origin_attrs: Object.entries(attrs).map(([k, v]) => ({
        source_name: k,
        source_value: v,
      })),
    };
    wsConnection?.send(JSON.stringify(msg));
  };

  wsConnection.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'stream') {
        addMessage(messageArea, 'assistant', msg.content);
      } else if (msg.type === 'final') {
        addMessage(messageArea, 'assistant', `推荐标题: ${msg.data.new_title}\n属性映射: ${msg.data.attr_mapping?.length || 0} 条`);
      } else if (msg.type === 'error') {
        addMessage(messageArea, 'system', `错误: ${msg.msg}`);
      }
    } catch {
      /* ignore parse errors */
    }
  };

  wsConnection.onerror = () => {
    addMessage(messageArea, 'system', '连接失败，请重试');
  };
}

/** Tab 冲突检测：同一商品不能多标签页操作 */
async function checkTabConflict(threadId: string): Promise<boolean> {
  const currentUrl = window.location.href;
  if (!currentUrl.includes('product_update')) return false;

  const result = await chrome.storage.local.get([STORAGE_KEYS.ACTIVE_THREAD_ID]);
  const activeId = result[STORAGE_KEYS.ACTIVE_THREAD_ID] as string | undefined;
  if (activeId && activeId === threadId) {
    alert('您已在其他页面编辑同一商品，不能多处同时上传商品。');
    return true;
  }
  return false;
}

/** 注册当前标签页的 thread_id */
async function registerActiveThread(threadId: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_THREAD_ID]: threadId });
}

/** 清理当前标签页的 thread_id */
async function unregisterActiveThread(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.ACTIVE_THREAD_ID]);
}

// 页面关闭/刷新时自动清理
window.addEventListener('beforeunload', () => {
  chrome.storage.local.remove([STORAGE_KEYS.ACTIVE_THREAD_ID]);
});

/** 初始化 */
async function initJieshun(): Promise<void> {
  const currentUrl = window.location.href;
  if (!currentUrl.includes('s.waisongbang.com')) return;

  const isEditPage = currentUrl.includes('product_update');
  if (!isEditPage) return;

  const hasConflict = await checkTabConflict();
  if (hasConflict) return;

  setTimeout(() => {
    injectImportButton();
  }, 2000);
}

initJieshun();
