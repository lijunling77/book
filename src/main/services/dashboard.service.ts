/**
 * DashboardService - 仪表盘服务
 * 提供仪表盘首页概览数据，包括总库存量、预警数量、今日入库/出库统计、本月利润和预警列表
 */

import { sql } from 'drizzle-orm';
import { getDatabase } from '../db';
import {
  stock,
  inboundRecords,
  outboundRecords,
} from '../db/schema';
import { AlertService } from './alert.service';
import type { DashboardData } from '../../shared/types';

export class DashboardService {
  private alertService: AlertService;

  constructor(alertService?: AlertService) {
    this.alertService = alertService ?? new AlertService();
  }

  /**
   * 获取仪表盘数据
   * - 总库存量 = SUM(stock.quantity)
   * - 预警库存单元数量 = alertList.length
   * - 今日入库数量 = SUM(inbound_records.quantity) WHERE inbound_date = today
   * - 今日入库金额 = SUM(inbound_records.quantity * inbound_records.purchase_price) WHERE inbound_date = today
   * - 今日出库数量 = SUM(outbound_records.quantity) WHERE outbound_date = today
   * - 今日出库金额 = SUM(outbound_records.quantity * outbound_records.selling_price) WHERE outbound_date = today
   * - 本月利润 = 本月出库总收入 - 本月入库总成本
   * - 预警列表 = AlertService.getAlertList()
   */
  getData(): DashboardData {
    const db = getDatabase();

    // 获取今天的日期字符串 (YYYY-MM-DD)
    const now = new Date();
    const today = this.formatDate(now);
    // 获取本月的起止日期
    const monthStart = this.getMonthStart(now);
    const monthEnd = this.getMonthEnd(now);

    // 1. 总库存量
    const totalStockResult = db
      .select({
        total: sql<number>`COALESCE(SUM(${stock.quantity}), 0)`,
      })
      .from(stock)
      .get();
    const totalStockQuantity = totalStockResult?.total ?? 0;

    // 2. 预警库存单元列表
    const alertStockUnits = this.alertService.getAlertList();
    const alertStockUnitCount = alertStockUnits.length;

    // 3. 今日入库数量和金额
    const todayInboundResult = db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${inboundRecords.quantity}), 0)`,
        totalAmount: sql<number>`COALESCE(SUM(${inboundRecords.quantity} * ${inboundRecords.purchasePrice}), 0)`,
      })
      .from(inboundRecords)
      .where(sql`${inboundRecords.inboundDate} = ${today}`)
      .get();
    const todayInboundQuantity = todayInboundResult?.totalQuantity ?? 0;
    const todayInboundAmount = todayInboundResult?.totalAmount ?? 0;

    // 4. 今日出库数量和金额
    const todayOutboundResult = db
      .select({
        totalQuantity: sql<number>`COALESCE(SUM(${outboundRecords.quantity}), 0)`,
        totalAmount: sql<number>`COALESCE(SUM(${outboundRecords.quantity} * ${outboundRecords.sellingPrice}), 0)`,
      })
      .from(outboundRecords)
      .where(sql`${outboundRecords.outboundDate} = ${today}`)
      .get();
    const todayOutboundQuantity = todayOutboundResult?.totalQuantity ?? 0;
    const todayOutboundAmount = todayOutboundResult?.totalAmount ?? 0;

    // 5. 本月利润 = 本月出库总收入 - 本月入库总成本
    const monthlyInboundCostResult = db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${inboundRecords.quantity} * ${inboundRecords.purchasePrice}), 0)`,
      })
      .from(inboundRecords)
      .where(
        sql`${inboundRecords.inboundDate} >= ${monthStart} AND ${inboundRecords.inboundDate} <= ${monthEnd}`,
      )
      .get();
    const monthlyInboundCost = monthlyInboundCostResult?.totalCost ?? 0;

    const monthlyOutboundRevenueResult = db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${outboundRecords.quantity} * ${outboundRecords.sellingPrice}), 0)`,
      })
      .from(outboundRecords)
      .where(
        sql`${outboundRecords.outboundDate} >= ${monthStart} AND ${outboundRecords.outboundDate} <= ${monthEnd}`,
      )
      .get();
    const monthlyOutboundRevenue = monthlyOutboundRevenueResult?.totalRevenue ?? 0;

    const monthlyProfit = monthlyOutboundRevenue - monthlyInboundCost;

    return {
      totalStockQuantity,
      alertStockUnitCount,
      todayInboundQuantity,
      todayInboundAmount,
      todayOutboundQuantity,
      todayOutboundAmount,
      monthlyProfit,
      alertStockUnits,
    };
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取月份的第一天 YYYY-MM-01
   */
  private getMonthStart(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  /**
   * 获取月份的最后一天 YYYY-MM-DD
   */
  private getMonthEnd(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    // 下个月的第0天就是本月最后一天
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    return `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  }
}
