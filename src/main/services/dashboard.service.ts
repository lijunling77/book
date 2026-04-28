/**
 * DashboardService - 仪表盘服务
 * 提供仪表盘首页概览数据
 */

import { sql, desc, eq } from 'drizzle-orm';
import { getDatabase } from '../db';
import { stock, inboundRecords, outboundRecords, books } from '../db/schema';
import type { DashboardData, RecentInboundItem, RecentOutboundItem } from '../../shared/types';

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

    // 最近5条入库记录
    const recentInboundRows = db
      .select({
        bookTitle: books.title,
        inboundDate: inboundRecords.inboundDate,
        quantity: inboundRecords.quantity,
        purchasePrice: inboundRecords.purchasePrice,
        location: inboundRecords.location,
      })
      .from(inboundRecords)
      .innerJoin(books, eq(inboundRecords.bookId, books.id))
      .orderBy(desc(inboundRecords.createdAt))
      .limit(5)
      .all();

    const recentInbound: RecentInboundItem[] = recentInboundRows.map((r) => ({
      bookTitle: r.bookTitle,
      inboundDate: r.inboundDate,
      quantity: r.quantity,
      purchasePrice: r.purchasePrice,
      location: r.location,
    }));

    // 最近5条出库记录
    const recentOutboundRows = db
      .select({
        bookTitle: books.title,
        outboundDate: outboundRecords.outboundDate,
        quantity: outboundRecords.quantity,
        sellingPrice: outboundRecords.sellingPrice,
        buyer: outboundRecords.buyer,
      })
      .from(outboundRecords)
      .innerJoin(books, eq(outboundRecords.bookId, books.id))
      .orderBy(desc(outboundRecords.createdAt))
      .limit(5)
      .all();

    const recentOutbound: RecentOutboundItem[] = recentOutboundRows.map((r) => ({
      bookTitle: r.bookTitle,
      outboundDate: r.outboundDate,
      quantity: r.quantity,
      sellingPrice: r.sellingPrice,
      buyer: r.buyer,
    }));

    return {
      totalStockQuantity,
      todayInboundQuantity: todayInboundResult?.totalQuantity ?? 0,
      todayInboundAmount: todayInboundResult?.totalAmount ?? 0,
      todayOutboundQuantity: todayOutboundResult?.totalQuantity ?? 0,
      todayOutboundAmount: todayOutboundResult?.totalAmount ?? 0,
      monthlyProfit: (monthlyOutboundRevenueResult?.totalRevenue ?? 0) - (monthlyInboundCostResult?.totalCost ?? 0),
      recentInbound,
      recentOutbound,
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
