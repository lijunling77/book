/**
 * ProfitService - 利润统计服务
 * 提供库存单元、书籍和分类级别的利润计算功能
 * 支持按日期范围筛选（入库记录按 inbound_date，出库记录按 outbound_date）
 */

import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { getDatabase } from '../db';
import {
  inboundRecords,
  outboundRecords,
  books,
} from '../db/schema';
import type { ProfitDetail, DateRange } from '../../shared/types';

export class ProfitService {
  /**
   * 计算库存单元的利润
   * 总采购成本 = SUM(purchase_price * quantity) from inbound_records
   * 总销售收入 = SUM(selling_price * quantity) from outbound_records
   * 净利润 = 总销售收入 - 总采购成本
   *
   * @param bookId 书籍 ID
   * @param editionId 版本 ID
   * @param dateRange 可选日期范围筛选
   */
  calculateByStockUnit(bookId: string, editionId: string, dateRange?: DateRange): ProfitDetail {
    const db = getDatabase();

    // 构建入库记录查询条件
    const inboundConditions = [
      eq(inboundRecords.bookId, bookId),
      eq(inboundRecords.editionId, editionId),
    ];
    if (dateRange?.startDate) {
      inboundConditions.push(gte(inboundRecords.inboundDate, dateRange.startDate));
    }
    if (dateRange?.endDate) {
      inboundConditions.push(lte(inboundRecords.inboundDate, dateRange.endDate));
    }

    // 查询总采购成本
    const costResult = db
      .select({
        totalCost: sql<number | null>`SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity})`,
      })
      .from(inboundRecords)
      .where(and(...inboundConditions))
      .get();

    const totalPurchaseCost = costResult?.totalCost ?? 0;

    // 构建出库记录查询条件
    const outboundConditions = [
      eq(outboundRecords.bookId, bookId),
      eq(outboundRecords.editionId, editionId),
    ];
    if (dateRange?.startDate) {
      outboundConditions.push(gte(outboundRecords.outboundDate, dateRange.startDate));
    }
    if (dateRange?.endDate) {
      outboundConditions.push(lte(outboundRecords.outboundDate, dateRange.endDate));
    }

    // 查询总销售收入
    const revenueResult = db
      .select({
        totalRevenue: sql<number | null>`SUM(${outboundRecords.sellingPrice} * ${outboundRecords.quantity})`,
      })
      .from(outboundRecords)
      .where(and(...outboundConditions))
      .get();

    const totalSalesRevenue = revenueResult?.totalRevenue ?? 0;

    return {
      totalPurchaseCost,
      totalSalesRevenue,
      netProfit: totalSalesRevenue - totalPurchaseCost,
    };
  }

  /**
   * 计算书籍的利润（汇总所有版本）
   *
   * @param bookId 书籍 ID
   * @param dateRange 可选日期范围筛选
   */
  calculateByBook(bookId: string, dateRange?: DateRange): ProfitDetail {
    const db = getDatabase();

    // 构建入库记录查询条件
    const inboundConditions = [
      eq(inboundRecords.bookId, bookId),
    ];
    if (dateRange?.startDate) {
      inboundConditions.push(gte(inboundRecords.inboundDate, dateRange.startDate));
    }
    if (dateRange?.endDate) {
      inboundConditions.push(lte(inboundRecords.inboundDate, dateRange.endDate));
    }

    // 查询总采购成本
    const costResult = db
      .select({
        totalCost: sql<number | null>`SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity})`,
      })
      .from(inboundRecords)
      .where(and(...inboundConditions))
      .get();

    const totalPurchaseCost = costResult?.totalCost ?? 0;

    // 构建出库记录查询条件
    const outboundConditions = [
      eq(outboundRecords.bookId, bookId),
    ];
    if (dateRange?.startDate) {
      outboundConditions.push(gte(outboundRecords.outboundDate, dateRange.startDate));
    }
    if (dateRange?.endDate) {
      outboundConditions.push(lte(outboundRecords.outboundDate, dateRange.endDate));
    }

    // 查询总销售收入
    const revenueResult = db
      .select({
        totalRevenue: sql<number | null>`SUM(${outboundRecords.sellingPrice} * ${outboundRecords.quantity})`,
      })
      .from(outboundRecords)
      .where(and(...outboundConditions))
      .get();

    const totalSalesRevenue = revenueResult?.totalRevenue ?? 0;

    return {
      totalPurchaseCost,
      totalSalesRevenue,
      netProfit: totalSalesRevenue - totalPurchaseCost,
    };
  }

  /**
   * 计算分类的利润（汇总分类下所有书籍的所有版本）
   *
   * @param category 分类名称
   * @param dateRange 可选日期范围筛选
   */
  calculateByCategory(category: string, dateRange?: DateRange): ProfitDetail {
    const db = getDatabase();

    // 查找该分类下所有书籍的 ID
    const categoryBooks = db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.category, category))
      .all();

    // 如果该分类下没有书籍，返回零值
    if (categoryBooks.length === 0) {
      return {
        totalPurchaseCost: 0,
        totalSalesRevenue: 0,
        netProfit: 0,
      };
    }

    // 汇总每本书的利润数据
    let totalPurchaseCost = 0;
    let totalSalesRevenue = 0;

    for (const book of categoryBooks) {
      const bookProfit = this.calculateByBook(book.id, dateRange);
      totalPurchaseCost += bookProfit.totalPurchaseCost;
      totalSalesRevenue += bookProfit.totalSalesRevenue;
    }

    return {
      totalPurchaseCost,
      totalSalesRevenue,
      netProfit: totalSalesRevenue - totalPurchaseCost,
    };
  }
}
