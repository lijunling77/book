/**
 * StockService - 库存管理服务
 * 提供库存数量查询、调整、列表和汇总功能
 */

import { eq, like, sql, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import {
  stock,
  books,
  inboundRecords,
  outboundRecords,
} from '../db/schema';
import {
  ERROR_MESSAGES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  STOCK_STATUS,
} from '../../shared/constants';
import type {
  StockFilter,
  StockView,
  StockSummaryView,
  PaginatedResult,
} from '../../shared/types';

export class StockService {
  /**
   * 查询特定书籍的库存数量
   */
  getStockQuantity(bookId: string): number {
    const db = getDatabase();

    const record = db
      .select({ quantity: stock.quantity })
      .from(stock)
      .where(eq(stock.bookId, bookId))
      .get();

    return record?.quantity ?? 0;
  }

  /**
   * 调整库存数量（delta 可正可负）
   */
  adjustStock(bookId: string, delta: number): void {
    const db = getDatabase();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const existing = db
      .select()
      .from(stock)
      .where(eq(stock.bookId, bookId))
      .get();

    if (existing) {
      const newQuantity = existing.quantity + delta;
      if (newQuantity < 0) {
        throw new Error(ERROR_MESSAGES.STOCK_WOULD_BE_NEGATIVE);
      }

      db.update(stock)
        .set({ quantity: newQuantity, updatedAt: now })
        .where(eq(stock.id, existing.id))
        .run();
    } else {
      if (delta < 0) {
        throw new Error(ERROR_MESSAGES.STOCK_WOULD_BE_NEGATIVE);
      }

      if (delta > 0) {
        db.insert(stock)
          .values({
            id: uuidv4(),
            bookId,
            quantity: delta,
            updatedAt: now,
          })
          .run();
      }
    }
  }

  /**
   * 查询书籍的总库存数量
   */
  getTotalStock(bookId: string): number {
    return this.getStockQuantity(bookId);
  }

  /**
   * 库存列表查询
   */
  list(filter?: StockFilter): PaginatedResult<StockView> {
    const db = getDatabase();
    const page = filter?.page ?? DEFAULT_PAGE;
    const pageSize = filter?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookTitle) {
      conditions.push(like(books.title, `%${filter.bookTitle}%`));
    }

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

    const countQuery = db
      .select({ count: count() })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const totalResult = countQuery.get();
    const total = totalResult?.count ?? 0;

    const dataQuery = db
      .select({
        stockId: stock.id,
        bookId: stock.bookId,
        quantity: stock.quantity,
        bookTitle: books.title,
        author: books.author,
      })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id));

    if (whereClause) {
      dataQuery.where(whereClause);
    }

    const rows = dataQuery.limit(pageSize).offset(offset).all();

    const data: StockView[] = rows.map((row) => {
      const priceStats = this.getPriceStats(row.bookId);

      return {
        stockId: row.stockId,
        bookId: row.bookId,
        bookTitle: row.bookTitle,
        author: row.author,
        quantity: row.quantity,
        status: row.quantity === 0 ? STOCK_STATUS.OUT_OF_STOCK : STOCK_STATUS.NORMAL,
        latestPurchasePrice: priceStats.latestPurchasePrice,
        latestSellingPrice: priceStats.latestSellingPrice,
        purchasePriceMin: priceStats.purchasePriceMin,
        purchasePriceMax: priceStats.purchasePriceMax,
        averagePurchasePrice: priceStats.averagePurchasePrice,
        averageSellingPrice: priceStats.averageSellingPrice,
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 汇总视图：显示每本书的总库存数量
   */
  summary(filter?: StockFilter): StockSummaryView[] {
    const db = getDatabase();

    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookTitle) {
      conditions.push(like(books.title, `%${filter.bookTitle}%`));
    }

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

    const query = db
      .select({
        bookId: stock.bookId,
        bookTitle: books.title,
        author: books.author,
        totalQuantity: sql<number>`COALESCE(SUM(${stock.quantity}), 0)`,
      })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id));

    if (whereClause) {
      query.where(whereClause);
    }

    const rows = query
      .groupBy(stock.bookId)
      .all();

    return rows.map((row) => ({
      bookId: row.bookId,
      bookTitle: row.bookTitle,
      author: row.author,
      totalQuantity: row.totalQuantity,
    }));
  }

  /**
   * 获取书籍的价格统计信息
   */
  private getPriceStats(
    bookId: string,
  ): {
    latestPurchasePrice: number | null;
    latestSellingPrice: number | null;
    purchasePriceMin: number | null;
    purchasePriceMax: number | null;
    averagePurchasePrice: number | null;
    averageSellingPrice: number | null;
  } {
    const db = getDatabase();

    const latestInbound = db
      .select({ purchasePrice: inboundRecords.purchasePrice })
      .from(inboundRecords)
      .where(eq(inboundRecords.bookId, bookId))
      .orderBy(sql`${inboundRecords.inboundDate} DESC, ${inboundRecords.createdAt} DESC`)
      .limit(1)
      .get();

    const latestOutbound = db
      .select({ sellingPrice: outboundRecords.sellingPrice })
      .from(outboundRecords)
      .where(eq(outboundRecords.bookId, bookId))
      .orderBy(sql`${outboundRecords.outboundDate} DESC, ${outboundRecords.createdAt} DESC`)
      .limit(1)
      .get();

    const purchaseStats = db
      .select({
        minPrice: sql<number | null>`MIN(${inboundRecords.purchasePrice})`,
        maxPrice: sql<number | null>`MAX(${inboundRecords.purchasePrice})`,
        weightedAvg: sql<number | null>`CASE WHEN SUM(${inboundRecords.quantity}) > 0 THEN SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity}) / SUM(${inboundRecords.quantity}) ELSE NULL END`,
      })
      .from(inboundRecords)
      .where(eq(inboundRecords.bookId, bookId))
      .get();

    const sellingStats = db
      .select({
        weightedAvg: sql<number | null>`CASE WHEN SUM(${outboundRecords.quantity}) > 0 THEN SUM(${outboundRecords.sellingPrice} * ${outboundRecords.quantity}) / SUM(${outboundRecords.quantity}) ELSE NULL END`,
      })
      .from(outboundRecords)
      .where(eq(outboundRecords.bookId, bookId))
      .get();

    return {
      latestPurchasePrice: latestInbound?.purchasePrice ?? null,
      latestSellingPrice: latestOutbound?.sellingPrice ?? null,
      purchasePriceMin: purchaseStats?.minPrice ?? null,
      purchasePriceMax: purchaseStats?.maxPrice ?? null,
      averagePurchasePrice: purchaseStats?.weightedAvg ?? null,
      averageSellingPrice: sellingStats?.weightedAvg ?? null,
    };
  }
}
