/**
 * 文件名称：taobao.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 淘宝商品详情页 Content Script，仅包含平台特定的 DOM 提取逻辑。
 *
 * 共享流程（顶栏、预览、API、弹窗）由 grabber.ts 统一处理（DRY）。
 */
import { extractTaobaoProductId } from '@/shared/utils';
import { initGrabber, type PlatformExtractors } from '@/content/shared/grabber';

const extractors: PlatformExtractors = {
  extractTitle(): string {
    const titleEl = document.querySelector('span[class^="mainTitle"]');
    if (titleEl) return titleEl.textContent?.trim() || '';
    const mainTitleDiv = document.querySelector('div[class^="MainTitle"]');
    const spanInMain = mainTitleDiv?.querySelector('span');
    if (spanInMain) return spanInMain.textContent?.trim() || '';
    return '';
  },

  extractAttrs(): Record<string, string> {
    const attrs: Record<string, string> = {};

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
  },

  extractPictures(): string[] {
    const pictures: string[] = [];
    const thumbsWrap = document.querySelector('div[class^="thumbnails"]');
    const thumbItems = (thumbsWrap || document).querySelectorAll(
      'div[class^="thumbnailItem"] img[class^="thumbnailPic"]'
    );
    thumbItems.forEach((img) => {
      const src = img.getAttribute('src');
      if (src) {
        const fullUrl = src.startsWith('//') ? `https:${src}` : src;
        if (fullUrl.startsWith('http')) pictures.push(fullUrl);
      }
    });
    return pictures;
  },

  extractDetailPictures(): string[] {
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
  },
};

const productId = extractTaobaoProductId(window.location.href);
if (productId) initGrabber('taobao', productId, '淘宝', extractors);
