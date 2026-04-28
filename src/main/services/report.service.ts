/**
 * ReportService - 综合报表服务
 * 提供单一扁平表格数据：每行对应一本书，包含库存、出入库、价格、利润等全部信息
 */

import { sql, eq, and, gte, lte, desc } from 'drizzle-orm';
import { getDatabase } from '../db';
import {
  stock,
  books,
  inboundRecords,
  outboundRecords,
} from '../db/schema';
import type { DateRange } from '../../shared/types';

export interface ReportRow {
  bookTitle: string;
  author: string | null;
  locations: string | null;
  totalQuantity: number;
  inboundTotalQuantity: number;
  inboundTotalAmount: number;
  outboundTotalQuantity: number;
  outboundTotalAmount: number;
  latestPurchasePrice: number | null;
  latestSellingPrice: number | null;
  averagePurchasePrice: number | null;
  averageSellingPrice: number | null;
  purchasePriceMin: number | null;
  purchasePriceMax: number | null;
  totalPurchaseCost: number;
  totalSalesRevenue: number;
  netProfit: number;
}

export class ReportService {
  getFullReport(dateRange?: DateRange): ReportRow[] {
    const db = getDatabase();

    const combos = db
      .select({
        bookId: books.id,
        bookTitle: books.title,
        author: books.author,
        totalQuantity: sql<number>`COALESCE(${stock.quantity}, 0)`,
      })
      .from(books)
      .leftJoin(stock, sql`${stock.bookId} = ${books.id}`)
      .all();

    return combos.map((combo) => {
      const bookId = combo.bookId;
      const inboundStats = this.getInboundStats(bookId, dateRange);
      const outboundStats = this.getOutboundStats(bookId, dateRange);
      const priceStats = this.getPriceStats(bookId);

      // Aggregate distinct locations from inbound_records
      const locResult = db
        .select({
          locations: sql<string | null>`GROUP_CONCAT(DISTINCT ${inboundRecords.location})`,
        })
        .from(inboundRecords)
        .where(eq(inboundRecords.bookId, bookId))
        .get();

      return {
        bookTitle: combo.bookTitle,
        author: combo.author,
        locations: locResult?.locations ?? null,
        totalQuantity: combo.totalQuantity,
        inboundTotalQuantity: inboundStats.totalQuantity,
        inboundTotalAmount: inboundStats.totalAmount,
        outboundTotalQuantity: outboundStats.totalQuantity,
        outboundTotalAmount: outboundStats.totalAmount,
        latestPurchasePrice: priceStats.latestPurchasePrice,
        latestSellingPrice: priceStats.latestSellingPrice,
        averagePurchasePrice: priceStats.averagePurchasePrice,
        averageSellingPrice: priceStats.averageSellingPrice,
        purchasePriceMin: priceStats.purchasePriceMin,
        purchasePriceMax: priceStats.purchasePriceMax,
        totalPurchaseCost: inboundStats.totalAmount,
        totalSalesRevenue: outboundStats.totalAmount,
        netProfit: outboundStats.totalAmount - inboundStats.totalAmount,
      };
    });
  }

  private getInboundStats(bookId: string, dateRange?: DateRange) {
    const db = getDatabase();
    const conditions = [eq(inboundRecords.bookId, bookId)];
    if (dateRange?.startDate) conditions.push(gte(inboundRecords.inboundDate, dateRange.startDate));
    if (dateRange?.endDate) conditions.push(lte(inboundRecords.inboundDate, dateRange.endDate));

    const result = db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${inboundRecords.quantity}), 0)`,
        totalAmount: sql<number>`COALESCE(SUM(${inboundRecords.quantity} * ${inboundRecords.purchasePrice}), 0)`,
      })
      .from(inboundRecords)
      .where(and(...conditions))
      .get();

    return { totalQuantity: result?.totalQuantity ?? 0, totalAmount: result?.totalAmount ?? 0 };
  }

  private getOutboundStats(bookId: string, dateRange?: DateRange) {
    const db = getDatabase();
    const conditions = [eq(outboundRecords.bookId, bookId)];
    if (dateRange?.startDate) conditions.push(gte(outboundRecords.outboundDate, dateRange.startDate));
    if (dateRange?.endDate) conditions.push(lte(outboundRecords.outboundDate, dateRange.endDate));

    const result = db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${outboundRecords.quantity}), 0)`,
        totalAmount: sql<number>`COALESCE(SUM(${outboundRecords.quantity} * ${outboundRecords.sellingPrice}), 0)`,
      })
      .from(outboundRecords)
      .where(and(...conditions))
      .get();

    return { totalQuantity: result?.totalQuantity ?? 0, totalAmount: result?.totalAmount ?? 0 };
  }

  private getPriceStats(bookId: string) {
    const db = getDatabase();

    const inboundAgg = db
      .select({
        cnt: sql<number>`COUNT(*)`,
        minPrice: sql<number | null>`MIN(${inboundRecords.purchasePrice})`,
        maxPrice: sql<number | null>`MAX(${inboundRecords.purchasePrice})`,
        weightedSum: sql<number | null>`SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity})`,
        totalQty: sql<number | null>`SUM(${inboundRecords.quantity})`,
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

    const outboundAgg = db
      .select({
        cnt: sql<number>`COUNT(*)`,
        weightedSum: sql<number | null>`SUM(${outboundRecords.sellingPrice} * ${outboundRecords.quantity})`,
        totalQty: sql<number | null>`SUM(${outboundRecords.quantity})`,
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

    const hasInbound = (inboundAgg?.cnt ?? 0) > 0;
    const hasOutbound = (outboundAgg?.cnt ?? 0) > 0;

    let averagePurchasePrice: number | null = null;
    if (hasInbound && inboundAgg!.totalQty && inboundAgg!.totalQty > 0) {
      averagePurchasePrice = inboundAgg!.weightedSum! / inboundAgg!.totalQty;
    }

    let averageSellingPrice: number | null = null;
    if (hasOutbound && outboundAgg!.totalQty && outboundAgg!.totalQty > 0) {
      averageSellingPrice = outboundAgg!.weightedSum! / outboundAgg!.totalQty;
    }

    return {
      latestPurchasePrice: hasInbound ? (latestInbound?.purchasePrice ?? null) : null,
      latestSellingPrice: hasOutbound ? (latestOutbound?.sellingPrice ?? null) : null,
      averagePurchasePrice,
      averageSellingPrice,
      purchasePriceMin: hasInbound ? (inboundAgg?.minPrice ?? null) : null,
      purchasePriceMax: hasInbound ? (inboundAgg?.maxPrice ?? null) : null,
    };
  }
}
