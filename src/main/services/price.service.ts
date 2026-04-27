/**
 * PriceService - 价格查询服务
 * 提供库存单元的买入/售出价格历史查询和价格统计功能
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { getDatabase } from '../db';
import {
  inboundRecords,
  outboundRecords,
} from '../db/schema';
import type {
  PurchasePriceHistory,
  SellingPriceHistory,
  PriceStats,
} from '../../shared/types';

export class PriceService {
  /**
   * 获取库存单元的买入价格历史
   * 返回该库存单元所有入库记录的买入价格、入库日期、数量和供应商信息
   * 按入库日期倒序排列
   */
  getPurchaseHistory(bookId: string, editionId: string): PurchasePriceHistory[] {
    const db = getDatabase();

    const rows = db
      .select({
        inboundRecordId: inboundRecords.id,
        purchasePrice: inboundRecords.purchasePrice,
        inboundDate: inboundRecords.inboundDate,
        quantity: inboundRecords.quantity,
        supplier: inboundRecords.supplier,
      })
      .from(inboundRecords)
      .where(
        and(
          eq(inboundRecords.bookId, bookId),
          eq(inboundRecords.editionId, editionId),
        ),
      )
      .orderBy(desc(inboundRecords.inboundDate), desc(inboundRecords.createdAt))
      .all();

    return rows;
  }

  /**
   * 获取库存单元的售出价格历史
   * 返回该库存单元所有出库记录的售出价格、出库日期、数量和买家信息
   * 按出库日期倒序排列
   */
  getSellingHistory(bookId: string, editionId: string): SellingPriceHistory[] {
    const db = getDatabase();

    const rows = db
      .select({
        outboundRecordId: outboundRecords.id,
        sellingPrice: outboundRecords.sellingPrice,
        outboundDate: outboundRecords.outboundDate,
        quantity: outboundRecords.quantity,
        buyer: outboundRecords.buyer,
      })
      .from(outboundRecords)
      .where(
        and(
          eq(outboundRecords.bookId, bookId),
          eq(outboundRecords.editionId, editionId),
        ),
      )
      .orderBy(desc(outboundRecords.outboundDate), desc(outboundRecords.createdAt))
      .all();

    return rows;
  }

  /**
   * 获取库存单元的价格统计信息
   * 计算最近买入/售出价格、买入价格范围、加权平均买入/售出价格
   * 无记录时返回 hasInboundRecords/hasOutboundRecords 为 false，价格字段为 null
   *
   * 加权平均价格 = SUM(price * quantity) / SUM(quantity)
   */
  getStats(bookId: string, editionId: string): PriceStats {
    const db = getDatabase();

    // 查询入库统计
    const inboundStats = db
      .select({
        count: sql<number>`COUNT(*)`,
        minPrice: sql<number | null>`MIN(${inboundRecords.purchasePrice})`,
        maxPrice: sql<number | null>`MAX(${inboundRecords.purchasePrice})`,
        weightedSum: sql<number | null>`SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity})`,
        totalQuantity: sql<number | null>`SUM(${inboundRecords.quantity})`,
      })
      .from(inboundRecords)
      .where(
        and(
          eq(inboundRecords.bookId, bookId),
          eq(inboundRecords.editionId, editionId),
        ),
      )
      .get();

    // 查询最近一条入库记录的买入价格
    const latestInbound = db
      .select({
        purchasePrice: inboundRecords.purchasePrice,
      })
      .from(inboundRecords)
      .where(
        and(
          eq(inboundRecords.bookId, bookId),
          eq(inboundRecords.editionId, editionId),
        ),
      )
      .orderBy(desc(inboundRecords.inboundDate), desc(inboundRecords.createdAt))
      .limit(1)
      .get();

    // 查询出库统计
    const outboundStats = db
      .select({
        count: sql<number>`COUNT(*)`,
        weightedSum: sql<number | null>`SUM(${outboundRecords.sellingPrice} * ${outboundRecords.quantity})`,
        totalQuantity: sql<number | null>`SUM(${outboundRecords.quantity})`,
      })
      .from(outboundRecords)
      .where(
        and(
          eq(outboundRecords.bookId, bookId),
          eq(outboundRecords.editionId, editionId),
        ),
      )
      .get();

    // 查询最近一条出库记录的售出价格
    const latestOutbound = db
      .select({
        sellingPrice: outboundRecords.sellingPrice,
      })
      .from(outboundRecords)
      .where(
        and(
          eq(outboundRecords.bookId, bookId),
          eq(outboundRecords.editionId, editionId),
        ),
      )
      .orderBy(desc(outboundRecords.outboundDate), desc(outboundRecords.createdAt))
      .limit(1)
      .get();

    const hasInboundRecords = (inboundStats?.count ?? 0) > 0;
    const hasOutboundRecords = (outboundStats?.count ?? 0) > 0;

    // 计算加权平均买入价格
    let averagePurchasePrice: number | null = null;
    if (hasInboundRecords && inboundStats!.totalQuantity && inboundStats!.totalQuantity > 0) {
      averagePurchasePrice = inboundStats!.weightedSum! / inboundStats!.totalQuantity;
    }

    // 计算加权平均售出价格
    let averageSellingPrice: number | null = null;
    if (hasOutboundRecords && outboundStats!.totalQuantity && outboundStats!.totalQuantity > 0) {
      averageSellingPrice = outboundStats!.weightedSum! / outboundStats!.totalQuantity;
    }

    return {
      latestPurchasePrice: hasInboundRecords ? (latestInbound?.purchasePrice ?? null) : null,
      latestSellingPrice: hasOutboundRecords ? (latestOutbound?.sellingPrice ?? null) : null,
      purchasePriceMin: hasInboundRecords ? (inboundStats?.minPrice ?? null) : null,
      purchasePriceMax: hasInboundRecords ? (inboundStats?.maxPrice ?? null) : null,
      averagePurchasePrice,
      averageSellingPrice,
      hasInboundRecords,
      hasOutboundRecords,
    };
  }
}
