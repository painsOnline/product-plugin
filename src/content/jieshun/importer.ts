/**
 * 文件名称：importer.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 街顺商品导入工具，负责按钮注入、数据获取和 DOM 填充（SRP）。
 */
import { getUserId } from '@/shared/auth';
import { apiGet } from '@/content/utils/api';
import { API_PATHS } from '@/shared/constants';
import { has1688Input, get1688ProductId } from './detector';
import { openChatDialog, openChatDialogWithData } from './chat-ui';

/** 填充商品名称到街顺输入框 */
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

/** 导入商品数据（调用后端 API + 打开对话窗口） */
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
      if (confirm(
        `商品未找到: ${result.msg}\n请先到 ${extFrom} 上抓取此商品。\n\n点击"确定"跳转到${extFrom}`
      )) {
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

    alert(
      `商品数据已加载\n标题: ${productName}\n属性数量: ${Object.keys(attrs).length}`
    );
  } catch (e) {
    alert(`导入失败: ${e}`);
  }
}

/** 处理一键导入按钮点击 */
export async function handleImportClick(is1688: boolean): Promise<void> {
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

/** 注入一键导入按钮到页面 */
export function injectImportButton(): void {
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
