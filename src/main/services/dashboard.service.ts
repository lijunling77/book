/**
 * DashboardService - 仪表盘服务
 * 提供仪表盘首页概览数据
 */

import { sql } from 'drizzle-orm';
import { getDatabase } from '../db';
import { stock, inboundRecords, outboundRecords } from '../db/schema';
import type { DashboardData } from '../../shared/types';

export class DashboardService {
  getData(): DashboardData {
    const db = getDatabase();

    const now = new Date();
    const today = this.formatDate(now);
    const monthStart = this.getMonthStart(now);
    const monthEnd = this.getMonthEnd(now);

    const totalStockResult = db
      .select({ total: sql<number>`COALESCE(SUM(${stock.quantity}), 0)` })
      .from(stock)
      .get();
    const totalStockQuantity = totalStockResult?.total ?? 0;

    const todayInboundResult = db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${inboundRecords.quantity}), 0)`,
        totalAmount: sql<number>`COALESCE(SUM(${inboundRecords.quantity} * ${inboundRecords.purchasePrice}), 0)`,
      })
      .from(inboundRecords)
      .where(sql`${inboundRecords.inboundDate} = ${today}`)
      .get();

    const todayOutboundResult = db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${outboundRecords.quantity}), 0)`,
        totalAmount: sql<number>`COALESCE(SUM(${outboundRecords.quantity} * ${outboundRecords.sellingPrice}), 0)`,
      })
      .from(outboundRecords)
      .where(sql`${outboundRecords.outboundDate} = ${today}`)
      .get();

    const monthlyInboundCostResult = db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${inboundRecords.quantity} * ${inboundRecords.purchasePrice}), 0)`,
      })
      .from(inboundRecords)
      .where(sql`${inboundRecords.inboundDate} >= ${monthStart} AND ${inboundRecords.inboundDate} <= ${monthEnd}`)
      .get();

    const monthlyOutboundRevenueResult = db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${outboundRecords.quantity} * ${outboundRecords.sellingPrice}), 0)`,
      })
      .from(outboundRecords)
      .where(sql`${outboundRecords.outboundDate} >= ${monthStart} AND ${outboundRecords.outboundDate} <= ${monthEnd}`)
      .get();

    return {
      totalStockQuantity,
      todayInboundQuantity: todayInboundResult?.totalQuantity ?? 0,
      todayInboundAmount: todayInboundResult?.totalAmount ?? 0,
      todayOutboundQuantity: todayOutboundResult?.totalQuantity ?? 0,
      todayOutboundAmount: todayOutboundResult?.totalAmount ?? 0,
      monthlyProfit: (monthlyOutboundRevenueResult?.totalRevenue ?? 0) - (monthlyInboundCostResult?.totalCost ?? 0),
    };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getMonthStart(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  private getMonthEnd(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    return `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  }
}
