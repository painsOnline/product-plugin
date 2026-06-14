/**
 * 文件名称：dom.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * DOM 操作工具函数
 */

/** 等待元素出现 */
export function waitForElement(
  selector: string,
  timeout: number = 10000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/** 创建固定顶部栏 */
export function createTopBar(platform: string): HTMLElement {
  const existing = document.getElementById('product-plugin-topbar');
  if (existing) return existing;

  const bar = document.createElement('div');
  bar.id = 'product-plugin-topbar';
  bar.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #fff0e6; border-bottom: 2px solid #ff6b00;
    padding: 10px 20px; display: flex; align-items: center;
    justify-content: space-between; font-family: sans-serif;
  `;

  const text = document.createElement('span');
  text.style.cssText = 'color: #333; font-size: 14px;';
  text.textContent = `系统识别到您已进入到 ${platform} 平台商品详情页，可以点击右方按钮抓取商品详细数据`;

  const btn = document.createElement('button');
  btn.id = 'product-plugin-grab-btn';
  btn.style.cssText = `
    background: #ff6b00; color: #fff; border: none; padding: 8px 20px;
    border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;
  `;
  btn.textContent = '一键抓取商品数据';

  bar.appendChild(text);
  bar.appendChild(btn);

  // 优先插入到平台预留的 #chromePlugin 容器中，兼容 1688 规范
  const chromePlugin = document.getElementById('chromePlugin');
  if (chromePlugin) {
    chromePlugin.insertBefore(bar, chromePlugin.firstChild);
  } else {
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.style.marginTop = '50px';
  }

  return bar;
}

/** 创建模态弹窗 */
export function createModal(title: string, content: HTMLElement): { modal: HTMLElement; close: () => void } {
  const overlay = document.createElement('div');
  overlay.id = 'product-plugin-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    z-index: 100000; display: flex; align-items: center;
    justify-content: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #fff; border-radius: 8px; padding: 24px;
    max-width: 700px; max-height: 80vh; width: 90%;
    overflow-y: auto; box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 12px;
  `;

  const titleEl = document.createElement('h3');
  titleEl.style.cssText = 'margin: 0; font-size: 18px;';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none; border: none; font-size: 24px; cursor: pointer;
    color: #999;
  `;

  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);

  const close = () => overlay.remove();
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
  return { modal, close };
}

/** 创建按钮 */
export function createButton(
  text: string,
  onClick: () => void,
  style: Partial<CSSStyleDeclaration> = {}
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = `
    padding: 8px 20px; border-radius: 4px; cursor: pointer;
    font-size: 14px; border: none;
  `;
  Object.assign(btn.style, style);
  btn.addEventListener('click', onClick);
  return btn;
}
