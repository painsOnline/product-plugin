/**
 * 文件名称：1688.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 1688 商品详情页 Content Script，仅包含平台特定的 DOM 提取逻辑。
 *
 * 共享流程（顶栏、预览、API、弹窗）由 grabber.ts 统一处理（DRY）。
 */
import { extract1688ProductId, parseAttrValues } from '@/shared/utils';
import { initGrabber, type PlatformExtractors } from '@/content/shared/grabber';

const extractors: PlatformExtractors = {
  extractTitle(): string {
    const titleEl = document.querySelector('#productTitle h1');
    if (titleEl) return titleEl.textContent?.trim() || '';
    const titleContent = document.querySelector('.title-content h1');
    if (titleContent) return titleContent.textContent?.trim() || '';
    return '';
  },

  extractAttrs(): Record<string, string[]> {
    const attrs: Record<string, string[]> = {};
    const attrContainer = document.querySelector('#productAttributes');
    if (!attrContainer) return attrs;

    const rows = attrContainer.querySelectorAll('tr.ant-descriptions-row');
    rows.forEach((row) => {
      // 每行有 1~2 对 th+td，获取所有 th 并通过 nextElementSibling 找对应的 td
      const ths = row.querySelectorAll('th.ant-descriptions-item-label');
      ths.forEach((th) => {
        const td = th.nextElementSibling as HTMLElement | null;
        if (td && td.classList.contains('ant-descriptions-item-content')) {
          const key = th.textContent?.trim() || '';
          const value = td.querySelector('.field-value')?.textContent?.trim()
            || td.textContent?.trim() || '';
          if (key) attrs[key] = parseAttrValues(value);
        }
      });
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
            || td?.textContent?.trim() || '';
          if (key) attrs[key] = parseAttrValues(value);
        });
      }
    }
    return attrs;
  },

  extractPictures(): string[] {
    const pictures: string[] = [];
    const galleryList = document.querySelector('.od-gallery-list');
    if (!galleryList) return pictures;
    const items = galleryList.querySelectorAll('li');
    items.forEach((li) => {
      const videoEl = li.querySelector('video, .cpv-icon, [class*="video"]');
      if (videoEl) return;
      const img = li.querySelector('img.preview-img');
      if (img) {
        const src = img.getAttribute('src');
        if (src && src.startsWith('http')) pictures.push(src);
      }
    });
    return pictures;
  },

  extractDetailPictures(): string[] {
    const sources = new Set<string>();

    function isDetailImg(src: string): boolean {
      return src.startsWith('http') && !src.includes('sdmap');
    }

    // 递归穿透 shadowRoot 找 #detail 内的 img
    function walkDetailPics(root: Document | ShadowRoot): void {
      const detail = root.querySelector('#detail');
      if (detail) {
        detail.querySelectorAll('img').forEach((img) => {
          const src = (img as HTMLImageElement).src || img.getAttribute('src') || '';
          if (isDetailImg(src) && !img.classList.contains('dynamic-backup-img')) {
            sources.add(src);
          }
        });
      }
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) walkDetailPics(el.shadowRoot);
      });
    }

    // 从 #description 开始遍历其子元素的 shadowRoot
    const desc = document.querySelector('#description');
    if (desc) {
      desc.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) walkDetailPics(el.shadowRoot);
      });
    }
    // 兜底：全局遍历
    document.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) walkDetailPics(el.shadowRoot);
    });

    return Array.from(sources);
  },
};

const productId = extract1688ProductId(window.location.href);
if (productId) {
  initGrabber('1688', productId, '1688', extractors);
}
