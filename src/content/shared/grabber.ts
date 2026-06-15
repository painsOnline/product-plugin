/**
 * 文件名称：grabber.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 共享的商品数据抓取流程模块。
 *
 * 1688.ts 和 taobao.ts 共有的 UI 构建和 API 调用逻辑提取到此文件（DRY）。
 * 各平台只需提供 PlatformExtractors（DOM 提取函数）即可复用完整抓取流程。
 */
import { createTopBar, createModal, createButton } from '@/content/utils/dom';
import { apiPost } from '@/content/utils/api';
import { API_PATHS } from '@/shared/constants';
import type { Platform, ProductSaveResponse } from '@/shared/types';

/** 轻量 toast 通知，3秒后自动消失 */
function showToast(msg: string): void {
  const existing = document.getElementById('product-plugin-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'product-plugin-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
    z-index: 100001; background: #fff3cd; color: #856404;
    border: 1px solid #ffeeba; border-radius: 8px;
    padding: 12px 24px; font-size: 14px; font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: pluginToastIn 0.3s ease;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/** 平台数据提取器接口（OCP：新增平台只需实现此接口） */
export interface PlatformExtractors {
  extractTitle(): string;
  extractAttrs(): Record<string, string[]>;
  extractPictures(): string[];
  extractDetailPictures(): string[];
}

/** 构建商品属性表格 */
function buildAttrTable(attrs: Record<string, string[]>): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'max-height: 200px; overflow-y: auto;';

  const table = document.createElement('table');
  table.style.cssText = `
    width: 100%; border-collapse: collapse; font-size: 13px;
  `;

  const entries = Object.entries(attrs);
  for (let i = 0; i < entries.length; i += 2) {
    const row = document.createElement('tr');

    for (let j = 0; j < 2; j++) {
      const idx = i + j;
      if (idx < entries.length) {
        const [key, values] = entries[idx];
        const th = document.createElement('td');
        th.style.cssText =
          'padding: 4px 8px; background: #f5f5f5; font-weight: bold; width: 25%; border: 1px solid #e8e8e8;';
        th.textContent = key;

        const td = document.createElement('td');
        td.style.cssText =
          'padding: 4px 8px; width: 25%; border: 1px solid #e8e8e8;';
        td.textContent = Array.isArray(values) ? values.join('、') : String(values);

        row.appendChild(th);
        row.appendChild(td);
      }
    }
    table.appendChild(row);
  }
  wrapper.appendChild(table);
  return wrapper;
}

/** 构建商品数据预览内容 */
export function buildPreviewContent(
  title: string,
  attrs: Record<string, string[]>,
  pictures: string[],
  detailPics: string[]
): HTMLElement {
  const container = document.createElement('div');

  const sections: Array<{ label: string; render: () => HTMLElement }> = [
    {
      label: '商品名称',
      render: () => {
        const el = document.createElement('div');
        el.style.cssText = 'font-size: 13px; color: #333; padding: 8px; background: #fafafa; border-radius: 4px;';
        el.textContent = title || '(未获取到)';
        return el;
      },
    },
    {
      label: '商品属性',
      render: () => buildAttrTable(attrs),
    },
    {
      label: '主图/轮播图',
      render: () => {
        const el = document.createElement('div');
        el.style.cssText = 'font-size: 13px; color: #666;';
        el.textContent = `${pictures.length} 张`;
        return el;
      },
    },
    {
      label: '详情图',
      render: () => {
        const el = document.createElement('div');
        el.style.cssText = 'font-size: 13px; color: #666;';
        el.textContent = `${detailPics.length} 张`;
        return el;
      },
    },
  ];

  sections.forEach(({ label, render }) => {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 12px;';

    const labelEl = document.createElement('div');
    labelEl.style.cssText =
      'font-weight: bold; font-size: 14px; color: #333; margin-bottom: 6px;';
    labelEl.textContent = label;

    section.appendChild(labelEl);
    section.appendChild(render());
    container.appendChild(section);
  });

  return container;
}

/** 初始化完整的抓取流程：顶栏 → 按钮 → 预览 → API 调用 */
export function initGrabber(
  platform: Platform,
  productId: string,
  label: string,
  extractors: PlatformExtractors
): void {
  let title = '';
  let attrs: Record<string, string[]> = {};
  let pictures: string[] = [];
  let detailPics: string[] = [];

  const bar = createTopBar(label);
  const btn = bar.querySelector('#product-plugin-grab-btn') as HTMLButtonElement;

  let grabbing = false;

  btn.addEventListener('click', async () => {
    // 防重复点击
    if (grabbing) return;
    grabbing = true;
    btn.textContent = '正在抓取数据...';
    btn.disabled = true;

    // 先触发 description 区域懒加载（滚动到视图）
    const desc = document.querySelector('#description');
    if (desc) desc.scrollIntoView({ block: 'center' });

    // 等待懒加载完成
    await new Promise((r) => setTimeout(r, 2000));

    title = extractors.extractTitle();
    attrs = extractors.extractAttrs();
    pictures = extractors.extractPictures();
    detailPics = extractors.extractDetailPictures();

    btn.textContent = '一键抓取商品数据';
    btn.disabled = false;
    grabbing = false;

    const previewContent = buildPreviewContent(
      title, attrs, pictures, detailPics
    );

    const footer = document.createElement('div');
    footer.style.cssText =
      'display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;';

    const cancelBtn = createButton('取消', () => close(), {
      background: '#f5f5f5', color: '#666',
    });

    const confirmBtn = createButton('抓取', async () => {
      confirmBtn.textContent = '正在抓取...';
      confirmBtn.disabled = true;

      try {
        const result = await apiPost<ProductSaveResponse>(
          API_PATHS.PRODUCT_SAVE,
          {
            ext_from: platform,
            ext_product_id: productId,
            ext_product_name: title,
            main_picture: pictures[0] || '',
            pictures,
            detail_pictures: detailPics,
            attrs,
          }
        );

        if (result.code === '200') {
          alert(
            `抓取成功！\n` +
            `主图：${pictures[0] ? '已保存' : '失败'}\n` +
            `轮播图：${result.result?.slide?.success_list?.length || 0} 张成功\n` +
            `详情图：${result.result?.detail?.success_list?.length || 0} 张成功`
          );
        } else if (result.code === '401') {
          // toast 提示，3s 后自动消失，然后弹出登录框
          close();
          showToast('当前没有登录，请先登录');
          setTimeout(() => {
            chrome.runtime.sendMessage({ type: 'SHOW_LOGIN_DIALOG' });
          }, 3000);
        } else {
          alert(`抓取失败: ${result.msg}`);
        }
      } catch (e) {
        alert(`请求失败: ${e}`);
      } finally {
        close();
      }
    }, {
      background: '#ff6b00', color: '#fff',
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    const contentWrapper = document.createElement('div');
    contentWrapper.appendChild(previewContent);
    contentWrapper.appendChild(footer);

    const { close } = createModal(
      `商品数据预览 - ${label}`, contentWrapper
    );
  });
}
