/**
 * ReportService - 综合报表服务
 * 提供单一扁平表格数据：每行对应一个 书籍+版本 组合，包含库存、出入库、价格、利润等全部信息
 */

import { sql, eq, and, gte, lte, desc, isNull } from 'drizzle-orm';
import { getDatabase } from '../db';
import {
  stock,
  books,
  editions,
  locations,
  inboundRecords,
  outboundRecords,
} from '../db/schema';
import type { DateRange } from '../../shared/types';

/** 报表行：一个 书籍+版本 组合的全部信息 */
export interface ReportRow {
  bookTitle: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  editionName: string;
  locations: string;
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
  /**
   * 获取综合报表数据（扁平表格）
   * @param dateRange 可选日期范围，用于入库/出库/利润计算的筛选
   */
  getFullReport(dateRange?: DateRange): ReportRow[] {
    const db = getDatabase();

    // 1. 查询所有唯一的 bookId + editionId 组合（从 stock 表）
    const combos = db
      .select({
        bookId: stock.bookId,
        editionId: stock.editionId,
        bookTitle: books.title,
        author: books.author,
        isbn: books.isbn,
        category: books.category,
        editionName: editions.name,
        totalQuantity: sql<number>`COALESCE(SUM(${stock.quantity}), 0)`,
        locations: sql<string>`GROUP_CONCAT(DISTINCT ${locations.warehouse} || '-' || ${locations.shelf} || '-' || ${locations.layer})`,
      })
      .from(stock)
      .innerJoin(books, sql`${stock.bookId} = ${books.id}`)
      .leftJoin(editions, sql`${stock.editionId} = ${editions.id}`)
      .innerJoin(locations, sql`${stock.locationId} = ${locations.id}`)
      .groupBy(stock.bookId, stock.editionId)
      .all();

    // 2. 对每个组合计算出入库、价格、利润
    return combos.map((combo) => {
      const bookId = combo.bookId;
      const editionId = combo.editionId;

      // --- 入库汇总 ---
      const inboundStats = this.getInboundStats(bookId, editionId, dateRange);

      // --- 出库汇总 ---
      const outboundStats = this.getOutboundStats(bookId, editionId, dateRange);

      // --- 价格统计（不受日期范围限制） ---
      const priceStats = this.getPriceStats(bookId, editionId);

      // --- 利润 = 出库总金额 - 入库总金额（受日期范围限制） ---
      const totalPurchaseCost = inboundStats.totalAmount;
      const totalSalesRevenue = outboundStats.totalAmount;

      return {
        bookTitle: combo.bookTitle,
        author: combo.author,
        isbn: combo.isbn,
        category: combo.category,
        editionName: combo.editionName ?? '-',
        locations: combo.locations ?? '-',
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
        totalPurchaseCost,
        totalSalesRevenue,
        netProfit: totalSalesRevenue - totalPurchaseCost,
      };
    });
  }

  /**
   * 入库汇总（按 bookId + editionId，可选日期范围）
   */
  private getInboundStats(
    bookId: string,
    editionId: string | null,
    dateRange?: DateRange,
  ): { totalQuantity: number; totalAmount: number } {
    const db = getDatabase();

    const conditions = [
      eq(inboundRecords.bookId, bookId),
      editionId === null
        ? isNull(inboundRecords.editionId)
        : eq(inboundRecords.editionId, editionId),
    ];
    if (dateRange?.startDate) {
      conditions.push(gte(inboundRecords.inboundDate, dateRange.startDate));
    }
    if (dateRange?.endDate) {
      conditions.push(lte(inboundRecords.inboundDate, dateRange.endDate));
    }

    const result = db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${inboundRecords.quantity}), 0)`,
        totalAmount: sql<number>`COALESCE(SUM(${inboundRecords.quantity} * ${inboundRecords.purchasePrice}), 0)`,
      })
      .from(inboundRecords)
      .where(and(...conditions))
      .get();

    return {
      totalQuantity: result?.totalQuantity ?? 0,
      totalAmount: result?.totalAmount ?? 0,
    };
  }

  /**
   * 出库汇总（按 bookId + editionId，可选日期范围）
   */
  private getOutboundStats(
    bookId: string,
    editionId: string | null,
    dateRange?: DateRange,
  ): { totalQuantity: number; totalAmount: number } {
    const db = getDatabase();

    const conditions = [
      eq(outboundRecords.bookId, bookId),
      editionId === null
        ? isNull(outboundRecords.editionId)
        : eq(outboundRecords.editionId, editionId),
    ];
    if (dateRange?.startDate) {
      conditions.push(gte(outboundRecords.outboundDate, dateRange.startDate));
    }
    if (dateRange?.endDate) {
      conditions.push(lte(outboundRecords.outboundDate, dateRange.endDate));
    }

    const result = db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${outboundRecords.quantity}), 0)`,
        totalAmount: sql<number>`COALESCE(SUM(${outboundRecords.quantity} * ${outboundRecords.sellingPrice}), 0)`,
      })
      .from(outboundRecords)
      .where(and(...conditions))
      .get();

    return {
      totalQuantity: result?.totalQuantity ?? 0,
      totalAmount: result?.totalAmount ?? 0,
    };
  }

  /**
   * 价格统计（不受日期范围限制）
   */
  private getPriceStats(
    bookId: string,
    editionId: string | null,
  ): {
    latestPurchasePrice: number | null;
    latestSellingPrice: number | null;
    averagePurchasePrice: number | null;
    averageSellingPrice: number | null;
    purchasePriceMin: number | null;
    purchasePriceMax: number | null;
  } {
    const db = getDatabase();

    const inboundEditionCond = editionId === null
      ? isNull(inboundRecords.editionId)
      : eq(inboundRecords.editionId, editionId);

    const outboundEditionCond = editionId === null
      ? isNull(outboundRecords.editionId)
      : eq(outboundRecords.editionId, editionId);

    // 入库价格统计
    const inboundAgg = db
      .select({
        cnt: sql<number>`COUNT(*)`,
        minPrice: sql<number | null>`MIN(${inboundRecords.purchasePrice})`,
        maxPrice: sql<number | null>`MAX(${inboundRecords.purchasePrice})`,
        weightedSum: sql<number | null>`SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity})`,
        totalQty: sql<number | null>`SUM(${inboundRecords.quantity})`,
      })
      .from(inboundRecords)
      .where(and(eq(inboundRecords.bookId, bookId), inboundEditionCond))
      .get();

    // 最近入库价格
    const latestInbound = db
      .select({ purchasePrice: inboundRecords.purchasePrice })
      .from(inboundRecords)
      .where(and(eq(inboundRecords.bookId, bookId), inboundEditionCond))
      .orderBy(desc(inboundRecords.inboundDate), desc(inboundRecords.createdAt))
      .limit(1)
      .get();

    // 出库价格统计
    const outboundAgg = db
      .select({
        cnt: sql<number>`COUNT(*)`,
        weightedSum: sql<number | null>`SUM(${outboundRecords.sellingPrice} * ${outboundRecords.quantity})`,
        totalQty: sql<number | null>`SUM(${outboundRecords.quantity})`,
      })
      .from(outboundRecords)
      .where(and(eq(outboundRecords.bookId, bookId), outboundEditionCond))
      .get();

    // 最近出库价格
    const latestOutbound = db
      .select({ sellingPrice: outboundRecords.sellingPrice })
      .from(outboundRecords)
      .where(and(eq(outboundRecords.bookId, bookId), outboundEditionCond))
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
