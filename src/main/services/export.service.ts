/**
 * ExportService - 数据导出服务
 */

import * as XLSX from 'xlsx';
import { eq, and, like, gte, lte, sql } from 'drizzle-orm';
import { getDatabase } from '../db';
import {
  inboundRecords,
  outboundRecords,
  stock,
  books,
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
  exportInbound(filter: InboundFilter | undefined, format: ExportFormat): Buffer {
    const db = getDatabase();
    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookId) conditions.push(eq(inboundRecords.bookId, filter.bookId));
    if (filter?.locationId) conditions.push(eq(inboundRecords.locationId, filter.locationId));
    if (filter?.dateRange?.startDate) conditions.push(gte(inboundRecords.inboundDate, filter.dateRange.startDate));
    if (filter?.dateRange?.endDate) conditions.push(lte(inboundRecords.inboundDate, filter.dateRange.endDate));
    if (filter?.supplier) conditions.push(like(inboundRecords.supplier, `%${filter.supplier}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
      .select({
        书名: books.title,
        作者: books.author,
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
      .innerJoin(locations, eq(inboundRecords.locationId, locations.id));

    if (whereClause) query.where(whereClause);

    const rows = query.orderBy(sql`${inboundRecords.inboundDate} DESC`).all();
    if (rows.length === 0) throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    return toBuffer(rows as Record<string, unknown>[], format);
  }

  exportOutbound(filter: OutboundFilter | undefined, format: ExportFormat): Buffer {
    const db = getDatabase();
    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookId) conditions.push(eq(outboundRecords.bookId, filter.bookId));
    if (filter?.locationId) conditions.push(eq(outboundRecords.locationId, filter.locationId));
    if (filter?.dateRange?.startDate) conditions.push(gte(outboundRecords.outboundDate, filter.dateRange.startDate));
    if (filter?.dateRange?.endDate) conditions.push(lte(outboundRecords.outboundDate, filter.dateRange.endDate));
    if (filter?.buyer) conditions.push(like(outboundRecords.buyer, `%${filter.buyer}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
      .select({
        书名: books.title,
        作者: books.author,
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
      .innerJoin(locations, eq(outboundRecords.locationId, locations.id));

    if (whereClause) query.where(whereClause);

    const rows = query.orderBy(sql`${outboundRecords.outboundDate} DESC`).all();
    if (rows.length === 0) throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    return toBuffer(rows as Record<string, unknown>[], format);
  }

  exportStock(filter: StockFilter | undefined, format: ExportFormat): Buffer {
    const db = getDatabase();
    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookTitle) conditions.push(like(books.title, `%${filter.bookTitle}%`));
    if (filter?.locationId) conditions.push(eq(stock.locationId, filter.locationId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
      .select({
        书名: books.title,
        作者: books.author,
        仓库: locations.warehouse,
        书架: locations.shelf,
        层号: locations.layer,
        库存数量: stock.quantity,
      })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id))
      .innerJoin(locations, eq(stock.locationId, locations.id));

    if (whereClause) query.where(whereClause);

    const rows = query.all();
    if (rows.length === 0) throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    return toBuffer(rows as Record<string, unknown>[], format);
  }

  exportProfit(filter: ProfitFilter | undefined, format: ExportFormat): Buffer {
    const db = getDatabase();

    // Get all books that have any inbound or outbound records
    const bookRows = db.select({ id: books.id, title: books.title }).from(books).all();

    if (bookRows.length === 0) throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);

    const data: Record<string, unknown>[] = [];

    for (const book of bookRows) {
      const profit = profitService.calculateByBook(book.id, filter?.dateRange);
      if (profit.totalPurchaseCost !== 0 || profit.totalSalesRevenue !== 0) {
        data.push({
          书名: book.title,
          总采购成本: profit.totalPurchaseCost,
          总销售收入: profit.totalSalesRevenue,
          净利润: profit.netProfit,
        });
      }
    }

    if (data.length === 0) throw new Error(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    return toBuffer(data, format);
  }
}
