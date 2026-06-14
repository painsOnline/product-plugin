/**
 * 文件名称：enums.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 枚举类型定义
 */

/** @deprecated Use `type Platform = '1688' | 'taobao'` from shared/types.ts */
export enum Platform {
  ALIBABA_1688 = '1688',
  TAOBAO = 'taobao',
}

/** @deprecated Use `type OperateType` from shared/types.ts */
export enum OperateType {
  REWRITE_TITLE = 'rewrite_title',
  MATCH_ATTR = 'match_attr',
  BOTH = 'both',
}

export enum WSMessageType {
  CHAT = 'chat',
  CONFIRM_REPLY = 'confirm_reply',
  STREAM = 'stream',
  FINAL = 'final',
  CONFIRM = 'confirm',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

export enum StatusCode {
  SUCCESS = '200',
  UNAUTHORIZED = '401',
  NOT_FOUND = '404',
  SESSION_BUSY = '406',
  SESSION_CONFLICT = '409',
  RATE_LIMIT = '429',
  SERVER_ERROR = '500',
}
