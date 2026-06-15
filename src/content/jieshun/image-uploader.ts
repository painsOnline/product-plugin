/**
 * 文件名称：image-uploader.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 街顺商品编辑页图片上传工具，从后端获取图片 Blob，通过 DataTransfer
 * 注入 Element UI 上传组件，触发街顺原生上传流程（SRP）。
 *
 * 上传顺序：主图 → 轮播图 → 详情图
 */
import { API_BASE_URL } from '@/shared/constants';

const UPLOAD_TIMEOUT = 30000;

/** 文件扩展名 → MIME 类型映射 */
const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
};

interface FetchBlobResult {
  ok: boolean;
  status: number;
  buffer?: number[];
  contentType?: string;
  error?: string;
}

/** 从路径中提取文件扩展名并映射到标准 MIME 类型 */
function getMimeAndExt(imagePath: string): { mime: string; ext: string } {
  const rawExt = (imagePath.split('.').pop() || 'jpg').toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const mime = MIME_MAP[ext] || 'image/jpeg';
  return { mime, ext };
}

/** 通过 Service Worker 代理获取图片（绕过 CORS） */
async function fetchImageBlob(imagePath: string): Promise<Blob> {
  const url = `${API_BASE_URL}${imagePath}`;
  const result = await new Promise<FetchBlobResult>((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'FETCH_BLOB', url },
      (response) => resolve((response as FetchBlobResult) || { ok: false, status: 0, error: 'SW 无响应' })
    );
  });

  if (!result.ok || !result.buffer) {
    throw new Error(`图片请求失败: ${result.status} ${url}`);
  }

  const { mime } = getMimeAndExt(imagePath);
  const bytes = new Uint8Array(result.buffer);
  return new Blob([bytes], { type: mime });
}

/** 通过 DataTransfer 将 File 注入 file input 并触发事件 */
function injectFileToInput(input: HTMLInputElement, file: File): void {
  const dt = new DataTransfer();
  dt.items.add(file);

  // 直接设置 files 属性（可能被 Vue 响应式系统监听）
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype, 'files'
  );
  if (descriptor?.set) {
    descriptor.set.call(input, dt.files);
  } else {
    input.files = dt.files;
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** 查找 "商品介绍图" 幻灯片上传区域 */
function findSlideUploadContainer(): {
  container: HTMLElement;
  input: HTMLInputElement;
} | null {
  const labels = document.querySelectorAll<HTMLElement>('span.font14Color9');
  for (const label of labels) {
    if (label.textContent?.trim() === '商品介绍图') {
      let parent: HTMLElement | null = label.parentElement;
      while (parent) {
        const uploadInput = parent.querySelector<HTMLInputElement>(
          '.el-upload__input[type="file"]'
        );
        if (uploadInput) {
          const uploadCard = uploadInput.closest<HTMLElement>('.flexRowCenterWrap') ||
                             uploadInput.closest<HTMLElement>('.flexRow');
          const container = uploadCard || parent;
          return { container, input: uploadInput };
        }
        parent = parent.parentElement;
      }
    }
  }
  return null;
}

/** 查找 "商品详情图" 上传区域 */
function findDetailUploadContainer(): {
  container: HTMLElement;
  input: HTMLInputElement;
} | null {
  // 找到 "商品详情图" 标签所在的表单项
  const formLabels = document.querySelectorAll<HTMLElement>('.el-form-item__label');
  for (const label of formLabels) {
    const span = label.querySelector<HTMLElement>('span.font14Color3Fw4');
    if (span && span.textContent?.trim() === '商品详情图') {
      const formItem = label.closest<HTMLElement>('.el-form-item');
      if (!formItem) continue;

      // 滚动详情图区域到可见位置，确保上传组件已渲染
      formItem.scrollIntoView({ block: 'center' });

      const uploadInput = formItem.querySelector<HTMLInputElement>(
        '.el-upload__input[type="file"]'
      );
      if (!uploadInput) continue;

      const uploadCard = uploadInput.closest<HTMLElement>('.flexRowCenterWrap');
      const container = uploadCard || formItem;
      return { container, input: uploadInput };
    }
  }
  return null;
}

/** 批量上传图片 */
async function uploadBatch(
  imagePaths: string[],
  container: HTMLElement,
  input: HTMLInputElement,
  label: string,
  startIndex: number = 0,
): Promise<{ success: number; fail: number }> {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    if (!imagePath) continue;

    try {
      const blob = await fetchImageBlob(imagePath);
      const { mime, ext } = getMimeAndExt(imagePath);
      const fileName = `${label}_${String(startIndex + i + 1).padStart(2, '0')}.${ext}`;
      const file = new File([blob], fileName, { type: mime });

      // 每张图都需要重新查找 input（上传组件可能重新渲染）
      const currentInput = container.querySelector<HTMLInputElement>(
        '.el-upload__input[type="file"]'
      ) || input;

      injectFileToInput(currentInput, file);
      successCount++;
      console.log(`[商品助手] ${label} 上传 [${i + 1}/${imagePaths.length}]: ${fileName}`);

      // 图片之间间隔，避免触发频率限制
      if (i < imagePaths.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      console.error(`[商品助手] ${label} 上传失败 [${i + 1}]: ${imagePath}`, e);
      failCount++;
    }
  }

  return { success: successCount, fail: failCount };
}

/** 上传活动图：主图 + 轮播图 */
export async function uploadSlideImages(
  mainPicture: string,
  pictures: string[],
): Promise<{ success: number; fail: number }> {
  const slide = findSlideUploadContainer();
  if (!slide) {
    console.error('[商品助手] 未找到商品介绍图上传区域');
    return { success: 0, fail: 1 };
  }

  const allImages = [mainPicture, ...pictures].filter(Boolean);
  return uploadBatch(allImages, slide.container, slide.input, 'slide');
}

/** 上传详情图 */
export async function uploadDetailImages(
  detailPictures: string[],
): Promise<{ success: number; fail: number }> {
  if (!detailPictures.length) return { success: 0, fail: 0 };

  const detail = findDetailUploadContainer();
  if (!detail) {
    console.error('[商品助手] 未找到商品详情图上传区域');
    return { success: 0, fail: detailPictures.length };
  }

  return uploadBatch(detailPictures, detail.container, detail.input, 'detail');
}

/** 上传所有图片 */
export async function uploadAllImages(
  mainPicture: string,
  pictures: string[],
  detailPictures: string[],
): Promise<{ slideOk: number; slideFail: number; detailOk: number; detailFail: number }> {
  const slideResult = await uploadSlideImages(mainPicture, pictures);
  // 幻灯片上传完成后再上传详情图，中间短暂间隔
  await new Promise((r) => setTimeout(r, 500));
  const detailResult = await uploadDetailImages(detailPictures);

  return {
    slideOk: slideResult.success,
    slideFail: slideResult.fail,
    detailOk: detailResult.success,
    detailFail: detailResult.fail,
  };
}
