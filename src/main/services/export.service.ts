/**
 * ExportService - 数据导出服务
 * 使用 xlsx (SheetJS) 库实现导出功能
 * 支持导出入库记录、出库记录、库存信息和利润统计
 * 支持 Excel (.xlsx) 和 CSV (.csv) 格式
 */

import * as XLSX from 'xlsx';
import { eq, and, like, gte, lte, sql } from 'drizzle-orm';
import { getDatabase } from '../db';
import {
  inboundRecords,
  outboundRecords,
  stock,
  books,
  editions,
  locations,
} from '../db/schema';
import { ERROR_MESSAGES } from '../../shared/constants';
import type {
  InboundFilter,
  OutboundFilter,
  StockFilter,
  ProfitFilter,
  ExportFormat,
} from '../../shared/types';
import { ProfitService } from './profit.service';

const profitService = new ProfitService();

/**
 * 将数据数组转换为文件 Buffer
 */
function toBuffer(data: Record<string, unknown>[], format: ExportFormat): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  if (format === 'csv') {
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    return Buffer.from(csvContent, 'utf-8');
  }

  const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(xlsxBuffer);
}

export class ExportService {
  /**
   * 导出入库记录
   * 支持按书籍、版本、日期范围、位置、供应商筛选
   *
   * @param filter 筛选条件
   * @param format 导出格式 ('xlsx' | 'csv')
   * @returns 文件 Buffer
   * @throws Error 无数据时
   */
  exportInbound(filter: InboundFilter | undefined, format: ExportFormat): Buffer {
    const db = getDatabase();

    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookId) {
      conditions.push(eq(inboundRecords.bookId, filter.bookId));
    }
    if (filter?.editionId) {
      conditions.push(eq(inboundRecords.editionId, filter.editionId));
    }
    if (filter?.locationId) {
      conditions.push(eq(inboundRecords.locationId, filter.locationId));
    }
    if (filter?.dateRange?.startDate) {
      conditions.push(gte(inboundRecords.inboundDate, filter.dateRange.startDate));
    }
    if (filter?.dateRange?.endDate) {
      conditions.push(lte(inboundRecords.inboundDate, filter.dateRange.endDate));
    }
    if (filter?.supplier) {
      conditions.push(like(inboundRecords.supplier, `%${filter.supplier}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
      .select({
        书名: books.title,
        作者: books.author,
        ISBN: books.isbn,
        版本: editions.name,
        仓库: locations.warehouse,
        书架: locations.shelf,
        层号: locations.layer,
        入库日期: inboundRecords.inboundDate,
        数量: inboundRecords.quantity,
        买入价格: inboundRecords.purchasePrice,
        供应商: inboundRecords.supplier,
        创建时间: inboundRecords.createdAt,
      })
      .from(inboundRecords)
      .innerJoin(books, eq(inboundRecords.bookId, books.id))
      .innerJoin(editions, eq(inboundRecords.editionId, editions.id))
      .innerJoin(locations, eq(inboundRecords.locationId, locations.id));

    if (whereClause) {
      query.where(whereClause);
    }

    const rows = query
      .orderBy(sql`${inboundRecords.inboundDate} DESC`)
      .all();

    if (rows.length === 0) {
      throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    }

    return toBuffer(rows as Record<string, unknown>[], format);
  }

  /**
   * 导出出库记录
   * 支持按书籍、版本、日期范围、位置、买家筛选
   *
   * @param filter 筛选条件
   * @param format 导出格式 ('xlsx' | 'csv')
   * @returns 文件 Buffer
   * @throws Error 无数据时
   */
  exportOutbound(filter: OutboundFilter | undefined, format: ExportFormat): Buffer {
    const db = getDatabase();

    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookId) {
      conditions.push(eq(outboundRecords.bookId, filter.bookId));
    }
    if (filter?.editionId) {
      conditions.push(eq(outboundRecords.editionId, filter.editionId));
    }
    if (filter?.locationId) {
      conditions.push(eq(outboundRecords.locationId, filter.locationId));
    }
    if (filter?.dateRange?.startDate) {
      conditions.push(gte(outboundRecords.outboundDate, filter.dateRange.startDate));
    }
    if (filter?.dateRange?.endDate) {
      conditions.push(lte(outboundRecords.outboundDate, filter.dateRange.endDate));
    }
    if (filter?.buyer) {
      conditions.push(like(outboundRecords.buyer, `%${filter.buyer}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
      .select({
        书名: books.title,
        作者: books.author,
        ISBN: books.isbn,
        版本: editions.name,
        仓库: locations.warehouse,
        书架: locations.shelf,
        层号: locations.layer,
        出库日期: outboundRecords.outboundDate,
        数量: outboundRecords.quantity,
        售出价格: outboundRecords.sellingPrice,
        买家: outboundRecords.buyer,
        创建时间: outboundRecords.createdAt,
      })
      .from(outboundRecords)
      .innerJoin(books, eq(outboundRecords.bookId, books.id))
      .innerJoin(editions, eq(outboundRecords.editionId, editions.id))
      .innerJoin(locations, eq(outboundRecords.locationId, locations.id));

    if (whereClause) {
      query.where(whereClause);
    }

    const rows = query
      .orderBy(sql`${outboundRecords.outboundDate} DESC`)
      .all();

    if (rows.length === 0) {
      throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    }

    return toBuffer(rows as Record<string, unknown>[], format);
  }

  /**
   * 导出库存信息
   * 支持按书名、分类、版本名称、位置筛选
   *
   * @param filter 筛选条件
   * @param format 导出格式 ('xlsx' | 'csv')
   * @returns 文件 Buffer
   * @throws Error 无数据时
   */
  exportStock(filter: StockFilter | undefined, format: ExportFormat): Buffer {
    const db = getDatabase();

    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookTitle) {
      conditions.push(like(books.title, `%${filter.bookTitle}%`));
    }
    if (filter?.category) {
      conditions.push(like(books.category, `%${filter.category}%`));
    }
    if (filter?.editionName) {
      conditions.push(like(editions.name, `%${filter.editionName}%`));
    }
    if (filter?.locationId) {
      conditions.push(eq(stock.locationId, filter.locationId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
      .select({
        书名: books.title,
        作者: books.author,
        ISBN: books.isbn,
        分类: books.category,
        版本: editions.name,
        仓库: locations.warehouse,
        书架: locations.shelf,
        层号: locations.layer,
        库存数量: stock.quantity,
      })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id))
      .innerJoin(editions, eq(stock.editionId, editions.id))
      .innerJoin(locations, eq(stock.locationId, locations.id));

    if (whereClause) {
      query.where(whereClause);
    }

    const rows = query.all();

    if (rows.length === 0) {
      throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    }

    return toBuffer(rows as Record<string, unknown>[], format);
  }

  /**
   * 导出利润统计
   * 支持按分类、日期范围筛选
   * 按分类汇总利润数据
   *
   * @param filter 筛选条件
   * @param format 导出格式 ('xlsx' | 'csv')
   * @returns 文件 Buffer
   * @throws Error 无数据时
   */
  exportProfit(filter: ProfitFilter | undefined, format: ExportFormat): Buffer {
    const db = getDatabase();

    // 获取所有分类（或指定分类）
    let categories: string[];
    if (filter?.category) {
      categories = [filter.category];
    } else {
      const categoryRows = db
        .select({ category: books.category })
        .from(books)
        .groupBy(books.category)
        .all();
      categories = categoryRows.map((r) => r.category);
    }

    if (categories.length === 0) {
      throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    }

    const data: Record<string, unknown>[] = [];

    for (const category of categories) {
      const profit = profitService.calculateByCategory(category, filter?.dateRange);
      // 只有有数据的分类才导出
      if (profit.totalPurchaseCost !== 0 || profit.totalSalesRevenue !== 0) {
        data.push({
          分类: category,
          总采购成本: profit.totalPurchaseCost,
          总销售收入: profit.totalSalesRevenue,
          净利润: profit.netProfit,
        });
      }
    }

    if (data.length === 0) {
      throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    }

    return toBuffer(data, format);
  }
}
