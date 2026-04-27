/**
 * 格式化工具函数
 */

import { CURRENCY_UNIT, NO_DATA_TEXT } from '../../shared/constants';

/** 格式化价格（人民币元），保留两位小数 */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA_TEXT;
  return `${value.toFixed(2)} ${CURRENCY_UNIT}`;
}

/** 格式化价格数值（不带单位） */
export function formatPriceValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA_TEXT;
  return value.toFixed(2);
}

/** 格式化日期（YYYY-MM-DD） */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return value.slice(0, 10);
}

/** 格式化日期时间（YYYY-MM-DD HH:mm:ss） */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return value.slice(0, 19).replace('T', ' ');
}

/** 格式化数量 */
export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return String(value);
}

/** 格式化位置显示 */
export function formatLocation(warehouse: string, shelf: string, layer: string): string {
  return `${warehouse}-${shelf}-${layer}`;
}
