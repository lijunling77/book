/**
 * PriceService - 价格查询服务
 * 提供书籍的买入/售出价格历史查询和价格统计功能
 */

import { eq, desc, sql } from 'drizzle-orm';
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
  getPurchaseHistory(bookId: string): PurchasePriceHistory[] {
    const db = getDatabase();
    return db
      .select({
        inboundRecordId: inboundRecords.id,
        purchasePrice: inboundRecords.purchasePrice,
        inboundDate: inboundRecords.inboundDate,
        quantity: inboundRecords.quantity,
        supplier: inboundRecords.supplier,
      })
      .from(inboundRecords)
      .where(eq(inboundRecords.bookId, bookId))
      .orderBy(desc(inboundRecords.inboundDate), desc(inboundRecords.createdAt))
      .all();
  }

  getSellingHistory(bookId: string): SellingPriceHistory[] {
    const db = getDatabase();
    return db
      .select({
        outboundRecordId: outboundRecords.id,
        sellingPrice: outboundRecords.sellingPrice,
        outboundDate: outboundRecords.outboundDate,
        quantity: outboundRecords.quantity,
        buyer: outboundRecords.buyer,
      })
      .from(outboundRecords)
      .where(eq(outboundRecords.bookId, bookId))
      .orderBy(desc(outboundRecords.outboundDate), desc(outboundRecords.createdAt))
      .all();
  }

  getStats(bookId: string): PriceStats {
    const db = getDatabase();

    const inboundStats = db
      .select({
        count: sql<number>`COUNT(*)`,
        minPrice: sql<number | null>`MIN(${inboundRecords.purchasePrice})`,
        maxPrice: sql<number | null>`MAX(${inboundRecords.purchasePrice})`,
        weightedSum: sql<number | null>`SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity})`,
        totalQuantity: sql<number | null>`SUM(${inboundRecords.quantity})`,
      })
      .from(inboundRecords)
      .where(eq(inboundRecords.bookId, bookId))
      .get();

    const latestInbound = db
      .select({ purchasePrice: inboundRecords.purchasePrice })
      .from(inboundRecords)
      .where(eq(inboundRecords.bookId, bookId))
      .orderBy(desc(inboundRecords.inboundDate), desc(inboundRecords.createdAt))
      .limit(1)
      .get();

    const outboundStats = db
      .select({
        count: sql<number>`COUNT(*)`,
        weightedSum: sql<number | null>`SUM(${outboundRecords.sellingPrice} * ${outboundRecords.quantity})`,
        totalQuantity: sql<number | null>`SUM(${outboundRecords.quantity})`,
      })
      .from(outboundRecords)
      .where(eq(outboundRecords.bookId, bookId))
      .get();

    const latestOutbound = db
      .select({ sellingPrice: outboundRecords.sellingPrice })
      .from(outboundRecords)
      .where(eq(outboundRecords.bookId, bookId))
      .orderBy(desc(outboundRecords.outboundDate), desc(outboundRecords.createdAt))
      .limit(1)
      .get();

    const hasInboundRecords = (inboundStats?.count ?? 0) > 0;
    const hasOutboundRecords = (outboundStats?.count ?? 0) > 0;

    let averagePurchasePrice: number | null = null;
    if (hasInboundRecords && inboundStats!.totalQuantity && inboundStats!.totalQuantity > 0) {
      averagePurchasePrice = inboundStats!.weightedSum! / inboundStats!.totalQuantity;
    }

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
