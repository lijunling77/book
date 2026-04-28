/**
 * ProfitService - 利润统计服务
 * 提供书籍级别的利润计算功能
 */

import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { getDatabase } from '../db';
import { inboundRecords, outboundRecords } from '../db/schema';
import type { ProfitDetail, DateRange } from '../../shared/types';

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
}
