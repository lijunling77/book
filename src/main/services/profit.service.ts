/**
 * ProfitService - 利润统计服务
 * 提供书籍级别的利润计算功能
 */

import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { getDatabase } from '../db';
import { inboundRecords, outboundRecords } from '../db/schema';
import type { ProfitDetail, DateRange } from '../../shared/types';

/** 月度利润 */
export interface MonthlyProfit {
  month: string;
  inboundQuantity: number;
  outboundQuantity: number;
  totalPurchaseCost: number;
  totalSalesRevenue: number;
  netProfit: number;
}

export class ProfitService {
  calculateByBook(bookId: string, dateRange?: DateRange): ProfitDetail {
    const db = getDatabase();

    const inboundConditions = [eq(inboundRecords.bookId, bookId)];
    if (dateRange?.startDate) {
      inboundConditions.push(gte(inboundRecords.inboundDate, dateRange.startDate));
    }
    if (dateRange?.endDate) {
      inboundConditions.push(lte(inboundRecords.inboundDate, dateRange.endDate));
    }

    const costResult = db
      .select({
        totalCost: sql<number | null>`SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity})`,
      })
      .from(inboundRecords)
      .where(and(...inboundConditions))
      .get();

    const totalPurchaseCost = costResult?.totalCost ?? 0;

    const outboundConditions = [eq(outboundRecords.bookId, bookId)];
    if (dateRange?.startDate) {
      outboundConditions.push(gte(outboundRecords.outboundDate, dateRange.startDate));
    }
    if (dateRange?.endDate) {
      outboundConditions.push(lte(outboundRecords.outboundDate, dateRange.endDate));
    }

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
   * 按月统计利润（全部书籍）
   * 返回每个月的采购成本、销售收入、净利润
   */
  calculateMonthly(): MonthlyProfit[] {
    const db = getDatabase();

    // 按月汇总入库成本
    const monthlyCosts = db
      .select({
        month: sql<string>`SUBSTR(${inboundRecords.inboundDate}, 1, 7)`,
        totalCost: sql<number>`COALESCE(SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity}), 0)`,
        totalQuantity: sql<number>`COALESCE(SUM(${inboundRecords.quantity}), 0)`,
      })
      .from(inboundRecords)
      .groupBy(sql`SUBSTR(${inboundRecords.inboundDate}, 1, 7)`)
      .all();

    // 按月汇总出库收入
    const monthlyRevenues = db
      .select({
        month: sql<string>`SUBSTR(${outboundRecords.outboundDate}, 1, 7)`,
        totalRevenue: sql<number>`COALESCE(SUM(${outboundRecords.sellingPrice} * ${outboundRecords.quantity}), 0)`,
        totalQuantity: sql<number>`COALESCE(SUM(${outboundRecords.quantity}), 0)`,
      })
      .from(outboundRecords)
      .groupBy(sql`SUBSTR(${outboundRecords.outboundDate}, 1, 7)`)
      .all();

    // 合并所有月份
    const monthMap = new Map<string, { cost: number; revenue: number; inboundQty: number; outboundQty: number }>();

    for (const row of monthlyCosts) {
      monthMap.set(row.month, { cost: row.totalCost, revenue: 0, inboundQty: row.totalQuantity, outboundQty: 0 });
    }
    for (const row of monthlyRevenues) {
      const existing = monthMap.get(row.month);
      if (existing) {
        existing.revenue = row.totalRevenue;
        existing.outboundQty = row.totalQuantity;
      } else {
        monthMap.set(row.month, { cost: 0, revenue: row.totalRevenue, inboundQty: 0, outboundQty: row.totalQuantity });
      }
    }

    // 按月份排序（倒序，最新的在前）
    const months = Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));

    return months.map(([month, data]) => ({
      month,
      inboundQuantity: data.inboundQty,
      outboundQuantity: data.outboundQty,
      totalPurchaseCost: data.cost,
      totalSalesRevenue: data.revenue,
      netProfit: data.revenue - data.cost,
    }));
  }
}
