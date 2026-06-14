/**
 * 文件名称：taobao.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 淘宝商品详情页 Content Script
 *
 * 功能：
 * - 检测淘宝商品详情页 URL
 * - 提取商品标题、属性、主图、轮播图、详情图
 * - 注入顶部固定栏和"一键抓取"按钮
 * - 弹出预览弹窗，确认后调用后端 API 保存
 */
import { extractTaobaoProductId } from '@/shared/utils';
import { createTopBar, createModal, createButton } from '@/content/utils/dom';
import { apiPost } from '@/content/utils/api';
import { API_PATHS } from '@/shared/constants';
import type { ProductSaveResponse } from '@/shared/types';

/** 提取淘宝商品标题 */
function extractTitle(): string {
  const titleEl = document.querySelector('span[class^="mainTitle"]');
  if (titleEl) return titleEl.textContent?.trim() || '';

  // 备选：查找 MainTitle 容器中的 span
  const mainTitleDiv = document.querySelector('div[class^="MainTitle"]');
  const spanInMain = mainTitleDiv?.querySelector('span');
  if (spanInMain) return spanInMain.textContent?.trim() || '';

  return '';
}

/** 提取淘宝商品属性 */
function extractAttrs(): Record<string, string> {
  const attrs: Record<string, string> = {};

  // 通用属性（generalParamsInfoWrap 容器下的属性项）
  const generalWrap = document.querySelector('div[class^="generalParamsInfoWrap"]');
  if (generalWrap) {
    const infoItems = generalWrap.querySelectorAll('div[class^="generalParamsInfoItem"]');
    infoItems.forEach((item) => {
      const titleEl = item.querySelector('div[class^="generalParamsInfoItemTitle"]');
      const subEl = item.querySelector('div[class^="generalParamsInfoItemSubTitle"]');
      if (titleEl && subEl) {
        const key = titleEl.getAttribute('title') || titleEl.textContent?.trim() || '';
        const value = subEl.getAttribute('title') || subEl.textContent?.trim() || '';
        if (key) attrs[key] = value;
      }
    });
  }

  // 重点属性
  const emphasisItems = document.querySelectorAll('div[class^="emphasisParamsInfoItem"]');
  emphasisItems.forEach((item) => {
    const subEl = item.querySelector('div[class^="emphasisParamsInfoItemSubTitle"]');
    const titleEl = item.querySelector('div[class^="emphasisParamsInfoItemTitle"]');
    if (subEl && titleEl) {
      const key = subEl.getAttribute('title') || subEl.textContent?.trim() || '';
      const value = titleEl.getAttribute('title') || titleEl.textContent?.trim() || '';
      if (key) attrs[key] = value;
    }
  });

  return attrs;
}

/** 提取淘宝轮播图 */
function extractPictures(): string[] {
  const pictures: string[] = [];
  // 使用前缀选择器，适配淘宝 CSS Module 动态哈希类名
  const thumbsWrap = document.querySelector('div[class^="thumbnails"]');
  const thumbItems = (thumbsWrap || document).querySelectorAll('div[class^="thumbnailItem"] img[class^="thumbnailPic"]');
  thumbItems.forEach((img) => {
    const src = img.getAttribute('src');
    if (src) {
      const fullUrl = src.startsWith('//') ? `https:${src}` : src;
      if (fullUrl.startsWith('http')) {
        pictures.push(fullUrl);
      }
    }
  });
  return pictures;
}

/** 提取淘宝详情图 */
function extractDetailPictures(): string[] {
  const pictures: string[] = [];
  const descContainer = document.querySelector('#imageTextInfo-content');
  if (!descContainer) return pictures;

  const images = descContainer.querySelectorAll('img.descV8-singleImage-image');
  images.forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    if (src && !src.includes('g.alicdn.com/s.gif')) {
      const fullUrl = src.startsWith('//') ? `https:${src}` : src;
      if (fullUrl.startsWith('http')) pictures.push(fullUrl);
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

/** 初始化插件 */
function initPlugin(): void {
  const currentUrl = window.location.href;
  const productId = extractTaobaoProductId(currentUrl);
  if (!productId) return;

  let title = '';
  let attrs: Record<string, string> = {};
  let pictures: string[] = [];
  let detailPics: string[] = [];

  const bar = createTopBar('淘宝');
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
          ext_from: 'taobao',
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

    const { close } = createModal('商品数据预览 - 淘宝', contentWrapper);
  });
}

initPlugin();
