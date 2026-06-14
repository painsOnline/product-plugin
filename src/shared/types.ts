/**
 * 文件名称：types.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 全局共享类型定义
 */

/** 平台类型 */
export type Platform = '1688' | 'taobao';

/** 操作类型 */
export type OperateType = 'rewrite_title' | 'match_attr' | 'both';

/** 消息角色 */
export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

/** WebSocket 消息类型 */
export type WSMessageType =
  | 'chat'
  | 'confirm_reply'
  | 'stream'
  | 'final'
  | 'confirm'
  | 'error'
  | 'heartbeat';

/** 商品数据 */
export interface ProductData {
  id: string;
  ext_from: Platform;
  ext_product_id: string;
  ext_product_name: string;
  main_picture: string;
  pictures: string[];
  detail_pictures: string[];
  attrs: Record<string, string>;
}

/** 商品保存请求 */
export interface ProductSaveRequest {
  ext_from: Platform;
  ext_product_id: string;
  ext_product_name: string;
  main_picture: string;
  pictures: string[];
  detail_pictures: string[];
  attrs: Record<string, string>;
}

/** 图片结果 */
export interface ImageSuccessResult {
  image_path: string;
  image_size: number;
  is_main?: boolean;
}

export interface ImageFailResult {
  image_name: string;
  reason: string;
  is_main?: boolean;
}

/** 商品保存响应 */
export interface ProductSaveResponse {
  id: string;
  ext_from: string;
  ext_product_id: string;
  create_time: string;
  slide: {
    success_list: ImageSuccessResult[];
    fail_list: ImageFailResult[];
  };
  detail: {
    success_list: ImageSuccessResult[];
    fail_list: ImageFailResult[];
  };
}

/** 登录请求/响应 */
export interface LoginRequest {
  account: string;
  password: string;
  captchaToken?: string;
  captchaInput?: string;
}

export interface LoginResponse {
  account: string;
  lastLoginTime: string;
  token: string;
}

/** 验证码 */
export interface CaptchaResponse {
  token: string;
  image: string;
}

/** 统一 API 响应 */
export interface APIResponse<T = unknown> {
  code: string;
  msg: string;
  result: T;
}

/** 属性项 */
export interface AttrItem {
  source_name: string;
  source_value: string;
}

/** 属性映射 */
export interface AttrMapping {
  target_name: string;
  target_value: string;
  source_name: string;
  source_value: string;
  map_note: string;
}

/** 手动修改数据 */
export interface ManualData {
  new_title: string;
  attr_mapping: AttrMapping[];
}

/** WebSocket Chat 消息 */
export interface ChatMessage {
  type: 'chat';
  thread_id: string;
  import_product_id: string;
  user_id: string;
  user_content: string;
  operate_type: OperateType;
  origin_title: string;
  origin_attrs: AttrItem[];
  manual_data?: ManualData;
}

/** WebSocket 最终结果 */
export interface FinalData {
  new_title: string;
  title_note: string;
  attr_mapping: AttrMapping[];
  warning: {
    has_warn: boolean;
    warn_content: string;
  };
  suggestion: {
    summary: string;
    items: string[];
  };
}

/** WebSocket 确认消息 */
export interface ConfirmMessage {
  type: 'confirm';
  thread_id: string;
  import_product_id: string;
  user_id: string;
  timeout: number;
  content: string;
  data: FinalData;
}

/** WebSocket 确认回传 */
export interface ConfirmReply {
  type: 'confirm_reply';
  thread_id: string;
  import_product_id: string;
  user_id: string;
  operate_result: 'confirm' | 'cancel';
  payload: FinalData;
}

/** 认证状态 */
export interface AuthState {
  token: string | null;
  tenantCode: string;
  account: string | null;
  isLoggedIn: boolean;
}
