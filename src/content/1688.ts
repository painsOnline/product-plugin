/**
 * 文件名称：1688.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 1688 商品详情页 Content Script
 *
 * 功能：
 * - 检测 1688 商品详情页 URL
 * - 提取商品标题、属性、主图、轮播图、详情图
 * - 注入顶部固定栏和"一键抓取"按钮
 * - 弹出预览弹窗，确认后调用后端 API 保存
 */
import { extract1688ProductId } from '@/shared/utils';
import { createTopBar, createModal, createButton } from '@/content/utils/dom';
import { apiPost } from '@/content/utils/api';
import { API_PATHS } from '@/shared/constants';
import type { ProductSaveResponse } from '@/shared/types';

/** 提取 1688 商品标题 */
function extractTitle(): string {
  const titleEl = document.querySelector('#productTitle h1');
  if (titleEl) return titleEl.textContent?.trim() || '';

  const titleContent = document.querySelector('.title-content h1');
  if (titleContent) return titleContent.textContent?.trim() || '';

  return '';
}

/** 提取 1688 商品属性 */
function extractAttrs(): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrContainer = document.querySelector('#productAttributes');
  if (!attrContainer) return attrs;

  const rows = attrContainer.querySelectorAll('tr.ant-descriptions-row');
  rows.forEach((row) => {
    const th = row.querySelector('th');
    const td = row.querySelector('td');
    if (th && td) {
      const key = th.textContent?.trim() || '';
      const value = td.querySelector('.field-value')?.textContent?.trim()
        || td.textContent?.trim()
        || '';
      if (key) attrs[key] = value;
    }
  });

  if (Object.keys(attrs).length === 0) {
    const table = attrContainer.querySelector('table');
    if (table) {
      const ths = table.querySelectorAll('th');
      const tds = table.querySelectorAll('td');
      ths.forEach((th, i) => {
        const key = th.textContent?.trim() || '';
        const td = tds[i];
        const value = td?.querySelector('.field-value')?.textContent?.trim()
          || td?.textContent?.trim()
          || '';
        if (key) attrs[key] = value;
      });
    }
  }

  return attrs;
}

/** 提取 1688 轮播图 URL 列表，跳过视频项 */
function extractPictures(): string[] {
  const pictures: string[] = [];
  const galleryList = document.querySelector('.od-gallery-list');
  if (!galleryList) return pictures;

  const items = galleryList.querySelectorAll('li');
  items.forEach((li) => {
    // 跳过视频元素（含有 video 标签或 class 含 video 标记）
    const videoEl = li.querySelector('video, .cpv-icon, [class*="video"]');
    if (videoEl) return;

    const img = li.querySelector('img.preview-img');
    if (img) {
      const src = img.getAttribute('src');
      if (src && src.startsWith('http')) {
        pictures.push(src);
      }
    }
  });

  return pictures;
}

/** 提取 1688 详情图 URL 列表 */
function extractDetailPictures(): string[] {
  const pictures: string[] = [];
  const detailContainer = document.querySelector('#detail');
  if (!detailContainer) return pictures;

  const images = detailContainer.querySelectorAll('img');
  images.forEach((img) => {
    const src = img.getAttribute('src');
    if (src && src.startsWith('http') && !src.includes('sdmap')) {
      pictures.push(src);
    }
  });

  return pictures;
}

/** 构建预览内容 */
function buildPreviewContent(
  title: string,
  attrs: Record<string, string>,
  pictures: string[],
  detailPics: string[]
): HTMLElement {
  const container = document.createElement('div');

  const sections: Array<{ label: string; content: string }> = [
    { label: '商品名称', content: title || '(未获取到)' },
    {
      label: '商品属性',
      content: Object.entries(attrs)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n') || '(未获取到)',
    },
    { label: '主图/轮播图', content: `${pictures.length} 张` },
    { label: '详情图', content: `${detailPics.length} 张` },
  ];

  sections.forEach(({ label, content }) => {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 12px;';

    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-weight: bold; font-size: 14px; color: #333; margin-bottom: 4px;';
    labelEl.textContent = label;

    const contentEl = document.createElement('div');
    contentEl.style.cssText = 'font-size: 13px; color: #666; white-space: pre-wrap; max-height: 100px; overflow-y: auto;';
    contentEl.textContent = content;

    section.appendChild(labelEl);
    section.appendChild(contentEl);
    container.appendChild(section);
  });

  return container;
}

function initPlugin(): void {
  const currentUrl = window.location.href;
  const productId = extract1688ProductId(currentUrl);
  if (!productId) return;

  let title = '';
  let attrs: Record<string, string> = {};
  let pictures: string[] = [];
  let detailPics: string[] = [];

  const bar = createTopBar('1688');
  const btn = bar.querySelector('#product-plugin-grab-btn') as HTMLButtonElement;

  btn.addEventListener('click', () => {
    title = extractTitle();
    attrs = extractAttrs();
    pictures = extractPictures();
    detailPics = extractDetailPictures();

    const previewContent = buildPreviewContent(title, attrs, pictures, detailPics);

    const footer = document.createElement('div');
    footer.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;';

    const cancelBtn = createButton('取消', () => close(), {
      background: '#f5f5f5', color: '#666',
    });

    const confirmBtn = createButton('抓取', async () => {
      confirmBtn.textContent = '正在抓取...';
      confirmBtn.disabled = true;

      try {
        const result = await apiPost<ProductSaveResponse>(API_PATHS.PRODUCT_SAVE, {
          ext_from: '1688',
          ext_product_id: productId,
          ext_product_name: title,
          main_picture: pictures[0] || '',
          pictures,
          detail_pictures: detailPics,
          attrs,
        });

        if (result.code === '200') {
          alert(`抓取成功！\n主图：${pictures[0] ? '已保存' : '失败'}\n轮播图：${result.result?.slide?.success_list?.length || 0} 张成功\n详情图：${result.result?.detail?.success_list?.length || 0} 张成功`);
        } else {
          alert(`抓取失败: ${result.msg}`);
        }
      } catch (e) {
        alert(`请求失败: ${e}`);
      } finally {
        close();
      }

      close();
    }, {
      background: '#ff6b00', color: '#fff',
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    const contentWrapper = document.createElement('div');
    contentWrapper.appendChild(previewContent);
    contentWrapper.appendChild(footer);

    const { close } = createModal('商品数据预览 - 1688', contentWrapper);
  });
}

initPlugin();
