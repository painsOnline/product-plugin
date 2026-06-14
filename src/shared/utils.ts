/**
 * 文件名称：utils.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 通用工具函数
 */

/**
 * 从 1688 URL 中提取商品 ID (offerId)
 */
export function extract1688ProductId(url: string): string | null {
  const match = url.match(/offerId=(\d+)/);
  if (match) return match[1];
  const pathMatch = url.match(/\/offer\/(\d+)/);
  if (pathMatch) return pathMatch[1];
  return null;
}

/**
 * 从淘宝 URL 中提取商品 ID (skuId)
 */
export function extractTaobaoProductId(url: string): string | null {
  const match = url.match(/[?&]skuId=(\d+)/);
  if (match) return match[1];
  const idMatch = url.match(/[?&]id=(\d+)/);
  if (idMatch) return idMatch[1];
  return null;
}

/**
 * 检测当前是否为 1688 商品详情页
 */
export function is1688Page(url: string): boolean {
  return url.includes('detail.1688.com/offer/');
}

/**
 * 检测当前是否为淘宝商品详情页
 */
export function isTaobaoPage(url: string): boolean {
  return url.includes('item.taobao.com/item.htm');
}

/**
 * 检测当前是否为街顺商品编辑页
 */
export function isJieshunEditPage(url: string): boolean {
  return url.includes('s.waisongbang.com') && url.includes('product_update');
}

/**
 * 解析 JWT token payload（不验证签名）
 */
export function parseJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * 检查 JWT 是否即将过期（提前 10 分钟提醒）
 */
export function isJWTExpiring(token: string): boolean {
  const payload = parseJWT(token);
  if (!payload || !payload.exp) return true;
  const expTime = (payload.exp as number) * 1000;
  const threshold = 10 * 60 * 1000;
  return Date.now() > expTime - threshold;
}

/**
 * 将 base64 解码为 Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0) ?? 0);
}
